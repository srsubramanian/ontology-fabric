import type { Transition, Variant } from 'motion/react';

/** True when the reader asks for less motion. Animations then take no time (docs/style-guide.md). */
export const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** A transition that collapses to zero length under reduced motion. */
export function tr(t: Transition = {}): Transition {
  return reduce ? { ...t, duration: 0, delay: 0 } : t;
}

/**
 * Motion props for an element that sits in `from` and plays `to` once `on` is true.
 * `to` can use keyframes, like `{ opacity: [0, 1], x: [10, 0] }`.
 * Pass `from = false` for an element that is already visible, so it only animates when `on`
 * turns true later, not when it mounts with `on` already true.
 */
export function play(on: boolean, from: Variant | false, to: Variant, t?: Transition) {
  return {
    variants: { from: from || {}, to },
    initial: from === false ? (false as const) : 'from',
    animate: on ? 'to' : 'from',
    transition: tr(t),
  };
}
