// Claude writes a test case for a question (decision 25, stage 4): the instances that should answer it and the near
// misses that shouldn't, planted on the sample world, with the rows to expect. Where the view runs page tools, Claude
// tries its case with try_test until the proof passes; elsewhere it answers in one call and the page runs the proof.
import type { SqlJsStatic } from 'sql.js';
import type { Model, RawSchema } from '../explorer/model.ts';
import { prove, type Lane, WORLD_NOW } from './proof.ts';
import type { Sample, SampleTool } from './runtime.ts';
import { buildWorld, iso, type Scenario } from './world.ts';

/** The question a test case proves: its id and words, and the query that answers it. */
export type Target = { id: string; question: string; query: string; language: Lane; classes: string[] };

const text = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const ref = (v: unknown) => text(v, 60).replace(/^@/, '');
const plain = (o: unknown): Record<string, unknown> => Object.fromEntries(Object.entries(o && typeof o === 'object' && !Array.isArray(o) ? o : {}).slice(0, 30)
  .filter(([, v]) => v == null || ['string', 'number', 'boolean'].includes(typeof v) || (Array.isArray(v) && v.length <= 20)).map(([k, v]) => [k.slice(0, 60), v]));

/** A test case as the page keeps it: only the parts it uses, each within bounds. */
export function cleanScenario(s: unknown): Scenario {
  const x = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
  const arr = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n) : []);
  const ex = (x.expect && typeof x.expect === 'object' ? x.expect : {}) as Record<string, unknown>;
  return {
    story: text(x.story, 600) || undefined,
    nodes: arr(x.nodes, 80).map((n) => ({ ref: ref(n?.ref), class: text(n?.class, 80), props: plain(n?.props) })).filter((n) => n.ref && n.class),
    links: arr(x.links, 200).map((l) => ({ from: ref(l?.from), rel: text(l?.rel, 80), to: ref(l?.to), props: plain(l?.props) })).filter((l) => l.from && l.rel && l.to),
    params: plain(x.params),
    expect: { include: arr(ex.include, 20).map(plain), exclude: arr(ex.exclude, 20).map(plain) },
  };
}

/** What Claude needs about the classes a question touches: fields, links and the codes it can link to. */
function classesFor(model: Model, schema: RawSchema, t: Target) {
  const names = new Set(t.classes);
  for (const m of t.query.matchAll(/:\s*([A-Z][A-Za-z0-9]*)/g)) if (model.classes[m[1]]) names.add(m[1]);
  const isCode = (n: string) => !!model.classes[n]?.codeList?.values.length || !!model.classes[n]?.slots.some((s) => s.name === 'code');
  for (const n of [...names]) for (const r of model.relationships) if (model.classes[n]?.chain.includes(r.from) && isCode(r.to)) names.add(r.to);
  // Codes are shared: a test links to the ones the sample world has, by id.
  const w = buildWorld(model, schema, {});
  return [...names].filter((n) => model.classes[n]).map((n) => {
    const c = model.classes[n];
    const enumOf = (range: string) => Object.keys(schema.enums?.[range]?.permissible_values ?? {});
    return {
      class: n, abstract: c.abstract, kinds: c.abstract ? c.children : undefined, id_rule: c.idRule,
      fields: c.slots.filter((s) => !s.relationship && !s.identifier && s.name !== 'id').map((s) => `${s.name}: ${s.range}${enumOf(s.range).length ? ` (${enumOf(s.range).join(' | ')})` : ''}`),
      links: model.relationships.filter((r) => c.chain.includes(r.from)).map((r) => `${r.slot} → ${r.open ? 'any class' : r.to}${r.multivalued ? ' (many)' : ''}`),
      existing: isCode(n) ? (w.byLabel.get(n) ?? []).slice(0, 20).map((x) => `${x.id}${x.props.code != null ? ` (code ${String(x.props.code)})` : ''}`) : undefined,
    };
  });
}

