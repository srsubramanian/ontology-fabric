// Prove it with data (decision 25, stage 4): a question's query runs on a sample world built from the ontology, in
// the page. openCypher runs on a small graph engine (cypher.ts), Snowflake SQL on SQLite (sqlrun.ts). A test case,
// written by a person or by Claude, plants the instances the question should find and the ones it shouldn't, and
// says which rows to expect; the proof checks them. Every instance, value and row is illustrative.
import type { SqlJsStatic } from 'sql.js';
import type { Model, RawSchema } from '../explorer/model.ts';
import { cypherParams, cypherShape, runCypher, show } from './cypher.ts';
import { queryTables, sqlParams, sqlShape, runSql, fillTables, type SqlResult } from './sqlrun.ts';
import { buildWorld, iso, resolveRef, type Node, type Scenario, type Shape, type World } from './world.ts';

export type Lane = 'cypher' | 'sql';
/** A value the proof chose for one of the query's parameters, and why. */
export type Choice = { name: string; value: unknown; why: string };
export type Check = { label: string; ok: boolean; detail?: string };
export type Proof = {
  lane: Lane; ok: boolean; error?: string;
  world: { now: string; nodes: number; edges: number; planted: number; classes: number };
  params: Choice[]; columns: string[]; rows: unknown[][]; checks: Check[];
  tables?: SqlResult['tables']; tries: number; ms: number;
  /** The test case's references, to the ids its planted instances got. */
  refs: Record<string, string>;
};

/** The sample world's clock: the end of August, so this month, last month and this quarter all have data. */
export const WORLD_NOW = Date.parse('2026-08-31T12:00:00Z');
export const WORLD_SEED = 'ontology-fabric';
const DAY = 86_400_000;
const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** A time a parameter's name asks for, from the world's clock. */
export function timeFor(name: string, now: string): string | null {
  const t = Date.parse(now), d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth();
  const n = name.toLowerCase();
  if (n === 'now' || n === 'today' || n === 'as_of') return now;
  if (/soon|until|deadline|due|_by$/.test(n)) return iso(t + 14 * DAY);
  if (/month_start|month_from/.test(n)) return iso(Date.UTC(y, m - 1, 1));
  if (/month_end|month_to/.test(n)) return iso(Date.UTC(y, m, 1));
  if (/week_start/.test(n)) return iso(t - 7 * DAY);
  if (/week_end/.test(n)) return now;
  if (/quarter_start/.test(n)) return iso(Date.UTC(y, m - (m % 3), 1));
  if (/year_start/.test(n)) return iso(Date.UTC(y, 0, 1));
  if (/since|start|from|after|_after$/.test(n)) return iso(t - 90 * DAY);
  if (/end|before|^to$|_to$/.test(n)) return now;
  return null;
}

const degree = (w: World, n: Node) => (w.out.get(n)?.length ?? 0) + (w.inn.get(n)?.length ?? 0);
/** Values of a property on a label's instances, the most common first; planted instances' values come before all. */
function valuesOf(w: World, label: string, prop: string): unknown[] {
  const ns = w.byLabel.get(label) ?? [];
  const rank = (id: string) => (w.planted.has(id) ? 2 : w.seeded.has(id) ? 1 : 0);
  if (prop === 'id') return [...ns].sort((a, b) => rank(b.id) - rank(a.id) || degree(w, b) - degree(w, a)).map((n) => n.id);
  const count = new Map<string, { v: unknown; n: number; rank: number }>();
  for (const n of ns) {
    const v = n.props[prop]; if (v == null) continue;
    const k = JSON.stringify(v), c = count.get(k) ?? { v, n: 0, rank: 0 };
    c.n++; c.rank = Math.max(c.rank, rank(n.id)); count.set(k, c);
  }
  return [...count.values()].sort((a, b) => b.rank - a.rank || b.n - a.n).map((c) => c.v);
}

type Candidates = { values: unknown[]; why: string };

