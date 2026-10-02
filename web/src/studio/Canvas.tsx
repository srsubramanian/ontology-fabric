// The class map as an editor. Click a class or line to select it; drag a class the draft added to move it; drag the
// ⊕ on a selected class onto another class to relate them; in place mode, click an empty spot to add a class; in
// walk mode, click lines to build a question's walk. Classes and lines the draft adds are drawn dashed and violet.
// A mission adds hints on top: the rest of the map fades back, what to use next pulses, a spot to click glows, and
// Show me plays the step with a dot that moves the way a person's pointer would.
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { fitText } from '../explorer/ClassMap';
import { boxes, edgeGeometry, NODE, viewOf, type Box, type LayoutPatch } from '../explorer/layout';
import type { Model } from '../explorer/model';
import { EASE_OUT, reduce, tr } from '../kit/motion';
import type { Point } from './draft';
import { ROOM } from './route';

export type Selection = { kind: 'class' | 'rel'; id: string } | null;
export type Mode = 'select' | 'place' | 'walk';
/** A step played for the person to watch: placing a class, dragging a line, or walking a question's path. */
export type Demo = { key: number } & ({ kind: 'place'; at: Point } | { kind: 'drag'; from: string; to: string } | { kind: 'walk'; rels: string[] });

type Props = {
  model: Model; layout: LayoutPatch;
  /** Classes and relationships the draft adds. */
  added: Set<string>; addedRels: Set<string>;
  /** What the checks name in a problem, ringed in red. */
  flagged: Set<string>;
  /** Classes and relationships Claude proposed and nobody has accepted yet, drawn faint and dashed. */
  ghosts?: Set<string>;
  selected: Selection;
  /** Relationships to light, such as a question's walk. */
  lit: string[];
  mode: Mode; editable: boolean;
  /** A mission's hints: the classes it works on (the rest fades back), what to use next, the class to drag a line
   *  from, the spot to place a class, and a step to play. */
  focus?: Set<string>; pulse?: Set<string>; handleOn?: string; target?: Point;
  demo?: Demo | null; onDemoEnd?: () => void;
  onSelect: (s: Selection) => void;
  /** Other people here: their pointer and what they picked, each in their colour. */
  peers?: { peer: string; label: string; color: number; cursor: Point | null; sel: string | null; away: boolean }[];
  /** Where this person's pointer is on the map, in map units, or null when it leaves. */
  onCursor?: (pt: Point | null) => void;
  /** A class placed at a spot; exact when it's the mission's target. */
  onPlace: (at: Point, exact?: boolean) => void;
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
  const pulse = p.pulse ?? new Set<string>();
  const ghost = p.ghosts ?? new Set<string>();
  const dimClass = (n: string) => !!p.focus && !p.focus.has(n) && !pulse.has(n);
  const dimRel = (r: { id: string; from: string; to: string }) => !!p.focus && !lit.has(r.id) && !pulse.has(r.id) && !(p.focus.has(r.from) && p.focus.has(r.to));

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
    p.onCursor?.(pt);
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
  const handleFor = p.handleOn ?? (sel?.kind === 'class' ? sel.id : undefined);
  const handle = handleFor && p.editable && p.mode === 'select' && box[handleFor] && !p.model.classes[handleFor]?.abstract && !drag ? handleFor : undefined;

  return (
    <svg ref={svg} className="canvas" data-mode={p.mode} viewBox={`0 0 ${view.w} ${H}`} role="application"
      aria-label="Class map editor: classes, abstract parents as frames, and relationships as arrows"
      onPointerMove={move} onPointerUp={up} onPointerLeave={() => { setHover(null); p.onCursor?.(null); }}>
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
          <g key={r.id} className={'cr' + (on ? ' hl' : '') + (sel?.id === r.id ? ' picked' : '') + (p.flagged.has(r.id) ? ' bad' : '') + (p.addedRels.has(r.id) ? ' fresh' : '')
            + (pulse.has(r.id) ? ' pulse' : '') + (dimRel(r) ? ' dim' : '') + (ghost.has(r.id) ? ' ghost' : '')}
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
          + (linkTarget === c.name ? ' target' : '') + (p.added.has(c.name) && p.editable && p.mode === 'select' ? ' movable' : '')
          + (pulse.has(c.name) ? ' pulse' : '') + (dimClass(c.name) ? ' dim' : '') + (ghost.has(c.name) ? ' ghost' : '');
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
            {ghost.has(c.name) && <text className="gtag" x={b.x + NODE.w - 8} y={b.y - 5} textAnchor="end">proposed</text>}
          </motion.g>
        );
      })}

      {/* The handle that relates the selected class, or the mission's, to another: drag it onto the target. */}
      {handle && (
        <g className={'handle' + (p.handleOn === handle ? ' pulse' : '')} data-handle={handle} onPointerDown={(e) => startLink(e, handle)} role="button"
          aria-label={`Relate ${handle} to another class: drag onto it`}>
          <circle cx={box[handle].x + NODE.w} cy={box[handle].y + NODE.h / 2} r={9} />
          <path d={`M${box[handle].x + NODE.w - 4},${box[handle].y + NODE.h / 2} h8 M${box[handle].x + NODE.w},${box[handle].y + NODE.h / 2 - 4} v8`} />
        </g>
      )}
      {drag?.kind === 'link' && box[drag.from] && (
        <line className="rubber" x1={box[drag.from].x + NODE.w} y1={box[drag.from].y + NODE.h / 2} x2={drag.at[0]} y2={drag.at[1]} />
      )}
      {p.mode === 'place' && hover && (
        <rect className="ghost" x={hover[0]} y={hover[1]} width={NODE.w} height={NODE.h} rx={9} pointerEvents="none" />
      )}
      {p.target && p.editable && (
        <g className="spot" role="button" aria-label="Place the class here" onClick={(e) => { e.stopPropagation(); p.onPlace(p.target!, true); }}>
          <rect x={p.target[0]} y={p.target[1]} width={NODE.w} height={NODE.h} rx={9} />
          <text x={p.target[0] + NODE.w / 2} y={p.target[1] + NODE.h / 2 + 4} textAnchor="middle">Click to place</text>
        </g>
      )}
      {/* Other people here: a ring on what each picked, and their pointer with their name. */}
      {(p.peers ?? []).map((x) => {
        const b = x.sel ? box[x.sel] : undefined;
        return b && !p.model.classes[x.sel!]?.abstract ? <rect key={'r' + x.peer} className={`pring pc${x.color}`} x={b.x - 4} y={b.y - 4} width={NODE.w + 8} height={NODE.h + 8} rx={12} pointerEvents="none" /> : null;
      })}
      {(p.peers ?? []).filter((x) => x.cursor).map((x) => (
        <g key={'c' + x.peer} className={`pcur pc${x.color}${x.away ? ' away' : ''}`} transform={`translate(${x.cursor![0]},${x.cursor![1]})`} pointerEvents="none">
          <path d="M0,0 v17 l4.6,-4.2 l3.2,7.4 l3.1,-1.4 l-3.2,-7.2 h6.2 z" />
          <rect x={12} y={15} height={17} rx={8.5} width={Math.min(150, x.label.length * 6.6 + 14)} />
          <text x={19} y={27.5}>{x.label}</text>
        </g>
      ))}
      {p.demo && <DemoLayer key={p.demo.key} demo={p.demo} box={box} edges={edges} view={{ w: view.w, h: H }} onEnd={p.onDemoEnd} />}
    </svg>
  );
}

