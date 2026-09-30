import { motion } from 'motion/react';
import { CodeBlock } from '../../kit/CodeBlock';
import { vars } from '../../kit/css';
import { play, tr } from '../../kit/motion';
import { ReplayButton } from '../../kit/ReplayButton';
import { useReplay, useTimeline } from '../../kit/useTimeline';
import { QUESTION } from '../data';
import { Stage } from '../Stage';

type Item = { text: string; id: string; tokens: number; drop?: boolean };

/** What each store contributes, and what each item costs in tokens (illustrative). */
const TRAYS: { color: string; title: string; from: string; items: Item[] }[] = [
  { color: 'var(--wh)', title: 'Metrics', from: 'from Snowflake', items: [
    { text: 'VAMP ratio: Jun 0.79%, Jul 0.84%, Aug 1.65%', id: 'sf-q-21b8', tokens: 520 },
    { text: 'August: 1,952 events, 118,300 transactions', id: 'sf-q-21b8', tokens: 140 },
    { text: 'Loaded through Sep 25, 02:00 UTC', id: 'freshness', tokens: 60 },
  ] },
  { color: 'var(--graph)', title: 'Facts', from: 'from Neptune', items: [
    { text: 'Sunset Tickets, online ticketing, US', id: 'm:10442', tokens: 180 },
    { text: '790 of 1,240 reports on 214 shared cards', id: 'q-5c11', tokens: 260 },
  ] },
  { color: 'var(--search)', title: 'Passages', from: 'from OpenSearch', items: [
    { text: 'Visa VAMP: thresholds and fees', id: 'visa-vamp-2026#c04', tokens: 1900 },
    { text: 'Runbook: stolen-card fraud response', id: 'fraud-runbook#c07', tokens: 1700 },
    { text: 'Glossary: TC40 and TC15', id: 'glossary#c15', tokens: 900, drop: true },
  ] },
  { color: 'var(--onto)', title: 'Definitions', from: 'from the ontology', items: [
    { text: 'VAMP ratio', id: 'pay:VampRatio', tokens: 240 },
    { text: 'Fraud report', id: 'pay:FraudReport', tokens: 200 },
  ] },
];
const ALL = TRAYS.flatMap((t) => t.items);
const BUDGET = 6000;

const PACKAGE = `{
  "question": "${QUESTION}",
  "ontology_version": "1.6.0",
  "defaults": { "region": "US" },
  "metrics": [
    { "id": "sf-q-21b8", "source": "snowflake", "fresh_through": "2026-09-25T02:00Z",
      "rows": [ { "month": "2026-06", "vamp_ratio": 0.0079 },
                { "month": "2026-07", "vamp_ratio": 0.0084 },
                { "month": "2026-08", "vamp_ratio": 0.0165, "vamp_events": 1952, "settled_cnp": 118300 } ] }
  ],
  "facts": [
    { "id": "m:10442", "type": "Merchant", "name": "Sunset Tickets", "region": "US" },
    { "id": "q-5c11", "source": "neptune", "shared_card_reports": 790, "of": 1240, "cards": 214 }
  ],
  "passages": [ { "id": "visa-vamp-2026#c04", "text": "…" }, { "id": "fraud-runbook#c07", "text": "…" } ],
  "definitions": [ { "concept": "pay:VampRatio", "definition": "(Visa fraud reports + disputes) / settled CNP transactions…" } ]
}`;

function Pack() {
  // One item arrives every 240 ms, in tray order.
  const arrived = useTimeline(ALL.map(() => 240));
  const used = ALL.slice(0, arrived).reduce((sum, it) => sum + (it.drop ? 0 : it.tokens), 0);
  let index = 0;
  return (
    <>
      <div className="trays trays4">
        {TRAYS.map((t) => (
          <div key={t.title} className="tray" style={vars({ '--c': t.color })}>
            <header><b>{t.title}</b><small>{t.from}</small></header>
            <div className="items">
              {t.items.map((it) => {
                const shown = index++ < arrived;
                return (
                  <motion.div key={it.text} className={'item' + (it.drop && shown ? ' drop' : '')}
                    {...play(shown, { opacity: 0 }, { opacity: [0, it.drop ? 0.35 : 1], x: [-8, 0] }, { duration: 0.3 })}>
                    {it.text}<code>{it.id}</code>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="budget">
        <span>Token budget</span>
        <div className="btrack">
          <motion.i initial={{ width: '0%' }} animate={{ width: Math.min(100, (used / BUDGET) * 100) + '%' }} transition={tr({ duration: 0.3 })} />
          <span className="lim"></span>
        </div>
        <span>{used.toLocaleString('en-US')} of {BUDGET.toLocaleString('en-US')}</span>
      </div>
    </>
  );
}

export function S8Assemble() {
  const [run, replay] = useReplay();
  return (
    <Stage n={8}
      idea="Results from all three stores, plus the ontology’s definitions, are packed into one context. Everything carries the ID Claude will cite."
      keys={['Each store’s results arrive tagged with query or document IDs', 'Data freshness travels with the warehouse numbers', 'A token budget keeps it focused; the lowest-ranked items go first']}>
      <Pack key={run} />
      <p className="note">Illustrative budget. The glossary passage is dropped: the ontology’s definitions already cover it.</p>
      <ReplayButton label="Pack it again" onClick={replay} />
      <p className="vcap" style={{ marginTop: 14 }}>The context package</p>
      <CodeBlock code={PACKAGE} lang="json" />
    </Stage>
  );
}
