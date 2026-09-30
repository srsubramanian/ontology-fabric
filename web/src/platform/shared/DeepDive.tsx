import { inView } from 'motion/react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { anim, wait } from './anim';
import { Keys, Stepper } from './Stepper';

// The deep dive every chapter from 2 on opens with: numbered steps, the step's key points,
// and one panel per step. Showing a step stops anything still playing, then plays the step.

export type DDStep = { t: string; k: string[] };

/** What a chapter needs to drive its deep dive: the current step, things to stop on a change, and its element. */
export type DDApi = { cur: number; stops: Set<() => void>; root: HTMLElement | null };

export function useDeepDive(): DDApi {
  return useRef<DDApi>({ cur: 1, stops: new Set(), root: null }).current;
}

const Cur = createContext(1);

export function DeepDive({ api, id, title, intro, steps, next, run, children }: {
  api: DDApi; id: string; title: string; intro: ReactNode; steps: DDStep[];
  /** Where the last step's button goes: the chapter's next sub-page. */
  next: { href: string; label: string };
  /** What each step plays when it's shown. */
  run: Record<number, () => void>;
  children: ReactNode;
}) {
  const [sel, setSel] = useState({ step: 1, play: false, n: 0 });
  const root = useRef<HTMLElement>(null), keys = useRef<HTMLDivElement>(null);
  const runs = useRef(run);
  runs.current = run;

  const show = (step: number) => {
    api.cur = step;
    api.stops.forEach((f) => f());
    setSel((s) => ({ step, play: true, n: s.n + 1 }));
  };

  useEffect(() => {
    anim(keys.current, { opacity: [0, 1], x: [-8, 0] }, { duration: 0.3 });
    anim(root.current!.querySelector(`.xpanel[data-d="${sel.step}"]`), { opacity: [0, 1] }, { duration: 0.25 });
    if (sel.play) runs.current[sel.step]?.();
  }, [sel]);

  // The first time the deep dive scrolls into view on step 1, step 1 plays.
  useEffect(() => {
    let seen = false;
    return inView(root.current!, () => { if (!seen && api.cur === 1) { seen = true; runs.current[1]?.(); } }, { amount: 0.3 });
  }, [api]);

  const s = steps[sel.step - 1];
  return (
    <section className="block dd" id={id} data-next={next.href} data-next-label={next.label} aria-labelledby={id + 'h'} ref={(el) => { root.current = el; api.root = el; }}>
      <h3 className="sech" id={id + 'h'}>{title}</h3>
      <p className="intro">{intro}</p>
      <Stepper className="stepper xsteps" label="Deep dive steps" titles={steps.map((x) => x.t)} cur={sel.step} onPick={show} />
      <div className="sdetail">
        <Keys className="skeys xkeys" ref={keys} title={s.t} keys={s.k}
          next={sel.step < steps.length ? { label: 'Next: ' + steps[sel.step].t, onClick: () => show(sel.step + 1) } : next} />
        <div className="sviz"><Cur.Provider value={sel.step}>{children}</Cur.Provider></div>
      </div>
    </section>
  );
}

/** One step's panel, shown only while its step is. */
export function XPanel({ n, children }: { n: number; children: ReactNode }) {
  const cur = useContext(Cur);
  return <div className="xpanel" data-d={n} hidden={cur !== n}>{children}</div>;
}

/**
 * A tour of a code block: a band moves over a few lines at a time, with a caption for each stop.
 * Showing another step of the deep dive stops it.
 */
export function useTour(api: DDApi, stops: [first: number, last: number, caption: string][]) {
  const box = useRef<HTMLDivElement>(null), capEl = useRef<HTMLParagraphElement>(null);
  const [cap, setCap] = useState('');
  const run = useRef(0);
  useEffect(() => {
    const stop = () => { run.current++; };
    api.stops.add(stop);
    return () => { api.stops.delete(stop); };
  }, [api]);

  const set = (i: number) => {
    const b = box.current!, [a, z, text] = stops[i], L = b.querySelectorAll('pre .ln');
    const base = b.getBoundingClientRect().top - b.scrollTop;
    const top = L[a].getBoundingClientRect().top - base, h = L[z].getBoundingClientRect().bottom - L[a].getBoundingClientRect().top;
    anim(b.querySelector('.ddband'), { top: top + 'px', height: h + 'px', opacity: 1 }, { duration: 0.4, ease: [0.22, 1, 0.36, 1] });
    setCap(text);
    anim(capEl.current, { opacity: [0, 1] }, { duration: 0.3 });
  };
  const play = async () => {
    const my = ++run.current;
    for (let i = 0; i < stops.length; i++) {
      if (my !== run.current) return;
      set(i);
      await wait(2500);
    }
  };
  return { box, capEl, cap, set, play };
}
