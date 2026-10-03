// The working draft: one shared copy of everything the team has built on top of the released ontology. It's
// stored as flat maps keyed by name, so two people editing different classes never overwrite each other: the
// store merges nested objects, and a null entry means "removed". draftToPatch turns it into the LinkML patch the
// checks run on and the pull request applies.
import type { LayoutPatch, PortSpec } from '../explorer/layout.ts';
import { NODE, viewOf } from '../explorer/layout.ts';
import type { RawQuestions, RawSchema, RawSlot } from '../explorer/model.ts';

export type Point = [number, number];
type Stamp = { by?: string | null; at?: number };

/** A class the draft adds (added: true), or an edit to a released one (its description and aliases only). */
export type ClassEdit = Stamp & {
  added?: boolean; is_a?: string | null; abstract?: boolean | null; description?: string | null; aliases?: string[] | null;
  owner?: string | null; lives_in?: string | null; id_rule?: string | null;
  close_mappings?: string[] | null; no_standard?: string | null; pos?: Point | null;
};
/** A field or relationship the draft adds to a class: a relationship when its range is a class. */
export type SlotEdit = Stamp & {
  class: string; name: string; range: string; required?: boolean | null; multivalued?: boolean | null;
  description?: string | null; port?: PortSpec | null;
};
export type EnumEdit = Stamp & { description?: string | null; values: Record<string, string | null> };
/** The walk and query that answer a question. A new question, asked in the studio, also carries its text and domain. */
export type AnswerEdit = Stamp & { answered_in: 'neptune' | 'snowflake'; walks: string[]; query: string; question?: string | null; domain?: string | null };

/**
 * One edit Claude proposed for a question someone asked: the change it makes, worked out on the draft when Claude
 * proposed it, why, the proposals it needs first, and what people decided. It touches the draft only once accepted.
 */
export type ProposalEdit = {
  title: string; why: string; kind: 'class' | 'enum' | 'field' | 'relationship' | 'answer';
  /** What it adds: a class or enum name, Class.slot, or the question id it answers. */
  name: string;
  update: DraftUpdate;
  needs: string[];
  /** Why the studio couldn't apply it, when it couldn't. */
  problem?: string | null;
  state: 'proposed' | 'accepted' | 'rejected';
  decidedBy?: string | null; decidedAt?: number | null;
  /** What people said about it, keyed by a generated id so two comments never overwrite each other. */
  notes?: Record<string, { by?: string | null; at: number; text: string } | null> | null;
  /** Why it was rejected or accepted, in the decider's words; it goes into the team's memory too. */
  reason?: string | null;
  /** For someone learning (the tutor setting): the modelling rule behind it, and a question that checks they see why. */
  teach?: string | null;
  quiz?: { question: string; choices: { label: string; right: boolean; why: string }[] } | null;
  /** What the team decided the last time something by this name was proposed. */
  recalled?: { state: 'accepted' | 'rejected'; reason?: string | null; by?: string | null; at: number; question?: string | null } | null;
};
/** A question someone asked in their own words, what Claude made of it, and the design it proposed. */
export type InquiryEdit = {
  question: string; askedBy?: string | null; askedAt: number;
  status: 'thinking' | 'proposed' | 'failed';
  /** When Claude last started on it, to tell a run in progress from one a closed tab left behind. */
  startedAt?: number | null;
  error?: string | null;
  /** What each phrase means, and what in the ontology holds it, or null where nothing does yet. */
  understanding?: { phrase: string; means: string; maps_to: string | null }[] | null;
  /** A competency question that already asks this, and whether the ontology already answers it. */
  matches?: string | null; answered?: boolean | null;
  gap?: string | null; summary?: string | null;
  proposals?: Record<string, ProposalEdit> | null;
  /** Proposal ids in the order they apply. */
  order?: string[] | null;
  /** How much Claude did, as the person asking set it: tutor, co-pilot or autopilot. */
  level?: 'tutor' | 'copilot' | 'autopilot' | null;
  /** On autopilot, the work Claude did after proposing: a test case planted and the answer proved, ready to accept. */
  auto?: { status: 'testing' | 'ready' | 'failed'; passes?: boolean | null; checks?: string[] | null; error?: string | null; at?: number | null } | null;
};

export type DraftDoc = {
  id: string;
  /** The released ontology version the draft builds on. */
  base: string;
  status: 'open' | 'pr';
  createdAt: number; updatedAt: number; updatedBy?: string | null;
  classes: Record<string, ClassEdit | null>;
  /** Keyed `Class:slot`. */
  slots: Record<string, SlotEdit | null>;
  enums: Record<string, EnumEdit | null>;
  /** Keyed by question id: the walk and query that answer a gap, or a new question. */
  answers: Record<string, AnswerEdit | null>;
  /** Questions people asked in their own words, keyed by a generated id. Older drafts have none. */
  inquiries?: Record<string, InquiryEdit | null>;
  /** Test cases that prove a question with sample data, keyed by question id. Illustrative; older drafts have none. */
  tests?: Record<string, TestEdit | null>;
  session?: { id: string | null; by: string; at: number; environment: string; branch: string; note?: string } | null;
};

