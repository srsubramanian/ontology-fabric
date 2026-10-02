// tools/check_ontology.py's checks in TypeScript, with the same messages and the same two coverage numbers, so the
// studio can check a draft as it's written. tools/test_checks.py runs both on planted mistakes and fails when they
// disagree. Like model.ts it has no runtime imports, so it runs outside the browser too
// (web/scripts/check-ontology.ts).
import { buildModel, type Model, type RawClass, type RawQuestions, type RawSchema } from './model.ts';
import { checkLayout } from './layoutCheck.ts';
import type { LayoutPatch } from './layout.ts';

const OWNERS = ['core', 'authorization', 'settlement', 'disputes', 'risk'];
const DOMAINS = OWNERS.filter((o) => o !== 'core');
const LIVES_IN = ['graph', 'warehouse', 'search'];
const STORES = ['neptune', 'snowflake'];
// The standards the ontology aligns with, by the start of their prefix, and the schema annotation that pins the
// release checked against (none: pinned in the name).
const STANDARDS: [string, string, string | undefined][] = [
  ['fibo-', 'FIBO', 'fibo_release'], ['cmns-', 'OMG Commons', 'commons_release'], ['iso20022', 'ISO 20022', undefined],
];
const ANY = 'linkml:Any';
/** An own key, so a name such as toString is never mistaken for a class or prefix. */
const has = (o: object | undefined, key: string) => !!o && Object.hasOwn(o, key);

const NODE = /(?<![\w.])\((\w*)(?::(\w+))?\s*(?:\{[^}]*\})?\)/g;
const REL = /(<)?-\[\w*:(\w+)\]-(>)?/g;
const WRITES = /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|CALL|LOAD\s+CSV|INSERT|UPDATE|DROP|ALTER|TRUNCATE|COPY|GRANT)\b/i;
const LIMIT = /\bLIMIT\s+\d+/i;

export type Coverage = {
  classes: number; concrete: number;
  answered: number; questions: number; gaps: number; byDomain: { domain: string; answered: number; of: number }[];
  mapped: number; byStandard: { standard: string; classes: number }[];
};
export type OntologyReport = {
  problems: string[]; coverage: Coverage;
  /** The model the explorer draws, or undefined when the explorer can't read the schema. */
  model?: Model;
  /** The lines tools/check_ontology.py prints about coverage, word for word. */
  summary: string[];
};

/** Python's repr of a sorted list of strings, as the Python checker's messages print it. */
const pyList = (xs: string[]) => `[${[...xs].sort().map((x) => `'${x}'`).join(', ')}]`;
const snake = (name: string) => name.replace(/(?<!^)(?=[A-Z])/g, '_').toLowerCase();
const standard = (curie: string) => STANDARDS.find(([start]) => curie.split(':')[0].startsWith(start))?.[1];

/** The few SchemaView reads the checks need, over the raw schema. */
function schemaView(schema: RawSchema) {
  const classes = schema.classes ?? {};
  const ancestors = (name: string): string[] => {
    const out: string[] = [];
    for (let c: string | undefined = name; c && has(classes, c) && !out.includes(c); c = classes[c].is_a) out.push(c);
    return out;
  };
  const descendants = (name: string): string[] => {
    const out = [name];
    for (let i = 0; i < out.length; i++) {
      for (const [n, c] of Object.entries(classes)) if (c.is_a === out[i] && !out.includes(n)) out.push(n);
    }
    return out;
  };
  /** A slot as a class sees it: the base slot with slot_usage applied, nearest class last. */
  const inducedRange = (cls: string, slot: string): string | undefined => {
    let range = schema.slots?.[slot]?.range;
    for (const c of [...ancestors(cls)].reverse()) range = classes[c].slot_usage?.[slot]?.range ?? range;
    return range ?? schema.default_range ?? 'string';
  };
  const inducedSlots = (cls: string): string[] => [...new Set(ancestors(cls).flatMap((c) => classes[c].slots ?? []))];
  const relationships = Object.entries(classes).flatMap(([name, c]) => (c.slots ?? []).flatMap((slot) => {
    const range = schema.slots?.[slot]?.range;
    return range && has(classes, range) ? [{ type: slot.toUpperCase(), from: name, to: range }] : [];
  }));
  const open = new Set(Object.entries(classes).filter(([, c]) => c.class_uri === ANY).map(([n]) => n));
  return { classes, ancestors, descendants, inducedRange, inducedSlots, relationships, open };
}
type View = ReturnType<typeof schemaView>;

