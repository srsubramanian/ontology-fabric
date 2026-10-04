// Lineage: how a field on a screen is built, layer by layer, from the warehouse, and what it means in the ontology. It
// reads a mapping set in SSSOM's TSV format: a field "prov:wasDerivedFrom" the field it's built from, with how
// (the transform), and a field's meaning (skos:exactMatch, closeMatch, relatedMatch, or sssom:NoTermFound for a gap).
// From those it works out each screen field's trace and its state: confirmed, waiting for a person, a gap, or a
// meaning that shifts along the way. Each scan of the code makes a version of the set; the earlier ones are kept, so the
// studio can show what a scan changed, and a person's decision holds until the code under it changes. The Transaction
// Research mapping set and its versions are illustrative.
import { parse } from 'yaml';
import type { Model } from '../explorer/model.ts';

export type Layer = 'ui' | 'be' | 'api' | 'sf';
export const LAYERS: { id: Layer; label: string; says: string }[] = [
  { id: 'ui', label: 'Screen', says: 'What the analyst sees' },
  { id: 'be', label: 'Backend', says: 'The application behind the screen' },
  { id: 'api', label: 'Data API', says: 'The API the backend calls' },
  { id: 'sf', label: 'Snowflake', says: 'Where the data is stored' },
];
export type Transform = 'pass' | 'rename' | 'format' | 'convert' | 'lookup' | 'derive' | 'aggregate' | 'join' | 'filter';
export const TRANSFORMS: Record<Transform, string> = {
  pass: 'as is', rename: 'renamed', format: 'formatted', convert: 'converted', lookup: 'looked up',
  derive: 'derived', aggregate: 'added up', join: 'joined', filter: 'filtered',
};
/** Below this, a mapping Claude proposed waits for a person (decision 19). */
export const THRESHOLD = 0.9;

export type Row = Record<string, string>;
export type Field = { id: string; label: string; layer: Layer };
export type Hop = { from: string; to: string; transform: Transform; note: string; location: string;
  /** The code that does it, from the set's code extension, in the language of the layer it's in. */
  code: string;
  /** The repository it's in (subject_source), such as repo:transaction-research-ui. */
  source?: string };
export type Means = {
  key: string; field: string; slot: string | null; predicate: string; confidence: number;
  author: string; reviewer: string; comment: string;
  /** A mapping people rejected: predicate_modifier Not in the set. */
  negated?: boolean;
};
export type State = 'confirmed' | 'proposed' | 'review' | 'recheck' | 'gap' | 'shift' | 'rejected';
/** One screen field's trace: every field it's built from, lane by lane, and what each end means. */
export type Trace = {
  slug: string; field: Field; lanes: Record<Layer, Field[]>; hops: Hop[];
  means: Means | null; sources: Means[]; state: State;
  /** Where the meaning shifts: the screen means one thing, a source it's built from another. */
  shift?: { screen: string; source: string; field: Field; hop?: Hop };
  /** What a decision on its meaning rests on: every hop and its code, not where the code sits. */
  fingerprint: string;
  /** Who agreed what it means: a person in the set (person:ana), or a person on the draft. */
  confirmedBy: string | null;
  /** A person agreed what it meant, then how it's built changed, so a person needs to look again. */
  reopened?: { since: string | null; by: string | null };
};
export type Lineage = {
  title: string; meta: Record<string, unknown>; fields: Map<string, Field>; hops: Hop[]; means: Means[]; traces: Trace[];
  /** The competency question the screen answers, from the set's competency_question extension. */
  question: string | null;
  /** Which scan this is (mapping_set_version) and when it was published. */
  version: string | null; date: string | null;
};
/** A person's decision on a proposed mapping, kept on the shared draft. It holds while the field is built the way it
 *  was when they decided (its fingerprint, the basis). */
export type MappingDecision = { state: 'accepted' | 'rejected'; reason?: string | null; by?: string | null; at?: number; basis?: string | null;
  /** The version of the mapping set it was made on, for the pull request to skip it if a newer scan has landed. */
  version?: string | null;
  /** The mapping set it belongs to, one per screen (transaction-research when not named, as before there were two). */
  set?: string | null };

