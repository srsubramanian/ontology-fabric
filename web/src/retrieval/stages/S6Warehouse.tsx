import { motion } from 'motion/react';
import { CodeBlock } from '../../kit/CodeBlock';
import { EASE_OUT, play, tr } from '../../kit/motion';
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

export function S6Warehouse() {
  const [run, replay] = useReplay();
  return (
    <Stage n={6}
      idea="Snowflake holds every transaction. It answers “how much” and “how often”, using a metric the ontology defines once."
      keys={['The metric is defined once in the ontology and generated into Snowflake', 'The ratio is computed in SQL, never by the model', 'Snowflake’s own role and row policies decide what the caller sees']}>
      <p className="vcap">Sunset Tickets’ VAMP ratio by month, from Snowflake</p>
      <Chart key={run} />
      <span className="fresh">Data loaded through Sep 25, 02:00 UTC</span>
      <div className="guards wh">
        {['read-only role', 'row access policy', '30-second timeout', 'result cache', 'query tagged with the trace ID'].map((g) => <span key={g}>{g}</span>)}
      </div>
      <ReplayButton label="Run it again" onClick={replay} />
      <div className="stack6">
        <div><p className="vcap">The metric, defined once in the ontology</p><CodeBlock code={METRIC} lang="yaml" /></div>
        <div><p className="vcap">The reviewed SQL template it runs</p><CodeBlock code={SQL} lang="sql" /></div>
      </div>
      <p className="note">Illustrative figures. Events are Visa fraud reports plus disputes, so a fraud dispute can count twice, as the metric definition warns.</p>
    </Stage>
  );
}
