// Places new classes and routes new relationships on the class map, by the rules web/src/explorer/layoutCheck.ts
// checks: no box on another, a frame holds only its own subclasses, no line through a box, no two lines crossing,
// no label on a box or another label. Both search candidates and keep the first or cheapest that breaks none.
import { at, boxes, edgeGeometry, NODE, viewOf, type Box, type LayoutPatch, type Label, type PortSpec, type Side } from '../explorer/layout.ts';
import { cross, inset, labelBox, overlap, segmentHitsBox, segments, type Point } from '../explorer/layoutCheck.ts';
import type { Model } from '../explorer/model.ts';

const SIDES: Side[] = ['right', 'left', 'bottom', 'top'];
const NORMAL: Record<Side, Point> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
const FRACS = [0.5, 0.3, 0.7];
/** Room below the drawing where new classes can go. */
export const ROOM = 168;

const children = (m: Model) => Object.fromEntries(Object.values(m.classes).map((c) => [c.name, c.children]));
const descendants = (m: Model, name: string): Set<string> => {
  const out = new Set<string>();
  const walk = (n: string) => m.classes[n]?.children.forEach((k) => { out.add(k); walk(k); });
  walk(name);
  return out;
};
const len = ([[x1, y1], [x2, y2]]: [Point, Point]) => Math.hypot(x2 - x1, y2 - y1);

/** Every other relationship as drawn: its line and its label. */
function drawn(m: Model, box: Record<string, Box>, layout: LayoutPatch, except?: string) {
  return m.relationships.flatMap((r) => {
    if (r.id === except || !box[r.from]) return [];
    try {
      const g = edgeGeometry(r.id, box[r.from], box[r.to], layout);
      return [{ id: r.id, segs: segments(g.points), label: labelBox(r.type, g) }];
    } catch { return []; }
  });
}

