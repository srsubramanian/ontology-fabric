import { inView } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { reduce } from '../../kit/motion';
import { rounded } from '../../kit/svg';
import { anim, tween } from '../shared/anim';
import { Block } from '../shared/Block';

// A continuous loop: signals become proposals, automated checks run, the diff picks a lane,
// and a release train ships it. Send a change through and watch its pull request.

type Pt = [number, number];
type LNode = { x: number; y: number; w: number; h: number; t: string; s: string; s2?: string; c: string; bar?: boolean };
const LN: Record<string, LNode> = {
  s0: { x: 20, y: 20, w: 160, h: 54, t: 'Code merged', s: 'Bitbucket webhook', c: 'var(--muted)' },
  s1: { x: 200, y: 20, w: 160, h: 54, t: 'Data won’t fit', s: 'SHACL violations', c: 'var(--muted)' },
  s2: { x: 380, y: 20, w: 160, h: 54, t: 'Failed questions', s: 'RAG query logs', c: 'var(--muted)' },
  s3: { x: 560, y: 20, w: 160, h: 54, t: 'Network bulletins', s: 'Visa, Mastercard', c: 'var(--muted)' },
  bot: { x: 20, y: 118, w: 700, h: 54, t: 'Proposal bot', s: 'Drafts a pull request with evidence', c: 'var(--query)', bar: true },
  chk: { x: 20, y: 216, w: 700, h: 54, t: 'Automated checks', s: 'SHACL, consistency, near duplicates, competency questions, impact', c: 'var(--query)', bar: true },
  auto: { x: 20, y: 334, w: 220, h: 74, t: 'Auto-merge', s: 'Patch: aliases, code values', s2: 'minutes', c: 'var(--query)', bar: true },
  owner: { x: 260, y: 334, w: 220, h: 74, t: 'Owner approves', s: 'Minor: new class or relationship', s2: 'about a day', c: 'var(--onto)', bar: true },
  board: { x: 500, y: 334, w: 220, h: 74, t: 'Change board', s: 'Major: rename, remove, split', s2: 'one release, with notice', c: 'var(--ink)', bar: true },
  rel: { x: 170, y: 452, w: 400, h: 56, t: 'Release train', s: 'Regenerate, reindex, swap aliases', c: 'var(--onto)', bar: true },
};
const E: Record<string, Pt[]> = {
  e_s0: [[100, 74], [100, 117]], e_s1: [[280, 74], [280, 117]], e_s2: [[460, 74], [460, 117]], e_s3: [[640, 74], [640, 117]],
  e_bc: [[370, 172], [370, 215]],
  e_ca: [[370, 270], [370, 302], [130, 302], [130, 333]],
  e_co: [[370, 270], [370, 333]],
  e_cb: [[370, 270], [370, 302], [610, 302], [610, 333]],
  e_ar: [[130, 408], [130, 430], [330, 430], [330, 451]],
  e_or: [[370, 408], [370, 451]],
  e_br: [[610, 408], [610, 430], [410, 430], [410, 451]],
};

