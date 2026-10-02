// A proposal is one YAML patch with three parts:
//   schema    merged into ontology/payments.yaml: maps merge, lists add to what's there
//   question  replaces the gap of the question it answers: walks, answered_in and query
//   layout    places new classes (pos) and routes new relationships (ports) on the class map
// Merging only adds or changes, never removes, so a patch is a patch or minor change (decision 10); a rename,
// removal or split is a major change, made in the repository through the change board instead.
import { parse } from 'yaml';
import { checkOntology, type OntologyReport } from '../explorer/check.ts';
import { checkLayout } from '../explorer/layoutCheck.ts';
import { boxes, NODE, VIEW, type LayoutPatch, type PortSpec, type Side } from '../explorer/layout.ts';
import type { Model, RawClass, RawQuestions, RawSchema } from '../explorer/model.ts';

type Point = [number, number];
export type Patch = {
  schema?: Partial<RawSchema>;
  question?: { answered_in?: string; walks?: string[]; query?: string };
  layout?: LayoutPatch;
};

export type Draft = {
  /** The patch as parsed, or the reason it doesn't parse. */
  patch?: Patch; parseError?: string;
  schema: RawSchema; questions: RawQuestions;
  /** The layout the map draws: the patch's own, plus a place and a route for anything it leaves out. */
  layout: LayoutPatch;
  /** What the studio placed or routed itself, so the reader can pin it in the patch. */
  placed: string[]; routed: string[];
  report: OntologyReport;
  /** What the draft adds and changes. */
  changes: Changes;
};
export type Changes = {
  newClasses: string[]; newSlots: string[]; newEnums: string[]; newRelationships: string[];
  /** Existing classes the patch touches, and the relationships it adds or changes on them. */
  touched: string[];
  lane: 'none' | 'patch' | 'minor';
  /** Teams that approve: owners of the classes it adds or touches, and the question's domain. */
  owners: string[];
};

/** Keys that would reach an object's prototype rather than the object. */
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Maps merge, lists add the items they don't have yet, and anything else is replaced. */
export function merge<T>(base: T, patch: unknown): T {
  if (Array.isArray(base) && Array.isArray(patch)) {
    const seen = new Set(base.map((x) => JSON.stringify(x)));
    return [...base, ...patch.filter((x) => !seen.has(JSON.stringify(x)))] as T;
  }
  if (isMap(base) && isMap(patch)) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(patch)) {
      if (UNSAFE.has(k)) continue;
      out[k] = Object.hasOwn(out, k) ? merge(out[k], v) : v;
    }
    return out as T;
  }
  return (patch === undefined ? base : patch) as T;
}

export function parsePatch(text: string): { patch?: Patch; error?: string } {
  try {
    const doc = parse(text) ?? {};
    if (!isMap(doc)) return { error: 'The patch must be a YAML map with schema, question and layout.' };
    const unknown = Object.keys(doc).filter((k) => !['schema', 'question', 'layout'].includes(k));
    if (unknown.length) return { error: `Unknown part ${unknown.join(', ')}: a patch has only schema, question and layout.` };
    for (const k of ['schema', 'question', 'layout'] as const) {
      if (doc[k] !== undefined && doc[k] !== null && !isMap(doc[k])) return { error: `${k} must be a map.` };
    }
    return { patch: doc as Patch };
  } catch (e) {
    return { error: e instanceof Error ? e.message.split('\n')[0] : String(e) };
  }
}

/** The side of `from` that faces `to`, and the side of `to` that faces back. */
function facing(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2), dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

/** A straight route between the facing sides, or a short stub for a relationship open to any class. */
function defaultPort(model: Model, id: string, layout: LayoutPatch): PortSpec | undefined {
  const r = model.relationships.find((x) => x.id === id);
  if (!r || r.from === r.to) return undefined;
  const children = Object.fromEntries(Object.values(model.classes).map((c) => [c.name, c.children]));
  const box = boxes(children, layout);
  if (r.open) return { from: ['right', 0.5], stub: [58, 0] };
  if (!box[r.from] || !box[r.to]) return undefined;
  const [s, t] = facing(box[r.from], box[r.to]);
  return { from: [s, 0.5], to: [t, 0.5] };
}

/** Candidate places for a new class: the map's four columns, every 12 units down. */
const SPOTS: Point[] = [44, 260, 456, 660].flatMap((x) =>
  Array.from({ length: Math.floor((VIEW.h - NODE.h - 12) / 12) + 1 }, (_, i) => [x, 12 + i * 12] as Point));

/** The first candidate place where the layout check finds the fewest problems, for each class the patch doesn't place. */
function place(model: Model, names: string[], layout: LayoutPatch): LayoutPatch {
  let out = layout;
  const children = Object.fromEntries(Object.values(model.classes).map((c) => [c.name, c.children]));
  const concrete = Object.values(model.classes).filter((c) => !c.abstract);
  for (const name of names) {
    let best: { at: Point; n: number } | undefined;
    // Skip spots on or next to a box already placed, before running the whole layout check on the rest.
    let placed: ReturnType<typeof boxes>;
    try { placed = boxes(children, { ...out, pos: { ...out.pos, [name]: SPOTS[0] } }); } catch { continue; }
    const free = SPOTS.filter(([x, y]) => concrete.every((c) => {
      const b = placed[c.name];
      return c.name === name || !b || x >= b.x + b.w + 8 || b.x >= x + NODE.w + 8 || y >= b.y + b.h + 8 || b.y >= y + NODE.h + 8;
    }));
    for (const at of free) {
      const trial: LayoutPatch = { ...out, pos: { ...out.pos, [name]: at } };
      // Route this class's relationships for the trial too, or every spot fails for lack of a route.
      const ports = { ...trial.ports };
      for (const r of model.relationships) {
        if ((r.from === name || r.to === name) && !ports[r.id]) {
          const p = defaultPort(model, r.id, trial);
          if (p) ports[r.id] = p;
        }
      }
      let n: number;
      try { n = checkLayout(model, { ...trial, ports }).problems.length; } catch { continue; }
      if (!best || n < best.n) best = { at, n };
      if (n === 0) break;
    }
    if (best) out = { ...out, pos: { ...out.pos, [name]: best.at } };
  }
  return out;
}

