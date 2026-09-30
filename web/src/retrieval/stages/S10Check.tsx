import { motion } from 'motion/react';
import { CodeBlock } from '../../kit/CodeBlock';
import { play } from '../../kit/motion';
import { ReplayButton } from '../../kit/ReplayButton';
import { useReplay, useTimeline } from '../../kit/useTimeline';
import { Stage } from '../Stage';

const CHECKS = [
  'Every cited ID is in the context package',
  'Every number matches a query result',
  'The threshold matches the rules for a US merchant',
  'Data freshness is stated',
  'The caller may see every cited source',
];
/** The number check catches a slip first, then passes once the sentence is regenerated. */
const CAUGHT = 1;

const AUDIT = `{
  "trace": "9b41-2e07",
  "caller": "risk-agent",
  "ontology_version": "1.6.0",
  "entities": ["m:10442"],
  "neptune_queries": ["q-5c11"],
  "snowflake": { "query_id": "sf-q-21b8", "role": "RISK_ANALYST_RO",
                 "warehouse": "RISK_XS", "fresh_through": "2026-09-25T02:00Z" },
  "passages": ["visa-vamp-2026#c04", "fraud-runbook#c07"],
  "checks": { "citations": "pass", "numbers": "fixed", "threshold": "pass",
              "freshness": "pass", "access": "pass" }
}`;

function Checks() {
  // Steps: 1 first check passes; 2 the slip is caught; 3 it passes after the fix; 4–6 the rest pass.
  const step = useTimeline([450, 450, 1300, 450, 450, 450]);
  return (
    <>
      <div className="checks">
        {CHECKS.map((text, i) => {
          // Checks after the caught one pass a step later, because the fix takes a step.
          const ok = step >= (i < CAUGHT ? i + 1 : i + 2);
          const fix = i === CAUGHT && step === CAUGHT + 1;
          return (
            <div key={text} className={'chk' + (ok ? ' ok' : '') + (fix ? ' fix' : '')}>
              <motion.i {...play(ok, false, { scale: [0.4, 1] }, { duration: 0.25 })}>{ok ? '✓' : fix ? '!' : ''}</motion.i>
              <span>{text}</span>
            </div>
          );
        })}
      </div>
      <motion.div className="fixbox" {...play(step >= 2, { opacity: 0 }, { opacity: [0, 1], y: [8, 0] }, { duration: 0.35 })}>
        Number check caught a slip: “August had <del>1,592</del> <ins>1,952</ins> fraud reports and disputes.” The digits were transposed; the sentence is regenerated from the Snowflake result.
      </motion.div>
    </>
  );
}

export function S10Check() {
  const [run, replay] = useReplay();
  return (
    <Stage n={10}
      idea="Before the answer leaves, code checks it against every store’s results. Claude isn’t trusted to check itself."
      keys={['Every number must match a query result from Snowflake or Neptune', 'The threshold must match the rules passage for the merchant’s region', 'Freshness must be stated, and the caller must be allowed to see every source']}>
      <Checks key={run} />
      <ReplayButton label="Check again" onClick={replay} />
      <p className="vcap" style={{ marginTop: 14 }}>What gets logged for audit</p>
      <CodeBlock code={AUDIT} lang="json" />
    </Stage>
  );
}