const CHECKS = ['SHACL shapes valid', 'Ontology stays consistent', 'No near-duplicate classes', 'Competency questions pass', 'Impact report'];
type Tier = 'patch' | 'minor' | 'major';
const TIERC: Record<Tier, string> = { patch: 'var(--query)', minor: 'var(--onto)', major: 'var(--ink)' };
type Lane = 'auto' | 'owner' | 'board';
const LANE: Record<Lane, { x: number; edge: string; rel: string; relX: number }> = {
  auto: { x: 130, edge: 'e_ca', rel: 'e_ar', relX: 330 },
  owner: { x: 370, edge: 'e_co', rel: 'e_or', relX: 370 },
  board: { x: 610, edge: 'e_cb', rel: 'e_br', relX: 410 },
};
const SIGX = [100, 280, 460, 640];
type Scen = {
  label: string; sig: number; lane: Lane; tier: Tier; title: string; signal: string; evidence: string; change: string;
  impact: string; status: string[]; failAt?: number; failMsg?: string;
  conv?: { tier: Tier; title: string; change: string; evidence: string };
};
/** Example changes (illustrative), from the signal that raises them to the release that ships them. */
const SCEN: Record<string, Scen> = {
  bulletin: { label: 'Network adds a reason code', sig: 3, lane: 'auto', tier: 'patch', title: 'Add a new value to the Mastercard reason code list',
    signal: 'Network bulletin', evidence: 'Bulletin text, plus the same value already appearing in clearing files', change: 'New code value on ReasonCode',
    impact: 'no queries or indexes change', status: ['Merged automatically'] },
  state: { label: 'Code adds a dispute state', sig: 0, lane: 'owner', tier: 'minor', title: 'Add PreArbitration as a kind of DisputeEvent',
    signal: 'disputes-svc merge', evidence: 'New state in the dispute state machine; 14 events in last week’s data', change: 'New class under an existing parent',
    impact: '3 competency questions touch DisputeEvent', status: ['Waiting for the disputes owner', 'Approved by the disputes owner'] },
  dup: { label: 'Code adds a look-alike class', sig: 0, lane: 'auto', tier: 'minor', title: 'Add ChargebackCase as a new class',
    signal: 'cb-portal merge', evidence: 'New JPA entity ChargebackCase', change: 'New class', failAt: 2,
    failMsg: 'Blocked: near duplicate of Chargeback. Converting to an alias.',
    conv: { tier: 'patch', title: 'Add “ChargebackCase” as an alias of Chargeback', change: 'New alias on an existing class', evidence: 'Same fields and lifecycle as Chargeback' },
    impact: 'no queries change; search now finds the new name', status: ['Merged automatically as an alias'] },
  split: { label: 'Questions keep failing', sig: 2, lane: 'board', tier: 'major', title: 'Split Merchant into Merchant and SubMerchant',
    signal: 'RAG query logs', evidence: '38 unanswered questions about payment facilitators’ sub-merchants this month', change: 'Changes what existing Merchant nodes mean',
    impact: '12 queries, 2 indexes, 3 consuming teams', status: ['Sent to the change board', 'Deprecation notice sent to consumers', 'Approved for the next major release'] },
};

/** The loop's own pause: under reduced motion it shortens to at most 0.4 s rather than vanishing. */
const lwait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduce ? Math.min(ms, 400) : ms));
const SVG = 'http://www.w3.org/2000/svg';

type Card = { pr: number; scen: Scen; tier: Tier; title: string; change: string; evidence: string };

