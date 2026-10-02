// The parts of a LinkML schema the explorer reads, and a small SchemaView over them:
// ancestors (the Neptune label chain), induced slots (own and inherited, with
// slot_usage applied) and relationships. It has no runtime imports, so it can be
// checked against LinkML's own SchemaView outside the browser.

export type RawSlot = {
  description?: string; range?: string; required?: boolean; multivalued?: boolean;
  identifier?: boolean; pattern?: string; close_mappings?: string[];
};
export type RawClass = {
  is_a?: string; abstract?: boolean; class_uri?: string; description?: string; title?: string; aliases?: string[];
  slots?: string[]; slot_usage?: Record<string, RawSlot>; close_mappings?: string[];
  annotations?: Record<string, string>;
};
export type RawEnum = {
  description?: string; close_mappings?: string[];
  permissible_values?: Record<string, { description?: string; meaning?: string; close_mappings?: string[] } | null>;
};
export type RawSchema = {
  id: string; name: string; title?: string; version?: string;
  prefixes?: Record<string, string>; default_prefix?: string; default_range?: string;
  annotations?: Record<string, string>;
  classes: Record<string, RawClass>; slots: Record<string, RawSlot>; enums?: Record<string, RawEnum>;
};
export type RawQuestions = {
  questions: {
    id: string; domain: string; question: string; answered_in: Store;
    walks?: string[]; query?: string;
    /** What the schema lacks, for a question it can't answer yet. Such a question has no walks or query. */
    gap?: string;
  }[];
};

export type LivesIn = 'graph' | 'warehouse' | 'search';
export type Store = 'neptune' | 'snowflake';

export type Slot = {
  name: string; description?: string; range: string; required: boolean; multivalued: boolean;
  identifier: boolean; declaredOn: string; relationship: boolean;
};

/** A slot whose range is a class. It becomes a Neptune relationship, in one direction. */
export type Relationship = {
  id: string; slot: string; type: string; from: string; to: string;
  description?: string; multivalued: boolean;
  /** True when the range is linkml:Any, so the relationship can point at a node of any class. */
  open: boolean;
};

/** LinkML's way to say "any class". Such a class is a range, never a node, so the explorer doesn't list it. */
const ANY = 'linkml:Any';

export type ClassInfo = {
  name: string; curie: string; abstract: boolean; description: string; aliases: string[];
  parent?: string; chain: string[]; children: string[]; slots: Slot[];
  owner: string; livesIn: LivesIn; idRule?: string; example?: string;
  /** A warehouse class that never loads into Neptune, such as reconciliation (decision 2). */
  neverInGraph: boolean;
  /** skos:closeMatch mappings, each with the standard it points into. */
  mappings: { curie: string; iri?: string; standard?: string }[];
  /** Why a concrete class maps to no standard concept. */
  noStandard?: string;
  codeList?: { name: string; values: { code: string; description?: string }[] };
};

export type Question = {
  id: string; domain: string; question: string; answeredIn: Store;
  /** What the schema lacks, when it can't answer the question yet. */
  gap?: string;
  /** The illustrative query, openCypher for Neptune and SQL for Snowflake. */
  query: string; language: 'cypher' | 'sql';
  /** Each step, and the query lines (from 0) that walk it. */
  steps: { named: string; relationship: Relationship; lines: number[] }[];
  classes: string[];
};

export type Model = {
  title: string; version: string;
  classes: Record<string, ClassInfo>;
  relationships: Relationship[];
  questions: Question[];
};

const LIVES_IN: LivesIn[] = ['graph', 'warehouse', 'search'];

/** The class and its ancestors, nearest first: the label chain, such as Chargeback;DisputeEvent;PaymentEvent. */
function ancestors(schema: RawSchema, name: string): string[] {
  const chain: string[] = [];
  for (let c: string | undefined = name; c; c = schema.classes[c]?.is_a) {
    if (!schema.classes[c]) throw new Error(`${name}: unknown parent class ${c}`);
    chain.push(c);
  }
  return chain;
}

/** Own slots first, then inherited ones; slot_usage nearer the class wins. */
function inducedSlots(schema: RawSchema, chain: string[]): Slot[] {
  const seen = new Set<string>();
  const slots: Slot[] = [];
  for (const owner of chain) {
    for (const name of schema.classes[owner].slots ?? []) {
      if (seen.has(name)) continue;
      seen.add(name);
      const base = schema.slots[name];
      if (!base) throw new Error(`${owner}: unknown slot ${name}`);
      const merged: RawSlot = { ...base };
      for (const c of [...chain].reverse()) Object.assign(merged, schema.classes[c].slot_usage?.[name]);
      const range = merged.range ?? schema.default_range ?? 'string';
      slots.push({
        name, description: merged.description, range,
        required: !!(merged.required || merged.identifier),
        multivalued: !!merged.multivalued, identifier: !!merged.identifier,
        declaredOn: owner, relationship: range in schema.classes,
      });
    }
  }
  return slots;
}

