// A small openCypher engine for proving a design on a sample world: the read-only subset the competency questions
// use (MATCH and OPTIONAL MATCH over chained patterns, WHERE with pattern predicates, WITH and RETURN with
// aggregation, DISTINCT, ORDER BY, SKIP, LIMIT, UNWIND and UNION). It isn't Neptune: it's how the studio shows what
// a query would return, on illustrative data. Anything outside the subset is named in a plain error, never guessed.
import { emptyShape, type Edge, type Node, type Shape, type World } from './world.ts';

type Tok = { t: 'id' | 'num' | 'str' | 'param' | 'op' | 'eof'; v: string; at: number; end: number };
const OPS = ['<-', '->', '<=', '>=', '<>', '..', '=~', '-', '<', '>', '=', '(', ')', '[', ']', '{', '}', ',', ':', '.', '+', '*', '/', '%', '|', ';', '^'];

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
    const at = i;
    if (/[A-Za-z_]/.test(c)) { while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++; out.push({ t: 'id', v: src.slice(at, i), at, end: i }); continue; }
    if (c === '`') { const j = src.indexOf('`', i + 1); out.push({ t: 'id', v: src.slice(i + 1, j), at, end: j + 1 }); i = j + 1; continue; }
    if (/[0-9]/.test(c)) { while (i < src.length && /[0-9]/.test(src[i])) i++; if (src[i] === '.' && /[0-9]/.test(src[i + 1] ?? '')) { i++; while (/[0-9]/.test(src[i] ?? '')) i++; } out.push({ t: 'num', v: src.slice(at, i), at, end: i }); continue; }
    if (c === '\'' || c === '"') {
      let s = ''; i++;
      while (i < src.length && src[i] !== c) { if (src[i] === '\\') { i++; s += src[i] === 'n' ? '\n' : src[i]; } else s += src[i]; i++; }
      i++; out.push({ t: 'str', v: s, at, end: i }); continue;
    }
    if (c === '$') { i++; const s = i; while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++; out.push({ t: 'param', v: src.slice(s, i), at, end: i }); continue; }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new Error(`Can't read "${c}" in the query.`);
    out.push({ t: 'op', v: op, at, end: i + op.length }); i += op.length;
  }
  out.push({ t: 'eof', v: '', at: src.length, end: src.length });
  return out;
}

type NodePat = { v?: string; labels: string[]; props: [string, Expr][] };
type RelPat = { v?: string; types: string[]; dir: 'out' | 'in' | 'both'; props: [string, Expr][] };
type Pattern = { nodes: NodePat[]; rels: RelPat[] };
type Expr =
  | { k: 'lit'; v: unknown; f?: boolean } | { k: 'param'; n: string } | { k: 'var'; n: string }
  | { k: 'prop'; o: Expr; n: string } | { k: 'idx'; o: Expr; i: Expr } | { k: 'slice'; o: Expr; a?: Expr; b?: Expr }
  | { k: 'bin'; op: string; a: Expr; b: Expr } | { k: 'not'; a: Expr } | { k: 'neg'; a: Expr } | { k: 'isnull'; a: Expr; not: boolean }
  | { k: 'fn'; n: string; args: Expr[]; distinct: boolean; star: boolean }
  | { k: 'list'; items: Expr[] } | { k: 'map'; entries: [string, Expr][] }
  | { k: 'case'; subject?: Expr; whens: [Expr, Expr][]; else?: Expr } | { k: 'exists'; p: Pattern };
type Item = { e: Expr; as: string };
type Proj = { distinct: boolean; items: Item[]; star: boolean; where?: Expr; order?: { e: Expr; desc: boolean }[]; skip?: Expr; limit?: Expr };
type Clause = { k: 'match'; optional: boolean; patterns: Pattern[]; where?: Expr } | ({ k: 'with' } & Proj) | ({ k: 'return' } & Proj) | { k: 'unwind'; e: Expr; as: string };

const AGG = new Set(['count', 'collect', 'sum', 'avg', 'min', 'max']);
/** Whether an expression is a float, as openCypher types it: 2 / 3 is 0, toFloat(2) / 3 isn't. */
const FLOATS = new Set(['tofloat', 'avg', 'sqrt', 'exp', 'log', 'log10', 'rand', 'percentilecont', 'stdev']);
const floaty = (e: Expr): boolean => e.k === 'lit' ? e.f === true : e.k === 'fn' ? FLOATS.has(e.n.toLowerCase())
  : e.k === 'bin' && ['+', '-', '*', '/'].includes(e.op) ? floaty(e.a) || floaty(e.b) : e.k === 'neg' ? floaty(e.a) : false;

