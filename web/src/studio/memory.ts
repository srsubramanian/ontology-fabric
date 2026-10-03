// The studio's memory (decision 25, stage 5): what the team decided about Claude's proposals and why, kept across
// drafts for everyone, and what each person told Claude about themselves, kept private to them. Claude reads both
// before it proposes, and a proposal the team decided on before says so.
import type { ProposalEdit } from './draft.ts';
import type { SampleTool } from './runtime.ts';

/** How much Claude does for one person: teaches, proposes, or does everything up to the decision. */
export type Level = 'tutor' | 'copilot' | 'autopilot';
export const LEVELS: { id: Level; label: string; says: string }[] = [
  { id: 'tutor', label: 'Tutor', says: 'Claude teaches as it proposes: one proposal at a time, each with the rule behind it and a question to check you see why.' },
  { id: 'copilot', label: 'Co-pilot', says: 'Claude proposes the design, and you accept or reject each part.' },
  { id: 'autopilot', label: 'Autopilot', says: 'Claude proposes the design, plants a test case and proves the answer, then waits for your one click.' },
];

/** One decision on a proposal, as the team remembers it. */
export type Memory = {
  state: 'accepted' | 'rejected'; kind: ProposalEdit['kind']; name: string; title: string;
  reason?: string | null; question: string; by?: string | null; at: number;
};
/** What one person keeps for themselves: their setting, what they told Claude, and their own recent decisions. */
export type Prefs = { level?: Level; about?: string | null; mine?: Record<string, Memory | null> | null };

/** Reasons people give most, offered as one click when rejecting. */
export const REASONS = ['We call it something else', 'The ontology has this already', 'Not needed for this question', 'It should be a different kind of thing'];

/** Team memory is kept one document per month, each decision keyed by id, so the store holds few documents. */
export const monthOf = (t: number) => 'm-' + new Date(t).toISOString().slice(0, 7);
export const memoryId = () => 'mem' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Live decisions from the monthly documents, newest first. */
export function entriesOf(months: { entries?: Record<string, Memory | null> | null }[]): [string, Memory][] {
  return months.flatMap((m) => Object.entries(m.entries ?? {}).filter((e): e is [string, Memory] => !!e[1] && typeof e[1] === 'object' && !!e[1].name))
    .sort(([, a], [, b]) => b.at - a.at);
}

const STOP = new Set(['which', 'what', 'when', 'where', 'their', 'there', 'that', 'this', 'with', 'from', 'have', 'were', 'they', 'into', 'than', 'then', 'them', 'does', 'most', 'many', 'much', 'each', 'every', 'before', 'after', 'class', 'field', 'link']);
const words = (s: string) => new Set((s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((w) => !STOP.has(w)).map((w) => w.replace(/(ies|es|s)$/, '')));

/** The decisions that bear on a question or on the names a design uses, most relevant first, then newest. */
export function relevant(entries: [string, Memory][], text: string, names: string[] = [], n = 12): [string, Memory][] {
  const want = words(text + ' ' + names.join(' '));
  const named = new Set(names);
  const score = (m: Memory) => (named.has(m.name) ? 10 : 0) + [...words(`${m.name} ${m.title} ${m.question} ${m.reason ?? ''}`)].filter((w) => want.has(w)).length;
  return entries.map((e, i) => ({ e, s: score(e[1]), i })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, n).map((x) => x.e);
}

/** The team's last decision on a proposal by this name, for the proposal card. */
export function recalledFor(entries: [string, Memory][], p: Pick<ProposalEdit, 'kind' | 'name'>): ProposalEdit['recalled'] {
  if (p.kind === 'answer') return null;
  const hit = entries.find(([, m]) => m.kind === p.kind && m.name === p.name);
  return hit ? { state: hit[1].state, reason: hit[1].reason ?? null, by: hit[1].by ?? null, at: hit[1].at, question: hit[1].question } : null;
}

const line = (m: Memory) => `- ${m.state === 'rejected' ? 'Rejected' : 'Accepted'} “${m.title}” (${m.name})${m.reason ? `: “${m.reason}”` : ''}, asked as “${m.question.slice(0, 120)}”, ${new Date(m.at).toISOString().slice(0, 10)}`;

/** What Claude is told about the team's past decisions and the person asking, for the design prompt. */
export function memoryPrompt(team: [string, Memory][], prefs: Prefs | null, asked: string): string {
  const out: string[] = [];
  const near = relevant(team, asked);
  if (near.length) {
    out.push('What the team decided before on proposals like these, most relevant first. Follow it: reuse the names they chose, and don\'t propose again what they rejected unless the question needs it and you say why:');
    out.push(...near.map(([, m]) => line(m)));
  }
  const about = prefs?.about?.trim();
  const mine = Object.values(prefs?.mine ?? {}).filter((m): m is Memory => !!m?.name).sort((a, b) => b.at - a.at).slice(0, 8);
  if (about || mine.length) {
    out.push('', 'About the person asking (private to them, for you only):');
    if (about) out.push(`- In their words: ${about.slice(0, 500)}`);
    if (mine.length) out.push('- Their own recent decisions:', ...mine.map(line));
  }
  return out.join('\n');
}

/** A page tool, where the view runs them: search everything the team decided, beyond what the prompt carries. */
export function recallTool(get: () => [string, Memory][], step: (s: string) => void): SampleTool {
  return {
    name: 'recall',
    description: 'Searches what the team decided before about proposals: each decision\'s state (accepted or rejected), what it added, the reason given, the question it came from, and when. Use it for the classes and names your design touches.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    execute: ({ text }) => {
      step('Reading what the team decided before');
      const hits = relevant(get(), String(text ?? ''), String(text ?? '').split(/[\s,]+/), 10);
      return hits.length ? hits.map(([, m]) => ({ state: m.state, kind: m.kind, name: m.name, title: m.title, reason: m.reason ?? null, question: m.question, date: new Date(m.at).toISOString().slice(0, 10) })) : 'Nothing the team decided matches.';
    },
  };
}

/** What a person's decisions keep, newest last, so their private history stays small. */
export function trimMine(mine: Record<string, Memory | null> | null | undefined, add: Record<string, Memory>, keep = 60): Record<string, Memory | null> {
  const all = [...Object.entries(mine ?? {}).filter((e): e is [string, Memory] => !!e[1]), ...Object.entries(add)].sort(([, a], [, b]) => b.at - a.at);
  const out: Record<string, Memory | null> = Object.fromEntries(all.slice(0, keep));
  for (const [id] of all.slice(keep)) out[id] = null;
  return out;
}
