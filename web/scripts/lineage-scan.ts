// The deep scan's bookkeeping (decision 26). Claude Code reads a screen's code on someone's desktop and writes down what
// it found: each field's hops back to Snowflake, with the code that does each one, and what each field and column
// means. This script checks every hop against the code itself and the SQL with sqlglot (tools/lineage_sql.py), then
// writes the next version of the mapping set, keeping the one before in history/. A person's decision on a field is
// carried forward while the field is built the same way; when its code changes, the field takes Claude's new mapping
// and the studio shows it as a re-check. The same code and the same findings always write the same file.
//
//   node --experimental-strip-types web/scripts/lineage-scan.ts scan --sources <sources.yaml> --answer <scan.json>
//   node --experimental-strip-types web/scripts/lineage-scan.ts decide --set <name> --decisions <decisions.json>
//
// scan options: --mappings <dir> (default ontology/mappings), --date <yyyy-mm-dd> (default today), --read
// ui=<commit>,be=<commit>,api=<commit>,sf=<day> (instead of asking git and the sources file), --dry-run (check only),
// --json (a summary on stdout). decide applies people's accept and reject decisions to the current version, the way the
// studio's pull request writes them. The lineage-scan skill (.claude/skills/lineage-scan/SKILL.md) runs both, and
// tools/test_lineage_scan.py runs them on the made-up repositories in examples/lineage/.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildModel } from '../src/explorer/model.ts';
import { buildLineage, CHANGES, compareLineage, LAYERS, parseSssom, tally, TRANSFORMS, type Change, type Layer, type Lineage, type Row, type Transform } from '../src/studio/lineage.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [cmd, ...args] = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name: string) => args.includes('--' + name);

const problems: string[] = [];
const warnings: string[] = [];

const DERIVED = 'prov:wasDerivedFrom';
const TOOL = 'Claude Code deep scan';
const COLUMNS = ['subject_id', 'subject_label', 'predicate_id', 'predicate_modifier', 'object_id', 'object_label', 'mapping_justification', 'author_id',
  'reviewer_id', 'confidence', 'mapping_tool', 'comment', 'subject_source', 'subject_source_version', 'transform', 'transform_note', 'location', 'code'];
const EXTENSIONS = ['transform', 'transform_note', 'location', 'code', 'competency_question']
  .map((slot_name) => ({ slot_name, property: `https://example.com/fabric/${slot_name}` }));
const PREDICATES = ['skos:exactMatch', 'skos:closeMatch', 'skos:relatedMatch', 'skos:narrowMatch', 'skos:broadMatch'];
const PREV: Record<Layer, Layer | null> = { ui: null, be: 'ui', api: 'be', sf: 'api' };
const KEYS_ONLY: Transform[] = ['lookup', 'join', 'filter'];

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const layerOf = (id: string): Layer | null => { const p = id.split(':')[0]; return (['ui', 'be', 'api', 'sf'] as string[]).includes(p) ? p as Layer : null; };
const lastName = (id: string) => id.split(/[.:]/).pop()!.replace(/\[\]$/, '');
const num = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const laneLabel = (l: Layer) => LAYERS.find((x) => x.id === l)!.label;

// ---------- reading the sources ----------

type Repo = { name: string; path: string; graphql_schema?: string };
type Sources = { set: string; repos: Record<'ui' | 'be' | 'api', Repo>; snowflake: { database: string; columns: string; exported?: string } };
type Read = Record<Layer, { source: string; at: string }>;

function loadSources(file: string): Sources {
  const s = parse(readFileSync(file, 'utf8')) as Sources;
  const base = dirname(resolve(file));
  for (const l of ['ui', 'be', 'api'] as const) {
    if (!s.repos?.[l]?.path) throw new Error(`${file} names no ${l} repository (repos.${l}.path)`);
    s.repos[l].path = resolve(base, s.repos[l].path);
  }
  s.snowflake.columns = resolve(base, s.snowflake.columns);
  return s;
}