function parse(src: string): { parts: Clause[][]; all: boolean } {
  const toks = lex(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const kw = (w: string, o = 0) => peek(o).t === 'id' && peek(o).v.toUpperCase() === w;
  const op = (v: string, o = 0) => peek(o).t === 'op' && peek(o).v === v;
  const fail = (what: string): never => { throw new Error(`The sample engine can't read the query near "${src.slice(peek().at, peek().at + 24).trim() || 'the end'}": ${what}.`); };
  const eat = (v: string) => { if (op(v)) { p++; return; } fail(`expected "${v}"`); };
  const eatKw = (w: string) => { if (kw(w)) { p++; return; } fail(`expected ${w}`); };
  const ident = () => { if (peek().t === 'id') return toks[p++].v; return fail('expected a name'); };

  const props = (): [string, Expr][] => {
    const out: [string, Expr][] = [];
    if (!op('{')) return out;
    p++;
    while (!op('}')) { const k = ident(); eat(':'); out.push([k, expr()]); if (op(',')) p++; }
    p++;
    return out;
  };
  const nodePat = (): NodePat => {
    eat('(');
    const n: NodePat = { labels: [], props: [] };
    if (peek().t === 'id') n.v = ident();
    while (op(':')) { p++; n.labels.push(ident()); }
    n.props = props();
    eat(')');
    return n;
  };
  const relPat = (): RelPat => {
    let left = false;
    if (op('<-')) { left = true; p++; } else eat('-');
    const r: RelPat = { types: [], dir: 'both', props: [] };
    if (op('[')) {
      p++;
      if (peek().t === 'id') r.v = ident();
      if (op(':')) { p++; r.types.push(ident()); while (op('|')) { p++; if (op(':')) p++; r.types.push(ident()); } }
      if (op('*')) fail('variable-length paths aren\'t supported in the sample engine');
      r.props = props();
      eat(']');
    }
    if (op('->')) { p++; r.dir = left ? 'both' : 'out'; } else { eat('-'); r.dir = left ? 'in' : 'both'; }
    return r;
  };
  const pattern = (): Pattern => {
    const pt: Pattern = { nodes: [nodePat()], rels: [] };
    while (op('-') || op('<-')) { pt.rels.push(relPat()); pt.nodes.push(nodePat()); }
    return pt;
  };
  // A pattern in an expression, such as NOT (cb)<-[:RESPONDS_TO]-(:Representment): "(" then a node, then a link.
  const looksLikePattern = () => {
    if (!op('(')) return false;
    let q = p + 1, depth = 1;
    while (q < toks.length && depth) { if (toks[q].v === '(' && toks[q].t === 'op') depth++; if (toks[q].v === ')' && toks[q].t === 'op') depth--; q++; }
    return toks[q]?.t === 'op' && (toks[q].v === '-' || toks[q].v === '<-');
  };

  const primary = (): Expr => {
    const t = peek();
    if (t.t === 'num') { p++; return { k: 'lit', v: Number(t.v), f: t.v.includes('.') }; }
    if (t.t === 'str') { p++; return { k: 'lit', v: t.v }; }
    if (t.t === 'param') { p++; return { k: 'param', n: t.v }; }
    if (op('[')) { p++; const items: Expr[] = []; while (!op(']')) { items.push(expr()); if (op(',')) p++; } p++; return { k: 'list', items }; }
    if (op('{')) { return { k: 'map', entries: props() }; }
    if (op('(')) {
      if (looksLikePattern()) return { k: 'exists', p: pattern() };
      p++; const e = expr(); eat(')'); return e;
    }
    if (t.t === 'id') {
      const w = t.v.toUpperCase();
      if (w === 'TRUE' || w === 'FALSE') { p++; return { k: 'lit', v: w === 'TRUE' }; }
      if (w === 'NULL') { p++; return { k: 'lit', v: null }; }
      if (w === 'CASE') {
        p++;
        const c: Extract<Expr, { k: 'case' }> = { k: 'case', whens: [] };
        if (!kw('WHEN')) c.subject = expr();
        while (kw('WHEN')) { p++; const w2 = expr(); eatKw('THEN'); c.whens.push([w2, expr()]); }
        if (kw('ELSE')) { p++; c.else = expr(); }
        eatKw('END');
        return c;
      }
      if (w === 'EXISTS' && op('(', 1)) { p += 2; const e = looksLikePattern() || op('(') ? { k: 'exists' as const, p: pattern() } : expr(); eat(')'); return e.k === 'exists' ? e : { k: 'isnull', a: e, not: true }; }
      if (op('(', 1)) {
        p += 2;
        const n = t.v.toLowerCase();
        if (op('*')) { p++; eat(')'); return { k: 'fn', n, args: [], distinct: false, star: true }; }
        const distinct = kw('DISTINCT') ? (p++, true) : false;
        const args: Expr[] = [];
        while (!op(')')) { args.push(expr()); if (op(',')) p++; }
        p++;
        return { k: 'fn', n, args, distinct, star: false };
      }
      p++;
      return { k: 'var', n: t.v };
    }
    return fail('expected a value');
  };
  const postfix = (): Expr => {
    let e = primary();
    for (;;) {
      if (op('.') && peek(1).t === 'id') { p++; e = { k: 'prop', o: e, n: ident() }; continue; }
      if (op('[')) {
        p++;
        if (op('..')) { p++; const b = op(']') ? undefined : expr(); eat(']'); e = { k: 'slice', o: e, b }; continue; }
        const a = expr();
        if (op('..')) { p++; const b = op(']') ? undefined : expr(); eat(']'); e = { k: 'slice', o: e, a, b }; continue; }
        eat(']'); e = { k: 'idx', o: e, i: a }; continue;
      }
      return e;
    }
  };
  const unary = (): Expr => { if (op('-')) { p++; return { k: 'neg', a: unary() }; } return postfix(); };
  const mult = (): Expr => { let e = unary(); while (op('*') || op('/') || op('%')) { const o = toks[p++].v; e = { k: 'bin', op: o, a: e, b: unary() }; } return e; };
  const add = (): Expr => { let e = mult(); while (op('+') || op('-')) { const o = toks[p++].v; e = { k: 'bin', op: o, a: e, b: mult() }; } return e; };
  const cmp = (): Expr => {
    let e = add();
    for (;;) {
      if (['=', '<>', '<', '<=', '>', '>=', '=~'].some((o) => op(o))) { const o = toks[p++].v; e = { k: 'bin', op: o, a: e, b: add() }; continue; }
      if (kw('IS')) { p++; const not = kw('NOT') ? (p++, true) : false; eatKw('NULL'); e = { k: 'isnull', a: e, not }; continue; }
      if (kw('IN')) { p++; e = { k: 'bin', op: 'IN', a: e, b: add() }; continue; }
      if (kw('STARTS') && kw('WITH', 1)) { p += 2; e = { k: 'bin', op: 'STARTS', a: e, b: add() }; continue; }
      if (kw('ENDS') && kw('WITH', 1)) { p += 2; e = { k: 'bin', op: 'ENDS', a: e, b: add() }; continue; }
      if (kw('CONTAINS')) { p++; e = { k: 'bin', op: 'CONTAINS', a: e, b: add() }; continue; }
      return e;
    }
  };
  const not = (): Expr => { if (kw('NOT')) { p++; return { k: 'not', a: not() }; } return cmp(); };
  const and = (): Expr => { let e = not(); while (kw('AND')) { p++; e = { k: 'bin', op: 'AND', a: e, b: not() }; } return e; };
  const xor = (): Expr => { let e = and(); while (kw('XOR')) { p++; e = { k: 'bin', op: 'XOR', a: e, b: and() }; } return e; };
  const expr = (): Expr => { let e = xor(); while (kw('OR')) { p++; e = { k: 'bin', op: 'OR', a: e, b: xor() }; } return e; };

  const items = (): { items: Item[]; star: boolean } => {
    const out: Item[] = [];
    let star = false;
    do {
      if (op(',')) p++;
      if (op('*')) { p++; star = true; continue; }
      const from = peek().at, e = expr(), to = toks[p - 1].end;
      const as = kw('AS') ? (p++, ident()) : e.k === 'var' ? e.n : src.slice(from, to).trim();
      out.push({ e, as });
    } while (op(','));
    return { items: out, star };
  };
  const proj = (): Proj => {
    const distinct = kw('DISTINCT') ? (p++, true) : false;
    const pr: Proj = { distinct, ...items() };
    if (kw('ORDER')) { p++; eatKw('BY'); pr.order = []; do { if (op(',')) p++; const e = expr(); const desc = kw('DESC') || kw('DESCENDING'); if (desc || kw('ASC') || kw('ASCENDING')) p++; pr.order.push({ e, desc }); } while (op(',')); }
    if (kw('SKIP')) { p++; pr.skip = expr(); }
    if (kw('LIMIT')) { p++; pr.limit = expr(); }
    return pr;
  };
  const single = (): Clause[] => {
    const out: Clause[] = [];
    for (;;) {
      if (kw('OPTIONAL') || kw('MATCH')) {
        const optional = kw('OPTIONAL') ? (p++, true) : false;
        eatKw('MATCH');
        const patterns = [pattern()];
        while (op(',')) { p++; patterns.push(pattern()); }
        const where = kw('WHERE') ? (p++, expr()) : undefined;
        out.push({ k: 'match', optional, patterns, where });
      } else if (kw('WITH')) {
        p++;
        const pr = proj();
        if (kw('WHERE')) { p++; pr.where = expr(); }
        out.push({ k: 'with', ...pr });
      } else if (kw('UNWIND')) {
        p++; const e = expr(); eatKw('AS'); out.push({ k: 'unwind', e, as: ident() });
      } else if (kw('RETURN')) {
        p++; out.push({ k: 'return', ...proj() });
        return out;
      } else if (['CREATE', 'MERGE', 'SET', 'DELETE', 'DETACH', 'REMOVE', 'CALL', 'LOAD', 'FOREACH'].some((w) => kw(w))) {
        fail('the sample engine runs read-only queries, as decision 13 requires');
      } else fail('expected MATCH, WITH, UNWIND or RETURN');
    }
  };
  const parts = [single()];
  let all = false;
  while (kw('UNION')) { p++; if (kw('ALL')) { p++; all = true; } parts.push(single()); }
  if (op(';')) p++;
  if (peek().t !== 'eof') fail('expected the query to end');
  return { parts, all };
}

// ---- evaluation ----

type Row = Record<string, unknown>;
type Duration = { duration: true; months: number; days: number; ms: number };
const isNode = (v: unknown): v is Node => !!v && typeof v === 'object' && 'labels' in (v as object) && 'cls' in (v as object);
const isEdge = (v: unknown): v is Edge => !!v && typeof v === 'object' && 'slot' in (v as object) && 'from' in (v as object);
const isDur = (v: unknown): v is Duration => !!v && typeof v === 'object' && (v as Duration).duration === true;
const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

function parseDuration(s: string): Duration {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(s.trim());
  if (!m) throw new Error(`Can't read the duration "${s}".`);
  const n = (i: number) => Number(m[i] ?? 0);
  return { duration: true, months: n(1) * 12 + n(2), days: n(3) * 7 + n(4), ms: ((n(5) * 60 + n(6)) * 60 + n(7)) * 1000 };
}
function shift(isoS: string, d: Duration, sign: number): string {
  const t = new Date(isoS.length === 10 ? isoS + 'T00:00:00Z' : isoS);
  t.setUTCMonth(t.getUTCMonth() + sign * d.months);
  t.setUTCDate(t.getUTCDate() + sign * d.days);
  const out = new Date(t.getTime() + sign * d.ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return isoS.length === 10 ? out.slice(0, 10) : out;
}
const key = (v: unknown): string => isNode(v) ? `n:${v.id}` : isEdge(v) ? `e:${v.from.id}>${v.type}>${v.to.id}` : Array.isArray(v) ? `[${v.map(key).join(',')}]` : JSON.stringify(v ?? null);
function compare(a: unknown, b: unknown): number | null {
  if (a == null || b == null) return null;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return null;
}
const equal = (a: unknown, b: unknown): boolean | null => (a == null || b == null ? null : key(a) === key(b));
const truthy = (v: unknown) => v === true;

export type CypherResult = { columns: string[]; rows: unknown[][] };

export function runCypher(src: string, world: World, params: Record<string, unknown>): CypherResult {
  const q = parse(src);
  const ev = (e: Expr, row: Row): unknown => {
    switch (e.k) {
      case 'lit': return e.v;
      case 'param': if (!(e.n in params)) throw new Error(`The query needs a value for $${e.n}.`); return params[e.n];
      case 'var': if (!(e.n in row)) throw new Error(`The query uses ${e.n} before it's matched.`); return row[e.n];
      case 'prop': { const o = ev(e.o, row); if (o == null) return null; if (isNode(o) || isEdge(o)) return o.props[e.n] ?? null; if (typeof o === 'object') return (o as Row)[e.n] ?? null; return null; }
      case 'idx': { const o = ev(e.o, row), i = ev(e.i, row); if (Array.isArray(o) && typeof i === 'number') return o[i < 0 ? o.length + i : i] ?? null; if (o && typeof o === 'object' && typeof i === 'string') return (o as Row)[i] ?? null; return null; }
      case 'slice': { const o = ev(e.o, row); if (!Array.isArray(o)) return null; const a = e.a ? Number(ev(e.a, row)) : 0, b = e.b ? Number(ev(e.b, row)) : o.length; return o.slice(a, b); }
      case 'not': { const v = ev(e.a, row); return v == null ? null : !truthy(v); }
      case 'neg': { const v = ev(e.a, row); return typeof v === 'number' ? -v : null; }
      case 'isnull': { const v = ev(e.a, row); return e.not ? v != null : v == null; }
      case 'list': return e.items.map((x) => ev(x, row));
      case 'map': return Object.fromEntries(e.entries.map(([k, x]) => [k, ev(x, row)]));
      case 'case': {
        if (e.subject) { const s = ev(e.subject, row); for (const [w, t] of e.whens) if (equal(s, ev(w, row))) return ev(t, row); }
        else for (const [w, t] of e.whens) if (truthy(ev(w, row))) return ev(t, row);
        return e.else ? ev(e.else, row) : null;
      }
      case 'exists': return match(e.p, row).length > 0;
      case 'fn': return fn(e, row);
      case 'bin': return bin(e, row);
    }
  };
  const bin = (e: Extract<Expr, { k: 'bin' }>, row: Row): unknown => {
    if (e.op === 'AND') { const a = ev(e.a, row); if (a === false) return false; const b = ev(e.b, row); if (b === false) return false; return a == null || b == null ? null : true; }
    if (e.op === 'OR') { const a = ev(e.a, row); if (a === true) return true; const b = ev(e.b, row); if (b === true) return true; return a == null || b == null ? null : false; }
    const a = ev(e.a, row), b = ev(e.b, row);
    switch (e.op) {
      case 'XOR': return a == null || b == null ? null : truthy(a) !== truthy(b);
      case '=': return equal(a, b);
      case '<>': { const q2 = equal(a, b); return q2 == null ? null : !q2; }
      case '<': { const c = compare(a, b); return c == null ? null : c < 0; }
      case '<=': { const c = compare(a, b); return c == null ? null : c <= 0; }
      case '>': { const c = compare(a, b); return c == null ? null : c > 0; }
      case '>=': { const c = compare(a, b); return c == null ? null : c >= 0; }
      case '=~': return typeof a === 'string' && typeof b === 'string' ? new RegExp(`^(?:${b})$`).test(a) : null;
      case 'IN': return Array.isArray(b) ? (a == null ? null : b.some((x) => equal(a, x))) : null;
      case 'STARTS': return typeof a === 'string' && typeof b === 'string' ? a.startsWith(b) : null;
      case 'ENDS': return typeof a === 'string' && typeof b === 'string' ? a.endsWith(b) : null;
      case 'CONTAINS': return typeof a === 'string' && typeof b === 'string' ? a.includes(b) : null;
      case '+':
        if (typeof a === 'string' && ISO.test(a) && isDur(b)) return shift(a, b, 1);
        if (Array.isArray(a)) return a.concat(Array.isArray(b) ? b : [b]);
        if (typeof a === 'number' && typeof b === 'number') return a + b;
        if (a == null || b == null) return null;
        return String(a) + String(b);
      case '-':
        if (typeof a === 'string' && ISO.test(a) && isDur(b)) return shift(a, b, -1);
        return typeof a === 'number' && typeof b === 'number' ? a - b : null;
      case '*': return typeof a === 'number' && typeof b === 'number' ? a * b : null;
      case '/': if (typeof a !== 'number' || typeof b !== 'number' || b === 0) return null; return Number.isInteger(a) && Number.isInteger(b) && !floaty(e.a) && !floaty(e.b) ? Math.trunc(a / b) : a / b;
      case '%': return typeof a === 'number' && typeof b === 'number' && b !== 0 ? a % b : null;
    }
    throw new Error(`The sample engine doesn't know ${e.op}.`);
  };
  const fn = (e: Extract<Expr, { k: 'fn' }>, row: Row): unknown => {
    if (AGG.has(e.n)) throw new Error(`${e.n}() is only allowed in WITH or RETURN.`);
    const a = e.args.map((x) => ev(x, row));
    switch (e.n) {
      case 'tofloat': return a[0] == null ? null : Number(a[0]);
      case 'tointeger': return a[0] == null ? null : Math.trunc(Number(a[0]));
      case 'tostring': return a[0] == null ? null : String(a[0]);
      case 'size': case 'length': return Array.isArray(a[0]) || typeof a[0] === 'string' ? (a[0] as string).length : null;
      case 'coalesce': return a.find((x) => x != null) ?? null;
      case 'tolower': return typeof a[0] === 'string' ? a[0].toLowerCase() : null;
      case 'toupper': return typeof a[0] === 'string' ? a[0].toUpperCase() : null;
      case 'trim': return typeof a[0] === 'string' ? a[0].trim() : null;
      case 'abs': return typeof a[0] === 'number' ? Math.abs(a[0]) : null;
      case 'round': return typeof a[0] === 'number' ? Math.round(a[0] * 10 ** Number(a[1] ?? 0)) / 10 ** Number(a[1] ?? 0) : null;
      case 'head': return Array.isArray(a[0]) ? a[0][0] ?? null : null;
      case 'last': return Array.isArray(a[0]) ? a[0][a[0].length - 1] ?? null : null;
      case 'id': return isNode(a[0]) ? a[0].id : null;
      case 'type': return isEdge(a[0]) ? a[0].type : null;
      case 'labels': return isNode(a[0]) ? a[0].labels : null;
      case 'duration': return typeof a[0] === 'string' ? parseDuration(a[0]) : null;
      case 'datetime': return typeof a[0] === 'string' ? a[0] : world.now;
      case 'date': return typeof a[0] === 'string' ? a[0].slice(0, 10) : world.now.slice(0, 10);
      case 'timestamp': return Date.parse(world.now);
    }
    throw new Error(`The sample engine doesn't know the function ${e.n}().`);
  };
  const hasAgg = (e: Expr): boolean => {
    switch (e.k) {
      case 'fn': return AGG.has(e.n) || e.args.some(hasAgg);
      case 'prop': return hasAgg(e.o);
      case 'idx': return hasAgg(e.o) || hasAgg(e.i);
      case 'slice': return hasAgg(e.o) || (!!e.a && hasAgg(e.a)) || (!!e.b && hasAgg(e.b));
      case 'bin': return hasAgg(e.a) || hasAgg(e.b);
      case 'not': case 'neg': case 'isnull': return hasAgg(e.a);
      case 'list': return e.items.some(hasAgg);
      case 'case': return (!!e.subject && hasAgg(e.subject)) || e.whens.some(([w, t]) => hasAgg(w) || hasAgg(t)) || (!!e.else && hasAgg(e.else));
      default: return false;
    }
  };
  // An expression over a group of rows: aggregates fold the group, everything else reads its first row.
  const evAgg = (e: Expr, rows: Row[]): unknown => {
    if (!hasAgg(e)) return rows.length ? ev(e, rows[0]) : null;
    if (e.k === 'fn' && AGG.has(e.n)) {
      let vals = e.star ? rows.map(() => 1) : rows.map((r) => ev(e.args[0], r)).filter((v) => v != null);
      if (e.distinct) { const seen = new Set<string>(); vals = vals.filter((v) => { const k = key(v); if (seen.has(k)) return false; seen.add(k); return true; }); }
      const nums = vals.filter((v): v is number => typeof v === 'number');
      switch (e.n) {
        case 'count': return vals.length;
        case 'collect': return vals;
        case 'sum': return nums.reduce((s, x) => s + x, 0);
        case 'avg': return nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : null;
        case 'min': return vals.reduce<unknown>((m, x) => (m == null || (compare(x, m) ?? 1) < 0 ? x : m), null);
        case 'max': return vals.reduce<unknown>((m, x) => (m == null || (compare(x, m) ?? -1) > 0 ? x : m), null);
      }
    }
    // An expression around aggregates, such as collect(x)[0..10] or toFloat(count(a)) / count(b).
    const sub = (x: Expr) => ({ k: 'lit', v: evAgg(x, rows), f: floaty(x) }) as Expr;
    const r0 = rows[0] ?? {};
    switch (e.k) {
      case 'fn': return ev({ ...e, args: e.args.map(sub) }, r0);
      case 'prop': return ev({ ...e, o: sub(e.o) }, r0);
      case 'idx': return ev({ ...e, o: sub(e.o), i: sub(e.i) }, r0);
      case 'slice': return ev({ ...e, o: sub(e.o), a: e.a && sub(e.a), b: e.b && sub(e.b) }, r0);
      case 'bin': return ev({ ...e, a: sub(e.a), b: sub(e.b) }, r0);
      case 'not': case 'neg': case 'isnull': return ev({ ...e, a: sub(e.a) } as Expr, r0);
      case 'list': return e.items.map((x) => evAgg(x, rows));
      default: return ev(e, r0);
    }
  };

  const fits = (n: Node, np: NodePat, row: Row) => np.labels.every((l) => n.labels.includes(l)) && np.props.every(([k, x]) => equal(n.props[k], ev(x, row)) === true);
  const relFits = (e: Edge, rp: RelPat, row: Row) => (!rp.types.length || rp.types.includes(e.type)) && rp.props.every(([k, x]) => equal(e.props[k], ev(x, row)) === true);
  const flip = (pt: Pattern): Pattern => ({ nodes: [...pt.nodes].reverse(), rels: [...pt.rels].reverse().map((r) => ({ ...r, dir: r.dir === 'out' ? 'in' : r.dir === 'in' ? 'out' : 'both' })) });
  // Every way a pattern matches, given what the row has bound. It starts from whichever end is bound.
  const match = (pt0: Pattern, row: Row): Row[] => {
    const bound = (np: NodePat) => !!np.v && np.v in row && row[np.v] != null;
    const pt = !bound(pt0.nodes[0]) && bound(pt0.nodes[pt0.nodes.length - 1]) ? flip(pt0) : pt0;
    const first = pt.nodes[0];
    let starts: Node[];
    if (first.v && first.v in row) { const v = row[first.v]; starts = isNode(v) ? [v] : []; }
    else starts = first.labels.length ? world.byLabel.get(first.labels[0]) ?? [] : world.nodes;
    const out: Row[] = [];
    const step = (i: number, at: Node, r: Row, used: Set<Edge>) => {
      if (i === pt.rels.length) { out.push(r); return; }
      const rp = pt.rels[i], np = pt.nodes[i + 1];
      const cands: [Edge, Node][] = [];
      if (rp.dir !== 'in') for (const e of world.out.get(at) ?? []) cands.push([e, e.to]);
      if (rp.dir !== 'out') for (const e of world.inn.get(at) ?? []) cands.push([e, e.from]);
      for (const [e, n] of cands) {
        if (used.has(e) || !relFits(e, rp, r)) continue;
        if (rp.v && rp.v in r && r[rp.v] !== e) continue;
        if (np.v && np.v in r) { if (r[np.v] !== n) continue; } else if (!fits(n, np, r)) continue;
        const next = { ...r };
        if (rp.v) next[rp.v] = e;
        if (np.v) next[np.v] = n;
        step(i + 1, n, next, new Set(used).add(e));
      }
    };
    for (const s of starts) {
      if (!fits(s, first, row)) continue;
      step(0, s, first.v ? { ...row, [first.v]: s } : { ...row }, new Set());
    }
    return out;
  };
  const varsOf = (pts: Pattern[]) => pts.flatMap((pt) => [...pt.nodes.map((n) => n.v), ...pt.rels.map((r) => r.v)]).filter((v): v is string => !!v);

  const project = (rows: Row[], pr: Proj): { out: Row[]; src: Row[] } => {
    const items = pr.star ? [...new Set(rows.flatMap((r) => Object.keys(r)))].map((n) => ({ e: { k: 'var', n } as Expr, as: n })).concat(pr.items) : pr.items;
    let out: Row[], src: Row[];
    if (items.some((it) => hasAgg(it.e))) {
      const keys = items.filter((it) => !hasAgg(it.e));
      const groups = new Map<string, Row[]>();
      for (const r of rows) { const k = keys.map((it) => key(ev(it.e, r))).join('|'); groups.set(k, [...(groups.get(k) ?? []), r]); }
      if (!rows.length && !keys.length) groups.set('', []);
      out = [...groups.values()].map((g) => Object.fromEntries(items.map((it) => [it.as, evAgg(it.e, g)])));
      src = out.map(() => ({}));
    } else {
      out = rows.map((r) => Object.fromEntries(items.map((it) => [it.as, ev(it.e, r)])));
      src = rows;
    }
    if (pr.distinct) {
      const seen = new Set<string>();
      const keep = out.map((r) => { const k = key(Object.values(r)); if (seen.has(k)) return false; seen.add(k); return true; });
      out = out.filter((_, i) => keep[i]); src = src.filter((_, i) => keep[i]);
    }
    if (pr.order) {
      const scope = out.map((r, i) => ({ ...src[i], ...r }));
      const idx = out.map((_, i) => i).sort((x, y) => {
        for (const o of pr.order!) {
          const c = compare(ev(o.e, scope[x]), ev(o.e, scope[y]));
          const d = c == null ? (ev(o.e, scope[x]) == null ? 1 : -1) * (o.desc ? -1 : 1) : c;
          if (d) return o.desc ? -d : d;
        }
        return x - y;
      });
      out = idx.map((i) => out[i]); src = idx.map((i) => src[i]);
    }
    const skip = pr.skip ? Number(ev(pr.skip, {})) : 0;
    const limit = pr.limit ? Number(ev(pr.limit, {})) : Infinity;
    return { out: out.slice(skip, skip + limit), src: src.slice(skip, skip + limit) };
  };

  const runSingle = (clauses: Clause[]): { columns: string[]; rows: Row[] } => {
    let rows: Row[] = [{}];
    for (const c of clauses) {
      if (rows.length > 20000) throw new Error('The query matched too many rows for the sample engine. Add more to its MATCH or WHERE.');
      if (c.k === 'match') {
        const next: Row[] = [];
        for (const r of rows) {
          let found: Row[] = [r];
          for (const pt of c.patterns) found = found.flatMap((x) => match(pt, x));
          if (c.where) found = found.filter((x) => truthy(ev(c.where!, x)));
          if (found.length) next.push(...found);
          else if (c.optional) next.push({ ...r, ...Object.fromEntries(varsOf(c.patterns).filter((v) => !(v in r)).map((v) => [v, null])) });
        }
        rows = next;
      } else if (c.k === 'unwind') {
        rows = rows.flatMap((r) => { const l = ev(c.e, r); return (Array.isArray(l) ? l : l == null ? [] : [l]).map((x) => ({ ...r, [c.as]: x })); });
      } else {
        const { out } = project(rows, c);
        if (c.k === 'with') { rows = c.where ? out.filter((r) => truthy(ev(c.where!, r))) : out; continue; }
        return { columns: c.items.map((it) => it.as), rows: out };
      }
    }
    throw new Error('The query has no RETURN.');
  };

  const results = q.parts.map(runSingle);
  const columns = results[0].columns;
  let rows = results.flatMap((r) => r.rows.map((x) => columns.map((c) => x[c])));
  if (results.length > 1 && !q.all) { const seen = new Set<string>(); rows = rows.filter((r) => { const k = key(r); if (seen.has(k)) return false; seen.add(k); return true; }); }
  return { columns, rows: rows.map((r) => r.map(show)) };
}

/** A value as the results table shows it: a node by its id, a relationship by its type. */
export function show(v: unknown): unknown {
  if (isNode(v)) return v.id;
  if (isEdge(v)) return v.type;
  if (isDur(v)) return `P${v.months ? v.months + 'M' : ''}${v.days ? v.days + 'D' : ''}`;
  if (Array.isArray(v)) return v.map(show);
  if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 10000) / 10000;
  return v ?? null;
}

/** The query's parameters, in the order they appear. */
export const cypherParams = (src: string) => [...new Set([...src.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))];

/**
 * The path a query walks, for seeding the sample world: every MATCH pattern's variables, labels and literal values,
 * the values its WHERE asks for (v.kind = 'x'), the links a NOT pattern rules out, and times it compares.
 */
export function cypherShape(src: string): Shape {
  const q = parse(src);
  const sh = emptyShape();
  let anon = 0;
  const nodeVar = (n: NodePat) => {
    const v = n.v ?? `_${anon++}`;
    const s = (sh.vars[v] ??= { props: {} });
    if (n.labels[0] && !s.cls) s.cls = n.labels[0];
    for (const [k, e] of n.props) if (e.k === 'lit') s.props[k] = e.v;
    return v;
  };
  const add = (pt: Pattern) => {
    const vs = pt.nodes.map(nodeVar);
    pt.rels.forEach((r, i) => {
      const [a, b] = r.dir === 'in' ? [vs[i + 1], vs[i]] : [vs[i], vs[i + 1]];
      if (r.types[0]) sh.links.push({ from: a, to: b, type: r.types[0] });
    });
  };
  const propOf = (e: Expr): [string, string] | null => (e.k === 'prop' && e.o.k === 'var' ? [e.o.n, e.n] : null);
  const where = (e?: Expr) => {
    if (!e) return;
    if (e.k === 'bin' && e.op === 'AND') { where(e.a); where(e.b); return; }
    if (e.k === 'exists') { add(e.p); return; }
    if (e.k === 'not' && e.a.k === 'exists') {
      const p = e.a.p;
      if (p.nodes.length === 2 && p.rels[0]?.types[0] && p.nodes[0].v && !p.nodes[1].v) sh.unlink.push({ v: p.nodes[0].v, type: p.rels[0].types[0], dir: p.rels[0].dir === 'in' ? 'in' : 'out' });
      return;
    }
    if (e.k !== 'bin') return;
    const a = propOf(e.a), b = propOf(e.b);
    if (e.op === '=' && a && e.b.k === 'lit' && sh.vars[a[0]]) sh.vars[a[0]].props[a[1]] = e.b.v;
    else if (e.op === 'IN' && a && e.b.k === 'list' && e.b.items[0]?.k === 'lit' && sh.vars[a[0]]) sh.vars[a[0]].props[a[1]] = (e.b.items[0] as { v: unknown }).v;
    else if (a && b && ['<', '<=', '>', '>='].includes(e.op)) sh.before.push(e.op.startsWith('<') ? { a, b } : { a: b, b: a });
  };
  for (const part of q.parts) for (const c of part) {
    if (c.k === 'match') { c.patterns.forEach(add); where(c.where); }
    else if ((c.k === 'with' || c.k === 'return') && c.where) where(c.where);
  }
  return sh;
}