export function Loop() {
  const [lit, setLit] = useState<{ nodes: string[]; edges: string[] }>({ nodes: [], edges: [] });
  const [flag, setFlag] = useState(false);
  const [relVer, setRelVer] = useState('v1.5.0');
  const [pressed, setPressed] = useState('');
  const [card, setCard] = useState<Card | null>(null);
  const [checks, setChecks] = useState<('pass' | 'fail' | null)[]>(CHECKS.map(() => null));
  const [status, setStatusText] = useState({ text: 'Proposal drafted', bad: false });
  const [hist, setHist] = useState<{ vs: string; tier: string }[]>([]);
  const svg = useRef<SVGSVGElement>(null), layer = useRef<SVGGElement>(null), cardEl = useRef<HTMLDivElement>(null), histEl = useRef<HTMLDivElement>(null);
  const arows = useRef<HTMLDivElement>(null), tiles = useRef<HTMLDivElement>(null);
  const nodeEls = useRef<Record<string, SVGGElement>>({});
  const ver = useRef([1, 5, 0]), prNum = useRef(230), runId = useRef(0);

  /** Lights the given nodes and edges, and dims the other nodes while anything is lit. */
  const light = (nodes: string[], edges: string[]) => {
    flushSync(() => setLit({ nodes, edges }));
    Object.entries(nodeEls.current).forEach(([k, g]) => anim(g, { opacity: nodes.length && !nodes.includes(k) ? 0.45 : 1 }, { duration: 0.3 }));
  };
  const pulse = (k: string) => { if (!reduce) anim(nodeEls.current[k].querySelector('.halo'), { opacity: [0.9, 0], scale: [1, 1.05] }, { duration: 0.6 }); };
  const makePacket = () => {
    const g = document.createElementNS(SVG, 'g'), h = document.createElementNS(SVG, 'circle'), c = document.createElementNS(SVG, 'circle');
    h.setAttribute('r', '10'); h.setAttribute('opacity', '0.22'); h.style.fill = 'var(--onto)';
    c.setAttribute('r', '5'); c.style.fill = 'var(--onto)'; c.style.stroke = 'var(--raised)'; c.style.strokeWidth = '1.5';
    g.append(h, c); layer.current!.appendChild(g);
    return g;
  };
  /** Moves the packet along a route drawn for the trip and removed after it. */
  const go = (pk: SVGGElement, pts: Pt[], dur?: number) => {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', rounded(pts, 10)); path.setAttribute('fill', 'none');
    layer.current!.insertBefore(path, layer.current!.firstChild);
    const len = path.getTotalLength();
    const step = (v: number) => { const p = path.getPointAtLength(v * len); pk.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')'); };
    step(0);
    return tween({ duration: dur || Math.min(1.2, 0.3 + len / 450), ease: [0.45, 0, 0.2, 1], onUpdate: step }).then(() => { step(1); path.remove(); });
  };

  const renderCard = (c: Card) => {
    flushSync(() => { setCard(c); setChecks(CHECKS.map(() => null)); setStatusText({ text: 'Proposal drafted', bad: false }); });
    anim(cardEl.current!.children, { opacity: [0, 1], y: [6, 0] }, { duration: 0.3, delay: (i) => i * 0.05 });
  };
  const setStatus = (text: string, bad = false) => {
    flushSync(() => setStatusText({ text, bad }));
    anim(cardEl.current!.querySelector('#prstatus'), { opacity: [0, 1], x: [-6, 0] }, { duration: 0.25 });
  };
  const runChecks = async (my: number, failAt?: number) => {
    for (let i = 0; i < CHECKS.length; i++) {
      await lwait(300); if (my !== runId.current) return false;
      const fail = i === failAt;
      flushSync(() => setChecks((cs) => cs.map((x, j) => (j === i ? (fail ? 'fail' : 'pass') : x))));
      anim(cardEl.current!.querySelectorAll('.ck')[i], { scale: [0.4, 1] }, { duration: 0.25 });
      if (fail) return i;
    }
    return true;
  };

  const run = async (key: string) => {
    const my = ++runId.current, sc = SCEN[key];
    prNum.current++;
    flushSync(() => { setPressed(key); setFlag(false); });
    layer.current!.replaceChildren();
    let c: Card = { pr: prNum.current, scen: sc, tier: sc.tier, title: sc.title, change: sc.change, evidence: sc.evidence };
    renderCard(c);
    const sid = 's' + sc.sig, sx = SIGX[sc.sig];
    const pk = makePacket();
    light([sid], ['e_s' + sc.sig]); pulse(sid);
    await go(pk, E['e_s' + sc.sig], 0.5); if (my !== runId.current) return;
    light([sid, 'bot'], ['e_s' + sc.sig]); pulse('bot');
    await go(pk, [[sx, 118], [sx, 145], [370, 145], [370, 172]], 0.6); if (my !== runId.current) return;
    light(['bot', 'chk'], ['e_bc']);
    await go(pk, [[370, 172], [370, 216], [370, 243]], 0.45); if (my !== runId.current) return;
    pulse('chk'); setStatus('Running checks');
    const res = await runChecks(my, sc.failAt); if (my !== runId.current || res === false) return;
    if (typeof res === 'number') {
      flushSync(() => setFlag(true));
      anim(nodeEls.current.chk, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.45 });
      setStatus(sc.failMsg!, true);
      await lwait(1600); if (my !== runId.current) return;
      flushSync(() => setFlag(false));
      c = { ...c, ...sc.conv! };
      renderCard(c);
      setStatus('Rechecking the alias');
      const again = await runChecks(my, -1); if (my !== runId.current || again === false) return;
    }
    const ln = LANE[sc.lane];
    setStatus(c.tier.charAt(0).toUpperCase() + c.tier.slice(1) + ' change: routed to ' + LN[sc.lane].t.toLowerCase());
    light(['chk', sc.lane], [ln.edge]);
    await go(pk, E[ln.edge].concat([[ln.x, 371]]), 0.8); if (my !== runId.current) return;
    pulse(sc.lane);
    for (const st of sc.status) { setStatus(st); await lwait(sc.lane === 'auto' ? 500 : 1000); if (my !== runId.current) return; }
    light([sc.lane, 'rel'], [ln.rel]);
    await go(pk, ([[ln.x, 371], [ln.x, 408]] as Pt[]).concat(E[ln.rel].slice(1)).concat([[ln.relX, 480]]), 0.8); if (my !== runId.current) return;
    pulse('rel');
    const v = ver.current;
    if (c.tier === 'patch') v[2]++; else if (c.tier === 'minor') { v[1]++; v[2] = 0; } else { v[0]++; v[1] = 0; v[2] = 0; }
    const vs = 'v' + v.join('.');
    const verEl = svg.current!.querySelector('.relver');
    await anim(verEl, { opacity: [1, 0], y: [0, -8] }, { duration: 0.18 });
    flushSync(() => setRelVer(vs));
    anim(verEl, { opacity: [0, 1], y: [8, 0], scale: [1.3, 1] }, { duration: 0.4 });
    anim(pk, { opacity: [1, 0] }, { duration: 0.3 }).then(() => pk.remove());
    flushSync(() => setHist((h) => [...h, { vs, tier: c.tier }]));
    anim(histEl.current!.lastElementChild, { opacity: [0, 1], scale: [0.7, 1] }, { duration: 0.35 });
    setStatus('Released as ' + vs);
    light([], []);
  };

  // The acceptance bars grow, and the health sparklines draw, when they scroll into view.
  useEffect(() => inView(arows.current!, () => {
    arows.current!.querySelectorAll<HTMLElement>('.fillbar').forEach((f, i) => {
      anim(f, { width: ['0%', f.dataset.p + '%'] }, { duration: 0.8, delay: 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] });
      if (reduce) f.style.width = f.dataset.p + '%';
    });
  }, { amount: 0.4 }), []);
  useEffect(() => inView(tiles.current!, () => {
    tiles.current!.querySelectorAll<SVGPathElement>('.spark path').forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      anim(p, { strokeDashoffset: [len, 0] }, { duration: 0.9, delay: 0.15 + i * 0.2 }).then(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
    });
  }, { amount: 0.4 }), []);

  return (
    <Block className="block" id="loopsec" aria-labelledby="loop">
      <h3 className="sech" id="loop">A continuous loop</h3>
      <p className="intro">Machines detect, draft, test and release. People decide only where meaning changes, and the diff decides which lane a change takes. Send a change through.</p>
      <div className="scen" id="scen" role="group" aria-label="Example changes">
        {Object.entries(SCEN).map(([k, sc]) => <button key={k} type="button" className="vbtn" data-s={k} aria-pressed={pressed ? pressed === k : undefined} onClick={() => run(k)}>{sc.label}</button>)}
      </div>
      <div className="loopgrid">
        <div>
          <div className="xwrap"><svg id="loopsvg" className="loopsvg" viewBox="0 0 740 545" role="img" aria-label="Drift signals feed a proposal bot and automated checks, then one of three approval lanes by risk, then a release train" ref={svg}>
            <g id="lpaths">
              {Object.entries(E).map(([k, pts]) => {
                const on = lit.edges.includes(k);
                return <path key={k} d={rounded(pts, 10)} className={'le' + (on ? ' on' : '')} markerEnd={on ? 'url(#mg-onto)' : 'url(#mg-line)'} />;
              })}
            </g>
            <g id="lnodes">
              {Object.entries(LN).map(([k, n]) => {
                const tx = n.bar ? n.x + 20 : n.x + 14, tall = n.h > 60;
                return (
                  <g key={k} className={'ln' + (lit.nodes.includes(k) ? ' on' : '') + (k === 'chk' && flag ? ' flag' : '')} style={{ '--c': n.c } as CSSProperties}
                    ref={(el) => { if (el) nodeEls.current[k] = el; }}>
                    <rect className="halo" x={n.x - 5} y={n.y - 5} width={n.w + 10} height={n.h + 10} rx="11" />
                    <rect className="box" x={n.x} y={n.y} width={n.w} height={n.h} rx="8" />
                    {n.bar && <rect className="lbar" x={n.x + 8} y={n.y + 10} width="3" height={n.h - 20} rx="1.5" />}
                    <text className="lnt" x={tx} y={n.y + (tall ? 25 : 23)}>{n.t}</text>
                    <text className="lns" x={tx} y={n.y + (tall ? 43 : 41)}>{n.s}</text>
                    {n.s2 && <text className="lnx" x={tx} y={n.y + 61}>{n.s2}</text>}
                    {k === 'rel' && <text className="relver" x={n.x + n.w - 16} y={n.y + 35}>{relVer}</text>}
                  </g>
                );
              })}
            </g>
            <g id="lpk" aria-hidden="true" ref={layer}></g>
            <text className="lns" x="370" y="534" textAnchor="middle">↻ The new version constrains the next extraction run</text>
          </svg></div>
          <div className="hist" id="hist" ref={histEl}><span className="hl">Releases</span><span className="hv"><b>v1.5.0</b>baseline</span>
            {hist.map((h) => <span key={h.vs} className="hv"><b>{h.vs}</b>{h.tier}</span>)}
          </div>
        </div>
        <div className="prcard" id="prcard" aria-live="polite" ref={cardEl}>
          {!card ? <p className="prempty">Pick a change above to watch its pull request move through the loop.</p> : <>
            <div className="prhead"><span className="prnum">PR #{card.pr}</span><span className="tier" style={{ '--c': TIERC[card.tier] } as CSSProperties}>{card.tier}</span></div>
            <h4>{card.title}</h4>
            <dl className="prf"><dt>Signal</dt><dd>{card.scen.signal}</dd><dt>Evidence</dt><dd>{card.evidence}</dd><dt>Change</dt><dd>{card.change}</dd></dl>
            <ol className="prchecks">
              {CHECKS.map((ck, i) => <li key={ck}><span className={'ck' + (checks[i] ? ' ' + checks[i] : '')} data-i={i}>{checks[i] === 'pass' ? '✓' : checks[i] === 'fail' ? '✕' : '·'}</span>{i === 4 ? ck + ': ' + card.scen.impact : ck}</li>)}
            </ol>
            <p className={'prstatus' + (status.bad ? ' bad' : '')} id="prstatus">{status.text}</p>
          </>}
        </div>
      </div>
      <div className="below">
        <div className="tc">
          <h3>Earn autonomy per change type</h3>
          <div className="thrkey"><i></i>Promotion line: 95% of proposals accepted</div>
          <div id="arows" ref={arows}>
            <div className="arow"><span>New code value</span><div className="track"><div className="fillbar" data-p="99" style={{ '--c': 'var(--query)' } as CSSProperties}></div><div className="thr"></div></div><span className="pv">99%</span><span className="lanechip" style={{ '--c': 'var(--query)' } as CSSProperties}>Auto-merge</span></div>
            <div className="arow"><span>New alias</span><div className="track"><div className="fillbar" data-p="97" style={{ '--c': 'var(--query)' } as CSSProperties}></div><div className="thr"></div></div><span className="pv">97%</span><span className="lanechip" style={{ '--c': 'var(--query)' } as CSSProperties}>Auto-merge</span></div>
            <div className="arow"><span>New class</span><div className="track"><div className="fillbar" data-p="72" style={{ '--c': 'var(--onto)' } as CSSProperties}></div><div className="thr"></div></div><span className="pv">72%</span><span className="lanechip" style={{ '--c': 'var(--onto)' } as CSSProperties}>Owner approves</span></div>
            <div className="arow"><span>New relationship</span><div className="track"><div className="fillbar" data-p="64" style={{ '--c': 'var(--onto)' } as CSSProperties}></div><div className="thr"></div></div><span className="pv">64%</span><span className="lanechip" style={{ '--c': 'var(--onto)' } as CSSProperties}>Owner approves</span></div>
            <div className="arow"><span>Rename, remove, split</span><div className="track always"></div><span className="pv">n/a</span><span className="lanechip" style={{ '--c': 'var(--ink)' } as CSSProperties}>Change board</span></div>
          </div>
          <p className="note">Illustrative numbers. Example policy: a change type moves to auto-merge after 50 proposals above the line. Breaking changes never do.</p>
        </div>
        <div className="tc">
          <h3>Is the loop healthy?</h3>
          <div className="tiles" id="tiles" ref={tiles}>
            <div className="tile" style={{ '--c': 'var(--query)' } as CSSProperties}><div><b>Signal to merge</b><span>How fast the ontology catches up. Lower is better.</span></div><svg className="spark" viewBox="0 0 120 40" aria-hidden="true"><path d="M4,8 L22,12 L40,11 L58,20 L76,24 L94,29 L116,31" /></svg></div>
            <div className="tile" style={{ '--c': 'var(--onto)' } as CSSProperties}><div><b>Acceptance rate</b><span>Is the bot proposing useful changes? Higher is better.</span></div><svg className="spark" viewBox="0 0 120 40" aria-hidden="true"><path d="M4,32 L22,29 L40,30 L58,21 L76,17 L94,12 L116,9" /></svg></div>
            <div className="tile" style={{ '--c': 'var(--graph)' } as CSSProperties}><div><b>Unanswered questions</b><span>Does the ontology cover what people ask? Lower is better.</span></div><svg className="spark" viewBox="0 0 120 40" aria-hidden="true"><path d="M4,10 L22,9 L40,15 L58,14 L76,23 L94,26 L116,30" /></svg></div>
          </div>
          <p className="note">Illustrative trends from a healthy loop.</p>
        </div>
      </div>
    </Block>
  );
}