/** Which commit each repository is at, and the day Snowflake's columns were exported: what this version read. */
function readOf(s: Sources): Read {
  const given = Object.fromEntries((opt('read') ?? '').split(',').filter(Boolean).map((kv) => kv.split('=')));
  const commit = (l: 'ui' | 'be' | 'api') => {
    if (given[l]) return given[l];
    try { return execFileSync('git', ['-C', s.repos[l].path, 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { problems.push(`Can't tell which commit ${s.repos[l].path} is at. Is it a git repository? Or pass --read ${l}=<commit>.`); return 'unknown'; }
  };
  const day = given.sf ?? s.snowflake.exported;
  if (!day) problems.push('Say which day Snowflake\'s columns were exported: snowflake.exported in the sources file, or --read sf=<yyyy-mm-dd>.');
  return {
    ui: { source: `repo:${s.repos.ui.name}`, at: commit('ui') }, be: { source: `repo:${s.repos.be.name}`, at: commit('be') },
    api: { source: `repo:${s.repos.api.name}`, at: commit('api') }, sf: { source: `snowflake:${s.snowflake.database}`, at: String(day ?? 'unknown') },
  };
}

function csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some(Boolean));
}

/** Snowflake's columns, from an export of INFORMATION_SCHEMA.COLUMNS: SCHEMA.TABLE.COLUMN. */
function snowflakeColumns(file: string): Set<string> {
  const [head, ...rows] = csv(readFileSync(file, 'utf8'));
  const at = (n: string) => head.findIndex((h) => h.trim().toUpperCase() === n);
  const [s, t, c] = [at('TABLE_SCHEMA'), at('TABLE_NAME'), at('COLUMN_NAME')];
  if (s < 0 || t < 0 || c < 0) throw new Error(`${file} needs TABLE_SCHEMA, TABLE_NAME and COLUMN_NAME columns`);
  return new Set(rows.map((r) => `${r[s]}.${r[t]}.${r[c]}`.toUpperCase()));
}

/** A GraphQL schema's object types and each field's type. */
function graphqlTypes(text: string): Map<string, Map<string, string>> {
  const types = new Map<string, Map<string, string>>();
  for (const m of text.replace(/#.*$/gm, '').matchAll(/\b(?:type|interface|input)\s+(\w+)[^{]*\{([^}]*)\}/g)) {
    types.set(m[1], new Map([...m[2].matchAll(/(\w+)\s*(?:\([^)]*\))?\s*:\s*\[?\s*(\w+)/g)].map((f) => [f[1], f[2]])));
  }
  return types;
}

function codeFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules', 'target', 'build', 'dist'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) codeFiles(p, out); else out.push(p);
  }
  return out;
}

// ---------- the answer: what Claude Code found ----------

type Means = { slot: string | null; predicate?: string; confidence: number; comment?: string };
type AnswerHop = { from?: string; to: string; label: string; transform: Transform; note: string; at: string; code: string };
type AnswerField = { field: string; label: string; hops: AnswerHop[]; means?: Means };
type Answer = {
  set: string; fields: AnswerField[]; columns?: ({ column: string; label?: string } & Means)[];
  /** For a set's first scan: what the set is. Later scans keep the version before's. */
  metadata?: { id: string; title: string; description: string; license: string; competency_question?: string; curie_map: Record<string, string> };
};
type Hop = Required<AnswerHop> & { field: string };

const files = new Map<string, string[] | null>();
const lines = (p: string) => { if (!files.has(p)) files.set(p, existsSync(p) ? readFileSync(p, 'utf8').split(/\r?\n/) : null); return files.get(p)!; };

