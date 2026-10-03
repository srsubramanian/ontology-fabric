// Ask anything: a question in someone's own words becomes a design Claude proposes on the shared draft. Claude reads
// the question, maps its words to the ontology, names what's missing, and proposes the smallest set of edits that
// answers it, checking its own design with the repository's checks first. Each edit is a proposal: drawn as a ghost
// on the map, applied to the draft only when a person accepts it. The question itself becomes a new competency
// question, or answers the open one it matches, so coverage grows with every accepted answer.
import { analyse } from './analysis.ts';
import { mergeDraft, type DraftDoc, type DraftUpdate, type InquiryEdit, type ProposalEdit } from './draft.ts';
import { applyOps, type Ctx, type Op } from './edits.ts';
import { openQuestions, RULES, schemaSummary } from './prompt.ts';
import { memoryPrompt, recalledFor, recallTool, type Level, type Memory, type Prefs } from './memory.ts';
import type { Sample, SampleTool } from './runtime.ts';

export type Understanding = { phrase: string; means: string; maps_to: string | null };
export type Answer = { id?: string; domain?: string; question?: string; answered_in?: string; walks?: string[]; query?: string };
/** What Claude replies with. Nothing in it is trusted: every field is checked before use. */
export type Reply = {
  understanding?: Understanding[]; matches?: string | null; answered?: boolean;
  gap?: string; summary?: string; ops?: (Op & { why?: string; teach?: string; quiz?: unknown })[]; answer?: Answer | null;
};
/** What the person asking brings: how much Claude does for them, and what the team and they decided before. */
export type Asker = { level: Level; team: [string, Memory][]; prefs: Prefs | null };

/** A tutor's question, only when it has a question and two to four choices with exactly one right. */
function cleanQuiz(q: unknown): ProposalEdit['quiz'] {
  const x = q as { question?: unknown; choices?: unknown } | null;
  if (!x || typeof x.question !== 'string' || !Array.isArray(x.choices)) return null;
  const choices = x.choices.slice(0, 4).map((c) => ({ label: text(c?.label, 160), right: c?.right === true, why: text(c?.why, 300) })).filter((c) => c.label);
  return choices.length >= 2 && choices.filter((c) => c.right).length === 1 ? { question: text(x.question, 240), choices } : null;
}

const DOMAINS = ['disputes', 'authorization', 'settlement', 'risk'];
const merge = (a: DraftUpdate, b: DraftUpdate) => mergeDraft(a as DraftDoc, b as Record<string, unknown>) as DraftUpdate;
const withUpdate = (ctx: Ctx, u: DraftUpdate): Ctx => ({ ...ctx, draft: mergeDraft(ctx.draft, u as Record<string, unknown>) });
const text = (v: unknown, max = 400) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
const unique = <T,>(xs: (T | undefined | null)[]) => [...new Set(xs.filter((x): x is T => x != null))];

/** The next free question id, after every id in the released questions and the draft. */
export function nextQuestionId(ctx: Ctx): string {
  const ids = [...ctx.questions.questions.map((q) => q.id), ...Object.keys(ctx.draft.answers ?? {})];
  const top = Math.max(0, ...ids.map((id) => Number(/^CQ-(\d+)$/.exec(id)?.[1] ?? 0)));
  return `CQ-${String(top + 1).padStart(2, '0')}`;
}

/** What one op adds, what it needs that may be new, and how to say it in a few words. */
function describe(op: Op): { kind: ProposalEdit['kind']; name: string; refs: string[]; title: string } {
  switch (op.op) {
    case 'addClass': return { kind: 'class', name: op.name, refs: [op.is_a ?? ''], title: `Add class ${op.name}${op.is_a ? `, a kind of ${op.is_a}` : ''}` };
    case 'addEnum': return { kind: 'enum', name: op.name, refs: [], title: `Add the list ${op.name}: ${Object.keys(op.values ?? {}).slice(0, 5).join(', ')}${Object.keys(op.values ?? {}).length > 5 ? '…' : ''}` };
    case 'addField': return { kind: 'field', name: `${op.class}.${op.name}`, refs: [op.class, op.range], title: `Give ${op.class} a field ${op.name} (${op.range})` };
    case 'addRelationship': return { kind: 'relationship', name: `${op.from}.${op.name}`, refs: [op.from, op.to], title: `Link ${op.from} to ${op.to}: ${op.name.toUpperCase()}` };
    default: return { kind: 'field', name: '?', refs: [], title: 'Unknown edit' };
  }
}