/**
 * A test case for a question (decision 25, stage 4): the instances to plant on the sample world, the rows to expect,
 * and its story in words. The case is kept as JSON text, so a new one replaces the old whole rather than merging.
 */
export type TestEdit = { scenario: string; by?: string | null; at?: number; author: 'claude' | 'person' };

/** One change to the draft: entries, or parts of entries, to merge into its maps; null removes one. */
export type DraftUpdate = {
  classes?: Record<string, Partial<ClassEdit> | null>;
  slots?: Record<string, Partial<SlotEdit> | null>;
  enums?: Record<string, Partial<EnumEdit> | null>;
  answers?: Record<string, Partial<AnswerEdit> | null>;
  inquiries?: Record<string, Partial<InquiryEdit> | null>;
  tests?: Record<string, Partial<TestEdit> | null>;
};
const MAPS = ['classes', 'slots', 'enums', 'answers', 'inquiries', 'tests'] as const;

export const slotKey = (cls: string, name: string) => `${cls}:${name}`;
export const emptyDraft = (id: string, base: string): DraftDoc =>
  ({ id, base, status: 'open', createdAt: Date.now(), updatedAt: Date.now(), classes: {}, slots: {}, enums: {}, answers: {}, inquiries: {}, tests: {} });

/** Entries that are there: null and undefined fields read as absent. */
export const live = <T>(m: Record<string, T | null> | undefined) =>
  Object.entries(m ?? {}).filter((e): e is [string, T] => e[1] !== null && e[1] !== undefined);
const has = (o: object | undefined, k: string) => !!o && Object.hasOwn(o, k);
const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== null && v !== undefined && k !== 'by' && k !== 'at')) as Partial<T>;

/** Merges an update into a draft the way the store does: nested objects merge, anything else replaces. */
export function mergeDraft(d: DraftDoc, u: Record<string, unknown>): DraftDoc {
  const go = (a: unknown, b: unknown): unknown => {
    if (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object' && !Array.isArray(a)) {
      const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
      for (const [k, v] of Object.entries(b)) out[k] = go(out[k], v);
      return out;
    }
    return b;
  };
  return go(d, u) as DraftDoc;
}

/** The update that undoes `u` on draft `d`: each touched entry back as it was, or removed if it wasn't there. */
export function inverse(d: DraftDoc, u: DraftUpdate): DraftUpdate {
  const out: Record<string, Record<string, unknown>> = {};
  for (const m of MAPS) {
    for (const [k, v] of Object.entries(u[m] ?? {})) {
      const prev = (d[m] as Record<string, unknown>)?.[k];
      if (prev === undefined || prev === null) { (out[m] ??= {})[k] = null; continue; }
      if (v === null) { (out[m] ??= {})[k] = prev; continue; }
      // A partial edit: put back each field it touched, and clear the ones that weren't there.
      const back: Record<string, unknown> = {};
      for (const f of Object.keys(v as object)) back[f] = (prev as Record<string, unknown>)[f] ?? null;
      (out[m] ??= {})[k] = back;
    }
  }
  return out as DraftUpdate;
}

/** The LinkML patch the draft adds up to: schema to merge, questions it answers, and the layout to draw it. */
export type Patch = {
  schema: Partial<RawSchema>;
  /** Answers by question id; a question the released file doesn't have also carries its text and domain. */
  questions: Record<string, { answered_in: string; walks: string[]; query: string; question?: string; domain?: string }>;
  layout: LayoutPatch;
};