/** SSSOM's TSV: commented YAML metadata, then a header row and one mapping per row. */
export function parseSssom(tsv: string): { meta: Record<string, unknown>; rows: Row[] } {
  const lines = tsv.split(/\r?\n/);
  const meta = (parse(lines.filter((l) => l.startsWith('#')).map((l) => l.slice(1)).join('\n')) ?? {}) as Record<string, unknown>;
  const body = lines.filter((l) => l && !l.startsWith('#'));
  const head = body[0]?.split('\t') ?? [];
  return { meta, rows: body.slice(1).map((l) => { const v = l.split('\t'); return Object.fromEntries(head.map((h, i) => [h, v[i] ?? ''])); }) };
}

const layerOf = (id: string): Layer | null => { const p = id.split(':')[0]; return p === 'ui' || p === 'be' || p === 'api' || p === 'sf' ? p : null; };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** The ontology class a slot belongs to: Settlement for Settlement.settled_at. */
export const classOf = (slot: string | null) => (slot ? slot.split('.')[0] : null);
export const mappingKey = (m: Pick<Means, 'field' | 'slot'>) => `${m.field}>${m.slot ?? 'none'}`;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const sig = (h: Hop) => `${h.from}>${h.to}|${h.transform}|${norm(h.code)}`;
/** A short hash of every hop, how it's done and its code. Where the code sits isn't in it, so code that only moves
 *  keeps a person's decision. */
export function fingerprint(hops: Hop[]): string {
  const s = hops.map(sig).sort().join('\n');
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x.toString(36);
}

/** Builds a mapping set's lineage. Decisions from the draft apply where they still rest on how the field is built; the
 *  version before (prior) tells which fields a person had confirmed before this scan changed them. */
export function buildLineage(tsv: string, decisions: Record<string, MappingDecision | null> = {}, prior: Lineage | null = null): Lineage {
  const { meta, rows } = parseSssom(tsv);
  const fields = new Map<string, Field>();
  const field = (id: string, label: string) => {
    const layer = layerOf(id);
    if (layer && !fields.has(id)) fields.set(id, { id, label: label || id.split(/[.:]/).pop()!, layer });
    return fields.get(id);
  };
  const hops: Hop[] = [], means: Means[] = [];
  for (const r of rows) {
    if (!r.subject_id || !r.predicate_id) continue;
    field(r.subject_id, r.subject_label);
    if (r.predicate_id === 'prov:wasDerivedFrom') {
      field(r.object_id, r.object_label);
      hops.push({ from: r.subject_id, to: r.object_id, transform: ((r.transform || 'pass') in TRANSFORMS ? r.transform || 'pass' : 'pass') as Transform, note: r.transform_note, location: r.location, code: r.code ?? '',
        source: r.subject_source || undefined });
    } else {
      const slot = r.object_id === 'sssom:NoTermFound' ? null : r.object_id.replace(/^fabric:/, '');
      const m: Means = { key: '', field: r.subject_id, slot, predicate: r.predicate_id, confidence: Number(r.confidence || 0), author: r.author_id, reviewer: r.reviewer_id, comment: r.comment,
        negated: r.predicate_modifier === 'Not' || undefined };
      m.key = mappingKey(m);
      means.push(m);
    }
  }
  // A rejected mapping isn't a meaning; it shows only when nothing else says what the field means.
  const meaningOf = (id: string) => means.find((m) => m.field === id && !m.negated) ?? means.find((m) => m.field === id) ?? null;
  const upstream = (id: string) => hops.filter((h) => h.from === id);
  const holds = (m: Means, fp: string) => { const d = decisions[m.key]; return d && (!d.basis || d.basis === fp) ? d : null; };
  const confirmer = (m: Means, fp: string) => m.reviewer || (m.author.startsWith('person:') ? m.author : null)
    || (holds(m, fp)?.state === 'accepted' ? holds(m, fp)!.by ?? 'person' : null);

  const traces: Trace[] = [...fields.values()].filter((f) => f.layer === 'ui').map((f) => {
    const lanes: Record<Layer, Field[]> = { ui: [f], be: [], api: [], sf: [] };
    const used: Hop[] = [];
    const walk = (id: string, seen: Set<string>) => {
      for (const h of upstream(id)) {
        if (seen.has(h.to)) continue;
        seen.add(h.to); used.push(h);
        const to = fields.get(h.to)!;
        if (!lanes[to.layer].includes(to)) lanes[to.layer].push(to);
        walk(h.to, seen);
      }
    };
    walk(f.id, new Set([f.id]));
    const fp = fingerprint(used);
    const m = meaningOf(f.id);
    const sources = lanes.sf.map((x) => meaningOf(x.id)).filter((x): x is Means => !!x && !x.negated);
    const by = m && !m.negated ? confirmer(m, fp) : null;
    let state: State = !m || !m.slot ? 'gap' : m.negated || holds(m, fp)?.state === 'rejected' ? 'rejected' : by ? 'confirmed' : m.confidence < THRESHOLD ? 'review' : 'proposed';
    // Confirmed before, by a person in the version before or on the draft, and built differently now: look again.
    const was = prior?.traces.find((x) => x.field.id === f.id);
    const stale = m && decisions[m.key] && !holds(m, fp) ? decisions[m.key] : null;
    const reopened = !m?.slot || by ? undefined
      : was?.confirmedBy && was.fingerprint !== fp ? { since: prior!.version, by: was.confirmedBy }
        : stale?.state === 'accepted' ? { since: null, by: stale.by ?? null } : undefined;
    if (reopened && (state === 'proposed' || state === 'review')) state = 'recheck';
    let shift: Trace['shift'];
    // A field that means something exactly or nearly, built from a source that means a different class: the meaning
    // shifts on the way. A field derived on purpose (relatedMatch, such as a status) is exempt.
    if (m?.slot && !m.negated && m.predicate !== 'skos:relatedMatch') {
      const other = sources.find((s) => s.slot && classOf(s.slot) !== classOf(m.slot));
      if (other) {
        const src = fields.get(other.field)!;
        shift = { screen: m.slot, source: other.slot!, field: src, hop: used.find((h) => h.to === src.id) };
        if (state !== 'rejected') state = 'shift';
      }
    }
    return { slug: slug(f.label), field: f, lanes, hops: used, means: m, sources, state, shift, fingerprint: fp, confirmedBy: by, reopened };
  });
  const v = versionOf(meta, rows);
  return { title: String(meta.mapping_set_title ?? 'Lineage'), meta, fields, hops, means, traces, question: typeof meta.competency_question === 'string' ? meta.competency_question : null,
    version: v.version, date: v.date };
}