/** A route for one relationship that crosses nothing, or the one that crosses least. */
export function autoRoute(m: Model, layout: LayoutPatch, id: string): PortSpec | undefined {
  const r = m.relationships.find((x) => x.id === id);
  if (!r) return undefined;
  if (r.from === r.to) return { loop: ['bottom', 0.5] };
  if (r.open) return { from: ['right', 0.5], stub: [58, 0] };
  const box = boxes(children(m), layout);
  const a = box[r.from], b = box[r.to];
  if (!a || !b) return undefined;
  const view = viewOf(layout);
  const others = drawn(m, box, layout, id);
  const ends = new Set([r.from, r.to, ...descendants(m, r.from), ...descendants(m, r.to)]);
  const obstacles = Object.values(m.classes).filter((c) => !c.abstract && box[c.name] && !ends.has(c.name)).map((c) => inset(box[c.name], -2));
  const allBoxes = Object.values(m.classes).filter((c) => !c.abstract && box[c.name]).map((c) => box[c.name]);
  const own = [inset(a, 1), inset(b, 1)];

  // Corridors: down the middle and edges of every gap between boxes, and along the margins.
  const gaps = (lo: (b: Box) => number, hi: (b: Box) => number, max: number) => {
    const edges = [...new Set(allBoxes.flatMap((x) => [lo(x), hi(x)]))].sort((p, q) => p - q);
    const out = [8, 18, max - 8];
    for (let i = 0; i + 1 < edges.length; i++) {
      const [p, q] = [edges[i], edges[i + 1]];
      if (q - p >= 14 && !allBoxes.some((x) => lo(x) < q && hi(x) > p && lo(x) <= p + 1 && hi(x) >= q - 1)) out.push(p + 6, (p + q) / 2, q - 6);
    }
    return out;
  };
  const xs = gaps((x) => x.x, (x) => x.x + x.w, view.w);
  const ys = gaps((x) => x.y, (x) => x.y + x.h, view.h + ROOM);

  // Runs to keep off: along a frame's border, or on top of another line. The layout check doesn't flag them, but
  // they read as one line where there are two.
  type Run = { at: number; lo: number; hi: number; w: number };
  const vruns: Run[] = [], hruns: Run[] = [];
  for (const f of Object.values(m.classes).filter((c) => c.abstract && box[c.name]).map((c) => box[c.name])) {
    vruns.push({ at: f.x, lo: f.y, hi: f.y + f.h, w: 400 }, { at: f.x + f.w, lo: f.y, hi: f.y + f.h, w: 400 });
    hruns.push({ at: f.y, lo: f.x, hi: f.x + f.w, w: 400 }, { at: f.y + f.h, lo: f.x, hi: f.x + f.w, w: 400 });
  }
  for (const e of others) for (const [[x1, y1], [x2, y2]] of e.segs) {
    if (Math.abs(x1 - x2) < 0.5) vruns.push({ at: x1, lo: Math.min(y1, y2), hi: Math.max(y1, y2), w: 3000 });
    else if (Math.abs(y1 - y2) < 0.5) hruns.push({ at: y1, lo: Math.min(x1, x2), hi: Math.max(x1, x2), w: 3000 });
  }
  const alongside = ([[x1, y1], [x2, y2]]: [Point, Point]) => {
    const [runs, at, lo, hi] = Math.abs(x1 - x2) < 0.5 ? [vruns, x1, Math.min(y1, y2), Math.max(y1, y2)]
      : Math.abs(y1 - y2) < 0.5 ? [hruns, y1, Math.min(x1, x2), Math.max(x1, x2)] : [[], 0, 0, 0];
    return (runs as Run[]).reduce((t, r) => t + (Math.abs(r.at - at) < 6 && Math.min(hi, r.hi) - Math.max(lo, r.lo) > 6 ? r.w : 0), 0);
  };

  const lineCost = (pts: Point[], fs: Side, ts: Side, routed: boolean): number => {
    const segs = segments(pts);
    const [d0x, d0y] = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
    const [n0x, n0y] = NORMAL[fs];
    if (d0x * n0x + d0y * n0y <= 0) return Infinity;                       // leaves its box outward
    const last = pts.length - 1, [dx, dy] = [pts[last][0] - pts[last - 1][0], pts[last][1] - pts[last - 1][1]];
    const [n1x, n1y] = NORMAL[ts];
    if (dx * n1x + dy * n1y >= 0) return Infinity;                          // arrives from outside
    if (routed && (Math.abs(d0x * n0y - d0y * n0x) > 0.01 || Math.abs(dx * n1y - dy * n1x) > 0.01)) return Infinity; // square to the box
    if (segs.some((s) => len(s) < 8) || len(segs[segs.length - 1]) < 12) return Infinity;
    if (segs.some((s) => own.some((o) => segmentHitsBox(s, o)))) return Infinity; // never back through its own ends
    if (pts.some(([x, y]) => x < 2 || y < 2 || x > view.w - 2 || y > view.h + ROOM - 2)) return Infinity;
    let p = 0;
    for (const o of obstacles) if (segs.some((s) => segmentHitsBox(s, o))) p++;
    for (const e of others) if (segs.some((s) => e.segs.some((t) => cross(s, t)))) p++;
    return p * 10000 + segs.reduce((t, s) => t + len(s) + alongside(s), 0) + (pts.length - 2) * 30;
  };

  const candidates: { spec: PortSpec; cost: number }[] = [];
  for (const fs of SIDES) for (const ts of SIDES) for (const ff of FRACS) for (const tf of FRACS) {
    const p1 = at(a, [fs, ff]), p2 = at(b, [ts, tf]);
    const base: PortSpec = { from: [fs, ff], to: [ts, tf] };
    const vias: Point[][] = [[], [[p2[0], p1[1]]], [[p1[0], p2[1]]],
      ...xs.map((x): Point[] => [[x, p1[1]], [x, p2[1]]]), ...ys.map((y): Point[] => [[p1[0], y], [p2[0], y]])];
    for (const via of vias) {
      const cost = lineCost([p1, ...via, p2], fs, ts, via.length > 0);
      if (cost < Infinity) candidates.push({ spec: via.length ? { ...base, via } : base, cost });
    }
  }
  candidates.sort((p, q) => p.cost - q.cost);

  // Then a label that sits clear of every box and label, on the best few routes.
  const LABELS: (Label | undefined)[] = [undefined, ...[0.5, 0.25, 0.75].flatMap((at) =>
    (['above', 'below', 'left', 'right'] as const).map((side) => ({ at, side })))];
  let best: { spec: PortSpec; cost: number } | undefined;
  for (const c of candidates.slice(0, 12)) {
    const segCount = (c.spec.via?.length ?? 0) + 1;
    for (let seg = 0; seg < segCount; seg++) {
      for (const l of LABELS) {
        const spec = l || seg ? { ...c.spec, label: { ...(l ?? {}), ...(segCount > 1 ? { seg } : {}) } } : c.spec;
        const g = edgeGeometry(id, a, b, { ports: { [id]: spec } });
        const lb = labelBox(r.type, g);
        let p = lb.x < 0 || lb.x + lb.w > view.w ? 1 : 0;
        for (const x of allBoxes) if (overlap(lb, x)) p++;
        for (const e of others) if (overlap(lb, e.label)) p++;
        const cost = c.cost + p * 10000;
        if (!best || cost < best.cost) best = { spec, cost };
        if (p === 0) break;
      }
      if (best && best.cost === c.cost) break;
    }
    if (best && best.cost < 10000) break;
  }
  return best?.spec;
}