/** Candidate values for each of a Cypher query's parameters, read from where the query uses it. */
function cypherCandidates(src: string, w: World, model: Model): Map<string, Candidates> {
  const vars = new Map<string, string>();
  for (const m of src.matchAll(/\(\s*([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)/g)) vars.set(m[1], m[2]);
  const out = new Map<string, Candidates>();
  const set = (p: string, c: Candidates) => { if (!out.has(p) && c.values.length) out.set(p, c); };
  // (:Label {prop: $p})
  for (const m of src.matchAll(/\(\s*\w*\s*:\s*([A-Za-z_]\w*)[^)]*?\{([^}]*)\}/g)) {
    for (const kv of m[2].matchAll(/([A-Za-z_]\w*)\s*:\s*\$([A-Za-z_]\w*)/g)) set(kv[2], { values: valuesOf(w, m[1], kv[1]), why: `a ${m[1]} in the sample world${kv[1] === 'id' ? '' : `, by its ${kv[1]}`}` });
  }
  // v.prop = $p, $p = v.prop, v.prop IN $p, and range comparisons
  const cmp = [...src.matchAll(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*(=|<>|>=|<=|>|<|IN)\s*\$([A-Za-z_]\w*)/g)].map((m) => ({ v: m[1], prop: m[2], op: m[3], p: m[4] }))
    .concat([...src.matchAll(/\$([A-Za-z_]\w*)\s*(=|<>|>=|<=|>|<)\s*([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g)].map((m) => ({ v: m[3], prop: m[4], op: m[2], p: m[1] })));
  for (const c of cmp) {
    const label = vars.get(c.v);
    if (c.op === '=' || c.op === '<>' || c.op === 'IN') {
      if (label) { const vs = valuesOf(w, label, c.prop); set(c.p, { values: c.op === 'IN' ? [vs.slice(0, 3)] : vs, why: `a ${c.prop} that sample ${label}s have` }); }
    } else {
      const t = timeFor(c.p, w.now);
      if (t) set(c.p, { values: [t], why: 'from the sample world’s clock' });
      else if (label) {
        const vs = valuesOf(w, label, c.prop).filter((x) => typeof x === 'number').sort((a, b) => (a as number) - (b as number));
        if (vs.length) set(c.p, { values: [vs[Math.floor(vs.length / 2)]], why: `the middle ${c.prop} of the sample ${label}s` });
      }
    }
  }
  for (const p of cypherParams(src)) if (!out.has(p)) out.set(p, byName(p, w, model));
  return out;
}

/** Candidate values for each of a SQL query's parameters: alias.column = :p reads the column from the built table. */
function sqlCandidates(src: string, w: World, model: Model): Map<string, Candidates> {
  const out = new Map<string, Candidates>();
  const { tables, aliases } = queryTables(model, src);
  fillTables(w, tables);
  const rank = (id: unknown) => (w.planted.has(String(id)) ? 2 : w.seeded.has(String(id)) ? 1 : 0);
  const plantedFirst = (t: { rows: unknown[][] }, i: number, idCol: number) => {
    const count = new Map<string, { v: unknown; n: number; rank: number }>();
    for (const r of t.rows) {
      const v = r[i]; if (v == null) continue;
      const k = JSON.stringify(v), c = count.get(k) ?? { v, n: 0, rank: 0 };
      c.n++; c.rank = Math.max(c.rank, rank(v), idCol >= 0 ? rank(r[idCol]) : 0); count.set(k, c);
    }
    return [...count.values()].sort((a, b) => b.rank - a.rank || b.n - a.n).map((c) => c.v);
  };
  const uses = [...src.matchAll(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*(=|<>|IN)\s*\(?\s*[:$]([A-Za-z_]\w*)/g)].map((m) => ({ a: m[1], col: m[2], p: m[4] }))
    .concat([...src.matchAll(/[:$]([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g)].map((m) => ({ a: m[2], col: m[3], p: m[1] })));
  for (const u of uses) {
    const t = tables.get(aliases.get(u.a.toLowerCase()) ?? '');
    if (!t || out.has(u.p)) continue;
    const cols = [...t.columns.keys()], i = cols.indexOf(u.col.toLowerCase());
    if (i < 0) continue;
    const values = plantedFirst(t, i, cols.indexOf(`${snake(t.cls)}_id`));
    if (values.length) out.set(u.p, { values, why: `a ${u.col} in the sample ${t.name} table` });
  }
  for (const m of src.matchAll(/(>=|<=|>|<)\s*[:$]([A-Za-z_]\w*)/g)) { const t = timeFor(m[2], w.now); if (t && !out.has(m[2])) out.set(m[2], { values: [t], why: 'from the sample world’s clock' }); }
  for (const p of sqlParams(src)) if (!out.has(p)) out.set(p, byName(p, w, model));
  return out;
}

/** A parameter the query uses some other way: a class by its name (merchant_id, chargeback), or a time. */
function byName(p: string, w: World, model: Model): Candidates {
  const t = timeFor(p, w.now);
  if (t) return { values: [t], why: 'from the sample world’s clock' };
  const stem = p.replace(/_(id|code|prefix)$/, '');
  const cls = Object.values(model.classes).find((c) => snake(c.name) === stem) ?? Object.values(model.classes).find((c) => snake(c.name).endsWith(`_${stem}`) || snake(c.name).startsWith(`${stem}_`));
  if (cls) {
    const prop = p.endsWith('_code') ? 'code' : p.endsWith('_prefix') ? 'prefix' : 'id';
    const values = valuesOf(w, cls.name, prop);
    if (values.length) return { values, why: `a ${cls.name} in the sample world` };
  }
  return { values: [null], why: 'nothing in the sample world fits it, so it’s empty' };
}

const near = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-4);
  if (Array.isArray(b)) return Array.isArray(a) && b.every((x) => a.some((y) => near(y, x))) && a.length === b.length;
  if (Array.isArray(a)) return a.some((y) => near(y, b));
  if (typeof a === 'number' && typeof b === 'string' && b.trim() !== '' && !Number.isNaN(Number(b))) return near(a, Number(b));
  return a === b || (a != null && b != null && String(a) === String(b));
};
const resolveDeep = (w: World, v: unknown): unknown => (Array.isArray(v) ? v.map((x) => resolveDeep(w, x)) : resolveRef(w, v));
/** Whether a result row matches what a test expects: every column it names holds the value it says. */
function rowMatches(w: World, columns: string[], row: unknown[], want: Record<string, unknown>) {
  return Object.entries(want).every(([col, v]) => { const i = columns.indexOf(col); return i >= 0 && near(row[i], resolveDeep(w, v)); });
}
const describe = (w: World, want: Record<string, unknown>) => Object.entries(want).map(([k, v]) => `${k} ${JSON.stringify(resolveDeep(w, v))}`).join(', ');

export type ProveInput = { query: string; language: Lane; scenario?: Scenario; seed?: string };

/**
 * Runs a question's query on the sample world, with the test case planted if there is one. Without a test, it tries a
 * few values for the query's parameters until the answer has rows; with one, it uses the test's values, or the
 * instances the test planted, and checks the rows it expects.
 */
export function prove(model: Model, schema: RawSchema, input: ProveInput, SQL: SqlJsStatic | null): Proof {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const lane = input.language;
  let w: World;
  const fail = (error: string, world?: World): Proof => ({
    lane, ok: false, error, params: [], columns: [], rows: [], checks: [{ label: 'The query runs on the sample world', ok: false, detail: error }], tries: 0, ms: 0,
    refs: world ? Object.fromEntries(world.refs) : {},
    world: { now: world?.now ?? iso(WORLD_NOW), nodes: world?.nodes.length ?? 0, edges: world?.edges.length ?? 0, planted: world?.planted.size ?? 0, classes: world ? new Set(world.nodes.map((n) => n.cls)).size : 0 },
  });
  // The question's own path, seeded into the world; a query the engines can't read runs on the plain world, and fails there.
  let shape: Shape | undefined;
  try { shape = lane === 'cypher' ? cypherShape(input.query) : sqlShape(model, input.query); } catch { shape = undefined; }
  try { w = buildWorld(model, schema, { seed: input.seed ?? WORLD_SEED, now: WORLD_NOW, scenario: input.scenario, shape }); } catch (e) { return fail((e as Error).message); }
  if (lane === 'sql' && !SQL) return fail('The warehouse engine hasn’t loaded.', w);
  const sc = input.scenario;
  let cands: Map<string, Candidates>;
  try { cands = lane === 'cypher' ? cypherCandidates(input.query, w, model) : sqlCandidates(input.query, w, model); } catch (e) { return fail((e as Error).message, w); }
  for (const [p, v] of Object.entries(sc?.params ?? {})) cands.set(p, { values: [resolveDeep(w, v)], why: 'the test case sets it' });
  const run = (params: Record<string, unknown>) => (lane === 'cypher' ? { ...runCypher(input.query, w, params), tables: undefined } : runSql(SQL!, model, w, input.query, params));
  // Without a test case, a few tries, so a question about one merchant picks one that has an answer.
  const tries = sc ? 1 : Math.max(1, Math.min(6, Math.max(...[...cands.values()].map((c) => c.values.length), 1)));
  // The fullest answer wins: rows first, then cells that hold something, so a ratio doesn't land on a merchant with
  // nothing settled. A first row with every cell filled stops the tries.
  const full = (v: unknown) => v != null && v !== 0 && !(Array.isArray(v) && !v.length);
  const score = (x: ReturnType<typeof run>) => (x.rows.length ? 1e6 : 0) + x.rows.slice(0, 20).flat().filter(full).length;
  let res: ReturnType<typeof run> | null = null, params: Record<string, unknown> = {}, used = 0;
  try {
    for (let i = 0; i < tries; i++) {
      const ps = Object.fromEntries([...cands].map(([p, c]) => [p, c.values[i % c.values.length]]));
      const got = run(ps);
      if (!res || score(got) > score(res)) { res = got; params = ps; used = i + 1; }
      if (got.rows.length && got.rows[0].every(full)) break;
    }
  } catch (e) { return fail((e as Error).message, w); }
  const r = res!;
  const rows = r.rows.map((row) => row.map(show));
  const checks: Check[] = [{ label: 'The query runs on the sample world', ok: true }];
  checks.push({ label: rows.length ? `It answers with ${rows.length} row${rows.length === 1 ? '' : 's'}` : 'It answers with no rows', ok: rows.length > 0 || !!sc?.expect?.exclude?.length && !sc.expect.include?.length });
  for (const want of sc?.expect?.include ?? []) {
    const ok = rows.some((row) => rowMatches(w, r.columns, row, want));
    checks.push({ label: `It finds ${describe(w, want)}`, ok, detail: ok ? undefined : 'No row of the answer holds that.' });
  }
  for (const want of sc?.expect?.exclude ?? []) {
    const ok = !rows.some((row) => rowMatches(w, r.columns, row, want));
    checks.push({ label: `It leaves out ${describe(w, want)}`, ok, detail: ok ? undefined : 'A row of the answer holds it.' });
  }
  for (const want of [...(sc?.expect?.include ?? []), ...(sc?.expect?.exclude ?? [])]) {
    const missing = Object.keys(want).filter((c) => !r.columns.includes(c));
    if (missing.length) checks.push({ label: `The answer has the column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}`, ok: false, detail: `It returns ${r.columns.join(', ')}.` });
  }
  return {
    lane, ok: checks.every((c) => c.ok), columns: r.columns, rows, checks, tables: r.tables, tries: used, refs: Object.fromEntries(w.refs),
    params: [...cands].map(([name, c]) => ({ name, value: params[name], why: c.why })),
    world: { now: w.now, nodes: w.nodes.length, edges: w.edges.length, planted: w.planted.size, classes: new Set(w.nodes.map((n) => n.cls)).size },
    ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
  };
}