/** One scan of a mapping set: its version, when it was published, the version it came from, and what each layer was
 *  read from (subject_source at subject_source_version: a repository at a commit, or Snowflake's schema on a day). */
export type Version = { version: string | null; date: string | null; source: string | null; read: Partial<Record<Layer, { source: string; at: string }>>; tsv: string;
  /** What wrote it, from its hops' mapping_tool: the deep scan, say, or a quick refresh in the studio. */
  tool: string | null };
const dateOf = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d == null ? null : String(d));
function versionOf(meta: Record<string, unknown>, rows: Row[], tsv = ''): Version {
  const read: Version['read'] = {};
  for (const r of rows) {
    const layer = layerOf(r.subject_id);
    if (layer && r.subject_source && !read[layer]) read[layer] = { source: r.subject_source, at: r.subject_source_version ?? '' };
  }
  const src = meta.mapping_set_source;
  const tool = rows.find((r) => r.predicate_id === 'prov:wasDerivedFrom' && r.mapping_tool)?.mapping_tool ?? null;
  return { tool, version: meta.mapping_set_version == null ? null : String(meta.mapping_set_version), date: dateOf(meta.publication_date),
    source: Array.isArray(src) ? String(src[0] ?? '') || null : typeof src === 'string' ? src : null, read, tsv };
}
export const versionOfSet = (tsv: string) => { const { meta, rows } = parseSssom(tsv); return versionOf(meta, rows, tsv); };

/** A set's versions, oldest first: the earlier scans kept in history, then the current one. */
export function versionsOf(current: string, history: string[]): Version[] {
  const now = versionOfSet(current);
  return [...history.map(versionOfSet).filter((v) => v.version !== now.version), now].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}
/** Every version's lineage, each read against the one before it. Decisions on the draft apply to the newest only. */
export function buildVersions(versions: Version[], decisions: Record<string, MappingDecision | null> = {}): Lineage[] {
  const out: Lineage[] = [];
  versions.forEach((v, i) => out.push(buildLineage(v.tsv, i === versions.length - 1 ? decisions : {}, out[i - 1] ?? null)));
  return out;
}