/** Every hop checked against the code it names; the SQL ones checked again with sqlglot. */
function checkHops(src: Sources, answer: Answer): Hop[] {
  const columns = snowflakeColumns(src.snowflake.columns);
  const schemaFile = src.repos.api.graphql_schema ? resolve(src.repos.api.path, src.repos.api.graphql_schema) : null;
  const types = schemaFile && existsSync(schemaFile) ? graphqlTypes(readFileSync(schemaFile, 'utf8')) : null;
  if (!types) warnings.push('The data API\'s GraphQL schema isn\'t named (repos.api.graphql_schema), so its fields aren\'t checked.');
  const beFiles = codeFiles(src.repos.be.path).filter((p) => /\.(java|kt)$/.test(p));
  const repoOf = (l: Layer) => (l === 'ui' ? src.repos.ui : l === 'be' ? src.repos.be : src.repos.api);

  const known = new Set<string>();
  const checkId = (id: string) => {
    if (known.has(id)) return;
    known.add(id);
    const l = layerOf(id), [, path = ''] = id.split(/:(.*)/);
    if (!l) { problems.push(`${id}: an id starts with ui:, be:, api: or sf:`); return; }
    if (l === 'sf' && !columns.has(path.toUpperCase())) problems.push(`${id} isn't in the Snowflake export (${src.snowflake.columns.split('/').pop()})`);
    if (l === 'api' && types) {
      const [type, ...rest] = path.split('.');
      let t: string | undefined = type;
      for (const f of rest.map((x) => x.replace(/\[\]$/, ''))) t = t && types.get(t)?.get(f);
      if (!t || !types.has(type)) problems.push(`${id} isn't in the data API's schema`);
    }
    if (l === 'be') {
      const [cls, field] = path.split('.');
      const file = beFiles.find((p) => new RegExp(`\\b(class|record|interface)\\s+${cls}\\b`).test(readFileSync(p, 'utf8')));
      if (!file) problems.push(`${id}: no class ${cls} in the backend`);
      else if (!new RegExp(`\\b${field}\\b`).test(readFileSync(file, 'utf8'))) problems.push(`${id}: ${cls} doesn't declare ${field}`);
    }
  };

  const hops: Hop[] = [];
  const seen = new Map<string, Hop>();
  for (const f of answer.fields) {
    if (layerOf(f.field) !== 'ui') { problems.push(`${f.field}: a screen field's id starts with ui:`); continue; }
    const mine: Hop[] = [];
    for (const h of f.hops) {
      const lt = layerOf(h.to);
      if (!lt || lt === 'ui') { problems.push(`${f.label}: a hop goes to a backend, data API or Snowflake id, not ${h.to}`); continue; }
      // A hop comes from the field, or the latest hop that reached the layer before; name it when that's not it.
      const from = h.from ?? (PREV[lt] === 'ui' ? f.field : [...mine].reverse().find((x) => layerOf(x.to) === PREV[lt])?.to);
      if (!from || layerOf(from) !== PREV[lt]) { problems.push(`${f.label}: the hop to ${h.to} has no ${PREV[lt] ? laneLabel(PREV[lt]!) : ''} field to come from`); continue; }
      if (!(h.transform in TRANSFORMS)) problems.push(`${f.label}: "${h.transform}" isn't a transform (${Object.keys(TRANSFORMS).join(', ')})`);
      const hop: Hop = { ...h, from, field: f.field };
      mine.push(hop);
      checkId(from); checkId(h.to);
      // The code is on the line the hop names, in the repository of the layer the hop is in.
      const m = /^(.+):(\d+)$/.exec(h.at ?? '');
      const repo = repoOf(layerOf(from)!);
      const text = m ? lines(resolve(repo.path, m[1])) : null;
      const line = text?.[Number(m![2]) - 1];
      if (!m) problems.push(`${f.label}: say where the hop to ${h.to} happens, as path:line`);
      else if (!text) problems.push(`${f.label}: ${m[1]} isn't in ${repo.name}`);
      else if (line === undefined || !norm(line).includes(norm(h.code))) problems.push(`${f.label}: "${h.code}" isn't on ${repo.name}/${h.at}`);
      else if (lt !== 'sf' && !line.toLowerCase().includes(lastName(h.to).toLowerCase())) problems.push(`${f.label}: ${repo.name}/${h.at} doesn't mention ${lastName(h.to)}`);
      const key = `${from}>${h.to}`, was = seen.get(key);
      if (was && (was.transform !== h.transform || was.at !== h.at || norm(was.code) !== norm(h.code))) problems.push(`${f.label}: the hop ${key} is told two ways`);
      if (!was) { seen.set(key, hop); hops.push(hop); }
    }
    if (!mine.some((x) => layerOf(x.to) === 'sf')) problems.push(`${f.label}: its hops don't reach Snowflake`);
  }
  checkSql(src, hops.filter((h) => layerOf(h.to) === 'sf'));
  return hops;
}

/** The SQL around each Snowflake hop, read by sqlglot: the hop's column must be one the SQL reads, and for a value the
 *  column it's built from. A column sqlglot finds that no hop names is reported too. */