/**
 * Works Claude's reply out on the draft, one edit at a time, each on the draft as the ones before it leave it: the
 * change each makes (with the classes placed and the lines routed), the proposals it needs first, and any edit the
 * studio can't apply, with why. The answer comes last.
 */
export function plan(ctx: Ctx, reply: Reply, asked: string): { proposals: Record<string, ProposalEdit>; order: string[] } {
  let c = ctx;
  const proposals: Record<string, ProposalEdit> = {}, order: string[] = [];
  const made = new Map<string, string>();
  (Array.isArray(reply.ops) ? reply.ops : []).slice(0, 24).forEach((o, i) => {
    if (!o || typeof o !== 'object') return;
    const { why, teach, quiz, ...op } = o;
    const id = `p${i + 1}`;
    const d = describe(op as Op);
    const { update, skipped } = applyOps(c, [op as Op]);
    proposals[id] = {
      title: d.title, why: text(why), kind: d.kind, name: d.name, update: skipped.length ? {} : update,
      needs: unique(d.refs.map((r) => made.get(r))), problem: skipped[0] ?? null, state: 'proposed',
      ...(teach ? { teach: text(teach, 300) } : {}), ...(cleanQuiz(quiz) ? { quiz: cleanQuiz(quiz) } : {}),
    };
    order.push(id);
    if (!skipped.length) { c = withUpdate(c, update); made.set(d.name, id); }
  });
  const a = reply.answer;
  if (a && Array.isArray(a.walks) && a.walks.length && a.query) {
    const target = text(a.id ?? reply.matches, 20);
    const open = ctx.questions.questions.find((q) => q.id === target && q.gap);
    const qid = open ? open.id : nextQuestionId(c);
    const walks = a.walks.slice(0, 12).map((w) => text(w, 80));
    proposals.answer = {
      title: open ? `Answer ${qid}` : `Add it as question ${qid}, with its answer`,
      why: open ? `${qid} asks this already and couldn't be answered.` : 'So it stays answered: the checks run it on every change from now on.',
      kind: 'answer', name: qid,
      update: { answers: { [qid]: {
        answered_in: a.answered_in === 'snowflake' ? 'snowflake' : 'neptune', walks, query: text(a.query, 4000),
        ...(open ? {} : { question: text(a.question || asked, 300), domain: DOMAINS.includes(text(a.domain)) ? text(a.domain) : 'risk' }),
      } } },
      needs: unique(walks.flatMap((w) => [made.get(w), made.get(w.split('.')[0])])), problem: null, state: 'proposed',
    };
    order.push('answer');
  }
  return { proposals, order };
}

const props = (inq: InquiryEdit) => inq.proposals ?? {};
const ordered = (inq: InquiryEdit) => (inq.order ?? Object.keys(props(inq))).filter((id) => props(inq)[id]);

/** Whether a proposal needs one that was rejected, or couldn't be applied, so it can't be accepted. */
export function blockedBy(inq: InquiryEdit, id: string, seen = new Set<string>()): string | null {
  for (const n of props(inq)[id]?.needs ?? []) {
    if (seen.has(n)) continue;
    seen.add(n);
    const p = props(inq)[n];
    if (!p || p.state === 'rejected' || p.problem) return n;
    const deeper = blockedBy(inq, n, seen);
    if (deeper) return deeper;
  }
  return null;
}

/** Proposals still waiting for a decision that could be accepted, in the order they apply. */
export const pending = (inq: InquiryEdit) =>
  ordered(inq).filter((id) => props(inq)[id].state === 'proposed' && !props(inq)[id].problem && !blockedBy(inq, id));

/** The draft as it would be with every pending proposal accepted: what the map draws as ghosts. */
export function previewDraft(d: DraftDoc, inq: InquiryEdit | null | undefined): DraftDoc {
  if (!inq) return d;
  return pending(inq).reduce((acc, id) => mergeDraft(acc, props(inq)[id].update as Record<string, unknown>), d);
}