export function draftToPatch(d: DraftDoc, base: RawSchema): Patch {
  const classes: Record<string, Record<string, unknown>> = {};
  const slots: Record<string, RawSlot> = {};
  const enums: Record<string, unknown> = {};
  const pos: Record<string, Point> = {};
  const ports: Record<string, PortSpec> = {};

  for (const [name, e] of live(d.classes)) {
    if (e.added) {
      const annotations = clean({ owner: e.owner, lives_in: e.lives_in, id_rule: e.id_rule, no_standard: e.no_standard });
      classes[name] = clean({
        is_a: e.is_a || null, abstract: e.abstract || null, description: e.description, aliases: e.aliases?.length ? e.aliases : null,
        close_mappings: e.close_mappings?.length ? e.close_mappings : null, annotations,
      });
      if (e.pos && !e.abstract) pos[name] = e.pos;
    } else {
      const edit = clean({ description: e.description, aliases: e.aliases?.length ? e.aliases : null });
      if (Object.keys(edit).length) classes[name] = edit;
    }
  }
  for (const [, s] of live(d.slots)) {
    const cls = (classes[s.class] ??= {});
    cls.slots = [...((cls.slots as string[]) ?? []), s.name];
    const known = slots[s.name] ?? base.slots[s.name];
    if (!known) slots[s.name] = clean({ range: s.range, description: s.description, multivalued: s.multivalued || null }) as RawSlot;
    const usage = clean({
      range: known && known.range !== s.range ? s.range : null, required: s.required || null,
      multivalued: known && !!known.multivalued !== !!s.multivalued ? !!s.multivalued : null,
    });
    if (Object.keys(usage).length) cls.slot_usage = { ...(cls.slot_usage as object), [s.name]: usage };
    if (s.port) ports[slotKey(s.class, s.name).replace(':', '.')] = s.port;
  }
  for (const [name, e] of live(d.enums)) {
    enums[name] = clean({
      description: e.description,
      permissible_values: Object.fromEntries(live(e.values).map(([v, desc]) => [v, desc ? { description: desc } : {}])),
    });
  }
  const questions = Object.fromEntries(live(d.answers).map(([id, a]) => [id, {
    answered_in: a.answered_in, walks: a.walks, query: a.query, ...(a.question ? { question: a.question, domain: a.domain ?? 'risk' } : {}),
  }]));
  // Grow the drawing to hold classes placed below or right of it.
  const far = Object.values(pos).reduce((m, [x, y]) => ({ w: Math.max(m.w, x + NODE.w + 12), h: Math.max(m.h, y + NODE.h + 24) }), viewOf());
  const view = far.w > viewOf().w || far.h > viewOf().h ? far : undefined;
  return {
    schema: { ...(Object.keys(classes).length && { classes: classes as RawSchema['classes'] }), ...(Object.keys(slots).length && { slots }), ...(Object.keys(enums).length && { enums: enums as RawSchema['enums'] }) },
    questions, layout: { pos, ports, ...(view && { view }) },
  };
}

/** The draft's schema and questions: the released ontology with the patch applied. */
export function applyPatch(base: RawSchema, baseQuestions: RawQuestions, patch: Patch): { schema: RawSchema; questions: RawQuestions } {
  const schema = merge(base, patch.schema);
  const known = new Set(baseQuestions.questions.map((q) => q.id));
  const questions: RawQuestions = {
    ...baseQuestions,
    questions: [
      ...baseQuestions.questions.map((q) => {
        const a = patch.questions[q.id];
        if (!a) return q;
        const { question: _q, domain: _d, ...answer } = a;
        const { gap: _g, ...rest } = q;
        return { ...rest, ...answer } as typeof q;
      }),
      // New questions, asked in the studio.
      ...Object.entries(patch.questions).filter(([id, a]) => !known.has(id) && a.question)
        .map(([id, a]) => ({ id, domain: a.domain ?? 'risk', question: a.question!, answered_in: a.answered_in as 'neptune' | 'snowflake', walks: a.walks, query: a.query })),
    ],
  };
  return { schema, questions };
}

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
      out[k] = has(out, k) ? merge(out[k], v) : v;
    }
    return out as T;
  }
  return (patch === undefined ? base : patch) as T;
}

/** Name rules, as linkml-lint enforces them in the pull request. */
export const NAMES = {
  class: { re: /^[A-Z][A-Za-z0-9]*$/, hint: 'CamelCase, such as PaymentFacilitator' },
  slot: { re: /^[a-z][a-z0-9_]*$/, hint: 'snake_case, such as sub_merchant_of' },
  value: { re: /^[a-z0-9][a-z0-9_]*$/, hint: 'snake_case, such as card_not_present' },
};

/** What the draft adds, for the change list and the pull request. */
export function summarize(d: DraftDoc, base: RawSchema) {
  const classes = live(d.classes);
  const slots = live(d.slots);
  const isClass = (r: string) => has(base.classes, r) || live(d.classes).some(([n, e]) => n === r && e.added);
  return {
    newClasses: classes.filter(([, e]) => e.added).map(([n]) => n),
    editedClasses: classes.filter(([, e]) => !e.added).map(([n]) => n),
    relationships: slots.filter(([, s]) => isClass(s.range)).map(([, s]) => `${s.class}.${s.name}`),
    fields: slots.filter(([, s]) => !isClass(s.range)).map(([, s]) => `${s.class}.${s.name}`),
    enums: live(d.enums).map(([n]) => n),
    answers: live(d.answers).map(([id]) => id),
    /** Questions asked in the studio: only their answers carry the question's text. */
    newQuestions: live(d.answers).filter(([, a]) => !!a.question).map(([id]) => id),
    get count() { return this.newClasses.length + this.editedClasses.length + this.relationships.length + this.fields.length + this.enums.length + this.answers.length; },
  };
}
