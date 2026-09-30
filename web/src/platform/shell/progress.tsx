import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { anim } from '../shared/anim';
import { CH } from './path-data';

// Reading progress: which chapters are done, and the last one read. Saved in this browser only,
// under the same key the page has always used, so existing progress carries over.

const KEY = 'pkl-progress-v1';
type Saved = { done: number[]; last: number | null };
const load = (): Saved => {
  const state: Saved = { done: [], last: null };
  try { const raw = localStorage.getItem(KEY); if (raw) Object.assign(state, JSON.parse(raw)); } catch { /* storage blocked */ }
  return state;
};

type Progress = {
  done: number[];
  /** Bumped when progress restarts, so every check clears its answers. */
  resetKey: number;
  markDone: (n: number) => void;
  /** Goes to the next unfinished chapter; when every chapter is done, starts over. */
  resume: () => void;
};
const Ctx = createContext<Progress>(null!);
export const useProgress = () => useContext(Ctx);
export const nextUp = (done: number[]) => CH.find((c) => !done.includes(c.n))?.n ?? null;

export function ProgressProvider({ children }: { children: ReactNode }) {
  const saved = useRef(load());
  const [done, setDone] = useState(saved.current.done);
  const [resetKey, setResetKey] = useState(0);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved.current)); } catch { /* storage blocked */ } };

  const markDone = (n: number) => {
    if (saved.current.done.includes(n)) return;
    saved.current.done = [...saved.current.done, n];
    save();
    flushSync(() => setDone(saved.current.done));
    anim(document.querySelector(`#pathlist a[href="#ch${n}"]`), { scale: [1, 1.06, 1] }, { duration: 0.45 });
  };
  const resume = () => {
    if (saved.current.done.length === CH.length) {
      saved.current.done = [];
      save();
      setDone([]); setResetKey((k) => k + 1);
    }
    location.hash = '#ch' + (nextUp(saved.current.done) || 1);
  };

  // Remember the last chapter read.
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { saved.current.last = Number((e.target as HTMLElement).dataset.ch); save(); }
    }), { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('.chapter[data-ch]').forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={{ done, resetKey, markDone, resume }}>{children}</Ctx.Provider>;
}