function analyse(base: RawSchema, schema: RawSchema, patch: Patch | undefined, domain: string | undefined): Changes {
  const p = patch?.schema ?? {};
  const has = (o: object | undefined, k: string) => !!o && Object.hasOwn(o, k);
  const newClasses = Object.keys(p.classes ?? {}).filter((n) => !has(base.classes, n));
  const newSlots = Object.keys(p.slots ?? {}).filter((n) => !has(base.slots, n));
  const newEnums = Object.keys(p.enums ?? {}).filter((n) => !has(base.enums, n));
  const touched = Object.keys(p.classes ?? {}).filter((n) => has(base.classes, n));
  const rel = (classes: Record<string, RawClass>, slots: RawSchema['slots']) => new Set(Object.entries(classes)
    .flatMap(([n, c]) => (c.slots ?? []).filter((s) => slots[s]?.range && has(classes, slots[s].range!)).map((s) => `${n}.${s}`)));
  const before = rel(base.classes, base.slots);
  const newRelationships = [...rel(schema.classes, schema.slots)].filter((id) => !before.has(id));
  const changedSlots = Object.keys(p.slots ?? {}).filter((n) => has(base.slots, n));
  // Aliases, descriptions and code values are a patch; anything new, or a changed range or slot list, is minor.
  const minor = newClasses.length || newSlots.length || newEnums.length || newRelationships.length
    || changedSlots.some((n) => Object.keys(p.slots![n] ?? {}).some((k) => !['description', 'aliases'].includes(k)))
    || touched.some((n) => Object.keys(p.classes![n] ?? {}).some((k) => !['description', 'aliases', 'title'].includes(k)));
  const changed = newClasses.length + newSlots.length + newEnums.length + touched.length + changedSlots.length
    + Object.keys(p.enums ?? {}).length;
  const owners = new Set<string>();
  for (const n of [...newClasses, ...touched]) {
    const owner = schema.classes[n]?.annotations?.owner;
    if (owner) owners.add(owner);
  }
  if (domain && changed) owners.add(domain);
  return { newClasses, newSlots, newEnums, newRelationships, touched, lane: minor ? 'minor' : changed ? 'patch' : 'none', owners: [...owners].sort() };
}

/** Applies a patch to the ontology and checks the result, as the pull request's checks would. */
export function buildDraft(base: RawSchema, baseQuestions: RawQuestions, questionId: string, text: string): Draft {
  const { patch, error } = parsePatch(text);
  const schema = merge(base, patch?.schema ?? {});
  const qp = patch?.question;
  const questions: RawQuestions = {
    ...baseQuestions,
    questions: baseQuestions.questions.map((q) => {
      if (q.id !== questionId || !qp) return q;
      const { gap: _gap, ...rest } = q;
      return { ...rest, ...qp } as typeof q;
    }),
  };
  const domain = baseQuestions.questions.find((q) => q.id === questionId)?.domain;
  const changes = analyse(base, schema, patch, domain);

  // A first pass without a layout gives the model; then place and route what the patch leaves out.
  let layout: LayoutPatch = { pos: { ...patch?.layout?.pos }, ports: { ...patch?.layout?.ports } };
  const first = checkOntology(schema, questions, layout);
  const placed: string[] = [], routed: string[] = [];
  if (first.model) {
    const model = first.model;
    const unplaced = changes.newClasses.filter((n) => model.classes[n] && !model.classes[n].abstract && !layout.pos?.[n]);
    layout = place(model, unplaced, layout);
    placed.push(...unplaced);
    for (const id of changes.newRelationships) {
      if (layout.ports?.[id]) continue;
      const p = defaultPort(model, id, layout);
      if (p) { layout = { ...layout, ports: { ...layout.ports, [id]: p } }; routed.push(id); }
    }
  }
  const report = placed.length || routed.length ? checkOntology(schema, questions, layout) : first;
  return { patch, parseError: error, schema, questions, layout, placed, routed, report, changes };
}

/** The layout the studio worked out, written as the patch's layout part, so a reader can pin it. */
export function layoutYaml(layout: LayoutPatch, only: { placed: string[]; routed: string[] }): string {
  const pos = only.placed.filter((n) => layout.pos?.[n]).map((n) => `    ${n}: [${layout.pos![n].join(', ')}]`);
  const ports = only.routed.filter((id) => layout.ports?.[id]).map((id) => `    ${id}: ${JSON.stringify(layout.ports![id]).replace(/"/g, '').replace(/:/g, ': ').replace(/,/g, ', ')}`);
  return ['layout:', ...(pos.length ? ['  pos:', ...pos] : []), ...(ports.length ? ['  ports:', ...ports] : [])].join('\n');
}
