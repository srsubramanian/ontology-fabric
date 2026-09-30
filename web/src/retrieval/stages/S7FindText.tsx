import { motion } from 'motion/react';
import { EASE_OUT, tr } from '../../kit/motion';
import { ReplayButton } from '../../kit/ReplayButton';
import { useReplay, useTimeline } from '../../kit/useTimeline';
import { Stage } from '../Stage';

const PASSES = ['1 Search', '2 Clearance filter', '3 Mention boost', '4 Rerank, keep 3'];

/** Candidate chunks, with each one's score after each pass (illustrative). */
const CHUNKS = [
  { id: 'c15', title: 'Glossary: TC40 and TC15', mentions: [], scores: [0.72, 0.72, 0.72, 0.71] },
  { id: 'c04', title: 'Visa VAMP: merchant thresholds and fees', mentions: ['pay:VampRatio'], scores: [0.70, 0.70, 0.85, 0.95] },
  { id: 'c22', title: 'Memo: Sunset Tickets risk review', mentions: ['m:10442'], restricted: true, scores: [0.68, 0, 0, 0] },
  { id: 'c07', title: 'Runbook: stolen-card fraud response', mentions: ['pay:FraudReport'], scores: [0.64, 0.64, 0.79, 0.86] },
  { id: 'c33', title: 'Mastercard excessive chargeback program', mentions: [], scores: [0.63, 0.63, 0.63, 0.22] },
  { id: 'c90', title: 'FAQ: settlement timing', mentions: [], scores: [0.41, 0.41, 0.41, 0.10] },
];
const KEEP = 3;

function Passes() {
  const pass = useTimeline([1700, 1700, 1700]);
  const ranked = CHUNKS.map((c) => ({ c, score: c.scores[pass] })).sort((a, b) => b.score - a.score);
  const move = tr({ duration: 0.45, ease: EASE_OUT });
  return (
    <>
      <div className="steps6">
        {PASSES.map((p, i) => <span key={p} className={i === pass ? 'on' : undefined}>{p}</span>)}
      </div>
      <div className="chunks">
        {ranked.map(({ c, score }, rank) => {
          const locked = !!c.restricted && pass >= 1;
          const cut = locked || (pass === 3 && rank >= KEEP);
          const cls = 'ch' + (cut ? ' cut' : '') + (locked ? ' lock' : '') + (pass === 3 && rank < KEEP ? ' keep' : '');
          // `layout` slides each row to its new rank when the order changes.
          return (
            <motion.div key={c.id} className={cls} layout="position" transition={move}>
              <div>{c.title}<small className="m">
                {c.mentions.length ? c.mentions.map((m) => <code key={m}>{m}</code>) : 'mentions nothing resolved'}
                {c.restricted && <> <b className="rst">restricted</b></>}
              </small></div>
              <div className="bar6"><motion.i initial={{ width: '0%' }} animate={{ width: score * 100 + '%' }} transition={tr({ duration: 0.45 })} /></div>
              <span className="sc">{score.toFixed(2)}</span>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}

export function S7FindText() {
  const [run, replay] = useReplay();
  return (
    <Stage n={7}
      idea="The rules and runbooks say what the numbers mean. Four passes pick the few passages worth reading."
      keys={['Hybrid search over chunks, with the caller’s clearance as a filter', 'Chunks that mention the resolved entities or concepts get a boost', 'A reranking model keeps the best three, and drops the wrong network']}>
      <Passes key={run} />
      <ReplayButton label="Run the passes again" onClick={replay} />
      <p className="note">Illustrative scores.</p>
    </Stage>
  );
}
