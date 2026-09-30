import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { anim, dl, drawIn, hideAll, tween, wait } from '../shared/anim';
import { DeepDive, XPanel, useDeepDive, type DDStep } from '../shared/DeepDive';

// Deep dive: Maya's chargeback stored twice, as connected nodes in Neptune and as a searchable
// document in OpenSearch, and the one ID that joins them.

const STEPS: DDStep[] = [
  { t: 'As a graph', k: ['Nodes are things, edges are relationships', 'Labels come from the ontology’s class chain', 'Properties sit on nodes: dates, amounts, codes'] },
  { t: 'Walking it', k: ['Queries follow edges, one hop at a time', 'Cypher can walk against an arrow’s direction', 'Lineage questions belong in Neptune'] },
  { t: 'As a document', k: ['OpenSearch splits text into terms', 'An inverted index maps each term to documents', 'Typos still match, with fuzzy matching'] },
  { t: 'Embeddings', k: ['An embedding turns text into a list of numbers', 'Similar meanings land close together', 'k-NN search finds the nearest neighbours'] },
  { t: 'One ID', k: ['Search finds where to start', 'neptune_id hands over to the graph', 'The graph explains the neighbourhood'] },
];

// Step 2: the pattern, each part tagged with the hop that lights it.
const PAT: [string, number][] = [['(rc)', 0], ['<-[:HAS_REASON]-', 1], ['(cb)', 1], ['-[:DISPUTES]->', 2], ['(cap)', 2], ['-[:CAPTURES]->', 3], ['(auth)', 3], ['-[:AT_MERCHANT]->', 4], ['(m)', 4]];
const CHAIN: [string, string][] = [['rc:visa:10.4', 'ReasonCode'], ['cb:1001', 'Chargeback'], ['cap:7731', 'Capture'], ['auth:5521', 'Authorization'], ['m:88213', 'Merchant']];
const CX = [72, 226, 380, 534, 688];

// Step 3: the document's terms, and which documents each term points to.
const TOKS = ['chargeback', 'on', 'a', 'harbor', 'grill', 'online', 'order', 'reason', '10.4', 'card', 'absent', 'fraud'];
const POST: [string, string][] = [['harbor', 'cb:1001, m:88213'], ['grill', 'cb:1001, m:88213'], ['fraud', 'cb:1001, chunk:c118'], ['10.4', 'cb:1001, rc:visa:10.4, chunk:c118'], ['chargeback', 'cb:1001, chunk:c07']];
const QUERY = 'harbor gril';

// Step 4: texts placed by meaning (illustrative), and where the question lands.
const PTS: [number, number, string, string][] = [
  [380, 90, 'card-absent fraud, reason 10.4', 'var(--search)'], [420, 120, 'cardholder denies the purchase', 'var(--search)'], [360, 135, 'unauthorized online order', 'var(--search)'], [440, 80, 'stolen card used online', 'var(--search)'],
  [110, 220, 'settlement file arrived late', 'var(--graph)'], [150, 255, 'interchange fee adjustment', 'var(--graph)'], [90, 262, 'batch totals mismatch', 'var(--graph)'],
  [200, 70, 'merchant onboarding checks', 'var(--muted)'], [240, 100, 'KYC documents missing', 'var(--muted)'],
  [270, 220, 'refund issued twice', 'var(--query)'], [310, 250, 'partial refund request', 'var(--query)'],
];
const QX = 395, QY = 108, SIM = ['0.91', '0.89', '0.86'];
const NEAR = PTS.map((p, i) => [Math.hypot(p[0] - QX, p[1] - QY), i]).sort((a, b) => a[0] - b[0]).slice(0, 3).map(([, i]) => i);

const SVG = 'http://www.w3.org/2000/svg';

