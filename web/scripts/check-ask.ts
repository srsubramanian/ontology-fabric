// Plays the studio's Ask anything path offline, on tools/fixtures/studio_ask.json (the reply tools/test_studio.py's
// stand-in Claude gives): the reply becomes proposals, check_design passes them, and accepting them answers the
// question as a new competency question with every ontology check passing. It also accepts the answer alone after
// rejecting a field, to prove an answer brings in what it needs and nothing it doesn't.
// Run by hand with: node --experimental-strip-types web/scripts/check-ask.ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { analyse } from '../src/studio/analysis.ts';
import { emptyDraft, mergeDraft, type DraftUpdate, type InquiryEdit } from '../src/studio/draft.ts';
import type { Ctx } from '../src/studio/edits.ts';
import { accept, checkDesign, decide, ghosts, pending, settle } from '../src/studio/inquiry.ts';

const root = new URL('../../', import.meta.url);
const read = (name: string) => parse(readFileSync(new URL(name, root), 'utf8'));
const base = read('ontology/payments.yaml'), questions = read('ontology/competency-questions.yaml');
const { question, reply } = JSON.parse(readFileSync(new URL('tools/fixtures/studio_ask.json', root), 'utf8'));
const apply = (c: Ctx, u: DraftUpdate): Ctx => ({ ...c, draft: mergeDraft(c.draft, u as Record<string, unknown>) });
const fresh = (): Ctx => ({ draft: emptyDraft('check', base.version), base, questions });

let failed = 0;
const expect = (ok: boolean, label: string, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`); if (!ok) failed++; };

const check = checkDesign(fresh(), reply, question);
expect(!check.could_not_apply.length && !check.problems.length && /passes/.test(check.answer), 'check_design passes the reply', JSON.stringify(check));

const start = (): [Ctx, InquiryEdit] => {
  const c = fresh();
  const inq = { question, askedAt: 0, ...settle(c, question, reply) } as InquiryEdit;
  return [apply(c, { inquiries: { q1: inq } }), inq];
};
const [c0, inq] = start();
expect(pending(inq).length === 7 && ghosts(inq).has('PayoutAccount') && ghosts(inq).has('PayoutAccountChange.for_merchant'), 'the reply becomes 7 proposals, drawn as ghosts');

const all = apply(c0, accept(c0, 'q1', inq, pending(inq), 'u_test'));
const a = analyse(all.draft, base, questions);
const qid = inq.proposals!.answer.name;
expect(!a.blocking.length, 'accepting everything passes every ontology check', a.blocking.join(' | '));
expect(a.report.coverage.questions === 121 && a.report.coverage.answered === 113, `${qid} is a new question, answered`, `${a.report.coverage.answered} of ${a.report.coverage.questions}`);
expect(!a.tidyUps.length, 'and the map stays tidy', a.tidyUps.join(' | '));

const [c1, inq1] = start();
const field = Object.entries(inq1.proposals!).find(([, p]) => p.name === 'PayoutAccountChange.changed_at')![0];
const c2 = apply(c1, decide('q1', field, 'rejected', 'u_test'));
const inq2 = c2.draft.inquiries!.q1!;
const c3 = apply(c2, accept(c2, 'q1', inq2, ['answer'], 'u_test'));
const b = analyse(c3.draft, base, questions);
const got = Object.keys(c3.draft.slots).sort().join(', ');
expect(!b.blocking.length && b.report.coverage.answered === 113, 'the answer alone brings in what it walks', got);
expect(!c3.draft.slots['PayoutAccountChange:changed_at'] && !c3.draft.slots['PayoutAccountChange:new_account'], 'and leaves out what was rejected or not needed');
process.exit(failed ? 1 : 0);