/** The standard a mapping points into, by its prefix, named as tools/check_ontology.py names them. */
function standardOf(curie: string): string | undefined {
  const prefix = curie.split(':')[0];
  return prefix.startsWith('fibo-') ? 'FIBO' : prefix.startsWith('cmns-') ? 'OMG Commons' : prefix === 'iso20022' ? 'ISO 20022' : undefined;
}

function expand(schema: RawSchema, curie: string): string | undefined {
  const [prefix, local] = curie.split(':');
  const base = schema.prefixes?.[prefix];
  return base ? base + local : undefined;
}

export function buildModel(schema: RawSchema, questions: RawQuestions): Model {
  const classes: Record<string, ClassInfo> = {};
  for (const [name, raw] of Object.entries(schema.classes)) {
    if (raw.class_uri === ANY) continue;
    const a = raw.annotations ?? {};
    if (!LIVES_IN.includes(a.lives_in as LivesIn)) throw new Error(`${name}: lives_in must be one of ${LIVES_IN.join(', ')}`);
    const chain = ancestors(schema, name);
    const list = a.code_list ? schema.enums?.[a.code_list] : undefined;
    classes[name] = {
      name, curie: `${schema.default_prefix ?? schema.name}:${name}`,
      abstract: !!raw.abstract, description: (raw.description ?? '').trim(), aliases: raw.aliases ?? [],
      parent: raw.is_a, chain, children: [], slots: inducedSlots(schema, chain),
      owner: a.owner, livesIn: a.lives_in as LivesIn, idRule: a.id_rule, example: a.example,
      neverInGraph: a.graph_load === 'never',
      mappings: (raw.close_mappings ?? []).map((curie) => ({ curie, iri: expand(schema, curie), standard: standardOf(curie) })),
      noStandard: a.no_standard,
      codeList: list && {
        name: a.code_list,
        values: Object.entries(list.permissible_values ?? {}).map(([code, v]) => ({ code, description: v?.description })),
      },
    };
  }
  for (const c of Object.values(classes)) if (c.parent) classes[c.parent].children.push(c.name);

  const relationships: Relationship[] = [];
  for (const [name, raw] of Object.entries(schema.classes)) {
    for (const slot of raw.slots ?? []) {
      const def = schema.slots[slot];
      if (!def?.range || !(def.range in schema.classes)) continue;
      relationships.push({
        id: `${name}.${slot}`, slot, type: slot.toUpperCase(), from: name, to: def.range,
        description: def.description, multivalued: !!def.multivalued, open: schema.classes[def.range].class_uri === ANY,
      });
    }
  }

  const qs: Question[] = questions.questions.map((q) => {
    const query = (q.query ?? '').replace(/\n+$/, '');
    const language = q.answered_in === 'snowflake' ? 'sql' : 'cypher';
    const queryLines = query.split('\n');
    const steps = (q.walks ?? []).map((walk) => {
      const [named, slot] = walk.split('.');
      const chain = classes[named]?.chain;
      const relationship = chain && relationships.find((r) => r.slot === slot && chain.includes(r.from));
      if (!relationship) throw new Error(`${q.id}: ${walk} is not a relationship in the schema`);
      // Cypher names the relationship type, as [:TYPE] or [r:TYPE]; SQL marks the line with a comment naming the step.
      const walks = language === 'sql'
        ? (line: string) => line.includes(`-- ${walk}`)
        : (line: string) => new RegExp(`\\[\\w*:${relationship.type}\\]`).test(line);
      const lines = queryLines.flatMap((line, i) => (walks(line) ? [i] : []));
      if (!lines.length) throw new Error(`${q.id}: no line of the query walks ${walk}`);
      return { named, relationship, lines };
    });
    const touched = new Set(steps.flatMap((s) => [s.named, s.relationship.to]));
    return {
      id: q.id, domain: q.domain, question: q.question, answeredIn: q.answered_in, gap: q.gap?.trim(),
      query, language, steps, classes: [...touched],
    };
  });

  return { title: schema.title ?? schema.name, version: schema.version ?? '', classes, relationships, questions: qs };
}
