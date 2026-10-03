// Lineage by meaning (decision 26): every screen field and Snowflake column, across every mapping set, gathered under
// the ontology slot it means. One meaning can then show every screen that carries it, and where they don't agree: a
// field that says one thing and is built from another, the same meaning built from different columns, and the same
// label meaning different things on different screens. The ontology is the hub every layer maps to, so this is what
// it's for at an organization's scale.
import { classOf, type Field, type Lineage, type Means, type Trace } from './lineage.ts';

/** One screen's mapping set, at its latest version. */
export type ScreenSet = { id: string; title: string; lineage: Lineage };
/** A screen field that means this. */
export type Use = { set: ScreenSet; trace: Trace; means: Means };
/** A Snowflake column that means this, and the screens whose sets say so. */
export type ColumnUse = { field: Field; means: Means; sets: ScreenSet[] };
export type Finding =
  /** The field means this, but a column it's built from means something else. */
  | { kind: 'shift'; use: Use; column: Field; source: string }
  /** The same meaning, built from different columns on different screens. When every one of those columns means it
   *  too (agree), that's worth knowing; when one means something else, the screens disagree. */
  | { kind: 'built'; uses: Use[]; agree: boolean }
  /** Another screen has a field with the same label that means something else. */
  | { kind: 'label'; use: Use; other: Use }
  /** The same meaning, called different things on different screens. */
  | { kind: 'labels'; labels: { label: string; uses: Use[] }[] }
  /** Fields whose meaning still waits for a person. */
  | { kind: 'waiting'; uses: Use[] };
export type Meaning = { key: string; cls: string; slot: string | null; uses: Use[]; columns: ColumnUse[]; findings: Finding[]; problems: number };

/** Findings that say two things disagree, rather than something to know. */
export const PROBLEMS: Finding['kind'][] = ['shift', 'built', 'label'];
/** A meaning's route: Settlement.settled_at is #studio-meaning-Settlement-settled-at. */
export const meaningRoute = (key: string) => key.replace('.', '-').replace(/_/g, '-');
export const setTitle = (l: Lineage) => l.title.replace(/ (screen )?to the payments ontology \(illustrative\)$/, '').replace(/ \(illustrative\)$/, '');
const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const sources = (u: Use) => u.trace.lanes.sf.map((f) => f.id).sort().join('|');

export function meaningIndex(sets: ScreenSet[]): Map<string, Meaning> {
  const index = new Map<string, Meaning>();
  const get = (key: string) => {
    if (!index.has(key)) index.set(key, { key, cls: classOf(key)!, slot: key.includes('.') ? key.split('.')[1] : null, uses: [], columns: [], findings: [], problems: 0 });
    return index.get(key)!;
  };
  const all: Use[] = [];
  for (const set of sets) {
    for (const trace of set.lineage.traces) {
      const m = trace.means;
      if (!m?.slot || m.negated) continue;
      const u = { set, trace, means: m };
      get(m.slot).uses.push(u);
      all.push(u);
    }
    for (const m of set.lineage.means) {
      const field = set.lineage.fields.get(m.field);
      if (!field || field.layer !== 'sf' || !m.slot || m.negated) continue;
      const c = get(m.slot).columns.find((x) => x.field.id === field.id);
      if (c) { if (!c.sets.includes(set)) c.sets.push(set); }
      else get(m.slot).columns.push({ field, means: m, sets: [set] });
    }
  }
  for (const mm of index.values()) {
    for (const u of mm.uses) if (u.trace.shift?.screen === mm.key) mm.findings.push({ kind: 'shift', use: u, column: u.trace.shift.field, source: u.trace.shift.source });
    if (new Set(mm.uses.map(sources)).size > 1) {
      const means = new Set(mm.columns.map((c) => c.field.id));
      mm.findings.push({ kind: 'built', uses: mm.uses, agree: mm.uses.every((u) => u.trace.lanes.sf.every((f) => means.has(f.id))) });
    }
    for (const u of mm.uses) for (const o of all) if (o.means.slot !== mm.key && sameLabel(o.trace.field.label, u.trace.field.label)) mm.findings.push({ kind: 'label', use: u, other: o });
    const labels = [...new Set(mm.uses.map((u) => u.trace.field.label))];
    if (labels.length > 1) mm.findings.push({ kind: 'labels', labels: labels.map((label) => ({ label, uses: mm.uses.filter((u) => u.trace.field.label === label) })) });
    const waiting = mm.uses.filter((u) => ['proposed', 'review', 'recheck'].includes(u.trace.state));
    if (waiting.length) mm.findings.push({ kind: 'waiting', uses: waiting });
    mm.problems = mm.findings.filter((f) => PROBLEMS.includes(f.kind) && !(f.kind === 'built' && f.agree)).length;
  }
  return index;
}

/** The meanings, those with something to look at first, then those most screens carry. */
export function meaningsInOrder(index: Map<string, Meaning>): Meaning[] {
  return [...index.values()].filter((m) => m.uses.length)
    .sort((a, b) => b.problems - a.problems || b.uses.length - a.uses.length || a.key.localeCompare(b.key));
}

/** Screen fields nothing in the ontology holds yet, on every screen. */
export const gapsOf = (sets: ScreenSet[]) => sets.flatMap((set) => set.lineage.traces.filter((t) => t.state === 'gap').map((trace) => ({ set, trace })));