function checkSql(src: Sources, hops: Hop[]) {
  type Stmt = { sql: string; hops: Hop[] };
  const stmts = new Map<string, Stmt>();
  for (const h of hops) {
    const [path, n] = [h.at.replace(/:\d+$/, ''), Number(h.at.split(':').pop())];
    const text = lines(resolve(src.repos.api.path, path));
    if (!text) continue;
    let a = n - 1, b = n - 1;
    if (path.endsWith('.sql')) { a = 0; b = text.length; }
    else {
      while (a >= 0 && !text[a].includes('"""')) a--;
      while (b < text.length && !(b > a && text[b].includes('"""'))) b++;
      if (a < 0 || b >= text.length) { warnings.push(`${h.at}: no SQL text block around it, so sqlglot didn't check it`); continue; }
    }
    const key = `${path}:${a}`;
    if (!stmts.has(key)) stmts.set(key, { sql: text.slice(a + (path.endsWith('.sql') ? 0 : 1), b).join('\n'), hops: [] });
    stmts.get(key)!.hops.push(h);
  }
  if (!stmts.size) return;
  const python = process.env.LINEAGE_PYTHON ?? (existsSync(join(ROOT, '.venv/bin/python')) ? join(ROOT, '.venv/bin/python') : 'python3');
  const list = [...stmts.values()];
  const run = spawnSync(python, [join(ROOT, 'tools/lineage_sql.py')], { input: JSON.stringify(list.map((s) => ({ sql: s.sql }))), encoding: 'utf8' });
  if (run.status !== 0) {
    const why = (run.stderr || String(run.error ?? '')).trim().split('\n').pop();
    (flag('require-sql-check') ? problems : warnings).push(`The SQL wasn't checked: ${why}. Install sqlglot (pip install -r tools/requirements.txt).`);
    return;
  }
  const out = JSON.parse(run.stdout) as ({ outputs: Record<string, string[]>; referenced: string[] } | { error: string })[];
  list.forEach((s, i) => {
    const r = out[i];
    if ('error' in r) { warnings.push(`${s.hops[0].at}: sqlglot couldn't read the SQL there (${r.error})`); return; }
    const claimed = new Map<string, Set<string>>();
    for (const h of s.hops) {
      const col = h.to.slice(3).toUpperCase();
      const lineText = lines(resolve(src.repos.api.path, h.at.replace(/:\d+$/, '')))![Number(h.at.split(':').pop()) - 1];
      const alias = /\bAS\s+"?(\w+)"?\s*,?\s*(--.*)?$/i.exec(norm(h.code))?.[1] ?? /\bAS\s+"?(\w+)"?\s*,?\s*(--.*)?$/i.exec(norm(lineText))?.[1];
      const built = alias ? r.outputs[alias.toUpperCase()] : undefined;
      if (!r.referenced.includes(col) && !Object.values(r.outputs).some((c) => c.includes(col))) {
        problems.push(`${h.at}: the SQL there doesn't read ${col}`);
        continue;
      }
      if (built && !built.includes(col) && !KEYS_ONLY.includes(h.transform)) warnings.push(`${h.at}: sqlglot builds ${alias} from ${built.join(', ') || 'no column'}, not ${col}`);
      // A lookup names the key it looks up by; the value it returns comes from the reference table, so don't count it.
      if (alias && !KEYS_ONLY.includes(h.transform)) { const k = `${h.from}|${alias.toUpperCase()}`; claimed.set(k, (claimed.get(k) ?? new Set()).add(col)); }
    }
    for (const [k, cols] of claimed) {
      const [from, alias] = k.split('|');
      const missed = (r.outputs[alias] ?? []).filter((c) => !cols.has(c));
      if (missed.length) warnings.push(`${from}: sqlglot also builds ${alias} from ${missed.join(', ')}, which no hop names`);
    }
  });
}

// ---------- writing a mapping set ----------

type Meta = Record<string, unknown>;

function scalar(v: unknown): string {
  const s = String(v);
  return s && !/: |\s#|^[\s'"&*!|>%@`{[\]-]|\s$/.test(s) ? s : JSON.stringify(s);
}
function yaml(key: string, v: unknown, pad = ''): string[] {
  if (Array.isArray(v)) return [`${pad}${key}:`, ...v.flatMap((x) => (typeof x === 'object' && x
    ? Object.entries(x).map(([k, y], i) => `${pad}  ${i ? ' ' : '-'} ${k}: ${scalar(y)}`) : [`${pad}  - ${scalar(x)}`]))];
  if (v && typeof v === 'object') return [`${pad}${key}:`, ...Object.entries(v).flatMap(([k, y]) => yaml(k, y, pad + '  '))];
  return [`${pad}${key}: ${scalar(v)}`];
}
const ORDER = ['mapping_set_id', 'mapping_set_version', 'publication_date', 'mapping_set_source', 'mapping_set_title', 'mapping_set_description', 'license',
  'competency_question', 'curie_map', 'extension_definitions'];

