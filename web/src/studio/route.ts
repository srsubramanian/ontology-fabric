// Places new classes and routes new relationships on the class map, by the rules web/src/explorer/layoutCheck.ts
// checks: no box on another, a frame holds only its own subclasses, no line through a box, no two lines crossing,
// no label on a box or another label. On top of those, a line keeps off frame borders and other lines. Both search
// candidates and keep the cheapest that breaks no rule; a class is only placed where its lines can reach cleanly.
import { at, boxes, edgeGeometry, NODE, viewOf, type Box, type LayoutPatch, type Label, type PortSpec, type Side } from '../explorer/layout.ts';
import { cross, inset, labelBox, overlap, segmentHitsBox, segments, type Point } from '../explorer/layoutCheck.ts';
import type { Model } from '../explorer/model.ts';

const SIDES: Side[] = ['right', 'left', 'bottom', 'top'];
const NORMAL: Record<Side, Point> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
const FRACS = [0.5, 0.3, 0.7];
/** A cost this high means a route breaks one of the layout check's rules. */
const BREAKS = 10000;
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
type Run = { at: number; lo: number; hi: number; w: number };

/** The map as it stands: boxes, the lines already drawn, corridors between boxes, and runs to keep off. */
export function scene(m: Model, layout: LayoutPatch, except?: string, box = boxes(children(m), layout)) {
  const view = viewOf(layout);
  const others = m.relationships.flatMap((r) => {
    if (r.id === except || !box[r.from]) return [];
    try {
      const g = edgeGeometry(r.id, box[r.from], box[r.to], layout);
      return [{ id: r.id, segs: segments(g.points), label: labelBox(r.type, g) }];
    } catch { return []; }
  });
  const concrete = Object.values(m.classes).filter((c) => !c.abstract && box[c.name]);
  const frames = Object.values(m.classes).filter((c) => c.abstract && box[c.name]).map((c) => box[c.name]);

  // Runs to keep off: along a frame's border, or on top of another line. The layout check doesn't flag them, but
  // they read as one line where there are two.
  const vruns: Run[] = [], hruns: Run[] = [];
  for (const f of frames) {
    vruns.push({ at: f.x, lo: f.y, hi: f.y + f.h, w: 400 }, { at: f.x + f.w, lo: f.y, hi: f.y + f.h, w: 400 });
    hruns.push({ at: f.y, lo: f.x, hi: f.x + f.w, w: 400 }, { at: f.y + f.h, lo: f.x, hi: f.x + f.w, w: 400 });
  }
  for (const e of others) for (const [[x1, y1], [x2, y2]] of e.segs) {
    if (Math.abs(x1 - x2) < 0.5) vruns.push({ at: x1, lo: Math.min(y1, y2), hi: Math.max(y1, y2), w: 3000 });
    else if (Math.abs(y1 - y2) < 0.5) hruns.push({ at: y1, lo: Math.min(x1, x2), hi: Math.max(x1, x2), w: 3000 });
  }
  return { m, box, view, others, concrete, vruns, hruns, ...corridors(concrete.map((c) => box[c.name]), view) };
}
type Scene = ReturnType<typeof scene>;

/** Corridors a line can run along: down the middle and edges of every gap between boxes, and along the margins. */
function corridors(all: Box[], view: { w: number; h: number }) {
  const gaps = (lo: (b: Box) => number, hi: (b: Box) => number, max: number) => {
    const edges = [...new Set(all.flatMap((x) => [lo(x), hi(x)]))].sort((p, q) => p - q);
    // The margins, every few units, since the drawing's edges are where long lines find room.
    const out = Array.from({ length: 10 }, (_, i) => 4 + i * 4).flatMap((d) => [d, max - d]);
    for (let i = 0; i + 1 < edges.length; i++) {
      const [p, q] = [edges[i], edges[i + 1]];
      if (q - p >= 14) out.push(p + 6, (p + q) / 2, q - 6);
    }
    return [...new Set(out)];
  };
  const ys = gaps((x) => x.y, (x) => x.y + x.h, view.h + ROOM);
  // And across the room below the drawing.
  for (let y = view.h + 6; y < view.h + ROOM; y += 12) ys.push(y);
  return { xs: gaps((x) => x.x, (x) => x.x + x.w, view.w), ys };
}

