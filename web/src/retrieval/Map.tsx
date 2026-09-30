import { animate, motion, type AnimationPlaybackControls } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { vars } from '../kit/css';
import { reduce, tr } from '../kit/motion';
import { rounded } from '../kit/svg';
import { STAGES } from './data';
import { link } from './link';

const NODES = {
  q: { x: 20, y: 150, w: 140, t: 'Question', s: 'agent or analyst', c: 'var(--muted)', page: 1 },
  g: { x: 180, y: 150, w: 140, t: 'Gateway', s: 'identity, policy', c: 'var(--onto)', page: 1 },
  u: { x: 340, y: 150, w: 140, t: 'Understand', s: 'route and plan', c: 'var(--query)', page: 2 },
  ep: { x: 500, y: 150, w: 140, t: 'Entry points', s: 'names become IDs', c: 'var(--search)', page: 3 },
  wg: { x: 660, y: 20, w: 150, t: 'Walk the graph', s: 'Neptune', c: 'var(--graph)', page: 4 },
  cg: { x: 660, y: 110, w: 150, t: 'Count in graph', s: 'Neptune', c: 'var(--graph)', page: 5 },
  sf: { x: 660, y: 200, w: 150, t: 'Ask warehouse', s: 'Snowflake', c: 'var(--wh)', page: 6 },
  ft: { x: 660, y: 290, w: 150, t: 'Find the text', s: 'OpenSearch', c: 'var(--search)', page: 7 },
  as: { x: 840, y: 150, w: 140, t: 'Assemble', s: 'one cited context', c: 'var(--query)', page: 8 },
  an: { x: 1000, y: 150, w: 140, t: 'Answer', s: 'cited by ID', c: 'var(--query)', page: 9 },
  ck: { x: 1000, y: 262, w: 140, t: 'Check', s: 'before it leaves', c: 'var(--query)', page: 10 },
};
type NodeId = keyof typeof NODES;
const H = 58;

const EDGES = {
  qg: { f: 'q', t: 'g', p: [[160, 179], [179, 179]] },
  gu: { f: 'g', t: 'u', p: [[320, 179], [339, 179]] },
  uep: { f: 'u', t: 'ep', p: [[480, 179], [499, 179]] },
  epwg: { f: 'ep', t: 'wg', p: [[640, 164], [650, 164], [650, 49], [659, 49]] },
  epcg: { f: 'ep', t: 'cg', p: [[640, 174], [650, 174], [650, 139], [659, 139]] },
  epsf: { f: 'ep', t: 'sf', p: [[640, 184], [650, 184], [650, 229], [659, 229]] },
  epft: { f: 'ep', t: 'ft', p: [[640, 194], [650, 194], [650, 319], [659, 319]] },
  wgas: { f: 'wg', t: 'as', p: [[810, 49], [825, 49], [825, 164], [839, 164]] },
  cgas: { f: 'cg', t: 'as', p: [[810, 139], [825, 139], [825, 174], [839, 174]] },
  sfas: { f: 'sf', t: 'as', p: [[810, 229], [825, 229], [825, 184], [839, 184]] },
  ftas: { f: 'ft', t: 'as', p: [[810, 319], [825, 319], [825, 194], [839, 194]] },
  asan: { f: 'as', t: 'an', p: [[980, 179], [999, 179]] },
  anck: { f: 'an', t: 'ck', p: [[1070, 208], [1070, 261]] },
} satisfies Record<string, { f: NodeId; t: NodeId; p: [number, number][] }>;
type EdgeId = keyof typeof EDGES;

/** Packet colours on the four parallel lanes; everything else travels in the retrieval colour. */
const LANE: Partial<Record<EdgeId, string>> = {
  epwg: 'var(--graph)', epcg: 'var(--graph)', epsf: 'var(--wh)', epft: 'var(--search)',
  wgas: 'var(--graph)', cgas: 'var(--graph)', sfas: 'var(--wh)', ftas: 'var(--search)',
};