function stepNames(sv: View, schema: RawSchema, step: string): Set<string> {
  const [cls, slot] = splitStep(step);
  if (!has(sv.classes, cls) || !has(schema.slots, slot)) return new Set();
  const target = sv.inducedRange(cls, slot);
  const names = [...sv.ancestors(cls), ...(target && has(sv.classes, target) ? sv.descendants(target) : [])];
  return new Set(names.map(snake));
}

/** Python's str.partition('.'): the class before the first dot, the slot after it. */
function splitStep(step: string): [string, string] {
  const i = step.indexOf('.');
  return i < 0 ? [step, ''] : [step.slice(0, i), step.slice(i + 1)];
}

function checkCypher(sv: View, qid: string, query: string, problems: string[]) {
  const types = new Set(sv.relationships.map((r) => r.type));
  for (const part of query.split(/^\s*UNION(?:\s+ALL)?\s*$/im)) {
    if (!LIMIT.test(part)) problems.push(`${qid}: every query part needs a LIMIT`);
    const labels = new Map<string, string>();
    const tokens = [
      ...[...part.matchAll(NODE)].map((m) => ({ kind: 'node' as const, m })),
      ...[...part.matchAll(REL)].map((m) => ({ kind: 'rel' as const, m })),
    ].sort((a, b) => a.m.index! - b.m.index!);
    for (const { kind, m } of tokens) {
      if (kind === 'node' && m[2]) {
        if (!has(sv.classes, m[2])) problems.push(`${qid}: no class ${m[2]}`);
        if (m[1]) labels.set(m[1], m[2]);
      }
    }
    // An unknown class is already reported above; don't also judge its direction.
    const label = (m: RegExpMatchArray) => {
      const found = m[2] || labels.get(m[1]);
      return found && has(sv.classes, found) ? found : undefined;
    };
    const end = (m: RegExpMatchArray) => m.index! + m[0].length;
    for (let i = 0; i + 2 < tokens.length; i++) {
      const [a, b, c] = tokens.slice(i, i + 3);
      if (a.kind !== 'node' || b.kind !== 'rel' || c.kind !== 'node') continue;
      if (end(a.m) !== b.m.index || end(b.m) !== c.m.index) continue;
      const [, back, rtype, fwd] = b.m;
      if (!types.has(rtype)) { problems.push(`${qid}: no relationship ${rtype}`); continue; }
      if (!!back === !!fwd) { problems.push(`${qid}: give ${rtype} its one direction`); continue; }
      const [src, dst] = back ? [label(c.m), label(a.m)] : [label(a.m), label(c.m)];
      const ok = sv.relationships.some((r) => r.type === rtype
        && (src === undefined || sv.ancestors(src).includes(r.from))
        && (dst === undefined || sv.open.has(r.to) || sv.ancestors(dst).includes(r.to)));
      if (!ok) {
        const allowed = sv.relationships.filter((r) => r.type === rtype).map((r) => `from ${r.from} to ${r.to}`).join(' or ');
        problems.push(`${qid}: (${src ?? 'None'})-[:${rtype}]->(${dst ?? 'None'}) runs against the schema's direction`
          + ` or classes; ${rtype} runs ${allowed}`);
      }
    }
  }
}