/** The classes and relationships pending proposals would add: drawn dashed and faint until accepted. */
export function ghosts(inq: InquiryEdit | null | undefined): Set<string> {
  if (!inq) return new Set();
  return new Set(pending(inq).filter((id) => ['class', 'relationship'].includes(props(inq)[id].kind)).map((id) => props(inq)[id].name));
}

/** A proposal and every proposal it needs that's still waiting, in the order they apply. */
function closure(inq: InquiryEdit, id: string): string[] {
  const want = new Set<string>();
  const add = (x: string) => {
    const p = props(inq)[x];
    if (!p || p.state !== 'proposed' || want.has(x)) return;
    want.add(x);
    p.needs.forEach(add);
  };
  add(id);
  return ordered(inq).filter((x) => want.has(x));
}

/**
 * The change that accepts a proposal, with whatever it needs: their edits on the draft, and the decision recorded on
 * the inquiry. A new question takes the next free id if someone used its id since.
 */
export function accept(ctx: Ctx, inqId: string, inq: InquiryEdit, ids: string[], by: string | null): DraftUpdate {
  const all = ordered(inq).filter((x) => ids.some((id) => closure(inq, id).includes(x)));
  let u: DraftUpdate = {};
  const decided: Record<string, Partial<ProposalEdit>> = {};
  for (const id of all) {
    const p = props(inq)[id];
    let up = p.update;
    if (p.kind === 'answer') {
      const entry = up.answers?.[p.name];
      const taken = entry?.question && (ctx.draft.answers[p.name] || ctx.questions.questions.some((q) => q.id === p.name));
      if (taken && entry) {
        const qid = nextQuestionId(withUpdate(ctx, u));
        up = { answers: { [qid]: entry } };
        decided[id] = { name: qid, title: `Add it as question ${qid}, with its answer` };
      }
    }
    u = merge(u, up);
    decided[id] = { ...decided[id], state: 'accepted', decidedBy: by, decidedAt: Date.now() };
  }
  return merge(u, { inquiries: { [inqId]: { proposals: decided as Record<string, ProposalEdit> } } });
}

export const decide = (inqId: string, id: string, state: ProposalEdit['state'], by: string | null): DraftUpdate =>
  ({ inquiries: { [inqId]: { proposals: { [id]: { state, decidedBy: by, decidedAt: Date.now() } as ProposalEdit } } } });

// ---- What Claude can use while it works ----

const STOP = new Set(['which', 'what', 'when', 'where', 'their', 'there', 'that', 'this', 'with', 'from', 'have', 'were', 'they', 'into', 'than', 'then', 'them', 'does', 'most', 'many', 'much', 'each', 'every', 'before', 'after']);
const words = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((w) => !STOP.has(w)).map((w) => w.replace(/(ies|es|s)$/, '')));

/** Competency questions most like a text, by the words they share. */
export function findQuestions(ctx: Ctx, query: string) {
  const want = words(query);
  const a = analyse(ctx.draft, ctx.base, ctx.questions);
  return a.questions.questions
    .map((q) => ({ q, score: [...words(q.question)].filter((w) => want.has(w)).length }))
    .filter((x) => x.score > 0).sort((p, q) => q.score - p.score).slice(0, 5)
    .map(({ q }) => ({ id: q.id, domain: q.domain, question: q.question, answered: !q.gap && !a.report.problems.some((p) => p.startsWith(q.id + ':')), ...(q.gap ? { lacks: q.gap.trim() } : { walks: q.walks }) }));
}

/** One class as the draft leaves it: what it is, its fields, and its relationships both ways. */
export function describeClass(ctx: Ctx, name: string) {
  const model = analyse(ctx.draft, ctx.base, ctx.questions).report.model;
  const c = model?.classes[name];
  if (!model || !c) throw new Error(`No class ${name}. Class names are CamelCase, such as Merchant.`);
  return {
    name, kind_of: c.parent ?? null, abstract: c.abstract, description: c.description, owner: c.owner, lives_in: c.livesIn, id_rule: c.idRule ?? null,
    fields: c.slots.filter((s) => !s.relationship).map((s) => `${s.name}: ${s.range}${s.multivalued ? '*' : ''}`),
    links_out: model.relationships.filter((r) => c.chain.includes(r.from)).map((r) => `${r.from}.${r.slot} (${r.type}) -> ${r.open ? 'any' : r.to}`),
    links_in: model.relationships.filter((r) => r.to === name).map((r) => `${r.from}.${r.slot} (${r.type}) -> ${name}`),
  };
}

