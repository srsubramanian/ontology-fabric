// Checks stage 5 offline: what the team decided reaches Claude's prompt and the proposal it bears on, the person's own
// notes reach the prompt, a tutor's reply keeps its rules and questions (and drops a malformed question), and a
// person's private history stays small. tools/test_studio.py runs it. Run by hand with:
// node --experimental-strip-types web/scripts/check-memory.ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { emptyDraft } from '../src/studio/draft.ts';
import type { Ctx } from '../src/studio/edits.ts';
import { inquiryPrompt, settle, type Asker } from '../src/studio/inquiry.ts';
import { entriesOf, memoryPrompt, recallTool, relevant, trimMine, type Memory } from '../src/studio/memory.ts';

const root = new URL('../../', import.meta.url);
const read = (name: string) => parse(readFileSync(new URL(name, root), 'utf8'));
const base = read('ontology/payments.yaml'), questions = read('ontology/competency-questions.yaml');
const { question, reply } = JSON.parse(readFileSync(new URL('tools/fixtures/studio_ask.json', root), 'utf8'));
const ctx: Ctx = { draft: emptyDraft('check', base.version), base, questions };

let failed = 0;
const expect = (ok: boolean, label: string, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`); if (!ok) failed++; };

const day = 86_400_000, t = Date.parse('2026-09-20T10:00:00Z');
const mem = (state: Memory['state'], kind: Memory['kind'], name: string, title: string, q: string, reason: string | null, at: number): Memory =>
  ({ state, kind, name, title, question: q, reason, by: 'u_ana', at });
const team = entriesOf([
  { entries: { a1: mem('rejected', 'class', 'PayoutAccount', 'Add class PayoutAccount', 'Where is each merchant paid?', 'We call it the settlement account', t) } },
  { entries: { a2: mem('accepted', 'enum', 'FraudType', 'Add list FraudType', 'Which fraud types rose last month?', null, t - 3 * day), a3: null } },
]);
expect(team.length === 2 && team[0][0] === 'a1', 'team memory reads newest first and skips forgotten entries', team.map(([id]) => id).join(', '));
const near = relevant(team, question);
expect(near.length === 1 && near[0][1].name === 'PayoutAccount', 'only the payout decision bears on the payout question', near.map(([, m]) => m.name).join(', '));

const who: Asker = { level: 'copilot', team, prefs: { about: 'I run chargeback operations; explain modelling words.' } };
const settled = settle(ctx, question, reply, who);
const p1 = Object.values(settled.proposals ?? {}).find((p) => p.name === 'PayoutAccount');
expect(p1?.recalled?.state === 'rejected' && p1.recalled.reason === 'We call it the settlement account', 'a proposal the team rejected before says so, with the reason', JSON.stringify(p1?.recalled));
expect(!Object.values(settled.proposals ?? {}).some((p) => p.name !== 'PayoutAccount' && p.recalled), 'and no other proposal claims a past decision');
expect(settled.level === 'copilot', 'the inquiry keeps the setting it was asked with');

const prompt = inquiryPrompt(ctx, question, true, undefined, undefined, who);
expect(prompt.includes('We call it the settlement account') && prompt.includes('I run chargeback operations'), 'the prompt carries the team\'s reason and the person\'s own notes');
expect(prompt.includes('recall for what the team decided') && !prompt.includes('"quiz"'), 'co-pilot offers recall and asks for no quiz');
const tutor = inquiryPrompt(ctx, question, true, undefined, undefined, { ...who, level: 'tutor' });
expect(tutor.includes('"quiz"') && tutor.includes('"teach"'), 'tutor asks for a rule and a question on each proposal');
expect(!memoryPrompt([], null, question), 'with no memory, the prompt adds nothing');

// A tutor's reply: rules and questions are kept; a question with two right answers is dropped.
const quiz = { question: 'Why a class, not a field on Merchant?', choices: [{ label: 'Several merchants can share one account', right: true, why: 'Shared things are nodes.' }, { label: 'Fields are slower', right: false, why: 'Speed isn\'t the reason.' }] };
const taught = { ...reply, ops: reply.ops.map((o: Record<string, unknown>, i: number) => ({ ...o, teach: 'Make it a node when things link to it.', quiz: i === 1 ? { ...quiz, choices: quiz.choices.map((c) => ({ ...c, right: true })) } : quiz })) };
const t2 = settle(ctx, question, taught, { ...who, level: 'tutor' });
expect(t2.proposals?.p1?.quiz?.choices.length === 2 && t2.proposals?.p1?.teach === 'Make it a node when things link to it.', 'a tutor\'s proposal keeps its rule and question');
expect(!t2.proposals?.p2?.quiz && !!t2.proposals?.p2?.teach, 'a question with two right answers is dropped, the rule kept');

const tool = recallTool(() => team, () => undefined);
const hits = tool.execute({ text: 'PayoutAccount' }, { signal: new AbortController().signal }) as { reason: string }[];
expect(Array.isArray(hits) && hits[0]?.reason === 'We call it the settlement account', 'recall finds the decision by name');

const many = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`x${i}`, mem('accepted', 'class', `C${i}`, `Add class C${i}`, 'q', null, t + i)]));
const trimmed = trimMine(null, many);
const kept = Object.values(trimmed).filter(Boolean) as Memory[];
expect(kept.length === 60 && Object.values(trimmed).filter((v) => v === null).length === 10 && kept.every((m) => m.at >= t + 10), 'a person\'s history keeps their newest 60 decisions');

process.exit(failed ? 1 : 0);