export function TwoStores() {
  const api = useDeepDive();
  const q = (sel: string) => api.root!.querySelector(sel);
  const qa = (sel: string) => api.root!.querySelectorAll(sel);

  // ---------- Step 2: walk the chain ----------
  const [lit, setLit] = useState(-1);
  const [hop, setHop] = useState('hop 0 of 4');
  const walkRun = useRef(0), pk = useRef<SVGGElement>(null);
  const walk = async () => {
    const my = ++walkRun.current, layer = pk.current!;
    layer.replaceChildren();
    const g = document.createElementNS(SVG, 'g'), c = document.createElementNS(SVG, 'circle');
    c.setAttribute('r', '7'); c.style.fill = 'var(--onto)'; g.appendChild(c); layer.appendChild(g);
    const put = (x: number) => g.setAttribute('transform', 'translate(' + x + ',100)');
    put(CX[0]); setLit(0); setHop('hop 0 of 4');
    const nodes = qa('#x3chain .cn');
    for (let i = 1; i < 5; i++) {
      await wait(500); if (my !== walkRun.current) return;
      const a = CX[i - 1], b = CX[i];
      await tween({ duration: 0.6, ease: [0.45, 0, 0.2, 1], onUpdate: (v) => put(a + (b - a) * v) });
      if (my !== walkRun.current) return;
      setLit(i); setHop('hop ' + i + ' of 4');
      anim(nodes[i], { scale: [1, 1.06, 1] }, { duration: 0.35 });
    }
    setHop('4 hops: from one reason code to the merchant');
  };

  // ---------- Step 3: the inverted index, and a search with a typo ----------
  const [typed, setTyped] = useState('');
  const [found, setFound] = useState(false);
  const ixRun = useRef(0);
  const index = async () => {
    const my = ++ixRun.current;
    setTyped(''); setFound(false);
    const toks = qa('#x3toks .tok'), rows = qa('#x3post tbody tr');
    hideAll(toks); hideAll(rows);
    anim(toks, { opacity: [0, 1], y: [-10, 0] }, { duration: 0.3, delay: dl(0.1, 0.07) });
    anim(rows, { opacity: [0, 1], x: [-10, 0] }, { duration: 0.3, delay: dl(1.3, 0.12) });
    await wait(2300); if (my !== ixRun.current) return;
    for (let i = 1; i <= QUERY.length; i++) { setTyped(QUERY.slice(0, i)); await wait(90); if (my !== ixRun.current) return; }
    await wait(300);
    flushSync(() => setFound(true));
    anim(qa('#x3res code'), { opacity: [0, 1], scale: [0.8, 1] }, { duration: 0.3, delay: dl(0.2, 0.12) });
  };

  // ---------- Step 4: embeddings, and the question's nearest neighbours ----------
  const embRun = useRef(0), lines = useRef<SVGGElement>(null), qp = useRef<SVGCircleElement>(null);
  const embed = async () => {
    const my = ++embRun.current, ql = q('#x3ql') as SVGTextElement, qc = qp.current!;
    lines.current!.replaceChildren();
    [0, 1, 2].forEach((i) => { (q('#x3n' + i) as SVGTextElement).style.opacity = '0'; });
    ql.style.opacity = '0';
    anim(qa('#x3pts circle'), { opacity: [0, 0.85], scale: [0.3, 1] }, { duration: 0.3, delay: dl(0, 0.05) });
    qc.setAttribute('cx', '500'); qc.setAttribute('cy', '296');
    await wait(900); if (my !== embRun.current) return;
    await tween({ duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => { qc.setAttribute('cx', String(500 + (QX - 500) * v)); qc.setAttribute('cy', String(296 + (QY - 296) * v)); } });
    if (my !== embRun.current) return;
    anim(ql, { opacity: [0, 1] }, { duration: 0.3 });
    NEAR.forEach((i, k) => {
      const ln = document.createElementNS(SVG, 'path');
      ln.setAttribute('d', 'M' + QX + ',' + QY + ' L' + PTS[i][0] + ',' + PTS[i][1]); ln.setAttribute('class', 'nline');
      lines.current!.appendChild(ln);
      drawIn([ln], k * 0.2);
      anim(q('#x3n' + k), { opacity: [0, 1] }, { duration: 0.3, delay: 0.3 + k * 0.2 });
    });
  };

  // ---------- Step 5: the search hit's ID flies over to the graph ----------
  const join = async () => {
    const id = q('#x3id') as HTMLElement, center = q('#x3jc') as SVGGElement;
    const nb = qa('#x3j .jn'), jr = qa('#x3j .jr');
    hideAll(nb); hideAll(jr); center.style.opacity = '0.3';
    anim(id, { scale: [1, 1.15, 1] }, { duration: 0.5 });
    const a = id.getBoundingClientRect(), b = center.getBoundingClientRect();
    const ghost = id.cloneNode(true) as HTMLElement;
    ghost.classList.add('flyer'); document.body.appendChild(ghost);
    ghost.style.left = a.left + 'px'; ghost.style.top = (a.top + window.scrollY) + 'px';
    await anim(ghost, { x: [0, b.left + b.width / 2 - a.left - a.width / 2], y: [0, b.top + b.height / 2 - a.top - a.height / 2], opacity: [1, 0.2] }, { duration: 0.8, delay: 0.4, ease: [0.45, 0, 0.2, 1] });
    ghost.remove();
    anim(center, { opacity: [0.3, 1], scale: [0.9, 1] }, { duration: 0.35 });
    anim(jr, { opacity: [0, 1] }, { duration: 0.3, delay: 0.2 });
    anim(nb, { opacity: [0, 1], scale: [0.7, 1] }, { duration: 0.35, delay: dl(0.3, 0.1) });
  };

  const run = {
    1: () => {
      hideAll(qa('#x3g .gn, #x3g .gp, #x3g .rl'));
      anim(qa('#x3g .gn'), { opacity: [0, 1], scale: [0.85, 1] }, { duration: 0.35, delay: dl(0, 0.12) });
      drawIn(qa('#x3g .rel'), 0.6);
      drawIn(qa('#x3g .lead'), 1.1);
      anim(qa('#x3g .rl'), { opacity: [0, 1] }, { duration: 0.3, delay: dl(0.9, 0.1) });
      anim(qa('#x3g .gp'), { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, delay: dl(1.3, 0.12) });
    },
    2: () => { walk(); },
    3: () => { index(); },
    4: () => { embed(); },
    5: () => { join(); },
  };

  return (
    <DeepDive api={api} id="dd3" title="Deep dive: one chargeback, two stores" steps={STEPS} run={run}
      intro="Maya's chargeback, stored twice: as connected nodes in Neptune and as a searchable document in OpenSearch. What each shape is good at, and what an embedding actually is."
      next={{ href: '#own', label: 'Next: who owns what' }}>
      <XPanel n={1}>
        <div className="xwrap"><svg id="x3g" className="xsvg" viewBox="0 0 760 280" role="img" aria-label="Property graph: chargeback cb:1001 disputes capture cap:7731, which captures authorization auth:5521 at merchant m:88213; the chargeback has reason code 10.4">
          <path className="rel" d="M92,124 L92,63" markerEnd="url(#mg-onto)" /><path className="rel" d="M165,148 L209,148" markerEnd="url(#mg-onto)" /><path className="rel" d="M355,148 L399,148" markerEnd="url(#mg-onto)" /><path className="rel" d="M545,148 L589,148" markerEnd="url(#mg-onto)" />
          <path className="lead" d="M92,172 L92,206" /><path className="lead" d="M282,172 L282,206" /><path className="lead" d="M472,172 L472,206" /><path className="lead" d="M662,172 L662,206" />
          <g className="gn"><rect className="evbox" x="20" y="14" width="145" height="48" rx="10" /><text className="evt mono" x="34" y="35">rc:visa:10.4</text><text className="evs" x="34" y="53">ReasonCode</text></g>
          <g className="gn hot"><rect className="evbox" x="20" y="124" width="145" height="48" rx="10" /><text className="evt mono" x="34" y="145">cb:1001</text><text className="evs" x="34" y="163">Chargeback</text></g>
          <g className="gn"><rect className="evbox" x="210" y="124" width="145" height="48" rx="10" /><text className="evt mono" x="224" y="145">cap:7731</text><text className="evs" x="224" y="163">Capture</text></g>
          <g className="gn"><rect className="evbox" x="400" y="124" width="145" height="48" rx="10" /><text className="evt mono" x="414" y="145">auth:5521</text><text className="evs" x="414" y="163">Authorization</text></g>
          <g className="gn"><rect className="evbox" x="590" y="124" width="145" height="48" rx="10" /><text className="evt mono" x="604" y="145">m:88213</text><text className="evs" x="604" y="163">Merchant</text></g>
          <text className="rl" x="100" y="100">HAS_REASON</text><text className="rl" x="187" y="116" textAnchor="middle">DISPUTES</text><text className="rl" x="377" y="116" textAnchor="middle">CAPTURES</text><text className="rl" x="567" y="116" textAnchor="middle">AT_MERCHANT</text>
          <g className="gp"><rect className="propbox" x="20" y="206" width="145" height="56" rx="8" /><text className="evs mono" x="32" y="228">opened: 2026-08-19</text><text className="evs mono" x="32" y="248">3 labels</text></g>
          <g className="gp"><rect className="propbox" x="210" y="206" width="145" height="56" rx="8" /><text className="evs mono" x="222" y="228">amount: 42.50</text><text className="evs mono" x="222" y="248">captured: Aug 4</text></g>
          <g className="gp"><rect className="propbox" x="400" y="206" width="145" height="56" rx="8" /><text className="evs mono" x="412" y="228">amount: 42.50</text><text className="evs mono" x="412" y="248">card not present</text></g>
          <g className="gp"><rect className="propbox" x="590" y="206" width="145" height="56" rx="8" /><text className="evs mono" x="602" y="228">Harbor Grill #4</text><text className="evs mono" x="602" y="248">mcc: 5812</text></g>
        </svg></div>
        <p className="note">Boxes are nodes, arrows are relationships, and the dashed cards are properties stored on each node.</p>
      </XPanel>
      <XPanel n={2}>
        <div className="xwrap"><svg id="x3chain" className="xsvg" viewBox="0 0 760 130" role="img" aria-label="A four-hop traversal from reason code to merchant">
          <path className="rel" d="M164,66 L135,66" markerEnd="url(#mg-onto)" /><path className="rel" d="M288,66 L317,66" markerEnd="url(#mg-onto)" /><path className="rel" d="M442,66 L471,66" markerEnd="url(#mg-onto)" /><path className="rel" d="M596,66 L625,66" markerEnd="url(#mg-onto)" />
          <text className="rl" x="149" y="30" textAnchor="middle">HAS_REASON</text><text className="rl" x="303" y="30" textAnchor="middle">DISPUTES</text><text className="rl" x="457" y="30" textAnchor="middle">CAPTURES</text><text className="rl" x="611" y="30" textAnchor="middle">AT_MERCHANT</text>
          {CHAIN.map(([id, cls], i) => (
            <g key={id} className={'cn' + (i <= lit ? ' on' : '')}><rect className="evbox" x={10 + i * 154} y="40" width="124" height="52" rx="10" /><text className="evt mono" x={22 + i * 154} y="62">{id}</text><text className="evs" x={22 + i * 154} y="80">{cls}</text></g>
          ))}
          <g id="x3pk" ref={pk}></g>
          <text className="evs" id="x3hop" x="380" y="120" textAnchor="middle">{hop}</text>
        </svg></div>
        <div className="pat" id="x3pat"><span className="pk">MATCH</span>{' '}{PAT.map(([t, h], i) => <span key={i} data-h={h} className={h <= lit ? 'on' : undefined}>{t}</span>)}</div>
        <div className="vbtns" style={{ marginTop: '12px' }}><button type="button" className="vbtn go" id="x3walk" onClick={walk}>Walk it again</button></div>
      </XPanel>
      <XPanel n={3}>
        <div className="doccard"><span className="vcap">A document in the entities index</span><p id="x3text">Chargeback on a Harbor Grill online order, reason 10.4 card-absent fraud</p></div>
        <div className="toks" id="x3toks">{TOKS.map((t) => <span key={t} className="tok">{t}</span>)}</div>
        <div className="ixgrid">
          <table className="postings" id="x3post"><thead><tr><th>Term</th><th>Found in</th></tr></thead><tbody>
            {POST.map(([t, docs]) => <tr key={t} data-t={t} className={found && (t === 'harbor' || t === 'grill') ? 'hit' : undefined}><td><code>{t}</code></td><td>{docs}</td></tr>)}
          </tbody></table>
          <div className="qbox"><span className="vcap">Someone searches, with a typo</span><div className="qline"><span id="x3q">{typed}</span><i className="caret"></i></div>
            <p className="note" id="x3qn">{found ? '“gril” is one letter away from “grill”, so fuzzy matching still finds it.' : ''}</p>
            <div className="qres" id="x3res">{found && <><code>cb:1001</code><code>m:88213</code></>}</div></div>
        </div>
      </XPanel>
      <XPanel n={4}>
        <div className="xwrap"><svg id="x3emb" className="xsvg" viewBox="0 0 760 320" role="img" aria-label="Texts plotted by meaning: fraud, settlement, onboarding and refund topics form clusters; a new question lands near the fraud cluster">
          <rect className="plotbg" x="20" y="16" width="500" height="288" rx="12" />
          <g id="x3lines" ref={lines}></g>
          <g id="x3pts">{PTS.map(([x, y, text, c]) => <circle key={text} cx={x} cy={y} r="7" style={{ fill: c, opacity: 0.85 }}><title>{text}</title></circle>)}</g>
          <g id="x3qg"><circle id="x3qp" cx="500" cy="296" r="8" style={{ fill: 'var(--onto)' }} ref={qp} /></g>
          <text className="evs" id="x3ql" x="395" y="160" textAnchor="middle" opacity="0">“customer says the order wasn’t theirs”</text>
          <text className="evt" x="540" y="40">Each text becomes a vector</text>
          <text className="evs mono" x="540" y="62">[0.012, −0.087, 0.143, …]</text>
          <text className="evs" x="540" y="82">256 to 3,072 numbers</text><text className="evs" x="540" y="104">for example Nova 2, Cohere Embed v4</text>
          <text className="evt" x="540" y="130">Nearest to the question</text>
          {NEAR.map((i, k) => <text key={k} className="evs" id={'x3n' + k} x="540" y={156 + k * 24} opacity="0">{SIM[k] + '  ' + PTS[i][2]}</text>)}
          <g className="lg"><circle cx="40" cy="288" r="5" style={{ fill: 'var(--search)' }} /><text className="evs" x="50" y="292">fraud</text><circle cx="100" cy="288" r="5" style={{ fill: 'var(--graph)' }} /><text className="evs" x="110" y="292">settlement</text><circle cx="190" cy="288" r="5" style={{ fill: 'var(--muted)' }} /><text className="evs" x="200" y="292">onboarding</text><circle cx="285" cy="288" r="5" style={{ fill: 'var(--query)' }} /><text className="evs" x="295" y="292">refunds</text></g>
        </svg></div>
        <div className="vbtns"><button type="button" className="vbtn go" id="x3ask" onClick={embed}>Ask again</button></div>
        <p className="note">A flattened picture: real embeddings have 256 to 3,072 dimensions, depending on the model. Cohere Embed v4 also reads tables and charts inside documents. The similarity scores are illustrative.</p>
      </XPanel>
      <XPanel n={5}>
        <div className="joingrid">
          <div className="hitcard"><span className="vcap">OpenSearch hit</span><dl className="prf"><dt>neptune_id</dt><dd><code className="idchip" id="x3id">cb:1001</code></dd><dt>score</dt><dd>0.86</dd><dt>labels</dt><dd>Chargeback</dd></dl></div>
          <div className="joinmid"><span className="joinpill">same ID</span></div>
          <svg id="x3j" className="xsvg" viewBox="0 0 330 230" role="img" aria-label="The chargeback node in Neptune and its neighbours">
            <path className="rel jr" d="M120,90 L78,52" /><path className="rel jr" d="M210,90 L252,52" /><path className="rel jr" d="M210,136 L252,174" /><path className="rel jr" d="M120,136 L78,174" />
            <g className="jn"><rect className="evbox" x="10" y="10" width="110" height="42" rx="9" /><text className="evs mono" x="22" y="36">rc:visa:10.4</text></g>
            <g className="jn"><rect className="evbox" x="210" y="10" width="110" height="42" rx="9" /><text className="evs mono" x="222" y="36">cap:7731</text></g>
            <g className="jn"><rect className="evbox" x="210" y="174" width="110" height="42" rx="9" /><text className="evs mono" x="222" y="200">auth:5521</text></g>
            <g className="jn"><rect className="evbox" x="10" y="174" width="110" height="42" rx="9" /><text className="evs mono" x="22" y="200">m:88213</text></g>
            <g id="x3jc"><rect className="evbox" x="115" y="90" width="100" height="46" rx="10" /><text className="evt mono" x="130" y="118">cb:1001</text></g>
          </svg>
        </div>
        <div className="vbtns" style={{ marginTop: '12px' }}><button type="button" className="vbtn go" id="x3join" onClick={join}>Follow the ID</button></div>
      </XPanel>
    </DeepDive>
  );
}
