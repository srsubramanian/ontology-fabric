import { motion } from 'motion/react';
import { play } from '../../kit/motion';
import { ReplayButton } from '../../kit/ReplayButton';
import { useReplay, useTimeline } from '../../kit/useTimeline';
import { Stage } from '../Stage';

// The walk, laid out in three columns: merchant, cards, other merchants. IDs are illustrative.
const MERCHANT = { x: 20, y: 141, w: 150, t: 'm:10442', s: 'Sunset Tickets' };
const CARDS = [
  { id: 'c1', t: 'card tk_1a3', y: 18, d: 'Aug 12' },
  { id: 'c2', t: 'card tk_7c9', y: 96, d: 'Aug 14' },
  { id: 'c3', t: 'card tk_9f2', y: 174, d: 'Aug 19' },
  { id: 'c4', t: 'card tk_c41', y: 252, d: 'Aug 22' },
];
const OTHERS = [
  { id: 'o1', t: 'm:31007', s: 'Gamer Hub', y: 30 },
  { id: 'o2', t: 'm:44120', s: 'Gift Card Hub', y: 141 },
  { id: 'o3', t: 'm:52301', s: 'Stream Plus', y: 252 },
];
/** Card, other merchant, and how long after the Sunset Tickets report it was reported there. */
const LINKS = [['c1', 'o1', '+2h'], ['c1', 'o2', '+6h'], ['c2', 'o1', '+30h'], ['c3', 'o2', '+1h'], ['c3', 'o3', '+20h'], ['c4', 'o3', '+3h']];

const HOPS = [
  'start: the merchant',
  'hops 1–2: August’s fraud reports, and the cards behind them',
  'hops 3–4: the same cards, fraud-reported at other merchants within 48 hours',
];

type Edge = { key: string; d: string; label: string; lx: number; ly: number };
const my = MERCHANT.y + 22;
const LEFT: Edge[] = CARDS.map((c) => {
  const cy = c.y + 22;
  return { key: c.id, d: 'M310,' + cy + ' L171,' + my, label: c.d, lx: 310 - 0.28 * 139, ly: cy + 0.28 * (my - cy) - 6 };
});
const RIGHT: Edge[] = LINKS.map(([cid, oid, label]) => {
  const y1 = CARDS.find((c) => c.id === cid)!.y + 22, y2 = OTHERS.find((o) => o.id === oid)!.y + 22;
  return { key: cid + oid, d: 'M450,' + y1 + ' L609,' + y2, label, lx: 450 + 0.72 * 159, ly: y1 + 0.72 * (y2 - y1) - 6 };
});

function Node({ x, y, w, t, s }: { x: number; y: number; w: number; t: string; s: string }) {
  return (
    <>
      <rect className="box" x={x} y={y} width={w} height={44} rx={9} />
      <text className="t" x={x + 12} y={y + 19}>{t}</text>
      <text className="s" x={x + 12} y={y + 35}>{s}</text>
    </>
  );
}

/** Edges and their labels fade in, one after another, once `on` is true. */
function Edges({ edges, on, gap }: { edges: Edge[]; on: boolean; gap: number }) {
  return edges.map((e, i) => (
    <g key={e.key}>
      <motion.path className="ge bad" d={e.d} {...play(on, { opacity: 0 }, { opacity: [0, 1] }, { duration: 0.4, delay: i * gap })} />
      <motion.text className="gl bad" x={e.lx} y={e.ly} textAnchor="middle"
        {...play(on, { opacity: 0 }, { opacity: [0, 1] }, { duration: 0.3, delay: 0.2 + i * gap })}>{e.label}</motion.text>
    </g>
  ));
}

function Walk() {
  const hop = useTimeline([700, 1600]);
  const grow = { opacity: [0, 1], scale: [0.8, 1] };
  return (
    <div className="xwrap">
      <svg className="svgv" viewBox="0 0 780 330" role="img" aria-label="Sunset Tickets' fraud-reported cards were also fraud-reported at three other merchants within hours">
        <g>
          <Edges edges={LEFT} on={hop >= 1} gap={0.12} />
          <Edges edges={RIGHT} on={hop >= 2} gap={0.1} />
        </g>
        <g>
          <motion.g className="gn m" {...play(true, {}, { scale: [0.85, 1] }, { duration: 0.4 })}>
            <Node {...MERCHANT} />
          </motion.g>
          {CARDS.map((c, i) => (
            <motion.g key={c.id} className="gn" {...play(hop >= 1, { opacity: 0 }, grow, { duration: 0.4, delay: 0.1 + i * 0.12 })}>
              <Node x={310} y={c.y} w={140} t={c.t} s="fraud-reported here" />
            </motion.g>
          ))}
          {OTHERS.map((o, i) => (
            <motion.g key={o.id} className="gn o" {...play(hop >= 2, { opacity: 0 }, grow, { duration: 0.4, delay: 0.3 + i * 0.15 })}>
              <Node x={610} y={o.y} w={160} t={o.t} s={o.s} />
            </motion.g>
          ))}
        </g>
        <text className="hopc" x={20} y={320}>{HOPS[hop]}</text>
      </svg>
    </div>
  );
}

export function S4WalkGraph() {
  const [run, replay] = useReplay();
  return (
    <Stage n={4}
      idea="To answer “what drove it”, Neptune follows the cards behind August’s fraud reports to see where else they were used."
      keys={['The walk starts from the merchant’s ID, never from a scan', 'It follows only the relationships this pattern needs', 'Limits come from the template: 4 hops, 500 nodes, 3 seconds']}>
      <Walk key={run} />
      <p className="note">Arrows fold in two hops each: card to authorization to merchant. Red means the authorization carries a fraud report. Four of 214 cards shown.</p>
      <ReplayButton label="Walk again" onClick={replay} />
    </Stage>
  );
}