function serialize(meta: Meta, rows: Row[]): string {
  const keys = [...ORDER.filter((k) => meta[k] !== undefined && meta[k] !== null), ...Object.keys(meta).filter((k) => !ORDER.includes(k))];
  const cols = COLUMNS.filter((c) => c !== 'predicate_modifier' || rows.some((r) => r.predicate_modifier));
  const clean = (s: string | undefined) => (s ?? '').replace(/[\t\r\n]+/g, ' ');
  return [...keys.flatMap((k) => yaml(k, meta[k])).map((l) => '#' + l), cols.join('\t'), ...rows.map((r) => cols.map((c) => clean(r[c])).join('\t'))].join('\n') + '\n';
}

const meansRow = (subject: string, label: string, m: Means, read: Read): Row => ({
  subject_id: subject, subject_label: label, predicate_id: m.predicate ?? 'skos:exactMatch', object_id: m.slot ? `fabric:${m.slot}` : 'sssom:NoTermFound',
  object_label: m.slot ?? '', mapping_justification: 'semapv:SemanticSimilarityThresholdMatching', author_id: 'agent:claude', reviewer_id: '',
  confidence: num(m.confidence), mapping_tool: TOOL, comment: m.comment ?? '', subject_source: read[layerOf(subject)!].source,
  subject_source_version: read[layerOf(subject)!].at, transform: '', transform_note: '', location: '', code: '',
});