/** Example questions. Each wave is a set of edges whose packets travel at the same time. */
const QS: { type: string; q: string; waves: EdgeId[][]; why: string }[] = [
  { type: 'Definition', q: 'What does Visa reason code 10.4 mean?', waves: [['qg'], ['gu'], ['uep'], ['epft'], ['ftas'], ['asan'], ['anck']],
    why: 'Resolve “10.4” to its ReasonCode node, then read the passages that mention it.' },
  { type: 'Lineage', q: 'Show the full history of authorization auth:5521.', waves: [['qg'], ['gu'], ['uep'], ['epwg'], ['wgas'], ['asan'], ['anck']],
    why: 'The ID is already known, so the walk starts from it and follows the lifecycle relationships.' },
  { type: 'Metric', q: 'What was Sunset Tickets’ approval rate last week?', waves: [['qg'], ['gu'], ['uep'], ['epsf'], ['sfas'], ['asan'], ['anck']],
    why: 'Resolve the merchant, then ask Snowflake. A rate over every transaction is a warehouse job.' },
  { type: 'Pattern', q: 'Which merchants share the most fraud-reported cards with Sunset Tickets?', waves: [['qg'], ['gu'], ['uep'], ['epcg'], ['cgas'], ['asan'], ['anck']],
    why: 'Resolve the merchant, then count along card relationships in Neptune.' },
  { type: 'Mixed', q: 'Was Sunset Tickets over Visa’s VAMP threshold in August, and what drove it?',
    waves: [['qg'], ['gu'], ['uep'], ['epwg', 'epcg', 'epsf', 'epft'], ['wgas', 'cgas', 'sfas', 'ftas'], ['asan'], ['anck']],
    why: 'All four lanes run in parallel: the warehouse for the ratio, the graph for the pattern and its size, the text for the rules. The stage pages follow this question.' },
];
const MIXED = QS.length - 1;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Sends a glowing dot along `path`, drawn into `layer`. Resolves when it arrives. */
function packet(layer: SVGGElement, path: SVGPathElement, color: string, running: Set<AnimationPlaybackControls>) {
  const len = path.getTotalLength();
  const g = layer.appendChild(document.createElementNS(SVG_NS, 'g'));
  const halo = g.appendChild(document.createElementNS(SVG_NS, 'circle'));
  halo.setAttribute('r', '9'); halo.setAttribute('opacity', '0.22'); halo.style.fill = color;
  const dot = g.appendChild(document.createElementNS(SVG_NS, 'circle'));
  dot.setAttribute('r', '4.5');
  Object.assign(dot.style, { fill: color, stroke: 'var(--raised)', strokeWidth: '1.5' });
  const put = (v: number) => {
    const pt = path.getPointAtLength(v * len);
    g.setAttribute('transform', 'translate(' + pt.x + ',' + pt.y + ')');
  };
  put(0);
  const run = animate(0, 1, { duration: Math.min(1.1, 0.35 + len / 420), ease: [0.45, 0, 0.2, 1], onUpdate: put });
  running.add(run);
  return run.then(() => { running.delete(run); g.remove(); });
}

type Pick = { i: number; nonce: number };