function checkQuery(sv: View, schema: RawSchema, q: RawQuestions['questions'][number], problems: string[]) {
  const query = q.query ?? '';
  if (!query.trim()) { problems.push(`${q.id}: needs a query`); return; }
  if (WRITES.test(query)) problems.push(`${q.id}: queries must be read-only`);
  if (q.answered_in === 'neptune') {
    checkCypher(sv, q.id, query, problems);
    for (const step of q.walks ?? []) {
      // [:TYPE] or [r:TYPE], the way the explorer's tracer finds the line.
      if (!new RegExp(`\\[\\w*:${splitStep(step)[1].toUpperCase()}\\]`).test(query)) {
        problems.push(`${q.id}: the query doesn't walk ${step}`);
      }
    }
  } else {
    if (!/^\s*(SELECT|WITH)\b/i.test(query)) problems.push(`${q.id}: SQL must start with SELECT or WITH`);
    if (!LIMIT.test(query)) problems.push(`${q.id}: SQL needs a LIMIT`);
    for (const step of q.walks ?? []) {
      const marked = query.split('\n').filter((line) => line.includes(`-- ${step}`)).map((line) => line.split('--')[0].toLowerCase());
      const names = stepNames(sv, schema, step);
      if (!marked.length) problems.push(`${q.id}: mark the line that walks ${step} with '-- ${step}'`);
      else if (!marked.some((code) => [...names].some((n) => code.includes(n)))) {
        problems.push(`${q.id}: the line marked '-- ${step}' names none of its classes; mark the line that joins them`);
      }
    }
  }
}

