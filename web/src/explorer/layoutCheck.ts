// Checks the class map's hand-drawn layout (layout.ts) against the rules it's drawn by: every class placed and
// every relationship routed, no two boxes overlap, a frame holds only its own subclasses, no line passes through
// a box, no two lines cross, and no label sits on a box or another label. web/scripts/check-layout.ts runs it for
// tools/check_ontology.py, and the studio runs it live on a proposal's layout patch.
import { boxes, edgeGeometry, isPlaced, isRouted, viewOf, type Box, type LayoutPatch } from './layout.ts';
import type { Model } from './model.ts';

export type Point = [number, number];
export type LayoutReport = { problems: string[]; boxes: number; lines: number };

export const overlap = (a: Box, b: Box, gap = 0) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
export const inset = (b: Box, d: number): Box => ({ x: b.x + d, y: b.y + d, w: b.w - 2 * d, h: b.h - 2 * d });
export const segments = (points: Point[]) => points.slice(1).map((p, i) => [points[i], p] as [Point, Point]);

export function segmentHitsBox([[x1, y1], [x2, y2]]: [Point, Point], b: Box): boolean {
  // Liang-Barsky clipping: does any part of the segment lie strictly inside the box?
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  for (const [p, q] of [[-dx, x1 - b.x], [dx, b.x + b.w - x1], [-dy, y1 - b.y], [dy, b.y + b.h - y1]]) {
    if (p === 0) { if (q <= 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t1 - t0 > 1e-6;
}

export function cross([[ax, ay], [bx, by]]: [Point, Point], [[cx, cy], [dx, dy]]: [Point, Point]): boolean {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

/** Where a relationship's label sits. Labels are 9.5px JetBrains Mono: about 5.8 units a character, 8 tall. */
export function labelBox(type: string, g: { label: [number, number]; anchor: 'start' | 'middle' | 'end' }): Box {
  const w = type.length * 5.8;
  const x = g.anchor === 'start' ? g.label[0] : g.anchor === 'end' ? g.label[0] - w : g.label[0] - w / 2;
  return { x, y: g.label[1] - 8, w, h: 9 };
}

export function checkLayout(model: Model, patch?: LayoutPatch): LayoutReport {
  const classes = Object.values(model.classes);
  const concrete = classes.filter((c) => !c.abstract);
  const problems: string[] = [];
  const VIEW = viewOf(patch);

  // First, everything needs a place and a route; until then nothing else can be measured.
  for (const c of concrete) {
    if (!isPlaced(c.name, patch)) problems.push(`${c.name} has no place on the map: add it to POS in web/src/explorer/layout.ts`);
  }
  for (const r of model.relationships) {
    if (r.from !== r.to && !isRouted(r.id, patch)) problems.push(`${r.id} has no route on the map: add it to PORTS in web/src/explorer/layout.ts`);
  }
  if (problems.length) return { problems, boxes: concrete.length, lines: model.relationships.length };

  const children = Object.fromEntries(classes.map((c) => [c.name, c.children]));
  const box = boxes(children, patch);
  const descendants = (name: string): Set<string> => {
    const out = new Set<string>();
    const walk = (n: string) => model.classes[n]?.children.forEach((k) => { out.add(k); walk(k); });
    walk(name);
    return out;
  };

  // Every box inside the drawing, and no two boxes closer than 8 units.
  for (const c of classes) {
    const b = box[c.name];
    if (b.x < 0 || b.y < 0 || b.x + b.w > VIEW.w || b.y + b.h > VIEW.h) problems.push(`${c.name} runs outside the drawing`);
  }
  concrete.forEach((a, i) => concrete.slice(i + 1).forEach((b) => {
    if (overlap(box[a.name], box[b.name], 8)) problems.push(`${a.name} and ${b.name} overlap or touch`);
  }));

  // A frame holds its own subclasses and nothing else.
  for (const f of classes.filter((c) => c.abstract)) {
    const own = descendants(f.name);
    for (const c of classes) {
      if (c.name === f.name || own.has(c.name) || descendants(c.name).has(f.name)) continue;
      if (overlap(box[f.name], box[c.name])) problems.push(`${c.name} sits inside or across the ${f.name} frame`);
    }
  }

  const edges = model.relationships.map((r) => ({ r, g: edgeGeometry(r.id, box[r.from], box[r.to], patch) }));

  // No line passes through a box: every concrete box but the line's own ends, inset a little so a line may
  // start and end on a box's edge. A relationship open to any class (Chunk.mentions) has no target box.
  for (const { r, g } of edges) {
    const ends = new Set([r.from, r.to, ...descendants(r.from), ...descendants(r.to)].filter(Boolean));
    for (const c of concrete) {
      if (ends.has(c.name)) continue;
      if (segments(g.points).some((s) => segmentHitsBox(s, inset(box[c.name], -2)))) problems.push(`${r.id} passes through ${c.name}`);
    }
  }

  // No two lines cross.
  edges.forEach((a, i) => edges.slice(i + 1).forEach((b) => {
    if (segments(a.g.points).some((s) => segments(b.g.points).some((t) => cross(s, t)))) problems.push(`${a.r.id} crosses ${b.r.id}`);
  }));

  // No label sits on a box or on another label. Labels are 9.5px JetBrains Mono: about 5.8 units a
  // character, 8 tall.
  const labels = edges.map(({ r, g }) => ({ id: r.id, box: labelBox(r.type, g) }));
  labels.forEach(({ id, box: l }, i) => {
    if (l.x < 0 || l.x + l.w > VIEW.w) problems.push(`${id}'s label runs outside the drawing`);
    for (const c of concrete) if (overlap(l, box[c.name])) problems.push(`${id}'s label sits on ${c.name}`);
    for (const other of labels.slice(i + 1)) if (overlap(l, other.box)) problems.push(`${id}'s label sits on ${other.id}'s`);
  });

  return { problems, boxes: concrete.length, lines: edges.length };
}