/** The pipeline map, the example questions that light up their route, and the list of stages. */
export function RetrievalMap({ autoplay }: { autoplay: boolean }) {
  const [pick, setPick] = useState<Pick | null>(null);
  const edgeEls = useRef<Partial<Record<EdgeId, SVGPathElement | null>>>({});
  const layer = useRef<SVGGElement>(null);
  const why = useRef<HTMLParagraphElement>(null);

  const choose = (i: number) => setPick((p) => ({ i, nonce: (p?.nonce ?? 0) + 1 }));

  // On first load at the map, play the mixed question.
  useEffect(() => {
    if (!autoplay) return;
    const t = window.setTimeout(() => choose(MIXED), reduce ? 0 : 500);
    return () => clearTimeout(t);
  }, [autoplay]);

  // Fade the explanation in, and send packets along the route, one wave at a time.
  useEffect(() => {
    if (!pick) return;
    if (why.current) animate(why.current, { opacity: [0, 1] }, tr({ duration: 0.3 }));
    if (reduce || !layer.current) return;
    const running = new Set<AnimationPlaybackControls>();
    const g = layer.current;
    let live = true;
    (async () => {
      for (const wave of QS[pick.i].waves) {
        if (!live) return;
        await Promise.all(wave.map((k) => packet(g, edgeEls.current[k]!, LANE[k] ?? 'var(--query)', running)));
      }
    })();
    return () => { live = false; running.forEach((r) => r.stop()); g.replaceChildren(); };
  }, [pick]);

  const litEdges = new Set<EdgeId>(pick ? QS[pick.i].waves.flat() : []);
  const litNodes = new Set<NodeId>(['q']);
  litEdges.forEach((k) => { litNodes.add(EDGES[k].f); litNodes.add(EDGES[k].t); });

  return (
    <>
      <div className="xwrap">
        <svg className="pmap" viewBox="0 0 1160 360" role="img" aria-label="Retrieval pipeline: question, gateway, understand, entry points, then four parallel lanes: walk the graph, count in the graph, ask the warehouse, find the text; then assemble, answer and check">
          <g>
            {(Object.keys(EDGES) as EdgeId[]).map((k) => (
              <path key={k} ref={(el) => { edgeEls.current[k] = el; }} d={rounded(EDGES[k].p)} className={'pe' + (litEdges.has(k) ? ' on' : '')} />
            ))}
          </g>
          <g>
            {(Object.keys(NODES) as NodeId[]).map((k) => {
              const n = NODES[k];
              const go = () => { location.hash = link('s' + n.page); };
              const on = pick !== null && litNodes.has(k);
              return (
                <motion.g
                  key={k} className={'pn' + (on ? ' on' : '')} style={vars({ '--c': n.c })}
                  tabIndex={0} role="link" aria-label={n.t + ', stage ' + n.page}
                  onClick={go}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}
                  initial={false} animate={{ opacity: pick && !on ? 0.3 : 1 }} transition={tr({ duration: 0.3 })}
                >
                  <rect className="box" x={n.x} y={n.y} width={n.w} height={H} rx={9} />
                  <rect className="bar" x={n.x + 8} y={n.y + 12} width={3} height={H - 24} rx={1.5} />
                  <text className="t" x={n.x + 20} y={n.y + 25}>{n.t}</text>
                  <text className="s" x={n.x + 20} y={n.y + 43}>{n.s}</text>
                </motion.g>
              );
            })}
          </g>
          {/* Packets are drawn here directly, outside React, while they travel. */}
          <g ref={layer} aria-hidden="true" />
        </svg>
      </div>
      <div className="legend">
        <span style={vars({ '--c': 'var(--graph)' })}><i></i>Neptune: how things connect</span>
        <span style={vars({ '--c': 'var(--wh)' })}><i></i>Snowflake: how much, how often</span>
        <span style={vars({ '--c': 'var(--search)' })}><i></i>OpenSearch: what the text says</span>
        <span style={vars({ '--c': 'var(--query)' })}><i></i>Retrieval service and Claude</span>
        <span style={vars({ '--c': 'var(--onto)' })}><i></i>Gateway</span>
      </div>
      <div className="qpick" role="group" aria-label="Example questions">
        {QS.map((q, i) => (
          <button key={q.type} type="button" className="qbtn" aria-pressed={pick?.i === i} onClick={() => choose(i)}>
            <b>{q.type}</b>{q.q}
          </button>
        ))}
      </div>
      <p className="qwhy" ref={why} aria-live="polite">{pick ? QS[pick.i].why : ''}</p>
      <ol className="stages">
        {STAGES.map((s, i) => (
          <li key={s.title}>
            <a href={link('s' + (i + 1))} style={vars({ '--c': s.color })}>
              <span className="n">{i + 1}</span><b>{s.title}</b><span>{s.tag}</span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}