/**
 * Candidate routes from box a to box b, cheapest first. `ends` are the classes the line may touch: its own two and
 * their subclasses. Routes leave and arrive square to their boxes, and never run back through them.
 */
type Route = { spec: PortSpec; cost: number; breaks: number; overlaps: number };
export function routes(sc: Scene, a: Box, b: Box, ends: Set<string>, fracs = FRACS): Route[] {
  const obstacles = sc.concrete.filter((c) => !ends.has(c.name)).map((c) => inset(sc.box[c.name], -2));
  const own = [inset(a, 1), inset(b, 1)];
  const alongside = ([[x1, y1], [x2, y2]]: [Point, Point]) => {
    const [runs, at, lo, hi] = Math.abs(x1 - x2) < 0.5 ? [sc.vruns, x1, Math.min(y1, y2), Math.max(y1, y2)]
      : Math.abs(y1 - y2) < 0.5 ? [sc.hruns, y1, Math.min(x1, x2), Math.max(x1, x2)] : [[], 0, 0, 0];
    return (runs as Run[]).filter((r) => Math.abs(r.at - at) < 6 && Math.min(hi, r.hi) - Math.max(lo, r.lo) > 6);
  };
  const cost = (pts: Point[], fs: Side, ts: Side, routed: boolean): Omit<Route, 'spec'> | null => {
    const segs = segments(pts);
    const [d0x, d0y] = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
    const [n0x, n0y] = NORMAL[fs];
    if (d0x * n0x + d0y * n0y <= 0) return null;                           // leaves its box outward
    const last = pts.length - 1, [dx, dy] = [pts[last][0] - pts[last - 1][0], pts[last][1] - pts[last - 1][1]];
    const [n1x, n1y] = NORMAL[ts];
    if (dx * n1x + dy * n1y >= 0) return null;                              // arrives from outside
    if (routed && (Math.abs(d0x * n0y - d0y * n0x) > 0.01 || Math.abs(dx * n1y - dy * n1x) > 0.01)) return null; // square to the box
    if (segs.some((s) => len(s) < 8) || len(segs[segs.length - 1]) < 12) return null;
    if (segs.some((s) => own.some((o) => segmentHitsBox(s, o)))) return null;
    if (pts.some(([x, y]) => x < 2 || y < 2 || x > sc.view.w - 2 || y > sc.view.h + ROOM - 2)) return null;
    let breaks = 0, overlaps = 0, along = 0;
    for (const o of obstacles) if (segs.some((s) => segmentHitsBox(s, o))) breaks++;
    for (const e of sc.others) if (segs.some((s) => e.segs.some((t) => cross(s, t)))) breaks++;
    for (const s of segs) for (const r of alongside(s)) { along += r.w; if (r.w >= 3000) overlaps++; }
    return { breaks, overlaps, cost: breaks * BREAKS + segs.reduce((t, s) => t + len(s), 0) + along + (pts.length - 2) * 30 };
  };
  const out: Route[] = [];
  for (const fs of SIDES) for (const ts of SIDES) for (const ff of fracs) for (const tf of fracs) {
    const p1 = at(a, [fs, ff]), p2 = at(b, [ts, tf]);
    const base: PortSpec = { from: [fs, ff], to: [ts, tf] };
    const vias: Point[][] = [[], [[p2[0], p1[1]]], [[p1[0], p2[1]]],
      ...sc.xs.map((x): Point[] => [[x, p1[1]], [x, p2[1]]]), ...sc.ys.map((y): Point[] => [[p1[0], y], [p2[0], y]])];
    for (const via of vias) {
      const c = cost([p1, ...via, p2], fs, ts, via.length > 0);
      if (c) out.push({ spec: via.length ? { ...base, via } : base, ...c });
    }
  }
  return out.sort((p, q) => p.cost - q.cost);
}