/** Runs the repository's checks on a design without applying it: what wouldn't apply, new problems, and the answer. */
export function checkDesign(ctx: Ctx, reply: Reply, asked: string) {
  const { proposals, order } = plan(ctx, reply, asked);
  const before = new Set(analyse(ctx.draft, ctx.base, ctx.questions).blocking);
  const inq: InquiryEdit = { question: asked, askedAt: 0, status: 'proposed', proposals, order };
  const a = analyse(previewDraft(ctx.draft, inq), ctx.base, ctx.questions);
  const qid = proposals.answer?.name;
  const fresh = a.blocking.filter((p) => !before.has(p));
  return {
    could_not_apply: order.filter((id) => proposals[id].problem).map((id) => `${proposals[id].title}: ${proposals[id].problem}`),
    problems: fresh.slice(0, 10),
    answer: !qid ? 'no answer given' : fresh.some((p) => p.startsWith(qid + ':')) ? `${qid} fails: see problems` : `${qid} passes every check`,
    coverage: `${a.report.coverage.answered} of ${a.report.coverage.questions} questions answered`,
  };
}

/** The page functions Claude may call. Each reports what it's doing, so the person can follow along. */
export function inquiryTools(get: () => Ctx, asked: string, step: (s: string) => void, team?: () => [string, Memory][]): SampleTool[] {
  return [
    ...(team && team().length ? [recallTool(team, step)] : []),
    {
      name: 'find_questions',
      description: 'Searches the competency questions for ones like the given text. Returns up to 5, each with its id, domain, text, whether the ontology answers it yet, and its walk or what it lacks. Use it first, to see whether the question is already asked.',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      execute: ({ text: t }) => { step('Looking for a question that already asks this'); return findQuestions(get(), String(t ?? '')); },
    },
    {
      name: 'describe_class',
      description: 'Describes one class as the draft leaves it: its parent, description, owner, where it lives, ID rule, fields, and relationships out of and into it. Use it for any class your design touches.',
      inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      execute: ({ name }) => { step(`Reading ${String(name)}`); return describeClass(get(), String(name ?? '')); },
    },
    {
      name: 'check_design',
      description: 'Runs the repository\'s checks on a design without applying it: the ops you plan to propose and the answer, shaped as in your final reply. Returns ops that couldn\'t be applied and why, the new problems the checks find, whether the answer passes, and the coverage. Call it before your final reply, and fix whatever it reports.',
      inputSchema: { type: 'object', properties: { ops: { type: 'array', items: { type: 'object' } }, answer: { type: 'object' } }, required: ['ops'] },
      execute: ({ ops, answer }) => { step('Checking the design with the repository\'s checks'); return checkDesign(get(), { ops: ops as Reply['ops'], answer: answer as Answer }, asked); },
    },
  ];
}

const SHAPE = `Reply with only a JSON object:
{"understanding": [{"phrase": "<words from the question>", "means": "<what they mean, in payments words>", "maps_to": "<Class, Class.slot or enum it maps to, or null when nothing in the ontology holds it yet>"}],
 "matches": "<the id of a competency question that asks the same thing, or null>",
 "answered": <true when that question is already answered and nothing needs adding>,
 "gap": "<one or two sentences, in business words: what the ontology lacks to answer it; empty when nothing>",
 "summary": "<one sentence: the design you propose>",
 "ops": [<edits, in order, each with a "why": one sentence in business words>],
 "answer": {"id": "<the open question's id when it matches one, else omit>", "domain": "disputes|authorization|settlement|risk", "question": "<the question, tidied as a competency question>", "answered_in": "neptune|snowflake", "walks": ["Class.slot", ...], "query": "<the query, with newlines as \\n>"}}
Each op is one of:
{"op": "addClass", "name": "PayoutAccount", "is_a": null, "description": "...", "owner": "settlement", "lives_in": "graph", "id_rule": "pacct:{account_hash}", "no_standard": "...", "why": "..."}
{"op": "addEnum", "name": "FraudType", "description": "...", "values": {"lost": "Card reported lost"}, "why": "..."}
{"op": "addField", "class": "FraudReport", "name": "fraud_type", "range": "FraudType", "description": "...", "why": "..."}
{"op": "addRelationship", "from": "Merchant", "name": "paid_out_to", "to": "PayoutAccount", "multivalued": false, "description": "...", "why": "..."}
Add only what the question needs, and reuse what the ontology has. Never rename or remove anything. When the question is already answered, return no ops and no answer.`;

