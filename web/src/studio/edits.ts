// Every change the studio makes to the working draft, as a DraftUpdate: from the map, from the side panel, or from
// Claude. Each one places and routes what it adds, so the class map stays clean as people build.
import { boxes } from '../explorer/layout.ts';
import type { RawQuestions, RawSchema } from '../explorer/model.ts';
import { analyse } from './analysis.ts';
import { live, mergeDraft, NAMES, slotKey, type ClassEdit, type DraftDoc, type DraftUpdate, type Point, type SlotEdit } from './draft.ts';
import { autoRoute, freeSpot } from './route.ts';

export type Ctx = { draft: DraftDoc; base: RawSchema; questions: RawQuestions };

const has = (o: object | undefined, k: string) => !!o && Object.hasOwn(o, k);
const draftModel = (ctx: Ctx, u: DraftUpdate) => {
  const a = analyse(mergeDraft(ctx.draft, u as Record<string, unknown>), ctx.base, ctx.questions);
  return { model: a.report.model, layout: a.patch.layout, schema: a.schema };
};
const merged = (a: DraftUpdate, b: DraftUpdate): DraftUpdate => mergeDraft(a as DraftDoc, b as Record<string, unknown>) as DraftUpdate;

/** Whether a class exists in the released ontology or the draft. */
export const classExists = (ctx: Ctx, name: string) =>
  has(ctx.base.classes, name) || live(ctx.draft.classes).some(([n, e]) => n === name && e.added);
export const isAdded = (ctx: Ctx, name: string) => !!ctx.draft.classes[name]?.added;

/** Why a name can't be used, or null when it can. */
export function classNameProblem(ctx: Ctx, name: string, self?: string): string | null {
  if (!NAMES.class.re.test(name)) return `Class names are ${NAMES.class.hint}.`;
  if (name !== self && (classExists(ctx, name) || has(ctx.base.enums, name) || live(ctx.draft.enums).some(([n]) => n === name))) return `${name} already exists.`;
  return null;
}
export function slotNameProblem(ctx: Ctx, cls: string, name: string, self?: string): string | null {
  if (!NAMES.slot.re.test(name)) return `Names are ${NAMES.slot.hint}.`;
  if (name === self) return null;
  const { schema } = draftModel(ctx, {});
  const chain: string[] = [];
  for (let c: string | undefined = cls; c && schema.classes[c]; c = schema.classes[c].is_a) chain.push(c);
  if (chain.some((c) => schema.classes[c].slots?.includes(name))) return `${cls} already has ${name}.`;
  return null;
}

/**
 * Adds a class: exactly where asked (at), or in the free spot nearest a point or another class, inside its parent's
 * frame when it has one. Its relationships route themselves when they're added.
 */
export function addClass(ctx: Ctx, name: string, e: Omit<ClassEdit, 'added'> = {}, where: { at?: Point; near?: string; nearPoint?: Point; links?: string[] } = {}): DraftUpdate {
  const { model, layout } = draftModel(ctx, {});
  let near = where.nearPoint;
  if (!near && where.near && model) {
    const b = boxes(Object.fromEntries(Object.values(model.classes).map((c) => [c.name, c.children])), layout)[where.near];
    if (b) near = [b.x + b.w / 2, b.y + b.h / 2];
  }
  const pos = e.abstract ? null : where.at ?? (model ? freeSpot(model, layout, name, e.is_a ?? undefined, near, where.links) : [12, 1124] as Point);
  return { classes: { [name]: { owner: 'core', lives_in: 'graph', id_rule: defaultIdRule(name), ...e, added: true, pos } } };
}

/** Moves a class the draft added, and reroutes the draft's relationships that touch it. */
export function moveClass(ctx: Ctx, name: string, pos: Point): DraftUpdate {
  const u: DraftUpdate = { classes: { [name]: { pos } } };
  return merged(u, reroute(ctx, u, live(ctx.draft.slots).filter(([, s]) => s.class === name || s.range === name).map(([k]) => k)));
}

