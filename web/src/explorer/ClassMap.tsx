import { motion } from 'motion/react';
import { useMemo, type KeyboardEvent } from 'react';
import { EASE_OUT, tr } from '../kit/motion';
import { boxes, edgeGeometry, NODE, VIEW, type Box, type LayoutPatch } from './layout';
import type { ClassInfo, LivesIn, Model } from './model';

export type Lens = 'relationships' | 'lives' | 'owner';

/** Where instances live, in the colours of the stores (docs/style-guide.md). */
export const STORE: Record<LivesIn, { color: string; label: string }> = {
  graph: { color: 'var(--graph)', label: 'Neptune' },
  warehouse: { color: 'var(--wh)', label: 'lake or Snowflake' },
  search: { color: 'var(--search)', label: 'OpenSearch' },
};

/** An ID rule, shortened to fit a box: m:{merchant_id} becomes m:{id}. */
const shortRule = (rule = '') => rule.replace(/\{[a-z_]*_id\}/, '{id}');

/** The widest a class name or subtitle runs inside its box. */
const TEXT_MAX = NODE.w - 22;

/**
 * Squeezes a class name or subtitle that would run past its box, such as RetrievalRequest. It measures once the
 * text is in the page, and again once the web fonts have loaded, since they change its width.
 */
function fitText(el: SVGTextElement | null) {
  if (!el) return;
  const fit = () => {
    el.removeAttribute('textLength');
    if (el.isConnected && el.getComputedTextLength() > TEXT_MAX) {
      el.setAttribute('textLength', String(TEXT_MAX));
      el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
  };
  fit();
  document.fonts?.ready.then(fit);
}

function subtitle(c: ClassInfo, lens: Lens) {
  if (lens === 'lives') return STORE[c.livesIn].label;
  if (lens === 'owner') return 'owner: ' + c.owner;
  return shortRule(c.idRule);
}

type Props = {
  model: Model;
  lens: Lens;
  /** Classes to keep bright; null leaves everything bright. */
  lit: Set<string> | null;
  /** Relationships to draw highlighted, in the order they animate. */
  litEdges: string[];
  selected?: string;
  /** Changes whenever the highlight changes, which replays its animation. */
  focusKey: string;
  /** Draw highlighted relationships one after another; off when a tracer adds them step by step. */
  stagger?: boolean;
  /** Bumped by the replay button, which replays the whole reveal. */
  run: number;
  onPick: (name: string) => void;
  onClear: () => void;
  /** A layout patch on top of layout.ts, such as a studio draft's places and routes. */
  layout?: LayoutPatch;
  /** Classes a draft adds, drawn as new. */
  fresh?: Set<string>;
};

export function ClassMap({ model, lens, lit, litEdges, selected, focusKey, stagger = true, run, onPick, onClear, layout, fresh }: Props) {
  const children = useMemo(
    () => Object.fromEntries(Object.values(model.classes).map((c) => [c.name, c.children])),
    [model],
  );
  const box = useMemo(() => boxes(children, layout), [children, layout]);
  // A draft can leave a relationship without a drawable route; the studio's checks say why, so skip it here.
  const edges = useMemo(
    () => model.relationships.flatMap((r) => {
      try { return box[r.from] ? [{ r, g: edgeGeometry(r.id, box[r.from], box[r.to], layout) }] : []; } catch { return []; }
    }),
    [model, box, layout],
  );
  // Outer frames first, so nested frames draw on top of them.
  const frames = Object.values(model.classes).filter((c) => c.abstract && box[c.name]).sort((a, b) => a.chain.length - b.chain.length);
  const concrete = Object.values(model.classes).filter((c) => !c.abstract && box[c.name]);
  const dim = (name: string) => lit !== null && !lit.has(name);
  const highlighted = new Set(litEdges);
  const pick = (name: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(name); }
  };
  // The reveal: frames, then boxes from the top down, then the relationships.
  const order = (b: Box) => (b.y / VIEW.h) * 0.7 + (b.x / VIEW.w) * 0.2;

  return (
    <svg className="cmap" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="group" aria-label="Class map: classes, abstract parents drawn as frames, and relationships as arrows">
      <rect className="cbg" width={VIEW.w} height={VIEW.h} onClick={onClear} />
      <g key={'reveal' + run}>
        {frames.map((c) => {
          const b = box[c.name];
          return (
            <motion.g key={c.name} className={'cf' + (c.name === selected ? ' sel' : '')} data-class={c.name}
              initial={{ opacity: 0 }} animate={{ opacity: dim(c.name) ? 0.45 : 1 }}
              transition={tr({ duration: 0.4 })}
              onClick={() => onPick(c.name)} onKeyDown={pick(c.name)} tabIndex={0} role="button"
              aria-label={`${c.name}, abstract class`}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12} />
              <text className="ft" x={b.x + 12} y={b.y + 19}>{c.name}<tspan className="fa"> abstract</tspan></text>
            </motion.g>
          );
        })}

        {edges.map(({ r, g }, i) => {
          const faded = lit !== null && !highlighted.has(r.id);
          const late = tr({ duration: 0.3, delay: 0.9 + i * 0.03 });
          return (
            <g key={r.id} className={'cr' + (faded ? ' faded' : '')}>
              <motion.path className="ce" d={g.d} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={tr({ duration: 0.5, delay: 0.6 + i * 0.03, ease: EASE_OUT })} />
              <motion.polygon className="ch" points={g.head} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={late} />
              <motion.text className="cl" x={g.label[0]} y={g.label[1]} textAnchor={g.anchor}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={late}>{r.type}</motion.text>
              {g.open && (
                <motion.text className="cany" x={g.open[0]} y={g.open[1]}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={late}>any entity</motion.text>
              )}
            </g>
          );
        })}

        {/* Highlighted relationships draw over the rest, one after another. */}
        <g key={focusKey}>
          {litEdges.map((id, i) => {
            const e = edges.find((x) => x.r.id === id);
            if (!e) return null;
            const t = { duration: 0.45, delay: stagger ? 0.1 + i * 0.22 : 0.05, ease: EASE_OUT };
            const after = tr({ duration: 0.2, delay: t.delay + t.duration - 0.1 });
            return (
              <g key={id} className="cr hl">
                <motion.path className="ce" d={e.g.d} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr(t)} />
                <motion.polygon className="ch" points={e.g.head} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={after} />
                <motion.text className="cl" x={e.g.label[0]} y={e.g.label[1]} textAnchor={e.g.anchor}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={after}>{e.r.type}</motion.text>
              </g>
            );
          })}
        </g>

        {concrete.map((c) => {
          const b = box[c.name];
          const color = lens === 'lives' ? STORE[c.livesIn].color : lens === 'owner' ? 'var(--muted)' : 'var(--onto)';
          return (
            <motion.g key={c.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={tr({ duration: 0.35, delay: 0.1 + order(b), ease: EASE_OUT })} style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
              <motion.g className={'cn' + (c.name === selected ? ' sel' : '') + (fresh?.has(c.name) ? ' fresh' : '')} data-class={c.name}
                animate={{ opacity: dim(c.name) ? 0.28 : 1 }} transition={tr({ duration: 0.25 })}
                onClick={() => onPick(c.name)} onKeyDown={pick(c.name)} tabIndex={0} role="button"
                aria-label={`${c.name}, ${subtitle(c, lens) || 'class'}`}>
                <rect className="box" x={b.x} y={b.y} width={NODE.w} height={NODE.h} rx={9} />
                <rect className="bar" x={b.x + 8} y={b.y + 11} width={3} height={NODE.h - 22} rx={1.5} style={{ fill: color }} />
                <text className="t" x={b.x + 18} y={b.y + 21} ref={fitText}>{c.name}</text>
                {/* Keyed by its words, so a lens that changes them remounts it and fitText measures again. */}
                <text key={subtitle(c, lens)} className="s" x={b.x + 18} y={b.y + 37} ref={fitText}>{subtitle(c, lens)}</text>
              </motion.g>
            </motion.g>
          );
        })}
      </g>
    </svg>
  );
}