export function checkOntology(schema: RawSchema, questions: RawQuestions, layout?: LayoutPatch): OntologyReport {
  const sv = schemaView(schema);
  const classes = Object.entries(sv.classes).filter(([n]) => !sv.open.has(n));
  const ann = (c: RawClass, key: string): string | undefined => (has(c.annotations, key) ? c.annotations![key] ?? undefined : undefined);
  const problems: string[] = [];

  for (const [name, cls] of classes) {
    for (const [key, allowed] of [['owner', OWNERS], ['lives_in', LIVES_IN]] as const) {
      if (!allowed.includes(ann(cls, key) as string)) problems.push(`${name}: ${key} must be one of ${pyList(allowed)}`);
    }
    const graphLoad = ann(cls, 'graph_load');
    if (graphLoad !== undefined && graphLoad !== 'never') problems.push(`${name}: graph_load can only be never`);
    if (graphLoad && ann(cls, 'lives_in') !== 'warehouse') problems.push(`${name}: only a warehouse class can never load into Neptune`);
    const mapped = (cls.close_mappings ?? []).length > 0;
    if (!cls.abstract && !ann(cls, 'id_rule')) problems.push(`${name}: concrete class needs an id_rule`);
    if (!cls.abstract && !mapped && !ann(cls, 'no_standard')) problems.push(`${name}: map it to a standard, or say why none fits in no_standard`);
    if (mapped && ann(cls, 'no_standard')) problems.push(`${name}: has close_mappings, so drop no_standard`);
  }

  const prefixes = schema.prefixes ?? {};
  const pins = schema.annotations ?? {};
  const values = Object.entries(schema.enums ?? {}).flatMap(([e, en]) =>
    Object.entries(en.permissible_values ?? {}).map(([v, pv]) => [`${e}.${v}`, pv ?? {}] as const));
  const elements: [string, [string, { close_mappings?: string[] }][]][] = [
    ['class', Object.entries(sv.classes)], ['slot', Object.entries(schema.slots ?? {})],
    ['enum', Object.entries(schema.enums ?? {})], ['value', values as [string, { close_mappings?: string[] }][]],
  ];
  for (const [kind, els] of elements) {
    for (const [name, el] of els) {
      for (const curie of el.close_mappings ?? []) {
        const prefix = curie.split(':')[0];
        if (!has(prefixes, prefix)) problems.push(`${kind} ${name}: ${curie} uses an undeclared prefix`);
        else if (!standard(curie)) problems.push(`${kind} ${name}: ${curie} isn't one of the standards (FIBO, OMG Commons, ISO 20022)`);
        else {
          const pin = STANDARDS.find(([start]) => prefix.startsWith(start))![2];
          if (pin && !(has(pins, pin) && pins[pin])) problems.push(`${kind} ${name}: ${curie} needs the release it was checked against, in the schema's ${pin} annotation`);
        }
      }
    }
  }

  const qs = questions.questions ?? [];
  const failing = new Set<string>(), gaps = new Set<string>(), seen = new Set<string>();
  const classNames = new Set(classes.map(([n]) => n));
  for (const q of qs) {
    const before = problems.length;
    if (seen.has(q.id)) problems.push(`${q.id}: used by more than one question`);
    seen.add(q.id);
    if (!DOMAINS.includes(q.domain)) problems.push(`${q.id}: domain must be one of ${pyList(DOMAINS)}`);
    if (!STORES.includes(q.answered_in)) problems.push(`${q.id}: answered_in must be one of ${pyList(STORES)}`);
    if (q.gap) {
      gaps.add(q.id);
      if (q.walks?.length || q.query) problems.push(`${q.id}: a gap question has no walks or query; say what the schema lacks instead`);
      continue;
    }
    if (!q.walks?.length) problems.push(`${q.id}: needs walks, or a gap saying what the schema lacks`);
    for (const step of q.walks ?? []) {
      const [cls, slot] = splitStep(step);
      if (!classNames.has(cls)) { problems.push(`${q.id}: no class ${cls}`); continue; }
      if (!sv.inducedSlots(cls).includes(slot)) problems.push(`${q.id}: ${cls} has no slot ${slot}`);
      else {
        const range = sv.inducedRange(cls, slot)!;
        if (!classNames.has(range) && !sv.open.has(range)) problems.push(`${q.id}: ${step} is an attribute, not a relationship`);
      }
    }
    if (problems.length > before) failing.add(q.id);
  }

  // The explorer's reading of the schema, and the class map's layout. tools/check_ontology.py runs these through
  // Node and reports a failure by its error line, which is the error's name and message.
  let model: Model | undefined;
  try {
    model = buildModel(schema, questions);
  } catch (e) {
    const err = e instanceof Error ? `${e.name}: ${e.message.split('\n')[0]}` : String(e);
    problems.push(`explorer: can't read the schema: ${err}`, `class map: can't check the layout: ${err}`);
  }
  if (model) {
    try {
      problems.push(...checkLayout(model, layout).problems.map((p) => `class map: ${p}`));
    } catch (e) {
      problems.push(`class map: can't check the layout: ${e instanceof Error ? `${e.name}: ${e.message.split('\n')[0]}` : String(e)}`);
    }
  }

  for (const q of qs) {
    if (q.gap) continue;
    const before = problems.length;
    checkQuery(sv, schema, q, problems);
    if (problems.length > before) failing.add(q.id);
  }

  // Only mappings to one of the standards count, through a prefix the schema declares.
  const counts = (curie: string) => !!standard(curie) && has(prefixes, curie.split(':')[0]);
  const concrete = classes.filter(([, c]) => !c.abstract);
  const mappedClasses = concrete.filter(([, c]) => (c.close_mappings ?? []).some(counts));
  const byStandard = new Map<string, Set<string>>();
  for (const [name, c] of mappedClasses) {
    for (const curie of (c.close_mappings ?? []).filter(counts)) {
      byStandard.set(standard(curie)!, (byStandard.get(standard(curie)!) ?? new Set()).add(name));
    }
  }
  const answered = qs.filter((q) => !failing.has(q.id) && !gaps.has(q.id));
  const byDomain = [...DOMAINS].sort().filter((d) => qs.some((q) => q.domain === d))
    .map((d) => ({ domain: d, answered: answered.filter((q) => q.domain === d).length, of: qs.filter((q) => q.domain === d).length }));
  const coverage: Coverage = {
    classes: classes.length, concrete: concrete.length,
    answered: answered.length, questions: qs.length, gaps: gaps.size, byDomain,
    mapped: mappedClasses.length,
    byStandard: [...byStandard].sort(([a], [b]) => (a < b ? -1 : 1)).map(([standard, s]) => ({ standard, classes: s.size })),
  };
  const summary = [
    `${coverage.classes} classes, ${coverage.concrete} concrete`,
    `competency questions the schema answers: ${coverage.answered} of ${coverage.questions}`
      + ` (${byDomain.map((d) => `${d.domain} ${d.answered} of ${d.of}`).join(', ')}); ${coverage.gaps} gaps`,
    `concrete classes mapped to a standard: ${coverage.mapped} of ${coverage.concrete}`
      + ` (${coverage.byStandard.map((s) => `${s.standard} ${s.classes}`).join(', ')})`,
  ];
  return { problems, coverage, model, summary };
}