/** Routes the given draft relationships again, one after another, on the draft with `u` applied. */
export function reroute(ctx: Ctx, u: DraftUpdate, keys: string[]): DraftUpdate {
  let out: DraftUpdate = { slots: {} };
  for (const k of keys) {
    const s = { ...ctx.draft.slots[k], ...u.slots?.[k] } as SlotEdit;
    if (!s.class || !s.name) continue;
    const { model, layout } = draftModel(ctx, merged(u, { slots: { ...out.slots, [k]: { port: null } } }));
    if (!model) continue;
    const port = autoRoute(model, layout, `${s.class}.${s.name}`);
    if (port) out = merged(out, { slots: { [k]: { port } } });
  }
  return out;
}

/** Adds a field, or a relationship when the range is a class, and routes a relationship on the map. */
export function addSlot(ctx: Ctx, cls: string, name: string, range: string, e: Partial<SlotEdit> = {}): DraftUpdate {
  const key = slotKey(cls, name);
  const u: DraftUpdate = { slots: { [key]: { ...e, class: cls, name, range } } };
  if (!classExists(ctx, range)) return u;
  return merged(u, reroute(ctx, u, [key]));
}

export function removeSlot(_ctx: Ctx, key: string): DraftUpdate {
  return { slots: { [key]: null } };
}

/** Removes a class the draft added, with its fields, the relationships to it, and answers that walk them. */
export function removeClass(ctx: Ctx, name: string): DraftUpdate {
  const slots = live(ctx.draft.slots).filter(([, s]) => s.class === name || s.range === name);
  const gone = new Set(slots.map(([, s]) => `${s.class}.${s.name}`));
  const answers = live(ctx.draft.answers).filter(([, a]) => a.walks.some((w) => gone.has(w) || w.startsWith(name + '.')));
  const kids = live(ctx.draft.classes).filter(([, e]) => e.is_a === name);
  return {
    classes: { [name]: null, ...Object.fromEntries(kids.map(([n]) => [n, { is_a: null }])) },
    slots: Object.fromEntries(slots.map(([k]) => [k, null])),
    answers: Object.fromEntries(answers.map(([id]) => [id, null])),
  };
}

/** The ID rule a new class starts with: its capitals, such as pf:{id} for PaymentFacilitator. */
export const defaultIdRule = (name: string) => `${name.replace(/[a-z0-9]/g, '').toLowerCase() || 'x'}:{id}`;

/** Renames a class the draft added, and everything that names it. */
export function renameClass(ctx: Ctx, from: string, to: string): DraftUpdate {
  const was = ctx.draft.classes[from]!;
  // An ID rule nobody has changed follows the new name.
  const e = was.id_rule === defaultIdRule(from) ? { ...was, id_rule: defaultIdRule(to) } : was;
  const slots: Record<string, SlotEdit | null> = {};
  for (const [k, s] of live(ctx.draft.slots)) {
    if (s.class !== from && s.range !== from) continue;
    const next = { ...s, class: s.class === from ? to : s.class, range: s.range === from ? to : s.range };
    slots[k] = null;
    slots[slotKey(next.class, next.name)] = next;
  }
  const kids = live(ctx.draft.classes).filter(([, c]) => c.is_a === from).map(([n]) => [n, { is_a: to }]);
  const answers = live(ctx.draft.answers).filter(([, a]) => a.walks.some((w) => w.startsWith(from + '.')))
    .map(([id, a]) => [id, { ...a, walks: a.walks.map((w) => (w.startsWith(from + '.') ? to + w.slice(from.length) : w)) }]);
  return { classes: { [from]: null, [to]: e, ...Object.fromEntries(kids) }, slots, answers: Object.fromEntries(answers) };
}

/** Renames a field or relationship the draft added, and the walks that use it. */
export function renameSlot(ctx: Ctx, key: string, to: string): DraftUpdate {
  const s = ctx.draft.slots[key]!;
  const [was, now] = [`${s.class}.${s.name}`, `${s.class}.${to}`];
  const answers = live(ctx.draft.answers).filter(([, a]) => a.walks.includes(was))
    .map(([id, a]) => [id, { ...a, walks: a.walks.map((w) => (w === was ? now : w)) }]);
  return { slots: { [key]: null, [slotKey(s.class, to)]: { ...s, name: to } }, answers: Object.fromEntries(answers) };
}