const TUTOR = `The person asking set Claude to tutor them: they are learning to model, in payments words. For each op, also add
 "teach": "<one sentence naming the modelling rule behind it, such as: model events, not status fields>",
 "quiz": {"question": "<a question in payments words that checks they see why this is the right design>", "choices": [{"label": "...", "right": true, "why": "<why it's right>"}, {"label": "...", "right": false, "why": "<why not, kindly>"}]}
with two or three choices, exactly one right.`;

export function inquiryPrompt(ctx: Ctx, asked: string, tools: boolean, note?: string, before?: string, who?: Asker): string {
  const a = analyse(ctx.draft, ctx.base, ctx.questions);
  const memory = who ? memoryPrompt(who.team, who.prefs, asked) : '';
  return [
    'You are the design partner in a studio where payments people build a payments ontology, written in LinkML, on a live class map. Someone asked a question in their own words. Work out what the ontology needs to answer it, and propose the smallest design that does, as edits they will accept or reject one by one.',
    '', RULES, '', 'The ontology as it stands, with the team\'s working draft applied:', schemaSummary(a.schema), '',
    'Competency questions it can\'t answer yet:', openQuestions(a.questions) || '- none', '',
    ...(memory ? [memory, ''] : []),
    `Their question: ${asked.trim()}`, '',
    ...(before ? [`Your last proposal: ${before}`, ''] : []),
    ...(note ? [`What they said about it: ${note.trim()}`, ''] : []),
    tools
      ? `Use the tools: find_questions to see whether a competency question asks this already, describe_class for the classes your design touches,${who?.team.length ? ' recall for what the team decided before about them,' : ''} and check_design on your ops and answer before you reply. Fix what check_design reports.`
      : 'Check your design against the rules above before you reply: the studio runs the repository\'s checks on it.',
    '', SHAPE,
    ...(who?.level === 'tutor' ? ['', TUTOR] : []),
  ].join('\n');
}

/** Asks Claude, with the tools where this view can run them, and without where it can't. */
export async function think(sample: Sample, get: () => Ctx, asked: string, o: { signal: AbortSignal; step: (s: string) => void; note?: string; before?: string; who?: Asker }): Promise<Reply> {
  const tools = await sample.limits?.().then((l) => !!l?.tools, () => false) ?? false;
  const ask = (withTools: boolean) => sample.json<Reply>(inquiryPrompt(get(), asked, withTools, o.note, o.before, o.who), {
    signal: o.signal, ...(withTools ? { tools: inquiryTools(get, asked, o.step, o.who ? () => o.who!.team : undefined) } : { cache: false }),
  });
  try { return await ask(tools); } catch (e) {
    if ((e as { code?: string })?.code === 'tools_unavailable') return ask(false);
    throw e;
  }
}

/** Claude's reply, cleaned to what the inquiry keeps, with the proposals worked out on the draft. */
export function settle(ctx: Ctx, asked: string, reply: Reply, who?: Asker): Partial<InquiryEdit> {
  const { proposals, order } = plan(ctx, reply ?? {}, asked);
  // A proposal the team decided on before carries that decision, so people see it where they decide.
  if (who?.team.length) for (const p of Object.values(proposals)) { const r = recalledFor(who.team, p); if (r) p.recalled = r; }
  const matches = text(reply?.matches, 20) || null;
  return {
    status: 'proposed', error: null,
    understanding: (Array.isArray(reply?.understanding) ? reply.understanding : []).slice(0, 12)
      .map((u) => ({ phrase: text(u?.phrase, 80), means: text(u?.means, 200), maps_to: u?.maps_to ? text(u.maps_to, 80) : null })),
    matches: matches && ctx.questions.questions.some((q) => q.id === matches) ? matches : null,
    answered: !!reply?.answered && !order.length,
    gap: text(reply?.gap, 600) || null, summary: text(reply?.summary, 300) || null, proposals, order,
    ...(who ? { level: who.level } : {}),
  };
}
