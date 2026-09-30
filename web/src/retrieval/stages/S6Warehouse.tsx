import { motion } from 'motion/react';
import { CodeBlock } from '../../kit/CodeBlock';
import { vars } from '../../kit/css';
import { EASE_OUT, play, tr } from '../../kit/motion';
import { rounded } from '../../kit/svg';
import { ReplayButton } from '../../kit/ReplayButton';
import { useReplay, useTimeline } from '../../kit/useTimeline';
import { Stage } from '../Stage';

/** Sunset Tickets' VAMP ratio by month (illustrative), against Visa's 1.5% merchant threshold. */
const MONTHS = [
  { month: 'June', ratio: 0.79, events: '945 events / 119,600', over: false },
  { month: 'July', ratio: 0.84, events: '1,020 events / 121,400', over: false },
  { month: 'August', ratio: 1.65, events: '1,952 events / 118,300', over: true },
];
const THRESHOLD = 1.5;
/** Pixels per percentage point: 2% fills the 190 px chart. */
const SCALE = 190 / 2.0;

const METRIC = `metrics:
  vamp_ratio:
    label: VAMP ratio
    definition: >-
      (Visa fraud reports + Visa disputes) divided by
      settled Visa card-not-present transactions, per month
    numerator: [FraudReport, Dispute]   # a fraud dispute can count twice
    denominator: SettledTransaction where channel = CNP
    grain: month
    snowflake: generated into a semantic view
    owner: merchant-risk`;

const SQL = `WITH settled AS (
  SELECT DATE_TRUNC('month', settled_at) AS month, COUNT(*) AS n
  FROM fct_settled_txn
  WHERE merchant_id = :merchant AND network = 'VISA'
    AND channel = 'CNP' AND settled_at >= :from
  GROUP BY 1
), events AS (
  SELECT DATE_TRUNC('month', event_at) AS month, COUNT(*) AS n
  FROM (
    SELECT reported_at AS event_at FROM fct_fraud_report
      WHERE merchant_id = :merchant AND network = 'VISA'
    UNION ALL
    SELECT opened_at FROM fct_dispute
      WHERE merchant_id = :merchant AND network = 'VISA'
  ) e
  WHERE event_at >= :from
  GROUP BY 1
)
SELECT s.month, e.n AS vamp_events, s.n AS settled_cnp,
       ROUND(e.n / s.n, 4) AS vamp_ratio
FROM settled s JOIN events e USING (month)
ORDER BY s.month;`;

function Chart() {
  const step = useTimeline([1500, 500]);
  return (
    <>
      <div className="bars">
        <motion.div className="thr" style={{ bottom: THRESHOLD * SCALE }} {...play(step >= 1, { opacity: 0 }, { opacity: [0, 1] }, { duration: 0.4 })}>
          <span>1.5% threshold</span>
        </motion.div>
        {MONTHS.map((m, i) => (
          <div key={m.month} className="col">
            <span className="val">{m.ratio.toFixed(2)}%</span>
            <motion.div className={'bar' + (m.over ? ' over' : '')} initial={{ height: 0 }} animate={{ height: m.ratio * SCALE }}
              transition={tr({ duration: 0.7, delay: 0.2 + i * 0.3, ease: EASE_OUT })} />
          </div>
        ))}
      </div>
      <div className="months">
        {MONTHS.map((m, i) => (
          <div key={m.month}>{m.month}<small>{m.events}</small>
            <motion.span className={'floor ' + (m.over ? 'yes' : 'no')}
              {...play(step >= 2, { opacity: 0 }, { opacity: [0, 1], scale: [0.8, 1] }, { duration: 0.3, delay: i * 0.2 })}>
              {m.over ? 'over the floor and threshold' : 'under the 1,500 floor'}
            </motion.span>
          </div>
        ))}
      </div>
    </>
  );
}

type Pt = readonly [number, number];
type Colour = '--query' | '--wh' | '--bad';

// How a question reaches Snowflake: a reviewed template when one fits, otherwise Cortex Analyst
// writes SQL from the semantic view and hands it back, and our validator checks it before it runs.
// `at` is the timeline step that shows each part.
const NODES: { at: number; c: Colour; x: number; y: number; w: number; t: string; s: string; strong?: boolean }[] = [
  { at: 0, c: '--query', x: 10, y: 96, w: 130, t: 'Question', s: 'how much, how often' },
  { at: 0, c: '--query', x: 162, y: 96, w: 128, t: 'Template fits?', s: 'matched by intent' },
  { at: 1, c: '--query', x: 332, y: 14, w: 196, t: 'Reviewed template', s: 'vamp_ratio, via a connector' },
  { at: 1, c: '--wh', x: 722, y: 96, w: 130, t: 'Snowflake', s: 'read-only role', strong: true },
  { at: 2, c: '--wh', x: 332, y: 178, w: 172, t: 'Cortex Analyst', s: 'SQL from a semantic view' },
  { at: 3, c: '--query', x: 540, y: 178, w: 140, t: 'Our validator', s: 'read-only, a LIMIT' },
];
const EDGES: { at: number; c: Colour; pts: Pt[]; label?: string; lx?: number; ly?: number; dashed?: boolean }[] = [
  { at: 0, c: '--query', pts: [[140, 120], [162, 120]] },
  { at: 1, c: '--query', pts: [[290, 112], [310, 112], [310, 38], [332, 38]], label: 'yes', lx: 316, ly: 80 },
  { at: 1, c: '--wh', pts: [[528, 38], [787, 38], [787, 96]] },
  { at: 2, c: '--query', pts: [[290, 128], [310, 128], [310, 202], [332, 202]], label: 'no', lx: 316, ly: 168 },
  { at: 3, c: '--wh', pts: [[504, 202], [540, 202]], label: 'SQL', lx: 522, ly: 194 },
  { at: 4, c: '--bad', pts: [[610, 226], [610, 246], [418, 246], [418, 226]], label: 'rejected: the error goes back', lx: 514, ly: 261, dashed: true },
  { at: 5, c: '--query', pts: [[680, 202], [787, 202], [787, 144]], label: 'passes', lx: 733, ly: 194 },
];
const CAPTIONS = [
  'Most questions match a reviewed template',
  'A match runs the template’s reviewed SQL',
  'No match: Cortex Analyst writes SQL from the semantic view, and hands it back',
  'Our validator checks it like any generated query',
  'A rejection goes back with the error and the allowed options',
  'A pass runs read-only, under the caller’s Snowflake role',
];