/** What Claude can ask the studio to do. Every op is checked before it's applied; ones that don't fit are skipped. */
export type Op =
  | { op: 'addClass'; name: string; is_a?: string; abstract?: boolean; description?: string; owner?: string; lives_in?: string; id_rule?: string; no_standard?: string; close_mappings?: string[] }
  | { op: 'addEnum'; name: string; description?: string; values: Record<string, string> }
  | { op: 'addField'; class: string; name: string; range: string; required?: boolean; multivalued?: boolean; description?: string }
  | { op: 'addRelationship'; from: string; name: string; to: string; required?: boolean; multivalued?: boolean; description?: string }
  | { op: 'answerQuestion'; id: string; answered_in: 'neptune' | 'snowflake'; walks: string[]; query: string };

const TYPES = ['string', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'uri'];
export const isType = (r: string) => TYPES.includes(r);
export const FIELD_TYPES = TYPES;

/** Applies Claude's ops in order, each on the draft as the ones before it left it. */
export function applyOps(ctx: Ctx, ops: Op[]): { update: DraftUpdate; done: string[]; skipped: string[] } {
  let u: DraftUpdate = {};
  const done: string[] = [], skipped: string[] = [];
  const step = (): Ctx => ({ ...ctx, draft: mergeDraft(ctx.draft, u as Record<string, unknown>) });
  const enumExists = (c: Ctx, n: string) => has(c.base.enums, n) || live(c.draft.enums).some(([e]) => e === n);
  for (const o of Array.isArray(ops) ? ops : []) {
    const c = step();
    const skip = (why: string) => skipped.push(`${o?.op ?? 'op'}: ${why}`);
    try {
      if (o.op === 'addClass') {
        const why = classNameProblem(c, String(o.name));
        if (why) { skip(why); continue; }
        if (o.is_a && !classExists(c, o.is_a)) { skip(`${o.name}'s parent ${o.is_a} doesn't exist.`); continue; }
        u = merged(u, addClass(c, o.name, {
          is_a: o.is_a ?? null, abstract: o.abstract ?? null, description: o.description ?? null, owner: o.owner ?? 'core',
          lives_in: o.lives_in ?? 'graph', id_rule: o.id_rule ?? null, no_standard: o.no_standard ?? null, close_mappings: o.close_mappings ?? null,
        }));
        done.push(`added class ${o.name}`);
      } else if (o.op === 'addEnum') {
        if (!NAMES.class.re.test(o.name) || enumExists(c, o.name) || classExists(c, o.name)) { skip(`can't add enum ${o.name}.`); continue; }
        const values = Object.fromEntries(Object.entries(o.values ?? {}).filter(([v]) => NAMES.value.re.test(v)).map(([v, d]) => [v, String(d ?? '')]));
        u = merged(u, { enums: { [o.name]: { description: o.description ?? null, values } } });
        done.push(`added enum ${o.name}`);
      } else if (o.op === 'addField' || o.op === 'addRelationship') {
        const cls = o.op === 'addField' ? o.class : o.from;
        const range = o.op === 'addField' ? o.range : o.to;
        if (!classExists(c, cls)) { skip(`no class ${cls}.`); continue; }
        const why = slotNameProblem(c, cls, String(o.name));
        if (why) { skip(why); continue; }
        if (!isType(range) && !enumExists(c, range) && !classExists(c, range)) { skip(`${cls}.${o.name}: no type, enum or class ${range}.`); continue; }
        u = merged(u, addSlot(c, cls, o.name, range, { required: o.required ?? null, multivalued: o.multivalued ?? null, description: o.description ?? null }));
        done.push(`added ${cls}.${o.name}`);
      } else if (o.op === 'answerQuestion') {
        if (!c.questions.questions.some((q) => q.id === o.id)) { skip(`no question ${o.id}.`); continue; }
        u = merged(u, { answers: { [o.id]: { answered_in: o.answered_in === 'snowflake' ? 'snowflake' : 'neptune', walks: (o.walks ?? []).map(String), query: String(o.query ?? '') } } });
        done.push(`answered ${o.id}`);
      } else skip('unknown op.');
    } catch (e) { skip(e instanceof Error ? e.message : String(e)); }
  }
  return { update: u, done, skipped };
}
