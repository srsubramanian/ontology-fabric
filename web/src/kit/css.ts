import type { CSSProperties } from 'react';

/** Inline CSS custom properties, such as `vars({ '--c': 'var(--graph)' })`. */
export const vars = (v: Record<`--${string}`, string>) => v as CSSProperties;