/** A dot that moves the way a person's pointer would, to show a step. Under reduced motion it stops where it ends. */
function DemoLayer({ demo, box, edges, view, onEnd }: {
  demo: Demo; box: Record<string, Box>; edges: { r: { id: string }; g: { points: Point[] } }[]; view: { w: number; h: number }; onEnd?: () => void;
}) {
  const centre = (b: Box): Point => [b.x + b.w / 2, b.y + b.h / 2];
  let path: Point[] = [];
  let rubber: Point | null = null;
  if (demo.kind === 'place') {
    const end: Point = [demo.at[0] + NODE.w / 2, demo.at[1] + NODE.h / 2];
    path = [[end[0] + (end[0] < view.w / 2 ? 170 : -170), Math.max(16, end[1] - 110)], end];
  }
  else if (demo.kind === 'drag' && box[demo.from] && box[demo.to]) {
    rubber = [box[demo.from].x + NODE.w, box[demo.from].y + NODE.h / 2];
    path = [rubber, centre(box[demo.to])];
  } else if (demo.kind === 'walk') path = demo.rels.flatMap((id) => edges.find((e) => e.r.id === id)?.g.points ?? []);
  const ok = path.length >= 2;
  useEffect(() => { if (!ok) onEnd?.(); }, [ok, onEnd]);
  if (!ok) return null;
  // Even speed along the way, plus a pause at the start and the end.
  const lens = path.slice(1).map((q, i) => Math.hypot(q[0] - path[i][0], q[1] - path[i][1]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const run = Math.min(3.2, 0.9 + total / 420), duration = run + 0.8;
  let acc = 0;
  const times = [0, ...lens.map((l) => (0.4 + run * ((acc += l) / total)) / duration), 1];
  const xs = [path[0][0], ...path.map((q) => q[0])], ys = [path[0][1], ...path.map((q) => q[1])];
  const t = tr({ duration, times, ease: 'easeInOut' });
  const end = path[path.length - 1];
  return (
    <g className="demo" pointerEvents="none">
      {rubber && <motion.line x1={rubber[0]} y1={rubber[1]} initial={{ x2: rubber[0], y2: rubber[1] }} animate={{ x2: xs, y2: ys }} transition={t} />}
      <motion.circle className="ripple" cx={end[0]} cy={end[1]} initial={{ r: 4, opacity: 0 }} animate={{ r: [4, 4, 26], opacity: [0, 0.7, 0] }}
        transition={tr({ duration: 0.6, delay: duration - 0.3, times: [0, 0.1, 1] })} />
      <motion.circle className="finger" r={reduce ? 7 : 8} initial={{ cx: xs[0], cy: ys[0] }} animate={{ cx: xs, cy: ys }} transition={t}
        onAnimationComplete={() => window.setTimeout(() => onEnd?.(), reduce ? 2500 : 600)} />
    </g>
  );
}
