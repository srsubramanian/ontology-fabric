// The warehouse lane of a proof: a competency question's Snowflake SQL runs on SQLite in the page (sql.js), over
// tables built from the sample world. The tables come from the query itself: each table it reads maps to an ontology
// class by its name, and each column it reads maps to that class's id, a field, or a relationship's linked id or code.
// A few Snowflake functions are rewritten or added so the same SQL runs. Everything here is illustrative.
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import type { Model } from '../explorer/model.ts';
import { emptyShape, type Node, type Shape, type World } from './world.ts';

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const toks = (s: string) => s.split('_').filter(Boolean);
const startsWith = (a: string[], b: string[]) => b.length > 0 && b.length <= a.length && b.every((x, i) => a[i] === x);
const KEYWORDS = new Set(['on', 'join', 'left', 'right', 'inner', 'outer', 'full', 'cross', 'where', 'group', 'order', 'limit', 'having', 'union', 'using', 'qualify', 'natural', 'lateral', 'as', 'select', 'with', 'and', 'or', 'window']);

/** Comments out, strings masked, so rewrites never touch what's inside quotes. */
function mask(src: string) {
  const strings: string[] = [];
  const code = src.replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, (s) => `\u0000${strings.push(s) - 1}\u0000`);
  return { code, unmask: (s: string) => s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => strings[+i]) };
}

/** The index just past the parenthesis that closes the one at `open`. */
function closing(s: string, open: number) {
  let d = 0;
  for (let i = open; i < s.length; i++) { if (s[i] === '(') d++; else if (s[i] === ')' && --d === 0) return i + 1; }
  throw new Error('The query has an unclosed parenthesis.');
}
/** Rewrites every call to `name(…)` with what `f` makes of its inside, innermost calls first. */
function rewriteCall(s: string, name: string, f: (inner: string, rest: string) => [string, number?]): string {
  const re = new RegExp(`\\b${name}\\s*\\(`, 'i');
  for (let guard = 0; guard < 200; guard++) {
    const m = re.exec(s);
    if (!m) return s;
    const open = m.index + m[0].length - 1, end = closing(s, open);
    const inner = rewriteCall(s.slice(open + 1, end - 1), name, f);
    const [out, used = 0] = f(inner, s.slice(end));
    s = s.slice(0, m.index) + out + s.slice(end + used);
  }
  return s;
}
/** Splits on commas that aren't inside parentheses. */
function splitTop(s: string) {
  const out: string[] = []; let d = 0, from = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') d++; else if (s[i] === ')') d--; else if (s[i] === ',' && d === 0) { out.push(s.slice(from, i)); from = i + 1; }
  }
  return [...out, s.slice(from)];
}

/** Snowflake allows a select list to use an alias it defined earlier; SQLite doesn't, so the expression goes in its place. */
function lateralAliases(s: string): string {
  let out = '', i = 0;
  const re = /\bSELECT\b/gi;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const start = m.index + m[0].length;
    let d = 0, end = s.length;
    for (let j = start; j < s.length; j++) {
      if (s[j] === '(') d++;
      else if (s[j] === ')') { if (d === 0) { end = j; break; } d--; }
      else if (d === 0 && /^FROM\b/i.test(s.slice(j, j + 5)) && /\W/.test(s[j - 1])) { end = j; break; }
    }
    const items = splitTop(s.slice(start, end));
    const seen: [string, string][] = [];
    const rewritten = items.map((item) => {
      let e = item;
      for (const [alias, expr] of seen) e = e.replace(new RegExp(`(?<![.\\w])${alias}(?![\\w(.])`, 'g'), (x, at: number) => (/\bAS\s+$/i.test(e.slice(0, at)) ? x : `(${expr})`));
      const a = /^([\s\S]*?)\s+AS\s+([a-z_]\w*)\s*$/i.exec(e);
      if (a) seen.push([a[2], a[1].trim()]);
      return e;
    });
    out += s.slice(i, start) + rewritten.join(',');
    i = end;
    re.lastIndex = Math.max(re.lastIndex, end);
  }
  return out + s.slice(i);
}