/** A route for one relationship that breaks no rule, or the one that breaks fewest. */
export function autoRoute(m: Model, layout: LayoutPatch, id: string): PortSpec | undefined {
  const r = m.relationships.find((x) => x.id === id);
  if (!r) return undefined;
  if (r.from === r.to) return { loop: ['bottom', 0.5] };
  if (r.open) return { from: ['right', 0.5], stub: [58, 0] };
  const sc = scene(m, layout, id);
  const a = sc.box[r.from], b = sc.box[r.to];
  if (!a || !b) return undefined;
  const ends = new Set([r.from, r.to, ...descendants(m, r.from), ...descendants(m, r.to)]);
  const all = sc.concrete.map((c) => sc.box[c.name]);

  // Then a label clear of every box and label, on the best routes.
  const LABELS: (Label | undefined)[] = [undefined, ...[0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9].flatMap((at) =>
    (['above', 'below', 'left', 'right'] as const).map((side) => ({ at, side })))];
  let best: { spec: PortSpec; cost: number } | undefined;
  for (const c of routes(sc, a, b, ends).slice(0, 40)) {
    const segCount = (c.spec.via?.length ?? 0) + 1;
    for (let seg = 0; seg < segCount; seg++) {
      for (const l of LABELS) {
        const spec = l || seg ? { ...c.spec, label: { ...(l ?? {}), ...(segCount > 1 ? { seg } : {}) } } : c.spec;
        const lb = labelBox(r.type, edgeGeometry(id, a, b, { ports: { [id]: spec } }));
        let p = lb.x < 0 || lb.x + lb.w > sc.view.w ? 1 : 0;
        for (const x of all) if (overlap(lb, x)) p++;
        for (const e of sc.others) if (overlap(lb, e.label)) p++;
        const cost = c.cost + p * BREAKS;
        if (!best || cost < best.cost) best = { spec, cost };
        if (p === 0) break;
      }
      if (best && best.cost === c.cost) break;
    }
    if (best && best.cost < BREAKS) break;
  }
  return best?.spec;
}

/**
 * A free place for a class: clear of every box and line, inside its parent's frame when it has one, as near as
 * possible to `near`, and where a clean line can reach each class in `links`, the classes it will be related to.
 * Positions snap to the map's grid.
 */
export function freeSpot(m: Model, layout: LayoutPatch, name: string, parent?: string, near?: Point, links: string[] = [],
  search: { tries?: number; fracs?: number[] } = {}): Point {
  const kids = children(m);
  if (parent) kids[parent] = [...new Set([...(kids[parent] ?? []), name])];
  kids[name] ??= [];
  const without = { ...layout, pos: { ...layout.pos } };
  delete without.pos![name];
  const box = boxes(Object.fromEntries(Object.entries(kids).filter(([k]) => k !== name).map(([k, v]) => [k, v.filter((c) => c !== name)])), without);
  const sc = scene({ ...m, relationships: m.relationships.filter((r) => r.from !== name && r.to !== name) }, without, undefined, box);
  const view = sc.view;
  const placed = sc.concrete.filter((c) => c.name !== name).map((c) => box[c.name]);
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
  const reach = links.filter((l) => l !== name && box[l]);
  let tried = 0;
  for (const [x, y] of spots) {
    const b: Box = { x, y, w: NODE.w, h: NODE.h };
    if (placed.some((p) => overlap(b, p, 10))) continue;
    if (sc.others.some((l) => l.segs.some((s) => segmentHitsBox(s, inset(b, -4))) || overlap(l.label, b, 2))) continue;
    // Its parents' frames grow to hold it, and mustn't take in anything that isn't theirs; other frames mustn't hold it.
    const trial = boxes(kids, { ...layout, pos: { ...layout.pos, [name]: [x, y] } });
    const bad = names.filter((f) => m.classes[f].abstract && trial[f]).some((f) => mine.has(f)
      ? names.some((c) => c !== f && trial[c] && !desc[f].has(c) && !desc[c].has(f) && overlap(trial[f], trial[c]))
      : overlap(trial[f], b));
    if (bad) continue;
    // A clean line has to reach each class it will be related to. Give up on that after enough tries.
    if (reach.length && tried++ < (search.tries ?? 160)) {
      // Routed the way autoRoute will see it, with this box among the others.
      const withBox = { ...sc, box: { ...box, [name]: b }, ...corridors([...placed, b], view) };
      const ok = reach.every((l) => routes(withBox, b, box[l], new Set([name, l, ...(desc[l] ?? [])]), search.fracs ?? [0.5]).some((r) => !r.breaks && !r.overlaps));
      if (!ok) continue;
    }
    return [x, y];
  }
  return [12, view.h + 12];
}
