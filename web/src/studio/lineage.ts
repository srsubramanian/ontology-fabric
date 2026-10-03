// Lineage: how a field on a screen is built, layer by layer, from the warehouse, and what it means in the ontology. It
// reads a mapping set in SSSOM's TSV format: a field "prov:wasDerivedFrom" the field it's built from, with how
// (the transform), and a field's meaning (skos:exactMatch, closeMatch, relatedMatch, or sssom:NoTermFound for a gap).
// From those it works out each screen field's trace and its state: confirmed, waiting for a person, a gap, or a
// meaning that shifts along the way. The Transaction Research mapping set is illustrative.
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
export type Hop = { from: string; to: string; transform: Transform; note: string; location: string };
export type Means = {
  key: string; field: string; slot: string | null; predicate: string; confidence: number;
  author: string; reviewer: string; comment: string;
};
export type State = 'confirmed' | 'proposed' | 'review' | 'gap' | 'shift' | 'rejected';
/** One screen field's trace: every field it's built from, lane by lane, and what each end means. */
export type Trace = {
  slug: string; field: Field; lanes: Record<Layer, Field[]>; hops: Hop[];
  means: Means | null; sources: Means[]; state: State;
  /** Where the meaning shifts: the screen means one thing, a source it's built from another. */
  shift?: { screen: string; source: string; field: Field; hop?: Hop };
};
export type Lineage = { title: string; meta: Record<string, unknown>; fields: Map<string, Field>; hops: Hop[]; means: Means[]; traces: Trace[] };
/** A person's decision on a proposed mapping, kept on the shared draft. */
export type MappingDecision = { state: 'accepted' | 'rejected'; reason?: string | null; by?: string | null; at?: number };

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

export function buildLineage(tsv: string, decisions: Record<string, MappingDecision | null> = {}): Lineage {
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
      hops.push({ from: r.subject_id, to: r.object_id, transform: ((r.transform || 'pass') in TRANSFORMS ? r.transform || 'pass' : 'pass') as Transform, note: r.transform_note, location: r.location });
    } else {
      const slot = r.object_id === 'sssom:NoTermFound' ? null : r.object_id.replace(/^fabric:/, '');
      const m: Means = { key: '', field: r.subject_id, slot, predicate: r.predicate_id, confidence: Number(r.confidence || 0), author: r.author_id, reviewer: r.reviewer_id, comment: r.comment };
      m.key = mappingKey(m);
      means.push(m);
    }
  }
  const meaningOf = (id: string) => means.find((m) => m.field === id) ?? null;
  const upstream = (id: string) => hops.filter((h) => h.from === id);
  const confirmed = (m: Means) => !!m.reviewer || m.author.startsWith('person:') || decisions[m.key]?.state === 'accepted';

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
    const m = meaningOf(f.id);
    const sources = lanes.sf.map((x) => meaningOf(x.id)).filter((x): x is Means => !!x);
    let state: State = !m || !m.slot ? 'gap' : decisions[m.key]?.state === 'rejected' ? 'rejected' : confirmed(m) ? 'confirmed' : m.confidence < THRESHOLD ? 'review' : 'proposed';
    let shift: Trace['shift'];
    // A field that means something exactly or nearly, built from a source that means a different class: the meaning
    // shifts on the way. A field derived on purpose (relatedMatch, such as a status) is exempt.
    if (m?.slot && m.predicate !== 'skos:relatedMatch') {
      const other = sources.find((s) => s.slot && classOf(s.slot) !== classOf(m.slot));
      if (other) {
        const src = fields.get(other.field)!;
        shift = { screen: m.slot, source: other.slot!, field: src, hop: used.find((h) => h.to === src.id) };
        if (state !== 'rejected') state = 'shift';
      }
    }
    return { slug: slug(f.label), field: f, lanes, hops: used, means: m, sources, state, shift };
  });
  return { title: String(meta.mapping_set_title ?? 'Lineage'), meta, fields, hops, means, traces };
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
  const out: Record<State, number> = { confirmed: 0, proposed: 0, review: 0, gap: 0, shift: 0, rejected: 0 };
  for (const t of traces) out[t.state]++;
  return out;
}
