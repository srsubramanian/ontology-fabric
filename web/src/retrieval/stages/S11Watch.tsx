import { motion } from 'motion/react';
import { vars } from '../../kit/css';
import { EASE_OUT, tr } from '../../kit/motion';
import { ReplayButton } from '../../kit/ReplayButton';
import { useReplay } from '../../kit/useTimeline';
import { Stage } from '../Stage';

/** Where the time goes for the mixed question: stage, start and length in ms (illustrative). */
const WATERFALL: [string, number, number, string][] = [
  ['Gateway', 0, 20, 'var(--onto)'],
  ['Understand', 20, 650, 'var(--query)'],
  ['Entry points', 670, 150, 'var(--search)'],
  ['Walk the graph', 820, 220, 'var(--graph)'],
  ['Count in graph', 820, 380, 'var(--graph)'],
  ['Ask warehouse', 820, 1400, 'var(--wh)'],
  ['Find the text', 820, 330, 'var(--search)'],
  ['Assemble', 2220, 40, 'var(--query)'],
  ['Answer', 2260, 2300, 'var(--query)'],
  ['Check', 4560, 180, 'var(--query)'],
];
const TOTAL_MS = 4800;

/** Quality measures: name, what it means, value and target, in percent (illustrative). */
const METRICS: [string, string, number, number][] = [
  ['Entity resolution accuracy', 'Right ID for the name asked about', 96, 95],
  ['Queries valid on first try', 'Generated Cypher and SQL pass their checks', 88, 90],
  ['Warehouse numbers reconcile', 'Match the acquirer’s monthly VAMP report', 99, 100],
  ['Answer faithfulness', 'Claims supported by the context', 97, 95],
  ['Citation precision', 'Citations that support their claim', 93, 95],
];

/** A bar that grows from nothing to `width` percent. */
const grow = (width: number, delay: number, duration: number) => ({
  initial: { width: '0%' }, animate: { width: width + '%' }, transition: tr({ duration, delay, ease: EASE_OUT }),
});

function Timings() {
  return (
    <div className="wf">
      {WATERFALL.map(([stage, start, ms, color], i) => (
        <div key={stage} className="wrow" style={vars({ '--c': color })}>
          <span>{stage}</span>
          <div className="wtrack"><motion.i style={{ left: (start / TOTAL_MS) * 100 + '%' }} {...grow((ms / TOTAL_MS) * 100, 0.1 + i * 0.12, 0.5)} /></div>
          <span className="ms">{ms.toLocaleString('en-US')} ms</span>
        </div>
      ))}
      <div className="wrow" style={vars({ '--c': 'var(--ink)' })}><span><b>Total</b></span><div></div><span className="ms"><b>≈4.7 s</b></span></div>
    </div>
  );
}

function Quality() {
  return (
    <div className="metrics">
      {METRICS.map(([name, what, value, target], i) => (
        <div key={name} className="metric">
          <b>{name}</b><small>{what}: {value}%, target {target}%</small>
          <div className="mt">
            <motion.i style={value < target ? { background: 'var(--search)' } : undefined} {...grow(value, 1.2 + i * 0.12, 0.7)} />
            <span className="tg" style={{ left: target + '%' }}></span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function S11Watch() {
  const [run, replay] = useReplay();
  return (
    <Stage n={11}
      idea="Every answer leaves a trace. Time, cost and quality are measured per stage, and failures become tests."
      keys={['The four lanes run in parallel, so the slowest one sets the pace', 'Snowflake is the slowest lane; cached results and monthly aggregates help', 'Every failure becomes a new competency question']}>
      <p className="vcap">Where the time goes for the mixed question (illustrative)</p>
      <Timings key={'t' + run} />
      <p className="note">From Snowflake’s result cache, the same warehouse query takes about 120 ms, bringing the total near 3.5 s.</p>
      <p className="vcap" style={{ marginTop: 18 }}>Quality, against targets (illustrative)</p>
      <Quality key={'q' + run} />
      <div className="loopback"><b>Closing the loop.</b> A wrong match, a rejected query, a number that doesn’t reconcile, or an unanswered question is saved with its trace, added to the competency questions, and, if the ontology lacked a term, turned into a proposal for the ontology’s change loop.</div>
      <ReplayButton label="Replay" onClick={replay} />
    </Stage>
  );
}