function scan() {
  const sourcesFile = opt('sources'), answerFile = opt('answer');
  if (!sourcesFile || !answerFile) throw new Error('scan needs --sources <sources.yaml> and --answer <scan.json>');
  const src = loadSources(sourcesFile);
  const answer = JSON.parse(readFileSync(answerFile, 'utf8')) as Answer;
  if (answer.set !== src.set) problems.push(`The answer is for ${answer.set}, the sources for ${src.set}`);
  const mappings = resolve(opt('mappings') ?? join(ROOT, 'ontology/mappings'));
  const current = join(mappings, `${src.set}.sssom.tsv`);
  const priorText = existsSync(current) ? readFileSync(current, 'utf8') : null;
  const prior = priorText ? parseSssom(priorText) : null;
  const priorL = priorText ? buildLineage(priorText) : null;
  const read = readOf(src);
  const hops = checkHops(src, answer);

  // What each field and column means: a person's decision, carried while the field is built the same way, or Claude's.
  const model = buildModel(parse(readFileSync(join(ROOT, 'ontology/payments.yaml'), 'utf8')), parse(readFileSync(join(ROOT, 'ontology/competency-questions.yaml'), 'utf8')));
  const slotKnown = (slot: string) => { const [c, s] = slot.split('.'); return !!model.classes[c] && (!s || model.classes[c].slots.some((x) => x.name === s)); };
  const checkMeans = (who: string, m: Means | undefined) => {
    if (!m) return;
    if (m.slot && !slotKnown(m.slot)) problems.push(`${who}: ${m.slot} isn't in the ontology`);
    if (m.predicate && !PREDICATES.includes(m.predicate)) problems.push(`${who}: ${m.predicate} isn't one of ${PREDICATES.join(', ')}`);
    if (!(m.confidence >= 0 && m.confidence <= 1)) problems.push(`${who}: confidence is between 0 and 1`);
  };
  const labels = new Map<string, string>();
  for (const f of answer.fields) { labels.set(f.field, f.label); for (const h of f.hops) labels.set(h.to, h.label); }
  for (const c of answer.columns ?? []) if (c.label) labels.set(c.column, labels.get(c.column) ?? c.label);
  const hopRow = (h: Hop): Row => ({
    subject_id: h.from, subject_label: labels.get(h.from) ?? lastName(h.from), predicate_id: DERIVED, object_id: h.to, object_label: h.label,
    mapping_justification: 'semapv:UnspecifiedMatching', author_id: 'agent:claude-code', reviewer_id: '', confidence: '1.0', mapping_tool: TOOL, comment: '',
    subject_source: read[layerOf(h.from)!].source, subject_source_version: read[layerOf(h.from)!].at, transform: h.transform, transform_note: h.note,
    location: h.at, code: norm(h.code),
  });
  const meta: Meta = prior ? { ...prior.meta } : answer.metadata ? {
    mapping_set_id: answer.metadata.id, mapping_set_title: answer.metadata.title, mapping_set_description: answer.metadata.description,
    license: answer.metadata.license, competency_question: answer.metadata.competency_question, curie_map: answer.metadata.curie_map, extension_definitions: EXTENSIONS,
  } : {};
  if (!meta.mapping_set_id) problems.push('A set\'s first scan says what the set is: metadata with id, title, description, licence and curie_map.');

  const hopsOnly = serialize(meta, hops.map(hopRow));
  const now = buildLineage(hopsOnly);
  const priorRows = (subject: string) => (prior?.rows ?? []).filter((r) => r.subject_id === subject && r.predicate_id !== DERIVED)
    .map((r) => ({ ...r, subject_source: read[layerOf(subject)!].source, subject_source_version: read[layerOf(subject)!].at }));
  const out: Row[] = [];
  const placed = new Set<string>();
  const needs: string[] = [];
  for (const f of answer.fields) {
    const trace = now.traces.find((t) => t.field.id === f.field);
    const ordered = LAYERS.flatMap((l) => (trace?.hops ?? []).filter((h) => layerOf(h.from) === l.id));
    for (const h of ordered) { const k = `${h.from}>${h.to}`; if (!placed.has(k)) { placed.add(k); out.push(hopRow(hops.find((x) => `${x.from}>${x.to}` === k)!)); } }
    const was = priorL?.traces.find((t) => t.field.id === f.field);
    const keep = was && trace && was.fingerprint === trace.fingerprint ? priorRows(f.field) : [];
    checkMeans(f.label, f.means);
    if (keep.length) out.push(...keep);
    else if (f.means) out.push(meansRow(f.field, f.label, f.means, read));
    else needs.push(`${f.label} (${f.field})`);
    for (const col of trace?.lanes.sf ?? []) {
      if (placed.has(col.id)) continue;
      placed.add(col.id);
      const kept = priorRows(col.id);
      const said = (answer.columns ?? []).find((c) => c.column === col.id);
      checkMeans(col.id, said);
      if (kept.length) out.push(...kept);
      else if (said) out.push(meansRow(col.id, labels.get(col.id) ?? lastName(col.id), said, read));
      else needs.push(col.id);
    }
  }
  if (needs.length) problems.push(`New, or built differently since ${prior?.meta.mapping_set_version ?? 'the last version'}, so say what each means: ${needs.join(', ')}`);

  const priorVersion = prior ? String(prior.meta.mapping_set_version ?? 'v0') : null;
  const version = priorVersion ? `v${Number(/\d+/.exec(priorVersion)?.[0] ?? 0) + 1}` : 'v1';
  const id = String(meta.mapping_set_id ?? '');
  meta.mapping_set_version = version;
  meta.publication_date = opt('date') ?? new Date().toISOString().slice(0, 10);
  if (priorVersion) meta.mapping_set_source = [id.replace(/([^/]+)\.sssom\.tsv$/, (_, n) => `history/${n}.${priorVersion}.sssom.tsv`)];
  else delete meta.mapping_set_source;
  const text = serialize(meta, out);

  const next = buildLineage(text, {}, priorL);
  const diff = priorL ? compareLineage(priorL, next) : null;
  const summary = {
    set: src.set, version, from: priorVersion, date: meta.publication_date, read, fields: next.traces.length, states: tally(next.traces),
    counts: diff?.count ?? null, lines: diff?.lines ?? 0,
    changes: diff ? diff.fields.filter((f) => f.kinds.length).map((f) => ({ field: f.field.label, kinds: f.kinds })) : [],
    problems, warnings, written: false,
  };
  if (!problems.length && !flag('dry-run')) {
    if (priorText) {
      const kept = join(mappings, 'history', `${src.set}.${priorVersion}.sssom.tsv`);
      if (existsSync(kept) && readFileSync(kept, 'utf8') !== priorText) problems.push(`history/${src.set}.${priorVersion}.sssom.tsv is already there, and differs`);
      else { mkdirSync(dirname(kept), { recursive: true }); writeFileSync(kept, priorText); }
    }
    if (!problems.length) { writeFileSync(current, text); summary.written = true; }
  }
  report(summary, next, diff);
}

