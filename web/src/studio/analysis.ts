// Runs the repository's checks on the working draft, as the pull request's CI would, and says what kind of change
// it is (decision 10) and which teams own it.
import { Document, isScalar, visit } from 'yaml';
import { checkOntology, type Coverage, type OntologyReport } from '../explorer/check.ts';
import type { RawQuestions, RawSchema } from '../explorer/model.ts';
import { applyPatch, draftToPatch, live, summarize, type DraftDoc, type Patch } from './draft.ts';

export type Analysis = {
  patch: Patch; schema: RawSchema; questions: RawQuestions; report: OntologyReport;
  changes: ReturnType<typeof summarize>;
  /** none: nothing yet; patch: descriptions, aliases and answers only; minor: anything new (decision 10). */
  lane: 'none' | 'patch' | 'minor';
  owners: string[];
};

export function analyse(d: DraftDoc, base: RawSchema, baseQuestions: RawQuestions): Analysis {
  const patch = draftToPatch(d, base);
  const { schema, questions } = applyPatch(base, baseQuestions, patch);
  const report = checkOntology(schema, questions, patch.layout);
  const changes = summarize(d, base);
  const minor = changes.newClasses.length + changes.relationships.length + changes.fields.length + changes.enums.length > 0;
  const owners = new Set<string>();
  for (const [name] of live(d.classes)) { const o = schema.classes[name]?.annotations?.owner; if (o) owners.add(o); }
  for (const [, s] of live(d.slots)) { const o = schema.classes[s.class]?.annotations?.owner; if (o) owners.add(o); }
  for (const id of changes.answers) { const q = questions.questions.find((x) => x.id === id); if (q) owners.add(q.domain); }
  return { patch, schema, questions, report, changes, lane: minor ? 'minor' : changes.count ? 'patch' : 'none', owners: [...owners].sort() };
}

let base: Coverage | undefined;
/** The released ontology's coverage, to compare the draft with. */
export const baseCoverage = (schema: RawSchema, questions: RawQuestions) => (base ??= checkOntology(schema, questions).coverage);

/** The patch as YAML: what the pull request applies, and what an engineer can read or copy. */
export function patchYaml(p: Patch): string {
  const doc: Record<string, unknown> = {};
  if (Object.keys(p.schema).length) doc.schema = p.schema;
  if (Object.keys(p.questions).length) doc.questions = p.questions;
  const layout = Object.fromEntries(Object.entries(p.layout).filter(([, v]) => v && Object.keys(v).length));
  if (Object.keys(layout).length) doc.layout = layout;
  if (!Object.keys(doc).length) return '# Nothing built yet.\n';
  // Short lists of plain values, such as [x, y] or a walk, read best on one line.
  const yaml = new Document(doc);
  visit(yaml, { Seq: (_, node) => { if (node.items.every((i) => isScalar(i))) node.flow = true; } });
  return yaml.toString({ lineWidth: 100, flowCollectionPadding: false });
}
