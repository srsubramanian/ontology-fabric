import { useState } from 'react';
import { CodeBlock } from '../../kit/CodeBlock';
import { useTimeline } from '../../kit/useTimeline';
import { Stage } from '../Stage';

/** The answer, sentence by sentence, with the IDs each sentence cites. */
const SENTENCES: [string, string[]][] = [
  ['Yes. Sunset Tickets’ VAMP ratio for August was 1.65%, above the 1.5% merchant threshold, with 1,952 fraud reports and disputes, over the 1,500 monitoring floor.', ['sf-q-21b8', 'visa-vamp-2026#c04']],
  ['That is a sharp jump from 0.84% in July and 0.79% in June.', ['sf-q-21b8']],
  ['The pattern points to stolen cards used across merchants: 790 of August’s 1,240 fraud reports are on 214 cards also fraud-reported at other merchants within 48 hours.', ['q-5c11']],
  ['At the Excessive level Visa assesses $8 per fraudulent or disputed transaction; the fraud runbook covers the response.', ['visa-vamp-2026#c04', 'fraud-runbook#c07']],
  ['Figures use warehouse data loaded through September 25, and US thresholds for this merchant.', ['sf-q-21b8', 'm:10442']],
];

const EVIDENCE = [
  ['sf-q-21b8', 'Snowflake: VAMP ratio by month', 'var(--wh)'],
  ['visa-vamp-2026#c04', 'OpenSearch: VAMP thresholds and fees', 'var(--search)'],
  ['q-5c11', 'Neptune: shared-card count', 'var(--graph)'],
  ['fraud-runbook#c07', 'OpenSearch: runbook passage', 'var(--search)'],
  ['m:10442', 'Neptune: merchant record, region US', 'var(--graph)'],
];

const RULES = `Answer only from the metrics, facts, passages and definitions provided.
Take every number from a query result; never calculate one yourself.
Cite the ID behind every claim, in square brackets.
State data freshness and any defaults, such as the merchant’s region.
If the context doesn’t answer part of the question, say so plainly.`;

export function S9Answer() {
  // Steps through the sentences until the reader picks one.
  const auto = useTimeline(SENTENCES.slice(1).map(() => 2000));
  const [picked, setPicked] = useState<number | null>(null);
  const current = picked ?? auto;
  const cited = SENTENCES[current][1];
  return (
    <Stage n={9}
      idea="Claude writes only from the context, and every sentence cites the store and ID it rests on."
      keys={['Numbers come from the warehouse, reasons from the graph, rules from the text', 'Every sentence carries the IDs it rests on', 'Freshness and defaults are stated, not assumed']}>
      <div className="ans">
        <div><p className="vcap">The answer, sentence by sentence</p>
          <div>
            {SENTENCES.map(([text, ids], i) => (
              <div key={i} className={'sent' + (i === current ? ' on' : '')} onClick={() => setPicked(i)}>
                {text} <sup>[{ids.length}]</sup>
              </div>
            ))}
          </div>
        </div>
        <div><p className="vcap">What each sentence rests on</p>
          <div>
            {EVIDENCE.map(([id, what, color]) => (
              <div key={id} className={'ev' + (cited.includes(id) ? ' on' : '')} style={{ boxShadow: 'inset 3px 0 0 ' + color }}>
                <code>{id}</code><br />{what}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rules8"><p className="vcap">The instructions, in short</p><CodeBlock code={RULES} lang="none" /></div>
    </Stage>
  );
}