/** What a scan can change about a screen field, in the order the studio names them. */
export type Change = 'gone' | 'added' | 'reopened' | 'rebuilt' | 'remapped' | 'confirmed' | 'moved';
export const CHANGES: Change[] = ['gone', 'added', 'reopened', 'rebuilt', 'remapped', 'confirmed', 'moved'];
/** The hops between two layers, before and after, where they differ. */
export type HopChange = { from: Layer; to: Layer; before: Hop[]; after: Hop[] };
export type FieldDiff = {
  slug: string; field: Field; kinds: Change[]; before: Trace | null; after: Trace | null;
  hops: HopChange[]; moved: { hop: Hop; was: string }[];
};
export type LineageDiff = { from: string | null; to: string | null; fields: FieldDiff[]; count: Record<Change, number>; lines: number };

const PAIRS: [Layer, Layer][] = [['ui', 'be'], ['be', 'api'], ['api', 'sf']];
export const between = (t: Trace, a: Layer, b: Layer) => t.hops.filter((h) => t.lanes[a].some((f) => f.id === h.from) && t.lanes[b].some((f) => f.id === h.to));

/** What changed for each screen field from one version to another: fields new or gone, hops built differently, a
 *  meaning that changed, a person's confirmation the change reopened, and code that only moved. */
export function compareLineage(a: Lineage, b: Lineage): LineageDiff {
  const ids = [...b.traces.map((t) => t.field.id), ...a.traces.map((t) => t.field.id).filter((id) => !b.traces.some((t) => t.field.id === id))];
  const fields = ids.map((id): FieldDiff => {
    const before = a.traces.find((t) => t.field.id === id) ?? null, after = b.traces.find((t) => t.field.id === id) ?? null;
    const t = (after ?? before)!;
    const kinds: Change[] = [], hops: HopChange[] = [], moved: FieldDiff['moved'] = [];
    if (!before) kinds.push('added');
    else if (!after) kinds.push('gone');
    else {
      for (const [x, y] of PAIRS) {
        const hb = between(before, x, y), ha = between(after, x, y);
        if (hb.map(sig).sort().join('\n') !== ha.map(sig).sort().join('\n')) hops.push({ from: x, to: y, before: hb, after: ha });
        else for (const h of ha) { const w = hb.find((o) => sig(o) === sig(h)); if (w && w.location !== h.location) moved.push({ hop: h, was: w.location }); }
      }
      const remapped = (before.means?.slot ?? null) !== (after.means?.slot ?? null) || (!!after.means?.slot && before.means?.predicate !== after.means?.predicate);
      if (before.confirmedBy && !after.confirmedBy && before.fingerprint !== after.fingerprint) kinds.push('reopened');
      if (hops.length) kinds.push('rebuilt');
      if (remapped) kinds.push('remapped');
      if (!before.confirmedBy && after.confirmedBy && !remapped) kinds.push('confirmed');
      if (!kinds.length && moved.length) kinds.push('moved');
    }
    return { slug: t.slug, field: t.field, kinds, before, after, hops, moved };
  });
  const count = Object.fromEntries(CHANGES.map((c) => [c, fields.filter((f) => f.kinds.includes(c)).length])) as Record<Change, number>;
  return { from: a.version, to: b.version, fields, count, lines: fields.reduce((n, f) => n + f.moved.length, 0) };
}

/** Mappings to slots the ontology doesn't have, for the checks. */
export function unknownSlots(l: Lineage, model: Model): string[] {
  const has = (slot: string) => {
    const [c, s] = slot.split('.');
    const cls = model.classes[c];
    return !!cls && (!s || cls.slots.some((x) => x.name === s));
  };
  return [...new Set(l.means.filter((m) => m.slot && !has(m.slot)).map((m) => m.slot!))];
}

/** A mapping's predicate, as a sentence's verb. */
export const meansWords = (p: string) => (p === 'skos:exactMatch' ? 'means exactly' : p === 'skos:closeMatch' ? 'means nearly' : p === 'skos:relatedMatch' ? 'is derived from' : p === 'skos:narrowMatch' ? 'is a narrower kind of' : p === 'skos:broadMatch' ? 'is a broader kind of' : 'maps to');

/** A count of each state, for the summary line. */
export function tally(traces: Trace[]): Record<State, number> {
  const out: Record<State, number> = { confirmed: 0, proposed: 0, review: 0, recheck: 0, gap: 0, shift: 0, rejected: 0 };
  for (const t of traces) out[t.state]++;
  return out;
}
