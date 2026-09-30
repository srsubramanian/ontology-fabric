import { motion } from 'motion/react';
import { CodeBlock } from '../../kit/CodeBlock';
import { vars } from '../../kit/css';
import { play } from '../../kit/motion';
import { ReplayButton } from '../../kit/ReplayButton';
import { useReplay, useTimeline } from '../../kit/useTimeline';
import { Stage } from '../Stage';

/** Which engine counts what. The first one, Neptune, gets this question. */
const ENGINES = [
  { color: 'var(--graph)', name: 'Neptune', does: 'counts along relationships', asks: '“How many of these fraud reports are on cards also reported elsewhere?”' },
  { color: 'var(--wh)', name: 'Snowflake', does: 'sums over big tables and time', asks: '“What share of August’s transactions were reported or disputed?”' },
  { color: 'var(--search)', name: 'OpenSearch', does: 'finds and ranks text', asks: '“What does Visa say the threshold is?”' },
];

const PATTERN = `MATCH (m:Merchant {id: $merchant})<-[:AT_MERCHANT]-(a:Authorization)
      <-[:REPORTS]-(f:FraudReport)
WHERE f.reported_on >= $from AND f.reported_on < $to
MATCH (a)-[:WITH_CARD]->(c:Card)<-[:WITH_CARD]-(a2:Authorization)
      -[:AT_MERCHANT]->(m2:Merchant)
MATCH (a2)<-[:REPORTS]-(:FraudReport)
WHERE m2 <> m AND abs(a2.authorized_ms - a.authorized_ms) <= 172800000
RETURN count(DISTINCT f) AS shared_card_reports,
       count(DISTINCT c) AS cards`;

function Count() {
  // Each engine lights in turn, then Neptune is chosen, then the result appears.
  const step = useTimeline([450, 450, 450, 400, 700]);
  return (
    <>
      <div className="eng">
        {ENGINES.map((e, i) => (
          <motion.div key={e.name} className={i === 0 && step >= 4 ? 'on' : undefined} style={vars({ '--c': e.color })}
            {...play(step > i, false, { opacity: [0.4, 1], y: [6, 0] }, { duration: 0.3 })}>
            <b>{e.name}</b>{e.does}<em>{e.asks}</em>
          </motion.div>
        ))}
      </div>
      <p className="vcap">The pattern template, run on Neptune</p>
      <CodeBlock code={PATTERN} lang="cypher" />
      <motion.div className="result" {...play(step >= 5, { opacity: 0 }, { opacity: [0, 1], y: [8, 0] }, { duration: 0.4 })}>
        790 of August’s 1,240 fraud reports are on <b>214 cards</b> also fraud-reported at other merchants within 48 hours. <code>[q-5c11]</code>
      </motion.div>
    </>
  );
}

export function S5CountGraph() {
  const [run, replay] = useReplay();
  return (
    <Stage n={5}
      idea="Some counts follow relationships. Those belong in Neptune; sums over huge tables belong in the warehouse."
      keys={['If the count follows relationships, ask Neptune', 'If it sums or averages over huge tables or time, ask Snowflake', 'Common counts run reviewed templates; new ones get checked Cypher']}>
      <Count key={run} />
      <ReplayButton label="Show it again" onClick={replay} />
    </Stage>
  );
}