const SHAPE = `Reply with only a JSON object:
{"story": "<two or three sentences, in payments words: what you planted and why the question should find some of it and not the rest>",
 "nodes": [{"ref": "<a short name of your own, such as m1>", "class": "<a concrete class>", "props": {"<field>": <value>}}],
 "links": [{"from": "<ref>", "rel": "<the relationship's slot name>", "to": "<ref, or the id of an existing code>"}],
 "params": {"<parameter, without $ or :>": "<value, or @ref for a planted instance's id>"},
 "expect": {"include": [{"<column the query returns>": <value or "@ref">}], "exclude": [{"<column>": <value or "@ref">}]}}`;

export function testPrompt(model: Model, schema: RawSchema, t: Target, withTools: boolean, note?: string): string {
  const params = [...new Set([...t.query.matchAll(/(?<![:\w])[:$]([A-Za-z_]\w*)/g)].map((m) => m[1]))];
  return `You write a test case that proves a payments question with sample data. The question's query runs on a sample world the page builds from the ontology: a few hundred made-up instances, as of ${iso(WORLD_NOW)} (times are ISO 8601, UTC). Your test case plants its own instances on top, then says which rows the answer must and mustn't hold.

The question (${t.id}): ${t.question}
It runs in ${t.language === 'cypher' ? 'Neptune, as openCypher' : 'Snowflake, as SQL; the page runs it on SQLite, with tables built from the classes'}:
${t.query}
${params.length ? `Its parameters: ${params.join(', ')}.` : 'It takes no parameters.'}

The classes it touches, with their fields, their links and, for codes, the ids that exist:
${JSON.stringify(classesFor(model, schema, t), null, 1)}

How to write it:
- Plant two to four instances the question should find, and one or two near misses it shouldn't: another merchant, a time outside the window, a different code. Make each near miss differ in one way, and say how in the story.
- Plant every instance on the path new, linked to each other, so counts and sums over your instances are exact. Link to codes by their existing ids.
- Give each event a time that fits the window the question asks about, relative to the clock above.
- Set every parameter, using @ref for a planted instance.
- Expect only columns the query returns, with the values your planted instances guarantee. Use "@ref" for an id.${note ? `\n\nA person asked for this change: ${note}` : ''}
${withTools ? '\nCall try_test with your case before you reply. It plants the case, runs the query and returns the checks and rows. Fix what fails, then reply with the case that passes.\n' : ''}
${SHAPE}`;
}

export function testTools(model: Model, schema: RawSchema, t: Target, SQL: SqlJsStatic | null, step: (s: string) => void): SampleTool[] {
  return [{
    name: 'try_test',
    description: 'Plants a test case on the sample world, runs the question\'s query, and returns whether it passes, each check, the parameters used, the columns and the first rows. Shape the case as in your final reply.',
    inputSchema: { type: 'object', properties: { nodes: { type: 'array' }, links: { type: 'array' }, params: { type: 'object' }, expect: { type: 'object' } }, required: ['nodes', 'expect'] },
    execute: (input) => {
      step('Trying the test case on the sample world');
      const p = prove(model, schema, { query: t.query, language: t.language, scenario: cleanScenario(input) }, SQL);
      return { passes: p.ok, error: p.error ?? null, checks: p.checks.map((c) => `${c.ok ? 'pass' : 'FAIL'}: ${c.label}${c.detail ? ` (${c.detail})` : ''}`), params: p.params, columns: p.columns, rows: p.rows.slice(0, 12) };
    },
  }];
}

/** Asks Claude for a test case, with try_test where the view runs page tools. */
export async function writeTest(sample: Sample, model: Model, schema: RawSchema, t: Target, SQL: SqlJsStatic | null,
  o: { signal?: AbortSignal; step: (s: string) => void; note?: string }): Promise<Scenario> {
  const tools = await sample.limits?.().then((l) => !!l?.tools, () => false) ?? false;
  const ask = (withTools: boolean) => sample.json<unknown>(testPrompt(model, schema, t, withTools, o.note), {
    signal: o.signal, ...(withTools ? { tools: testTools(model, schema, t, SQL, o.step) } : { cache: false }),
  });
  let reply: unknown;
  try { reply = await ask(tools); } catch (e) {
    if ((e as { code?: string })?.code !== 'tools_unavailable') throw e;
    reply = await ask(false);
  }
  return cleanScenario(reply);
}
