// The class map as an editor. Click a class or line to select it; drag a class the draft added to move it; drag the
// ⊕ on a selected class onto another class to relate them; in place mode, click an empty spot to add a class; in
// walk mode, click lines to build a question's walk. Classes and lines the draft adds are drawn dashed and violet.
import { motion } from 'motion/react';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { fitText } from '../explorer/ClassMap';
import { boxes, edgeGeometry, NODE, viewOf, type Box, type LayoutPatch } from '../explorer/layout';
import type { Model } from '../explorer/model';
import { EASE_OUT, tr } from '../kit/motion';
import type { Point } from './draft';
import { ROOM } from './route';

export type Selection = { kind: 'class' | 'rel'; id: string } | null;
export type Mode = 'select' | 'place' | 'walk';

type Props = {
  model: Model; layout: LayoutPatch;
  /** Classes and relationships the draft adds. */
  added: Set<string>; addedRels: Set<string>;
  /** What the checks name in a problem, ringed in red. */
  flagged: Set<string>;
  selected: Selection;
  /** Relationships to light, such as a question's walk. */
  lit: string[];
  mode: Mode; editable: boolean;
  onSelect: (s: Selection) => void;
  onPlace: (at: Point) => void;
  onMove: (name: string, at: Point) => void;
  onLink: (from: string, to: string) => void;
  onWalk: (rel: string) => void;
};

const snap = (v: number) => Math.round(v / 4) * 4;
const shortRule = (rule = '') => rule.replace(/\{[a-z_]*_id\}/, '{id}');
const inside = ([x, y]: Point, b: Box) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

type Drag =
  | { kind: 'move'; name: string; dx: number; dy: number; at: Point; moved: boolean }
  | { kind: 'link'; from: string; at: Point }
  | null;

