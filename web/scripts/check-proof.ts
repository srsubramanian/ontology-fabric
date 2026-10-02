// Proves every competency question with data, offline: each query, openCypher or Snowflake SQL, runs on the sample
// world the studio builds from the ontology, and must run without an error. It reports how many answer with rows.
// Then it plants the test case in tools/fixtures/studio_ask.json on the asked question's design and checks the rows
// it expects. tools/test_studio.py runs it. Run by hand with: node --experimental-strip-types web/scripts/check-proof.ts
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'yaml';
import initSqlJs from 'sql.js';
import { buildModel } from '../src/explorer/model.ts';
import { analyse } from '../src/studio/analysis.ts';
import { emptyDraft, mergeDraft, type DraftUpdate, type InquiryEdit } from '../src/studio/draft.ts';
import type { Ctx } from '../src/studio/edits.ts';
import { accept, pending, settle } from '../src/studio/inquiry.ts';
import { prove } from '../src/studio/proof.ts';
import { cleanScenario, testPrompt } from '../src/studio/testcase.ts';

const root = new URL('../../', import.meta.url);
const read = (name: string) => parse(readFileSync(new URL(name, root), 'utf8'));
const schema = read('ontology/payments.yaml'), questions = read('ontology/competency-questions.yaml');
const model = buildModel(schema, questions);
const require = createRequire(import.meta.url);
const SQL = await initSqlJs({ wasmBinary: readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm')) });

let failed = 0;
const lanes = { cypher: { ran: 0, rows: 0, n: 0 }, sql: { ran: 0, rows: 0, n: 0 } };
const empty: string[] = [];
const only = process.argv[2];
for (const q of model.questions) {
  if (!q.query || (only && q.id !== only)) continue;
  const p = prove(model, schema, { query: q.query, language: q.language }, SQL);
  const l = lanes[q.language]; l.n++;
  if (p.error) { failed++; console.log(`FAIL ${q.id} (${q.language}): ${p.error}`); continue; }
  l.ran++;
  if (p.rows.length) l.rows++; else empty.push(q.id);
  if (only) { console.log(p.params, p.columns); console.table(p.rows.slice(0, 10)); console.log(p.tables); }
}
// The asked question's design, every proposal accepted, proved with the fixture's test case.
const fx = JSON.parse(readFileSync(new URL('tools/fixtures/studio_ask.json', root), 'utf8'));
const c0: Ctx = { draft: emptyDraft('check', schema.version), base: schema, questions };
const inq = { question: fx.question, askedAt: 0, ...settle(c0, fx.question, fx.reply) } as InquiryEdit;
const c1 = { ...c0, draft: mergeDraft(c0.draft, { inquiries: { q1: inq } }) };
const all = { ...c1, draft: mergeDraft(c1.draft, accept(c1, 'q1', inq, pending(inq), 'u_test') as Record<string, unknown>) };
const a = analyse(all.draft, schema, questions);
const qid = inq.proposals!.answer.name, asked = a.report.model!.questions.find((q) => q.id === qid)!;
const expect = (ok: boolean, label: string, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`); if (!ok) failed++; };
const withTest = prove(a.report.model!, a.schema, { query: asked.query, language: asked.language, scenario: cleanScenario(fx.test) }, SQL);
expect(withTest.ok && withTest.checks.length === 4, `${qid}'s test case passes on the sample world`, withTest.checks.filter((c) => !c.ok).map((c) => `${c.label} (${c.detail})`).join(' | ') || withTest.error || '');
const planted = withTest.rows.filter((r) => String(r[0]).startsWith('m:9'));
expect(planted.length === 1, 'and the answer names the planted merchant once, and not its near miss', JSON.stringify(withTest.rows.slice(0, 5)));
// A test case that expects the near miss fails, so the proof can tell a wrong answer from a right one.
const wrong = cleanScenario({ ...fx.test, expect: { include: [{ merchant: '@m2' }] } });
expect(!prove(a.report.model!, a.schema, { query: asked.query, language: asked.language, scenario: wrong }, SQL).ok, 'a test that expects the near miss fails');
const prompt = testPrompt(a.report.model!, a.schema, { id: qid, question: asked.question, query: asked.query, language: asked.language, classes: asked.classes }, true);
expect(prompt.includes('PayoutAccountChange') && prompt.includes('changed_at: datetime') && prompt.includes('try_test'), 'the test prompt describes the new classes and offers try_test');

for (const [k, l] of Object.entries(lanes)) console.log(`${l.ran === l.n ? 'ok  ' : 'FAIL'} ${l.ran} of ${l.n} ${k === 'cypher' ? 'openCypher' : 'Snowflake SQL'} queries run on the sample world; ${l.rows} answer with rows`);
if (empty.length) console.log(`     no rows: ${empty.join(', ')}`);
process.exit(failed ? 1 : 0);
