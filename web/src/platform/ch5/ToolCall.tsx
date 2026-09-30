import { Fragment, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { anim, dl, drawIn, hideAll, tween, wait } from '../shared/anim';
import { DeepDive, XPanel, useDeepDive, useTour, type DDStep } from '../shared/DeepDive';
import { linesHtml } from '../shared/lines';

// Deep dive: an agent asks the knowledge layer about Maya's chargeback. The tools it sees, the
// messages on the wire under the 2026-07-28 MCP spec, the checks at the gateway, and A2A.

const STEPS: DDStep[] = [
  { t: 'The toolbox', k: ['An MCP server lists its tools', 'Each has a name, a description, an input schema and now an output schema', 'The agent picks tools by reading the descriptions'] },
  { t: 'One call', k: ['Since the 2026-07-28 spec each call stands alone: no session, no handshake', 'Headers name the method and tool, so the gateway can route and check it', 'Results carry structured content as well as text'] },
  { t: 'A chain', k: ['Agents chain small tools instead of one big query', 'Without sessions, each call passes the IDs it needs', 'Every call is logged for audit'] },
  { t: 'Guardrails', k: ['AgentCore Policy checks every call at the gateway', 'Default deny: only what a rule allows gets through', 'The IAM role can only read, even if everything else fails'] },
  { t: 'Agent to agent', k: ['MCP connects an agent to tools', 'A2A connects an agent to another agent', 'Both now sit under the Linux Foundation’s Agentic AI Foundation'] },
];

const TOOLS: [string, string][] = [
  ['search_entities', 'Find entities by name, code or meaning. Returns Neptune IDs.'],
  ['expand_subgraph', 'Return the neighbourhood of an ID, a few hops deep.'],
  ['run_validated_cypher', 'Run a read-only query, checked against the ontology.'],
  ['get_ontology_class', 'Look up a class definition and its allowed relationships.'],
];
const J = (a: string[]) => a.join('\n');
const DEF = J([
  '{',
  '  "name": "search_entities",',
  '  "description": "Find payment entities by name, code or meaning. Returns Neptune IDs.",',
  '  "inputSchema": {',
  '    "type": "object",',
  '    "properties": {',
  '      "query":  { "type": "string" },',
  '      "labels": { "type": "array", "items": { "type": "string" } },',
  '      "limit":  { "type": "integer", "default": 10 }',
  '    },',
  '    "required": ["query"]',
  '  },',
  '  "outputSchema": {',
  '    "type": "object",',
  '    "properties": {',
  '      "hits": { "type": "array" }',
  '    }',
  '  }',
  '}',
]);
const TOUR: [number, number, string][] = [
  [1, 1, 'The name the agent will call.'],
  [2, 2, 'The description: the agent reads this to decide when the tool fits.'],
  [3, 11, 'The input schema: which arguments are allowed, and their types.'],
  [12, 17, 'New in the 2026 spec: an output schema, so results can come back as structured data.'],
];
const REQ = J([
  'POST /mcp HTTP/1.1',
  'MCP-Protocol-Version: 2026-07-28',
  'Mcp-Method: tools/call',
  'Mcp-Name: search_entities',
  'Authorization: Bearer <token>',
  '',
  '{ "jsonrpc": "2.0", "id": 7, "method": "tools/call",',
  '  "params": { "name": "search_entities",',
  '    "arguments": { "query": "Harbor Grill", "labels": ["Merchant"] },',
  '    "_meta": { "io.modelcontextprotocol/clientInfo":',
  '               { "name": "disputes-agent", "version": "1.4" } } } }',
]);
const RES = J([
  '{ "jsonrpc": "2.0", "id": 7,',
  '  "result": { "resultType": "complete", "isError": false,',
  '    "content": [ { "type": "text", "text": "m:88213  Harbor Grill #4" } ],',
  '    "structuredContent": {',
  '      "hits": [ { "neptune_id": "m:88213", "labels": ["Merchant"] } ] } } }',
]);
const ERR = J([
  '{ "jsonrpc": "2.0", "id": 12,',
  '  "result": { "resultType": "complete", "isError": true,',
  '    "content": [ { "type": "text",',
  '      "text": "Denied by policy: writes are not allowed." } ] } }',
]);
const POL = J([
  '// Default deny: nothing runs unless a rule allows it',
  'permit (',
  '  principal in Group::"dispute-analysts",',
  '  action in [Action::"search_entities", Action::"expand_subgraph",',
  '             Action::"run_validated_cypher"],',
  '  resource',
  ');',
  '// Forbid wins over permit',
  'forbid (principal, action == Action::"run_validated_cypher", resource)',
  '  when { context.input.cypher like "*DELETE*" };',
]);
const CARD = J([
  '{',
  '  "name": "Disputes agent",',
  '  "description": "Explains chargebacks and dispute history for a merchant or card.",',
  '  "url": "https://agents.example.com/disputes",',
  '  "version": "1.2.0",',
  '  "skills": [',
  '    { "id": "explain_chargeback", "name": "Explain a chargeback" },',
  '    { "id": "merchant_dispute_history", "name": "Merchant dispute history" }',
  '  ]',
  '}',
]);
const CHAIN: [string, string, string][] = [
  ['search_entities', '{ "query": "Harbor Grill chargeback Aug 19", "labels": ["Chargeback"] }', 'cb:1001'],
  ['expand_subgraph', '{ "id": "cb:1001", "hops": 2 }', 'cap:7731, auth:5521, m:88213, rc:visa:10.4'],
  ['run_validated_cypher', '{ "template": "chargebacks_by_reason", "params": { "merchant": "m:88213", "reason": "rc:visa:10.4" } }', '41 this month'],
];
// Step 4: what each layer does with call 1 and call 2. Faded: never reached, but it would refuse too.
type Mark = 'ok' | 'no' | 'fade' | null;
const GUARD: { a: Mark; b: Mark }[] = [{ a: 'ok', b: 'ok' }, { a: 'ok', b: 'no' }, { a: 'ok', b: 'fade' }, { a: 'ok', b: 'fade' }];
const LAYERS: [string, string][] = [
  ['Gateway:', 'who is asking? The caller’s token is checked'],
  ['AgentCore Policy:', 'is this call allowed? Default deny, forbid wins'],
  ['Our validator:', 'valid for the ontology, read-only, bounded?'],
  ['IAM role:', 'Neptune access is read-only'],
];
const TASK = ['submitted', 'working', 'completed'] as const;
const SVG = 'http://www.w3.org/2000/svg';

/** A dot travelling along a path, forwards or back. */
function move(layer: SVGGElement, p: SVGGeometryElement, reverse: boolean, dur: number) {
  const len = p.getTotalLength();
  const g = document.createElementNS(SVG, 'g'), c = document.createElementNS(SVG, 'circle');
  c.setAttribute('r', '6'); c.style.fill = 'var(--onto)'; g.appendChild(c); layer.appendChild(g);
  return tween({ duration: dur || 0.7, ease: [0.45, 0, 0.2, 1], onUpdate: (v) => { const pt = p.getPointAtLength((reverse ? 1 - v : v) * len); g.setAttribute('transform', 'translate(' + pt.x + ',' + pt.y + ')'); } }).then(() => g.remove());
}

export function ToolCall() {
  const api = useDeepDive();
  const tour = useTour(api, TOUR);
  const html = useMemo(() => ({
    def: linesHtml(DEF, 'json'), req: linesHtml(REQ, 'mcphttp'), res: linesHtml(RES, 'json'),
    err: linesHtml(ERR, 'json'), pol: linesHtml(POL, 'cedar'), card: linesHtml(CARD, 'json'),
  }), []);
  const q = (sel: string) => api.root!.querySelector<HTMLElement>(sel)!;
  const qa = (sel: string) => api.root!.querySelectorAll<HTMLElement>(sel);

  // ---------- Step 2: one call on the wire ----------
  const [wire, setWire] = useState<'req' | 'res'>('req');
  const seqRun = useRef(0), seqPk = useRef<SVGGElement>(null);
  const seq = async () => {
    const my = ++seqRun.current, msgs = qa('#x5seq .msg'), labs = qa('#x5seq .mlab');
    hideAll(msgs); hideAll(labs); seqPk.current!.replaceChildren();
    setWire('req'); anim(q('#x5json'), { opacity: [0, 1] }, { duration: 0.3 });
    for (let i = 0; i < msgs.length; i++) {
      if (my !== seqRun.current) return;
      if (i === msgs.length - 1) { flushSync(() => setWire('res')); anim(q('#x5json'), { opacity: [0, 1] }, { duration: 0.3 }); }
      msgs[i].style.opacity = '1'; drawIn([msgs[i]], 0); anim(labs[i], { opacity: [0, 1] }, { duration: 0.3 });
      await move(seqPk.current!, msgs[i] as unknown as SVGGeometryElement, false, 0.6);
      await wait(260);
    }
  };

  // ---------- Step 3: a chain of small calls ----------
  const chainRun = async () => {
    const calls = qa('#x5chain .ccall'), ans = q('#x5ans');
    hideAll(calls); ans.style.opacity = '0';
    for (let i = 0; i < calls.length; i++) {
      if (api.cur !== 3) return;
      await anim(calls[i], { opacity: [0, 1], x: [-12, 0] }, { duration: 0.35 });
      anim(calls[i].querySelector('.cres'), { opacity: [0, 1] }, { duration: 0.3, delay: 0.4 });
      await wait(900);
    }
    anim(ans, { opacity: [0, 1], y: [10, 0] }, { duration: 0.4 });
  };

  // ---------- Step 4: the layers every call passes through ----------
  const [marks, setMarks] = useState<{ a: Mark; b: Mark }[]>(GUARD.map(() => ({ a: null, b: null })));
  const [polOpen, setPolOpen] = useState(false);
  const gRun = useRef(0);
  const guard = async () => {
    const my = ++gRun.current;
    setMarks(GUARD.map(() => ({ a: null, b: null })));
    const eb = q('#x5errbox'); eb.style.opacity = '0';
    const rows = qa('#x5g .rrow:not(.rh)');
    for (let r = 0; r < rows.length; r++) {
      if (my !== gRun.current) return;
      anim(rows[r], { backgroundColor: ['rgba(175,169,236,0.25)', 'rgba(175,169,236,0)'] }, { duration: 0.8 });
      for (const c of ['a', 'b'] as const) {
        await wait(260); if (my !== gRun.current) return;
        flushSync(() => setMarks((m) => m.map((x, k) => (k === r ? { ...x, [c]: GUARD[r][c] } : x))));
        anim(q(`#x5g .mk[data-r="${r}"][data-c="${c}"]`), { scale: [0.3, 1] }, { duration: 0.25 });
      }
    }
    anim(eb, { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, delay: 0.2 });
  };
  const togglePolicy = () => {
    const open = !polOpen;
    flushSync(() => setPolOpen(open));
    if (open) anim(q('#x5polBox'), { opacity: [0, 1], y: [6, 0] }, { duration: 0.3 });
  };
  const mark = (r: number, c: 'a' | 'b') => {
    const m = marks[r][c];
    return <span className={'mk' + (m === 'ok' ? ' ok' : m === 'no' ? ' no' : m === 'fade' ? ' no fade' : '')} data-r={r} data-c={c}
      title={m === 'fade' ? 'Never reached, but it would refuse the call too' : undefined}>{m === 'ok' ? '✓' : m ? '✕' : ''}</span>;
  };

  // ---------- Step 5: an A2A task ----------
  const [task, setTask] = useState<string>('');
  const aRun = useRef(0), aPk = useRef<SVGGElement>(null);
  const a2a = async () => {
    const my = ++aRun.current, layer = aPk.current!;
    const A = q('#a2aA') as unknown as SVGGeometryElement, B = q('#a2aB') as unknown as SVGGeometryElement;
    const state = (s: string) => { flushSync(() => setTask(s)); anim(q(`#x5ts [data-s="${s}"]`), { scale: [0.85, 1] }, { duration: 0.3 }); };
    layer.replaceChildren(); setTask('');
    anim(qa('#x5a2a .a2n'), { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, delay: dl(0, 0.12) });
    await wait(600); if (my !== aRun.current) return;
    state('submitted'); await move(layer, A, false, 0.8); if (my !== aRun.current) return;
    state('working');
    for (let i = 0; i < 2; i++) {
      await move(layer, B, false, 0.5); if (my !== aRun.current) return;
      await move(layer, B, true, 0.5); if (my !== aRun.current) return;
    }
    await move(layer, A, true, 0.8); if (my !== aRun.current) return;
    state('completed');
  };

  const run = {
    1: () => { anim(qa('#x5tools .tcard'), { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, delay: dl(0, 0.08) }); tour.play(); },
    2: () => { seq(); },
    3: () => { chainRun(); },
    4: () => { guard(); },
    5: () => { a2a(); },
  };

  return (
    <DeepDive api={api} id="dd5" title="Deep dive: an agent's tool call" steps={STEPS} run={run}
      intro="What happens when an agent asks the knowledge layer about Maya's chargeback: the tools it sees, the messages on the wire under the 2026-07-28 MCP spec, the checks at the gateway, and how one agent hands work to another."
      next={{ href: '#usersh', label: 'Next: four ways in' }}>
      <XPanel n={1}>
        <div className="toolcards" id="x5tools">{TOOLS.map(([name, what], i) => <div key={name} className={'tcard' + (i === 0 ? ' on' : '')}><code>{name}</code><span>{what}</span></div>)}</div>
        <div className="ddcode" id="x5box" ref={tour.box}><div className="ddband"></div><pre id="x5def" dangerouslySetInnerHTML={{ __html: html.def }} /></div>
        <p className="reading" id="x5cap" ref={tour.capEl}>{tour.cap}</p>
      </XPanel>
      <XPanel n={2}>
        <div className="xwrap"><svg id="x5seq" className="xsvg" viewBox="0 0 760 300" role="img" aria-label="Sequence: the agent calls a tool through AgentCore Gateway, which checks policy and forwards the call to the retrieval service; the service queries OpenSearch and a structured result returns">
          <g><rect className="evbox" x="20" y="10" width="140" height="46" rx="10" /><text className="evt" x="90" y="38" textAnchor="middle">Agent</text></g>
          <g><rect className="evbox" x="200" y="10" width="180" height="46" rx="10" /><rect x="208" y="20" width="3" height="26" rx="1.5" style={{ fill: 'var(--onto)' }} /><text className="evt" x="296" y="30" textAnchor="middle">AgentCore Gateway</text><text className="evs" x="296" y="47" textAnchor="middle">identity and policy</text></g>
          <g><rect className="evbox" x="410" y="10" width="160" height="46" rx="10" /><rect x="418" y="20" width="3" height="26" rx="1.5" style={{ fill: 'var(--query)' }} /><text className="evt" x="496" y="30" textAnchor="middle">Retrieval service</text><text className="evs" x="496" y="47" textAnchor="middle">MCP tools</text></g>
          <g><rect className="evbox" x="600" y="10" width="140" height="46" rx="10" /><rect x="608" y="20" width="3" height="26" rx="1.5" style={{ fill: 'var(--search)' }} /><text className="evt" x="676" y="38" textAnchor="middle">OpenSearch</text></g>
          <path className="life" d="M90,56 L90,290" /><path className="life" d="M290,56 L290,290" /><path className="life" d="M490,56 L490,290" /><path className="life" d="M670,56 L670,290" />
          <path className="msg" d="M90,88 L288,88" markerEnd="url(#mg-onto)" />
          <path className="msg" d="M290,120 L488,120" markerEnd="url(#mg-onto)" />
          <path className="msg" d="M490,152 L668,152" markerEnd="url(#mg-onto)" />
          <path className="msg ret" d="M670,184 L492,184" markerEnd="url(#mg-onto)" />
          <path className="msg ret" d="M490,216 L292,216" markerEnd="url(#mg-onto)" />
          <path className="msg ret" d="M290,248 L92,248" markerEnd="url(#mg-onto)" />
          <text className="rl mlab" x="190" y="80" textAnchor="middle">tools/call search_entities</text>
          <text className="rl mlab" x="390" y="112" textAnchor="middle">policy allows it</text>
          <text className="rl mlab" x="580" y="144" textAnchor="middle">hybrid query</text>
          <text className="rl mlab" x="580" y="176" textAnchor="middle">hits with neptune_id</text>
          <text className="rl mlab" x="390" y="208" textAnchor="middle">structured result</text>
          <text className="rl mlab" x="190" y="240" textAnchor="middle">result: m:88213</text>
          <g id="x5pk" ref={seqPk}></g>
        </svg></div>
        <p className="vcap" id="x5jl" style={{ marginTop: '10px' }}>{wire === 'req' ? 'The request, under the 2026-07-28 spec' : 'The response: text plus structured content'}</p>
        <div className="ddcode"><pre id="x5json" dangerouslySetInnerHTML={{ __html: wire === 'req' ? html.req : html.res }} /></div>
        <div className="vbtns" style={{ marginTop: '12px' }}><button type="button" className="vbtn go" id="x5again" onClick={seq}>Send it again</button></div>
      </XPanel>
      <XPanel n={3}>
        <p className="vcap">The question: “Why was Maya’s Harbor Grill order charged back, and is it a pattern?”</p>
        <div className="callchain" id="x5chain">
          {CHAIN.map(([name, args, ret], i) => <div key={name} className="ccall"><span className="cn2">{i + 1}</span><div><code className="cname">{name}</code><pre className="cargs">{args}</pre><div className="cres">returns <code>{ret}</code></div></div></div>)}
        </div>
        <div className="answer" id="x5ans"><span className="vcap">The agent’s answer</span><p>Maya’s order was charged back as 10.4, card-absent fraud. It isn’t a one-off: Harbor Grill has 41 chargebacks with that reason code this month. <code>[cb:1001]</code> <code>[cypher run q-7f3a]</code></p></div>
      </XPanel>
      <XPanel n={4}>
        <div className="rules" id="x5g">
          <div className="rrow rh"><span>Layers every tool call passes through</span><span>call 1</span><span>call 2</span></div>
          {LAYERS.map(([b, text], r) => <div key={b} className="rrow"><span><b>{b}</b> {text}</span>{mark(r, 'a')}{mark(r, 'b')}</div>)}
        </div>
        <div className="calls2"><div><span className="vcap">Call 1</span><code>run_validated_cypher</code> counts 10.4 chargebacks</div><div><span className="vcap">Call 2</span><code>run_validated_cypher</code> <code>MATCH (n) DETACH DELETE n</code></div></div>
        <div className="ddcode report" id="x5errbox"><pre id="x5err" dangerouslySetInnerHTML={{ __html: html.err }} /></div>
        <div className="vbtns" style={{ marginTop: '12px' }}><button type="button" className="vbtn go" id="x5check" onClick={guard}>Run the checks</button><button type="button" className="vbtn" id="x5polBtn" aria-expanded={polOpen} onClick={togglePolicy}>{polOpen ? 'Hide the policy' : 'Show the policy'}</button></div>
        <div className="ddcode" id="x5polBox" hidden={!polOpen}><pre id="x5pol" dangerouslySetInnerHTML={{ __html: html.pol }} /></div>
        <p className="note">Faded marks are layers call 2 never reaches, but each would refuse it too. The policy and error shown are illustrative; AgentCore Policy rules are Cedar and can also be written in plain language.</p>
      </XPanel>
      <XPanel n={5}>
        <div className="xwrap"><svg id="x5a2a" className="xsvg" viewBox="0 0 760 160" role="img" aria-label="A fraud agent from another team sends an A2A task to our disputes agent, which uses MCP tools on the knowledge layer and returns the result">
          <path id="a2aA" className="rel" d="M200,80 L289,80" markerEnd="url(#mg-onto)" />
          <path id="a2aB" className="rel" d="M470,80 L559,80" markerEnd="url(#mg-onto)" />
          <text className="rl" x="245" y="68" textAnchor="middle">A2A task</text>
          <text className="rl" x="515" y="68" textAnchor="middle">MCP tools</text>
          <g className="a2n"><rect className="evbox" x="20" y="50" width="180" height="60" rx="10" /><text className="evt" x="110" y="76" textAnchor="middle">Fraud agent</text><text className="evs" x="110" y="95" textAnchor="middle">another team</text></g>
          <g className="a2n"><rect className="evbox" x="290" y="50" width="180" height="60" rx="10" /><rect x="298" y="62" width="3" height="36" rx="1.5" style={{ fill: 'var(--query)' }} /><text className="evt" x="386" y="76" textAnchor="middle">Disputes agent</text><text className="evs" x="386" y="95" textAnchor="middle">ours</text></g>
          <g className="a2n"><rect className="evbox" x="560" y="50" width="180" height="60" rx="10" /><rect x="568" y="62" width="3" height="36" rx="1.5" style={{ fill: 'var(--graph)' }} /><text className="evt" x="656" y="76" textAnchor="middle">Knowledge layer</text><text className="evs" x="656" y="95" textAnchor="middle">via AgentCore Gateway</text></g>
          <g id="a2apk" ref={aPk}></g>
        </svg></div>
        <div className="tstates" id="x5ts"><span className="vcap">Task</span>
          {TASK.map((s, i) => <Fragment key={s}>{i > 0 && <span className="ar">→</span>}<span data-s={s} className={task === s ? 'on' : undefined}>{s}</span></Fragment>)}
        </div>
        <p className="vcap" style={{ marginTop: '12px' }}>The disputes agent’s agent card, which other agents read to discover it</p>
        <div className="ddcode"><pre id="x5card" dangerouslySetInnerHTML={{ __html: html.card }} /></div>
        <div className="vbtns" style={{ marginTop: '12px' }}><button type="button" className="vbtn go" id="x5a2aBtn" onClick={a2a}>Send the task again</button></div>
        <p className="note">Agent cards are published at /.well-known/agent-card.json. This card is illustrative.</p>
      </XPanel>
    </DeepDive>
  );
}