export function Canvas(p: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const view = viewOf(p.layout);
  const H = view.h + ROOM;

  // While a class is dragged, draw it where the pointer is, without its lines, which reroute when it's dropped.
  const moving = drag?.kind === 'move' && drag.moved ? drag : null;
  const layout = useMemo(() => (moving ? { ...p.layout, pos: { ...p.layout.pos, [moving.name]: moving.at } } : p.layout), [p.layout, moving]);
  const children = useMemo(() => Object.fromEntries(Object.values(p.model.classes).map((c) => [c.name, c.children])), [p.model]);
  const box = useMemo(() => { try { return boxes(children, layout); } catch { return {} as Record<string, Box>; } }, [children, layout]);
  const edges = useMemo(() => p.model.relationships.flatMap((r) => {
    if (moving && (r.from === moving.name || r.to === moving.name)) return [];
    if (!box[r.from]) return [];
    try { return [{ r, g: edgeGeometry(r.id, box[r.from], box[r.to], layout) }]; } catch { return []; }
  }), [p.model, box, layout, moving]);
  const frames = Object.values(p.model.classes).filter((c) => c.abstract && box[c.name]).sort((a, b) => a.chain.length - b.chain.length);
  const concrete = Object.values(p.model.classes).filter((c) => !c.abstract && box[c.name]);
  const lit = new Set(p.lit);

  // Only what appears after the first drawing animates in: new classes and new lines, as people build.
  const first = useRef<Set<string> | null>(null);
  first.current ??= new Set([...concrete.map((c) => c.name), ...p.model.relationships.map((r) => r.id)]);
  const isNew = (id: string) => !first.current!.has(id);

  const toSvg = (e: { clientX: number; clientY: number }): Point => {
    const s = svg.current!, m = s.getScreenCTM();
    if (!m) return [0, 0];
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [pt.x, pt.y];
  };
  const classAt = (pt: Point) => concrete.find((c) => inside(pt, box[c.name]))?.name;

  const down = (e: ReactPointerEvent, name: string) => {
    if (p.mode !== 'select' || !p.editable || !p.added.has(name)) return;
    const pt = toSvg(e), b = box[name];
    svg.current!.setPointerCapture(e.pointerId);
    setDrag({ kind: 'move', name, dx: pt[0] - b.x, dy: pt[1] - b.y, at: [b.x, b.y], moved: false });
  };
  const startLink = (e: ReactPointerEvent, from: string) => {
    e.stopPropagation();
    svg.current!.setPointerCapture(e.pointerId);
    setDrag({ kind: 'link', from, at: toSvg(e) });
  };
  const move = (e: ReactPointerEvent) => {
    const pt = toSvg(e);
    if (p.mode === 'place') setHover([snap(pt[0] - NODE.w / 2), snap(pt[1] - NODE.h / 2)]);
    if (!drag) return;
    if (drag.kind === 'link') { setDrag({ ...drag, at: pt }); return; }
    const at: Point = [
      Math.max(0, Math.min(view.w - NODE.w, snap(pt[0] - drag.dx))),
      Math.max(0, Math.min(H - NODE.h, snap(pt[1] - drag.dy))),
    ];
    const moved = drag.moved || Math.hypot(at[0] - box[drag.name].x, at[1] - box[drag.name].y) > 4;
    setDrag({ ...drag, at, moved });
  };
  const up = (e: ReactPointerEvent) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.kind === 'link') {
      const to = classAt(toSvg(e));
      if (to) p.onLink(d.from, to);
      return;
    }
    if (d.moved) p.onMove(d.name, d.at);
    else p.onSelect({ kind: 'class', id: d.name });
  };
  const clickBackground = (e: React.MouseEvent) => {
    if (p.mode === 'place') {
      const pt = toSvg(e);
      p.onPlace([Math.max(0, snap(pt[0] - NODE.w / 2)), Math.max(0, snap(pt[1] - NODE.h / 2))]);
    } else if (p.mode === 'select') p.onSelect(null);
  };
  const pickClass = (name: string) => { if (p.mode === 'select') p.onSelect({ kind: 'class', id: name }); };
  const pickRel = (id: string) => {
    if (p.mode === 'walk') p.onWalk(id);
    else if (p.mode === 'select') p.onSelect({ kind: 'rel', id });
  };
  const sel = p.selected;
  const linkTarget = drag?.kind === 'link' ? classAt(drag.at) : undefined;

  return (
    <svg ref={svg} className="canvas" data-mode={p.mode} viewBox={`0 0 ${view.w} ${H}`} role="application"
      aria-label="Class map editor: classes, abstract parents as frames, and relationships as arrows"
      onPointerMove={move} onPointerUp={up} onPointerLeave={() => setHover(null)}>
      <rect className="cbg" width={view.w} height={H} onClick={clickBackground} />
      <rect className="room" x={1} y={view.h + 8} width={view.w - 2} height={ROOM - 10} rx={10} onClick={clickBackground} />
      <text className="roomt" x={12} y={H - 10}>Room to build: place new classes anywhere</text>

      {frames.map((c) => {
        const b = box[c.name];
        return (
          <g key={c.name} className={'cf' + (sel?.id === c.name ? ' sel' : '') + (p.added.has(c.name) ? ' fresh' : '')} data-class={c.name}
            onClick={(e) => { e.stopPropagation(); pickClass(c.name); }}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12} />
            <text className="ft" x={b.x + 12} y={b.y + 19}>{c.name}<tspan className="fa"> abstract</tspan></text>
          </g>
        );
      })}

      {edges.map(({ r, g }) => {
        const on = lit.has(r.id) || p.addedRels.has(r.id) || sel?.id === r.id;
        return (
          <g key={r.id} className={'cr' + (on ? ' hl' : '') + (sel?.id === r.id ? ' picked' : '') + (p.flagged.has(r.id) ? ' bad' : '') + (p.addedRels.has(r.id) ? ' fresh' : '')}
            data-rel={r.id} onClick={(e) => { e.stopPropagation(); pickRel(r.id); }}>
            <path className="hit" d={g.d} />
            <motion.path className="ce" d={g.d} initial={isNew(r.id) ? { pathLength: 0 } : false} animate={{ pathLength: 1 }}
              transition={tr({ duration: 0.5, ease: EASE_OUT })} />
            <polygon className="ch" points={g.head} />
            <text className="cl" x={g.label[0]} y={g.label[1]} textAnchor={g.anchor}>{r.type}</text>
            {g.open && <text className="cany" x={g.open[0]} y={g.open[1]}>any entity</text>}
          </g>
        );
      })}

      {concrete.map((c) => {
        const b = box[c.name];
        const cls = 'cn' + (sel?.id === c.name ? ' sel' : '') + (p.added.has(c.name) ? ' fresh' : '') + (p.flagged.has(c.name) ? ' bad' : '')
          + (linkTarget === c.name ? ' target' : '') + (p.added.has(c.name) && p.editable && p.mode === 'select' ? ' movable' : '');
        return (
          <motion.g key={c.name} className={cls} data-class={c.name} tabIndex={0} role="button" aria-label={`${c.name}${p.added.has(c.name) ? ', new' : ''}`}
            initial={isNew(c.name) ? { opacity: 0, scale: 0.85 } : false} animate={{ opacity: 1, scale: 1 }}
            transition={tr({ duration: 0.3, ease: EASE_OUT })} style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            onPointerDown={(e) => down(e, c.name)}
            onClick={(e) => { e.stopPropagation(); if (!p.added.has(c.name) || p.mode !== 'select' || !p.editable) pickClass(c.name); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickClass(c.name); } }}>
            <rect className="box" x={b.x} y={b.y} width={NODE.w} height={NODE.h} rx={9} />
            <rect className="bar" x={b.x + 8} y={b.y + 11} width={3} height={NODE.h - 22} rx={1.5} />
            <text key={c.name} className="t" x={b.x + 18} y={b.y + 21} ref={fitText}>{c.name}</text>
            <text key={c.idRule} className="s" x={b.x + 18} y={b.y + 37} ref={fitText}>{shortRule(c.idRule)}</text>
          </motion.g>
        );
      })}

      {/* The handle that relates the selected class to another: drag it onto the target. */}
      {sel?.kind === 'class' && p.editable && p.mode === 'select' && box[sel.id] && !p.model.classes[sel.id]?.abstract && !drag && (
        <g className="handle" onPointerDown={(e) => startLink(e, sel.id)} role="button" aria-label={`Relate ${sel.id} to another class: drag onto it`}>
          <circle cx={box[sel.id].x + NODE.w} cy={box[sel.id].y + NODE.h / 2} r={9} />
          <path d={`M${box[sel.id].x + NODE.w - 4},${box[sel.id].y + NODE.h / 2} h8 M${box[sel.id].x + NODE.w},${box[sel.id].y + NODE.h / 2 - 4} v8`} />
        </g>
      )}
      {drag?.kind === 'link' && box[drag.from] && (
        <line className="rubber" x1={box[drag.from].x + NODE.w} y1={box[drag.from].y + NODE.h / 2} x2={drag.at[0]} y2={drag.at[1]} />
      )}
      {p.mode === 'place' && hover && (
        <rect className="ghost" x={hover[0]} y={hover[1]} width={NODE.w} height={NODE.h} rx={9} pointerEvents="none" />
      )}
    </svg>
  );
}
