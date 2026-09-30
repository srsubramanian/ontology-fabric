import { useCallback, useEffect, useState } from 'react';
import { reduce } from './motion';

/**
 * Steps through a timeline. Returns 0 on mount, then 1, 2, … as each delay (in ms) passes.
 * Under reduced motion it starts at the last step. To replay, remount the component with a new key.
 */
export function useTimeline(delays: readonly number[]): number {
  const [step, setStep] = useState(reduce ? delays.length : 0);
  useEffect(() => {
    if (reduce) return;
    let at = 0;
    const timers = delays.map((ms, i) => {
      at += ms;
      return window.setTimeout(() => setStep(i + 1), at);
    });
    return () => timers.forEach(clearTimeout);
    // The timeline is fixed for the component's life; replays remount it.
  }, []);
  return step;
}

/** A key for the animated part of a view, and a function that bumps it to replay. */
export function useReplay(): [number, () => void] {
  const [run, setRun] = useState(0);
  return [run, useCallback(() => setRun((r) => r + 1), [])];
}
