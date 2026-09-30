import { animate, type AnimationOptions, type DOMKeyframesDefinition, type ValueAnimationTransition } from 'motion/react';
import { reduce } from '../../kit/motion';

type Targets = Element | null | undefined | ArrayLike<Element>;

const list = (t: Targets): Element[] => (!t ? [] : t instanceof Element ? [t] : Array.from(t));

/**
 * Plays keyframes on elements, as chapter 1 always has: timed sequences that step through
 * several parts of a panel. Under reduced motion every animation takes no time.
 */
export function anim(targets: Targets, keyframes: DOMKeyframesDefinition, opts: AnimationOptions = {}): Promise<void> {
  const els = list(targets);
  if (!els.length) return Promise.resolve();
  return Promise.resolve(animate(els, keyframes, reduce ? { ...opts, duration: 0, delay: 0 } : opts)).then(() => undefined);
}

/** Resolves after `ms`, or at once under reduced motion. */
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduce ? 0 : ms));

/** A delay for the i-th of several elements: `base`, then `step` more for each. */
export const dl = (base: number, step: number) => (i: number) => base + i * step;

/** Tweens a value from 0 to 1, calling `onUpdate` on every frame; at once under reduced motion. */
export function tween(opts: ValueAnimationTransition<number> & { onUpdate: (v: number) => void }): Promise<void> {
  if (reduce) { opts.onUpdate(1); return Promise.resolve(); }
  return Promise.resolve(animate(0, 1, opts)).then(() => undefined);
}

/** Draws lines in, one after another, then clears the dash so markers and hovers behave. */
export function drawIn(paths: ArrayLike<Element>, delay0 = 0, duration = 0.5) {
  Array.from(paths as ArrayLike<SVGGeometryElement>).forEach((p, i) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = String(len);
    p.style.strokeDashoffset = String(len);
    anim(p, { strokeDashoffset: [len, 0] }, { duration, delay: delay0 + i * 0.12 })
      .then(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
  });
}

/** Hides elements until a later animation shows them. */
export function hideAll(els: ArrayLike<Element>) {
  Array.from(els as ArrayLike<HTMLElement>).forEach((e) => { e.style.opacity = '0'; });
}

const SVG = 'http://www.w3.org/2000/svg';

/** Sends a dot along `path`, drawn in `layer` and removed when it arrives. Skipped under reduced motion. */
export function packet(layer: SVGGElement, path: SVGGeometryElement, color: string, dur?: number): Promise<void> {
  if (reduce) return Promise.resolve();
  const len = path.getTotalLength();
  const g = document.createElementNS(SVG, 'g');
  const halo = document.createElementNS(SVG, 'circle');
  halo.setAttribute('r', '9'); halo.setAttribute('opacity', '0.22'); halo.style.fill = color;
  const dot = document.createElementNS(SVG, 'circle');
  dot.setAttribute('r', '4.5'); dot.style.fill = color; dot.style.stroke = 'var(--raised)'; dot.style.strokeWidth = '1.5';
  g.append(halo, dot);
  layer.appendChild(g);
  const place = (v: number) => { const p = path.getPointAtLength(v * len); g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')'); };
  place(0);
  return tween({ duration: dur || Math.min(1.4, 0.4 + len / 500), ease: [0.45, 0, 0.2, 1], onUpdate: place }).then(() => g.remove());
}