/** Snowflake SQL as SQLite runs it. `now` is the sample world's clock. */
export function toSqlite(src: string, now: string): string {
  const { code, unmask } = mask(src);
  let s = code.trim().replace(/;\s*$/, '');
  s = s.replace(/\bCURRENT_TIMESTAMP\b(\s*\(\s*\))?|\bSYSDATE\s*\(\s*\)|\bGETDATE\s*\(\s*\)/gi, `'${now}'`)
    .replace(/\bCURRENT_DATE\b(\s*\(\s*\))?/gi, `'${now.slice(0, 10)}'`)
    .replace(/\b(DATE_TRUNC|DATEADD|DATEDIFF|TIMESTAMPADD|TIMESTAMPDIFF|DATE_PART)\s*\(\s*([A-Za-z]+)\s*,/gi, "$1('$2',")
    .replace(/\bIFF\s*\(/gi, 'IIF(')
    .replace(/\$([A-Za-z_]\w*)/g, ':$1')
    .replace(/\s\/\s|\/(?![*/])/g, ' * 1.0 / ');
  s = rewriteCall(s, 'COUNT_IF', (inner) => [`SUM(CASE WHEN ${inner} THEN 1 ELSE 0 END)`]);
  s = rewriteCall(s, 'RATIO_TO_REPORT', (inner, rest) => {
    const over = /^\s*OVER\s*\(/i.exec(rest);
    if (!over) return [`(${inner}) * 1.0 / SUM(${inner}) OVER ()`];
    const end = closing(rest, over[0].length - 1);
    return [`(${inner}) * 1.0 / SUM(${inner}) ${rest.slice(0, end).trim()}`, end];
  });
  return unmask(lateralAliases(s));
}

const DAYMS = 86_400_000;
const parseT = (v: unknown) => (typeof v === 'string' ? Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v) : typeof v === 'number' ? v : NaN);
const isDateOnly = (v: unknown) => typeof v === 'string' && v.length === 10;
const fmt = (t: number, dateOnly: boolean) => (dateOnly ? new Date(t).toISOString().slice(0, 10) : new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z'));
const unit = (u: unknown) => String(u).toLowerCase().replace(/s$/, '').replace(/^(dd?|days?)$/, 'day').replace(/^(mm|mon|months?)$/, 'month').replace(/^(yy|yyyy|years?)$/, 'year');
function dateTrunc(u: unknown, v: unknown): string | null {
  const t = parseT(v); if (Number.isNaN(t)) return null;
  const d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth();
  switch (unit(u)) {
    case 'year': return fmt(Date.UTC(y, 0, 1), true);
    case 'quarter': return fmt(Date.UTC(y, m - (m % 3), 1), true);
    case 'month': return fmt(Date.UTC(y, m, 1), true);
    case 'week': return fmt(Date.UTC(y, m, d.getUTCDate()) - ((d.getUTCDay() + 6) % 7) * DAYMS, true);
    case 'day': return fmt(Date.UTC(y, m, d.getUTCDate()), true);
    case 'hour': return fmt(Math.floor(t / 3_600_000) * 3_600_000, false);
    default: return fmt(t, false);
  }
}
function dateAdd(u: unknown, n: unknown, v: unknown): string | null {
  const t = parseT(v); if (Number.isNaN(t) || typeof n !== 'number') return null;
  const d = new Date(t), k = unit(u);
  if (k === 'year' || k === 'quarter' || k === 'month') d.setUTCMonth(d.getUTCMonth() + n * (k === 'year' ? 12 : k === 'quarter' ? 3 : 1));
  else d.setTime(t + n * ({ week: 7 * DAYMS, day: DAYMS, hour: 3_600_000, minute: 60_000, second: 1000 }[k] ?? DAYMS));
  return fmt(d.getTime(), isDateOnly(v) && ['year', 'quarter', 'month', 'week', 'day'].includes(k));
}
function dateDiff(u: unknown, a: unknown, b: unknown): number | null {
  const x = parseT(a), y = parseT(b); if (Number.isNaN(x) || Number.isNaN(y)) return null;
  const p = new Date(x), q = new Date(y), k = unit(u);
  const months = (q.getUTCFullYear() - p.getUTCFullYear()) * 12 + q.getUTCMonth() - p.getUTCMonth();
  if (k === 'year') return q.getUTCFullYear() - p.getUTCFullYear();
  if (k === 'quarter') return Math.floor((q.getUTCFullYear() * 12 + q.getUTCMonth()) / 3) - Math.floor((p.getUTCFullYear() * 12 + p.getUTCMonth()) / 3);
  if (k === 'month') return months;
  const day = (t: number) => Math.floor(t / DAYMS);
  if (k === 'week') return Math.floor((day(y) + 3) / 7) - Math.floor((day(x) + 3) / 7);
  if (k === 'hour') return Math.floor(y / 3_600_000) - Math.floor(x / 3_600_000);
  if (k === 'minute') return Math.floor(y / 60_000) - Math.floor(x / 60_000);
  if (k === 'second') return Math.floor(y / 1000) - Math.floor(x / 1000);
  return day(y) - day(x);
}

/** What one column of a table holds for an instance: its id, a field, or a linked instance's id or code. */
type Rel = Model['relationships'][number];
type Col = { kind: 'id' } | { kind: 'field'; name: string } | { kind: 'rel'; rel: Rel; label?: string; code: boolean } | { kind: 'in'; rel: Rel }
  | { kind: 'via'; rel: Rel; dir: 'in' | 'out'; field: string } | { kind: 'guess' };
/** A table the query reads, the class it holds, and the columns it reads from it. */
export type Table = { name: string; cls: string; columns: Map<string, Col>; explode?: Model['relationships'][number]; rows: SqlValue[][] };

const PREFIX = /^(fct|dim|stg|agg|raw|int|vw|v|tbl|f|d)_/;

/** The class a table holds: the one whose name its name starts with, longest first. */
export function tableClass(model: Model, table: string, hint?: string): { cls: string; extra: string[] } | null {
  const t = toks(table.toLowerCase().replace(PREFIX, '')).map((x, i, a) => (i === a.length - 1 && x.length > 3 ? x.replace(/s$/, '') : x));
  let best: { cls: string; extra: string[]; score: number } | null = null;
  for (const c of Object.values(model.classes)) {
    const ct = toks(snake(c.name));
    if (!startsWith(t, ct)) continue;
    const score = ct.length * 10 - (t.length - ct.length) - (c.abstract ? 1 : 0);
    if (!best || score > best.score) best = { cls: c.name, extra: t.slice(ct.length), score };
  }
  if (best) return best;
  return hint && model.classes[hint] ? { cls: hint, extra: [] } : null;
}

/**
 * What a column holds, from its name: merchant_id on an authorization is the merchant it links to, batch_id on a
 * clearing batch is its own id, response_code is the linked response code's code, and name on an issuer is the name
 * of the organization acting as it. A step comment on the column's line (-- FeeCollection.collected_from) settles a
 * name the ontology doesn't use, such as member_id.
 */
function resolveCol(model: Model, cls: string, col: string, hint?: Rel): Col {
  const c = model.classes[cls];
  const chain = c.chain;
  const below = (name: string): string[] => [name, ...(model.classes[name]?.children ?? []).flatMap(below)];
  const rels = model.relationships.filter((r) => chain.includes(r.from));
  const stem = col.replace(/_id$/, '');
  const st = toks(stem), own = toks(snake(cls));
  const endsWith = (a: string[], b: string[]) => b.length > 0 && b.length <= a.length && b.every((x, i) => a[a.length - b.length + i] === x);
  if (col === 'id' || (col.endsWith('_id') && chain.some((x) => snake(x) === stem))) return { kind: 'id' };
  if (col.endsWith('_id')) {
    for (const r of rels) for (const t of r.open ? Object.keys(model.classes) : below(r.to)) if (snake(t) === stem || `${r.slot}_${snake(t)}` === stem) return { kind: 'rel', rel: r, label: t === r.to ? undefined : t, code: false };
    if (startsWith(own, st) || endsWith(own, st)) return { kind: 'id' };
    for (const r of rels) if (r.slot === stem || r.slot.endsWith(`_${stem}`) || startsWith(toks(snake(r.to)), st)) return { kind: 'rel', rel: r, code: false };
    const inbound = model.relationships.find((r) => snake(r.from) === stem && chain.includes(r.to));
    if (inbound) return { kind: 'in', rel: inbound };
    if (hint && chain.includes(hint.from)) return { kind: 'rel', rel: hint, code: false };
    return { kind: 'guess' };
  }
  const field = c.slots.find((s) => !s.relationship && s.name === col);
  if (field) return { kind: 'field', name: col };
  for (const r of rels) if (snake(r.to) === col || r.slot === col || (r.slot.endsWith(`_${col}`) && !r.multivalued)) return { kind: 'rel', rel: r, code: true };
  const has = (k: string) => model.classes[k]?.slots.some((s) => !s.relationship && s.name === col);
  const inbound = model.relationships.find((r) => chain.includes(r.to) && has(r.from));
  if (inbound) return { kind: 'via', rel: inbound, dir: 'in', field: col };
  const outbound = rels.find((r) => !r.open && !r.multivalued && has(r.to));
  if (outbound) return { kind: 'via', rel: outbound, dir: 'out', field: col };
  return { kind: 'guess' };
}

/** A plausible value for a column the ontology doesn't name, so the query still runs. Marked as a guess on the page. */
function guess(col: string, n: Node, now: string): SqlValue {
  const h = [...(n.id + col)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  if (/_(at|on|date|time)$|^(date|day|time)$/.test(col)) return new Date(Date.parse(now) - (h % 90) * DAYMS).toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (/amount|fee|total|value|price|balance/.test(col)) return (h % 50_000) / 100;
  if (/^(is|has)_/.test(col)) return h % 2;
  if (/count|^n$|qty|number/.test(col)) return h % 40;
  if (col === 'name' && typeof n.props.name === 'string') return n.props.name;
  if (col.endsWith('_id')) return null;
  return `${col} ${h % 100}`;
}
const sqlValue = (v: unknown): SqlValue => (v == null ? null : typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' || typeof v === 'string' ? v : Array.isArray(v) ? v.join(',') : String(v));

/** The tables a query reads (not its CTEs), each with the columns the query reads from it. */
export function queryTables(model: Model, src: string): { tables: Map<string, Table>; aliases: Map<string, string> } {
  const { code } = mask(src);
  const lines = src.split('\n');
  const ctes = new Set([...code.matchAll(/(?:\bWITH\b|,)\s*([a-z_]\w*)\s+AS\s*\(/gi)].map((m) => m[1].toLowerCase()));
  const tables = new Map<string, Table>(), aliases = new Map<string, string>();
  // FROM a [AS] x, b y  |  JOIN c z
  const words = code.match(/[A-Za-z_]\w*|[(),]/g) ?? [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (w !== 'from' && w !== 'join') continue;
    let j = i + 1;
    for (;;) {
      const name = words[j];
      if (!name || name === '(' || name === ')' || name === ',') break;
      let alias = name;
      let k = j + 1;
      if (words[k]?.toLowerCase() === 'as') k++;
      if (words[k] && /^[A-Za-z_]/.test(words[k]) && !KEYWORDS.has(words[k].toLowerCase())) { alias = words[k]; k++; }
      const tn = name.toLowerCase();
      if (!ctes.has(tn) && !KEYWORDS.has(tn)) {
        aliases.set(alias.toLowerCase(), tn);
        if (!tables.has(tn)) {
          const line = lines.find((l) => new RegExp(`\\b(FROM|JOIN)\\s+${name}\\b`, 'i').test(l)) ?? '';
          const step = /--\s*([A-Z]\w*)\.([a-z_]\w*)/.exec(line);
          const hintRel = step ? model.relationships.find((r) => r.from === step[1] && r.slot === step[2]) : undefined;
          const tc = tableClass(model, tn, hintRel?.to);
          if (!tc) throw new Error(`The query reads ${name}, and no class in the ontology matches that table's name.`);
          const t: Table = { name: tn, cls: tc.cls, columns: new Map(), rows: [] };
          // A table of items, such as a settlement's items, has one row for each instance it links to.
          if (tc.extra.length) t.explode = model.relationships.find((r) => model.classes[tc.cls].chain.includes(r.from) && r.multivalued);
          tables.set(tn, t);
        }
      }
      if (w !== 'from' || words[k] !== ',') break;
      j = k + 1;
    }
  }
  const add = (t: Table, col: string, hint?: Rel) => {
    const now = t.columns.get(col);
    if (!now || (now.kind === 'guess' && hint)) t.columns.set(col, resolveCol(model, t.cls, col, hint));
  };
  for (const m of code.matchAll(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b/g)) {
    const tn = aliases.get(m[1].toLowerCase());
    if (!tn) continue;
    const step = /--\s*([A-Z]\w*)\.([a-z_]\w*)/.exec(lines[code.slice(0, m.index!).split('\n').length - 1] ?? '');
    add(tables.get(tn)!, m[2].toLowerCase(), step ? model.relationships.find((r) => r.from === step[1] && r.slot === step[2]) : undefined);
  }
  // Every table also carries its id, its fields and its links, for a query that names a column without its table.
  for (const t of tables.values()) {
    const c = model.classes[t.cls];
    add(t, `${snake(t.cls)}_id`);
    for (const s of c.slots) if (!s.relationship && !s.identifier) add(t, s.name);
    for (const r of model.relationships.filter((x) => c.chain.includes(x.from) && !x.open)) add(t, `${snake(r.to)}_id`);
    if (!t.explode) for (const col of t.columns.values()) if (col.kind === 'rel' && col.rel.multivalued) { t.explode = col.rel; break; }
  }
  return { tables, aliases };
}

/** Fills each table's rows from the sample world. */
export function fillTables(world: World, tables: Map<string, Table>) {
  for (const t of tables.values()) {
    t.rows = [];
    const cols = [...t.columns];
    for (const n of world.byLabel.get(t.cls) ?? []) {
      const links = (rel: Model['relationships'][number]) => (world.out.get(n) ?? []).filter((e) => e.slot === rel.slot && e.type === rel.type).map((e) => e.to);
      const each = t.explode ? links(t.explode) : [null];
      for (const via of each) {
        t.rows.push(cols.map(([name, c]) => {
          if (c.kind === 'id') return n.id;
          if (c.kind === 'field') return sqlValue(n.props[c.name]);
          if (c.kind === 'in') return (world.inn.get(n) ?? []).find((e) => e.slot === c.rel.slot)?.from.id ?? null;
          if (c.kind === 'via') {
            const other = c.dir === 'in' ? (world.inn.get(n) ?? []).find((e) => e.slot === c.rel.slot)?.from : links(c.rel)[0];
            return sqlValue(other?.props[c.field]);
          }
          if (c.kind === 'rel') {
            const to = via && t.explode === c.rel ? via : links(c.rel).find((x) => !c.label || x.labels.includes(c.label));
            if (!to || (c.label && !to.labels.includes(c.label))) return null;
            return c.code ? sqlValue(to.props.code ?? to.id) : to.id;
          }
          return guess(name, n, world.now);
        }));
      }
    }
  }
}

export type SqlResult = { columns: string[]; rows: unknown[][]; tables: { name: string; cls: string; rows: number; guessed: string[] }[] };

const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** The database for one run: the tables, and the Snowflake functions SQLite lacks. */
export function openDb(SQL: SqlJsStatic, tables: Map<string, Table>): Database {
  const db = new SQL.Database();
  db.create_function('date_trunc', dateTrunc);
  db.create_function('dateadd', dateAdd);
  db.create_function('timestampadd', dateAdd);
  db.create_function('datediff', dateDiff);
  db.create_function('timestampdiff', dateDiff);
  db.create_function('date_part', (u: unknown, v: unknown) => {
    const d = new Date(parseT(v)); const k = unit(u);
    return k === 'year' ? d.getUTCFullYear() : k === 'month' ? d.getUTCMonth() + 1 : k === 'day' ? d.getUTCDate() : k === 'hour' ? d.getUTCHours() : k === 'dow' ? d.getUTCDay() : null;
  });
  (db as unknown as { create_aggregate(name: string, a: { init(): unknown; step(s: unknown, v: unknown): unknown; finalize(s: unknown): unknown }): void }).create_aggregate('median', {
    init: () => [] as number[],
    step: (s, v) => { if (typeof v === 'number') (s as number[]).push(v); return s; },
    finalize: (s) => { const a = (s as number[]).sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; },
  });
  for (const t of tables.values()) {
    const cols = [...t.columns.keys()];
    db.run(`CREATE TABLE ${quote(t.name)} (${cols.map(quote).join(', ')})`);
    const ins = db.prepare(`INSERT INTO ${quote(t.name)} VALUES (${cols.map(() => '?').join(', ')})`);
    for (const r of t.rows) ins.run(r);
    ins.free();
  }
  return db;
}

/** The named parameters a query takes, such as :merchant_id. */
export const sqlParams = (src: string) => [...new Set([...mask(src).code.matchAll(/(?<![:\w]):([A-Za-z_]\w*)|\$([A-Za-z_]\w*)/g)].map((m) => m[1] ?? m[2]))];

/** Runs a query on the sample world: builds its tables, rewrites it for SQLite and binds its parameters. */
export function runSql(SQL: SqlJsStatic, model: Model, world: World, src: string, params: Record<string, unknown>): SqlResult {
  const { tables } = queryTables(model, src);
  fillTables(world, tables);
  const db = openDb(SQL, tables);
  try {
    const sql = toSqlite(src, world.now);
    const stmt = db.prepare(sql);
    const bind: Record<string, SqlValue> = {};
    for (const p of sqlParams(src)) bind[`:${p}`] = sqlValue(params[p]);
    if (Object.keys(bind).length) stmt.bind(bind);
    const rows: unknown[][] = [];
    while (stmt.step() && rows.length < 5000) rows.push(stmt.get());
    const columns = stmt.getColumnNames();
    stmt.free();
    return {
      columns, rows,
      tables: [...tables.values()].map((t) => ({ name: t.name, cls: t.cls, rows: t.rows.length, guessed: [...t.columns].filter(([, c]) => c.kind === 'guess').map(([n]) => n) })),
    };
  } finally {
    db.close();
  }
}

/**
 * The path a query walks, for seeding the sample world: each table alias is a variable of its class, each join
 * (a.capture_id = c.capture_id) a link, a column set to a literal (m.mcc = '7011') a value, a code column set to
 * one (a.response_code = '10') a link to that code, and two time columns compared, an order.
 */
export function sqlShape(model: Model, src: string): Shape {
  const { code, unmask } = mask(src);
  const { tables, aliases } = queryTables(model, src);
  const sh = emptyShape();
  const col = (alias: string, c: string) => {
    const t = tables.get(aliases.get(alias.toLowerCase()) ?? '');
    return t ? { t, c: c.toLowerCase(), r: t.columns.get(c.toLowerCase()) } : null;
  };
  for (const [a, tn] of aliases) sh.vars[a] = { cls: tables.get(tn)!.cls, props: {} };
  const lit = (x: string) => unmask(x).replace(/^'|'$/g, '').replace(/''/g, "'");
  let anon = 0;
  for (const m of code.matchAll(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*(=|<=|<|>=|>)\s*([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g)) {
    const x = col(m[1], m[2]), y = col(m[4], m[5]);
    if (!x?.r || !y?.r) continue;
    const [a, b] = [m[1].toLowerCase(), m[4].toLowerCase()];
    if (m[3] !== '=') {
      const time = (k: typeof x) => k.r!.kind === 'field' && /_(at|on|date)$|^date$/.test(k.c);
      if (time(x) && time(y)) sh.before.push(m[3].startsWith('<') ? { a: [a, m[2].toLowerCase()], b: [b, m[5].toLowerCase()] } : { a: [b, m[5].toLowerCase()], b: [a, m[2].toLowerCase()] });
      continue;
    }
    if (x.r.kind === 'id' && y.r.kind === 'rel') sh.links.push({ from: b, to: a, slot: y.r.rel.slot });
    else if (y.r.kind === 'id' && x.r.kind === 'rel') sh.links.push({ from: a, to: b, slot: x.r.rel.slot });
    else if (x.r.kind === 'rel' && y.r.kind === 'rel' && x.r.rel.to === y.r.rel.to) {
      const v = `_${anon++}`;
      sh.vars[v] = { cls: x.r.rel.to, props: {} };
      sh.links.push({ from: a, to: v, slot: x.r.rel.slot }, { from: b, to: v, slot: y.r.rel.slot });
    }
  }
  for (const m of code.matchAll(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*(?:=\s*(\u0000\d+\u0000|-?\d+(?:\.\d+)?)|IN\s*\(\s*(\u0000\d+\u0000|-?\d+(?:\.\d+)?))/gi)) {
    const x = col(m[1], m[2]);
    const raw = m[3] ?? m[4];
    if (!x?.r) continue;
    const v = raw.startsWith('\u0000') ? lit(raw) : Number(raw);
    if (x.r.kind === 'field') sh.vars[m[1].toLowerCase()].props[x.c] = v;
    else if (x.r.kind === 'rel' && x.r.code) sh.codes.push({ v: m[1].toLowerCase(), slot: x.r.rel.slot, code: String(v) });
  }
  return sh;
}
