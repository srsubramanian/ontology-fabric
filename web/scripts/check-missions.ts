// Plays every studio mission's solution, as Do it for me would, and checks it passes the ontology's checks and answers
// its question: each mission on its own, then all of them on one draft. A mission that fails here would leave a
// beginner stuck with a red check they can't fix. The class map's tidy-ups are reported, not failed: the pull
// request's session tidies them, and CI's layout check holds it to that. On its own, each mission should leave none.
// tools/test_studio.py runs it.
// Run by hand with: node --experimental-strip-types web/scripts/check-missions.ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { analyse } from '../src/studio/analysis.ts';
import { emptyDraft, mergeDraft, type DraftUpdate } from '../src/studio/draft.ts';
import type { Ctx } from '../src/studio/edits.ts';
import { MISSIONS, progress, solve } from '../src/studio/missions.ts';

const root = new URL('../../ontology/', import.meta.url);
const read = (name: string) => parse(readFileSync(new URL(name, root), 'utf8'));
const base = read('payments.yaml'), questions = read('competency-questions.yaml');
const apply = (c: Ctx, u: DraftUpdate): Ctx => ({ ...c, draft: mergeDraft(c.draft, u as Record<string, unknown>) });
const fresh = (): Ctx => ({ draft: emptyDraft('check', base.version), base, questions });
const thought = new Set(MISSIONS.flatMap((m) => m.steps.map((_, i) => `${m.id}:${i}`)));

let failed = 0;
const report = (label: string, c: Ctx, ids: string[], alone: boolean) => {
  const a = analyse(c.draft, base, questions);
  const answered = new Set(a.questions.questions.filter((q) => !q.gap && !a.report.problems.some((p) => p.startsWith(q.id + ':'))).map((q) => q.id));
  const open = ids.filter((id) => !answered.has(id) || progress(MISSIONS.find((m) => m.id === id)!, c, a, thought) < MISSIONS.find((m) => m.id === id)!.steps.length);
  const ok = !a.blocking.length && !open.length && !(alone && a.tidyUps.length);
  if (!ok) failed++;
  const tidy = a.tidyUps.length ? `, ${a.tidyUps.length} map tidy-up${a.tidyUps.length === 1 ? '' : 's'}` : '';
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${a.report.summary[1].split(' (')[0].replace('competency questions the schema answers: ', 'answers ')}${tidy}`);
  for (const p of a.blocking) console.log('       problem:', p);
  for (const p of a.tidyUps) console.log('       tidy-up:', p);
  for (const id of open) console.log('       not answered:', id);
};

for (const m of MISSIONS) report(`${m.id} ${m.title}`, solve(m, fresh(), apply), [m.id], true);
let all = fresh();
for (const m of MISSIONS) all = solve(m, all, apply);
report('every mission on one draft', all, MISSIONS.map((m) => m.id), false);
let back = fresh();
for (const m of [...MISSIONS].reverse()) back = solve(m, back, apply);
report('every mission, last first', back, MISSIONS.map((m) => m.id), false);
process.exit(failed ? 1 : 0);