/** An arrowhead at the end of `pts`, pointing along the last segment. */
function head(pts: Pt[]): string {
  const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
  const l = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / l, uy = (y2 - y1) / l;
  const bx = x2 - ux * 9, by = y2 - uy * 9;
  return `${x2},${y2} ${bx - uy * 4.5},${by + ux * 4.5} ${bx + uy * 4.5},${by - ux * 4.5}`;
}

function Route() {
  const step = useTimeline([700, 1500, 1000, 1000, 1100]);
  return (
    <div className="xwrap">
      <svg className="svgv route" viewBox="0 0 860 266" role="img"
        aria-label="A question runs a reviewed template when one fits. Otherwise Cortex Analyst writes SQL from the semantic view, our validator checks it, and only then does it run read-only in Snowflake.">
        {EDGES.map((e, i) => {
          const on = step >= e.at;
          // A dashed line can't draw itself in with pathLength, so it fades in instead.
          const draw = e.dashed ? { opacity: [0, 1] } : { pathLength: [0, 1], opacity: [1, 1] };
          const after = { duration: 0.25, delay: 0.3 };
          return (
            <g key={i} style={vars({ '--c': `var(${e.c})` })}>
              <motion.path className={'re' + (e.dashed ? ' dash' : '')} d={rounded(e.pts)}
                {...play(on, { opacity: 0 }, draw, { duration: 0.45, ease: EASE_OUT })} />
              <motion.polygon className="rh" points={head(e.pts)} {...play(on, { opacity: 0 }, { opacity: [0, 1] }, after)} />
              {e.label && (
                <motion.text className="rl" x={e.lx} y={e.ly} textAnchor={e.lx! > 400 ? 'middle' : 'start'}
                  {...play(on, { opacity: 0 }, { opacity: [0, 1] }, after)}>{e.label}</motion.text>
              )}
            </g>
          );
        })}
        {NODES.map((n) => (
          <motion.g key={n.t} className={'rn' + (n.strong ? ' strong' : '')} style={vars({ '--c': `var(${n.c})` })}
            {...play(step >= n.at, { opacity: 0 }, { opacity: [0, 1], scale: [0.9, 1] }, { duration: 0.35 })}>
            <rect className="box" x={n.x} y={n.y} width={n.w} height={48} rx={9} />
            <text className="t" x={n.x + 12} y={n.y + 20}>{n.t}</text>
            <text className="s" x={n.x + 12} y={n.y + 37}>{n.s}</text>
          </motion.g>
        ))}
      </svg>
      <p className="rcap">{CAPTIONS[step]}</p>
    </div>
  );
}

export function S6Warehouse() {
  const [run, replay] = useReplay();
  return (
    <Stage n={6}
      idea="Snowflake holds every transaction. It answers “how much” and “how often”, using a metric the ontology defines once."
      keys={['The metric is defined once in the ontology and generated into Snowflake', 'The ratio is computed in SQL, never by the model', 'No template? Cortex Analyst writes the SQL, and our validator checks it first', 'Snowflake’s own role and row policies decide what the caller sees']}>
      <p className="vcap">Sunset Tickets’ VAMP ratio by month, from Snowflake</p>
      <Chart key={run} />
      <span className="fresh">Data loaded through Sep 25, 02:00 UTC</span>
      <div className="guards wh">
        {['read-only role', 'row access policy', '30-second timeout', 'result cache', 'query tagged with the trace ID'].map((g) => <span key={g}>{g}</span>)}
      </div>
      <p className="vcap" style={{ marginTop: 18 }}>How a question reaches Snowflake</p>
      <Route key={run} />
      <ReplayButton label="Run it again" onClick={replay} />
      <div className="stack6">
        <div><p className="vcap">The metric, defined once in the ontology</p><CodeBlock code={METRIC} lang="yaml" /></div>
        <div><p className="vcap">The reviewed SQL template it runs</p><CodeBlock code={SQL} lang="sql" /></div>
      </div>
      <p className="note">Illustrative figures. Events are Visa fraud reports plus disputes, so a fraud dispute can count twice, as the metric definition warns.</p>
    </Stage>
  );
}
