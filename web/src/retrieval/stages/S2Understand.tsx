import { motion } from 'motion/react';
import { CodeBlock } from '../../kit/CodeBlock';
import { vars } from '../../kit/css';
import { play } from '../../kit/motion';
import { ReplayButton } from '../../kit/ReplayButton';
import { useReplay, useTimeline } from '../../kit/useTimeline';
import { Stage } from '../Stage';

/** The four parts of the question the router spots, in reading order. */
const PARTS = [
  { text: 'Sunset Tickets', color: 'var(--search)', key: 'Name: needs search' },
  { text: 'VAMP threshold', color: 'var(--onto)', key: 'Term: a metric the ontology defines' },
  { text: 'August', color: 'var(--wh)', key: 'Time: one month in the warehouse' },
  { text: 'what drove it', color: 'var(--graph)', key: 'Why: a pattern in the graph' },
];

const PLAN = `{
  "intent": "check_threshold_and_explain",
  "entities": [ { "text": "Sunset Tickets", "kind": "name", "label": "Merchant" } ],
  "concepts": [ { "text": "VAMP threshold", "concept": "pay:VampRatio" } ],
  "window": { "month": "2026-08" },
  "sub_questions": [
    { "id": "q1", "route": "warehouse", "ask": "VAMP ratio by month, June to August" },
    { "id": "q2", "route": "documents", "ask": "VAMP merchant threshold and floor" },
    { "id": "q3", "route": "graph_count", "ask": "August fraud reports on cards reported elsewhere" },
    { "id": "q4", "route": "graph_walk", "ask": "a few example cards, for the explanation" }
  ],
  "defaults": { "region": "US, from the merchant record" }
}`;

const TYPES = [
  ['Definition', '“What does 10.4 mean?”', 'text'],
  ['Lineage', '“History of auth:5521”', 'graph walk'],
  ['Metric', '“Approval rate last week?”', 'warehouse'],
  ['Pattern', '“Who shares fraud cards?”', 'graph count'],
  ['Mixed', 'This question', 'all four, in parallel'],
];

function Reading() {
  const seen = useTimeline([650, 650, 650, 650, 300]);
  const part = (i: number) => (
    <span className={'hl' + (seen > i ? ' on' : '')} style={vars({ '--hc': PARTS[i].color })}>{PARTS[i].text}</span>
  );
  return (
    <>
      <div className="qline">Was {part(0)} over Visa’s {part(1)} in {part(2)}, and {part(3)}?</div>
      <div className="hlkey">
        {PARTS.map((p, i) => (
          <motion.span key={p.key} className={seen > i ? 'on' : undefined} style={vars({ '--hc': p.color })}
            {...play(seen > i, false, { scale: [0.85, 1] }, { duration: 0.3 })}>{p.key}</motion.span>
        ))}
      </div>
      <p className="vcap">The plan the router writes</p>
      <CodeBlock code={PLAN} lang="json" {...play(seen >= 5, { opacity: 0.2 }, { opacity: [0.2, 1], y: [8, 0] }, { duration: 0.35 })} />
    </>
  );
}

export function S2Understand() {
  const [run, replay] = useReplay();
  return (
    <Stage n={2}
      idea="A small Claude call reads the question with the ontology’s terms beside it, and splits it into sub-questions, one per store that can answer it."
      keys={['It spots names, business terms, time words and “why” questions', 'Each sub-question gets a route: warehouse, graph, text or code', 'Defaults, like the merchant’s region, are recorded so the answer can state them']}>
      <Reading key={run} />
      <div className="types">
        {TYPES.map(([type, example, route]) => <div key={type}><b>{type}</b><em>{example}</em><small>{route}</small></div>)}
      </div>
      <ReplayButton label="Read it again" onClick={replay} />
    </Stage>
  );
}
