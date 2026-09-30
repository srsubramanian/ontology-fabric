import { useState } from 'react';
import { flushSync } from 'react-dom';
import { anim } from '../shared/anim';
import { CH, QS } from './path-data';
import { useProgress } from './progress';

/** Check yourself: a few questions; answering them all right marks the chapter done. */
export function Check({ n, hidden }: { n: number; hidden: boolean }) {
  const { resetKey } = useProgress();
  return <div className="check" data-ch={n} hidden={hidden}><Questions key={resetKey} n={n} /></div>;
}

type Answer = { j: number; right: boolean } | null;

function Questions({ n }: { n: number }) {
  const { markDone } = useProgress();
  const qs = QS[n];
  const [answers, setAnswers] = useState<Answer[]>(qs.map(() => null));
  const [solved] = useState(() => qs.map(() => false));

  const pick = (i: number, j: number, btn: HTMLButtonElement) => {
    const right = j === qs[i].a;
    flushSync(() => setAnswers((a) => a.map((x, k) => (k === i ? { j, right } : x))));
    if (right) {
      anim(btn, { scale: [0.97, 1] }, { duration: 0.25 });
      solved[i] = true;
      if (solved.every(Boolean)) markDone(n);
    } else {
      anim(btn, { x: [0, -5, 5, -3, 3, 0] }, { duration: 0.35 });
    }
  };

  return (
    <>
      <h3>Check yourself</h3>
      <div className="qgrid2">
        {qs.map((q, i) => {
          const a = answers[i];
          return (
            <div key={q.q} className="qc" data-i={i}>
              <p className="q">{q.q}</p>
              <div className="qopts">
                {q.o.map((o, j) => (
                  <button key={o} type="button" className={'qopt' + (a && a.j === j ? (a.right ? ' right' : ' wrong') : '')} data-j={j}
                    onClick={(e) => pick(i, j, e.currentTarget)}>{o}</button>
                ))}
              </div>
              <p className={'qfb' + (a ? (a.right ? ' ok' : ' no') : '')} aria-live="polite">{a ? (a.right ? 'Right. ' + q.why : 'Not quite. Try another answer.') : ''}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Whether the chapter is done, a button to mark it done, and the way to the next chapter. */
export function ChapterNext({ n, hidden }: { n: number; hidden: boolean }) {
  const { done, markDone } = useProgress();
  const d = done.includes(n), nx = CH.find((c) => c.n === n + 1);
  return (
    <div className="chnext" data-ch={n} hidden={hidden}>
      <span className="chstat">{d ? '✓ Chapter ' + n + ' done' : ''}</span>
      <span className="chbtns">
        <button type="button" className="vbtn mark" hidden={d} onClick={() => markDone(n)}>Mark as done</button>
        {nx ? <a className="vbtn go nextch" href={'#ch' + nx.n}>Next: {nx.title}</a> : <a className="vbtn go nextch" href="#path">Back to your path</a>}
      </span>
    </div>
  );
}