/**
 * A free place for a class: clear of every box and line, inside its parent's frame when it has one, as near as
 * possible to `near`. Positions snap to 4 units.
 */
export function freeSpot(m: Model, layout: LayoutPatch, name: string, parent?: string, near?: Point): Point {
  const kids = children(m);
  if (parent) kids[parent] = [...new Set([...(kids[parent] ?? []), name])];
  kids[name] ??= [];
  const without = { ...layout, pos: { ...layout.pos } };
  delete without.pos![name];
  const box = boxes(Object.fromEntries(Object.entries(kids).filter(([k]) => k !== name).map(([k, v]) => [k, v.filter((c) => c !== name)])), without);
  const view = viewOf(layout);
  const placed = Object.values(m.classes).filter((c) => !c.abstract && c.name !== name && box[c.name]).map((c) => box[c.name]);
  const lines = drawn(m, box, without);
  const frame = parent ? box[parent] : undefined;
  const target: Point = near ?? (frame ? [frame.x + frame.w / 2, frame.y + frame.h / 2] : [view.w / 2, view.h]);

  const spots: Point[] = [];
  for (let y = 12; y <= view.h + ROOM - NODE.h - 8; y += 12) for (let x = 4; x <= view.w - NODE.w - 8; x += 8) spots.push([x, y]);
  // Nearest first, measured from the box's centre.
  const dist = ([x, y]: Point) => Math.hypot(x + NODE.w / 2 - target[0], y + NODE.h / 2 - target[1]);
  spots.sort((p, q) => dist(p) - dist(q));

  const ancestors = (n: string) => { const out = new Set<string>(); for (let c = m.classes[n]?.parent; c; c = m.classes[c]?.parent) out.add(c); return out; };
  const mine = parent ? new Set([parent, ...ancestors(parent)]) : new Set<string>();
  const names = Object.keys(m.classes);
  const desc = Object.fromEntries(names.map((n) => [n, descendants(m, n)]));
  for (const [x, y] of spots) {
    const b: Box = { x, y, w: NODE.w, h: NODE.h };
    if (placed.some((p) => overlap(b, p, 10))) continue;
    if (lines.some((l) => l.segs.some((s) => segmentHitsBox(s, inset(b, -4))) || overlap(l.label, b, 2))) continue;
    // Its parents' frames grow to hold it, and mustn't take in anything that isn't theirs; other frames mustn't hold it.
    const trial = boxes(kids, { ...layout, pos: { ...layout.pos, [name]: [x, y] } });
    const bad = names.filter((f) => m.classes[f].abstract && trial[f]).some((f) => mine.has(f)
      ? names.some((c) => c !== f && trial[c] && !desc[f].has(c) && !desc[c].has(f) && overlap(trial[f], trial[c]))
      : overlap(trial[f], b));
    if (!bad) return [x, y];
  }
  return [12, view.h + 12];
}