function report(s: { set: string; version: string; from: string | null; date: unknown; fields: number; states: Record<string, number>; lines: number;
  changes: { field: string; kinds: Change[] }[]; written: boolean }, l: Lineage, diff: ReturnType<typeof compareLineage> | null) {
  if (flag('json')) { console.log(JSON.stringify(s, null, 1)); }
  else {
    for (const p of problems) console.log(`FAIL ${p}`);
    for (const w of warnings) console.log(`note ${w}`);
    console.log(`${s.set} ${s.version}${s.from ? `, from ${s.from}` : ', the first scan'}, ${s.date}: ${s.fields} screen fields`);
    if (diff) {
      for (const c of CHANGES) {
        const names = diff.fields.filter((f) => f.kinds.includes(c) && (c !== 'moved' || f.kinds.length === 1)).map((f) => f.field.label);
        if (names.length && c !== 'moved') console.log(`  ${c}: ${names.join(', ')}`);
      }
      if (diff.lines) console.log(`  code moved in ${diff.lines} places; a decision holds through that`);
      if (!diff.fields.some((f) => f.kinds.some((k) => k !== 'moved'))) console.log('  nothing that bears on a meaning changed');
    }
    const waiting = l.traces.filter((t) => ['proposed', 'review', 'recheck', 'shift', 'gap'].includes(t.state));
    if (waiting.length) console.log(`For people to look at in the studio: ${waiting.map((t) => `${t.field.label} (${t.state})`).join(', ')}`);
    console.log(problems.length ? 'Nothing written.' : s.written ? `Wrote ${s.set}.sssom.tsv${s.from ? `; ${s.from} kept in history/` : ''}.` : 'Checked; nothing written (--dry-run).');
  }
  process.exit(problems.length ? 1 : 0);
}

/** People's decisions, written into the current version: an accept names its reviewer, a reject negates the mapping.
 *  A decision made on an older version than the file's is skipped, since a scan has changed the file since. */
function decide() {
  const set = opt('set'), file = opt('decisions');
  if (!set || !file) throw new Error('decide needs --set <name> and --decisions <decisions.json>');
  const current = join(resolve(opt('mappings') ?? join(ROOT, 'ontology/mappings')), `${set}.sssom.tsv`);
  const { meta, rows } = parseSssom(readFileSync(current, 'utf8'));
  const decisions = JSON.parse(readFileSync(file, 'utf8')) as { key: string; state: 'accepted' | 'rejected'; by: string; reason?: string | null; version?: string | null }[];
  let applied = 0;
  for (const d of decisions) {
    if (d.version && d.version !== meta.mapping_set_version) { warnings.push(`${d.key}: made on ${d.version}, but the file is ${meta.mapping_set_version} now; skipped`); continue; }
    const [subject, slot] = d.key.split('>');
    const object = !slot || slot === 'none' ? 'sssom:NoTermFound' : `fabric:${slot}`;
    const hits = rows.filter((r) => r.subject_id === subject && r.predicate_id !== DERIVED && r.object_id === object);
    if (!hits.length) { problems.push(`${d.key}: no such mapping in ${set} ${meta.mapping_set_version}`); continue; }
    const by = d.by.includes(':') ? d.by : `person:${d.by}`;
    for (const r of hits) {
      r.reviewer_id = by;
      if (d.state === 'rejected') { r.predicate_modifier = 'Not'; r.comment = d.reason ? `Rejected: ${d.reason}` : 'Rejected.'; }
    }
    applied++;
  }
  if (!problems.length) writeFileSync(current, serialize(meta, rows));
  for (const p of problems) console.log(`FAIL ${p}`);
  for (const w of warnings) console.log(`note ${w}`);
  console.log(problems.length ? 'Nothing written.' : `Wrote ${applied} decision${applied === 1 ? '' : 's'} into ${set} ${meta.mapping_set_version}.`);
  process.exit(problems.length ? 1 : 0);
}

try {
  if (cmd === 'scan') scan();
  else if (cmd === 'decide') decide();
  else { console.log('Usage: lineage-scan.ts scan --sources <sources.yaml> --answer <scan.json> | decide --set <name> --decisions <decisions.json>'); process.exit(2); }
} catch (e) {
  console.log(`FAIL ${(e as Error).message}`);
  process.exit(1);
}
