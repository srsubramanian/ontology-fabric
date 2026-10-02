// What Claude reads when it drafts or fixes a patch. Claude sees only this text, so it carries the modeling
// rules (docs/decisions.md 7 and 13), a compact reading of the schema, two answered questions to copy the style
// of, the question, and, when fixing, the draft and what the checks found.
import type { RawQuestions, RawSchema } from '../explorer/model.ts';

const RULES = `Rules the ontology follows:
- Model events, not status fields: a change that happens is a new event class, not a field that gets overwritten.
- Make codes nodes when things link to them; otherwise an enum is enough.
- Give each relationship one canonical direction. A relationship is a slot whose range is a class; its type in Neptune is the slot name in capitals, such as at_merchant -> AT_MERCHANT.
- Keep hierarchies to 3 or 4 levels. Organizations get roles (subclasses of PartyRole), not duplicate nodes.
- Class names are CamelCase; slot and enum value names are snake_case.
- Every new concrete class needs annotations owner (core, authorization, settlement, disputes or risk), lives_in (graph, warehouse or search) and id_rule (such as "pf:{payfac_id}"), and either close_mappings to a standard concept, using a prefix the schema declares, or a no_standard annotation saying why none fits. Never invent a standard identifier: if unsure, use no_standard.
- A Neptune question's query is read-only openCypher with a LIMIT, using only labels and relationship types the schema has, each relationship in its own direction.
- A Snowflake question's query is one SELECT or WITH statement with a LIMIT. Tables are snake_case, such as fct_authorization and dim_card. Each walked step is marked with a comment naming it, such as "-- Card.in_bin_range", on the line that joins its two classes' tables.
- walks lists every relationship the query walks, as Class.slot.`;

const FORMAT = `Reply with only the patch, in one \`\`\`yaml fence, with these parts:
schema:    merged into the schema: maps merge, and lists add to what's there. Add slots under slots, classes under classes, enums under enums; to give an existing class a new slot, list just the new slot under that class's slots.
question:  answered_in (neptune or snowflake), walks and query for the question.
layout:    leave out; the studio places new classes and routes new relationships.
Add only what the question needs. Never rename or remove anything.`;

/** The schema as Claude needs it: each class with its parent, owner, home and own slots, then enums and prefixes. */
export function schemaSummary(schema: RawSchema): string {
  const slot = (name: string) => {
    const s = schema.slots[name];
    return `${name}: ${s?.range ?? schema.default_range ?? 'string'}${s?.multivalued ? '*' : ''}`;
  };
  const classes = Object.entries(schema.classes).map(([name, c]) => {
    const a = c.annotations ?? {};
    const head = [name, c.is_a && `is_a ${c.is_a}`, c.abstract && 'abstract', a.owner && `owner ${a.owner}`, a.lives_in && `in ${a.lives_in}`]
      .filter(Boolean).join(', ');
    return `- ${head}${c.slots?.length ? ` | slots: ${c.slots.map(slot).join('; ')}` : ''}`;
  });
  const enums = Object.entries(schema.enums ?? {}).map(([n, e]) => `- ${n}: ${Object.keys(e.permissible_values ?? {}).slice(0, 12).join(', ')}`);
  return [
    'Classes (slots marked * are multivalued):', ...classes, '',
    'Enums:', ...enums, '',
    `Declared prefixes: ${Object.keys(schema.prefixes ?? {}).join(', ')}`,
  ].join('\n');
}

function examples(questions: RawQuestions): string {
  return questions.questions.filter((q) => q.id === 'CQ-01' || q.id === 'CQ-35').map((q) => [
    `${q.id}: ${q.question}`, `answered_in: ${q.answered_in}`, `walks: [${(q.walks ?? []).join(', ')}]`, 'query:', q.query ?? '',
  ].join('\n')).join('\n');
}

export function draftPrompt(schema: RawSchema, questions: RawQuestions, questionId: string): string {
  const q = questions.questions.find((x) => x.id === questionId)!;
  return [
    'You are helping an ontology engineer extend a payments ontology, written in LinkML, so it can answer one more competency question. Write the patch that does it.',
    '', RULES, '', schemaSummary(schema), '', 'Two questions it already answers, for the style:', examples(questions), '',
    `The question to answer, ${q.id} (${q.domain} team): ${q.question}`,
    `What the schema lacks today: ${(q.gap ?? '').trim()}`, '', FORMAT,
  ].join('\n');
}

export function fixPrompt(schema: RawSchema, questions: RawQuestions, questionId: string, patch: string, problems: string[]): string {
  const q = questions.questions.find((x) => x.id === questionId)!;
  return [
    'You are helping an ontology engineer extend a payments ontology, written in LinkML, so it can answer one more competency question. Their draft patch fails some checks. Fix the patch so every check passes, changing as little as you can.',
    '', RULES, '', schemaSummary(schema), '',
    `The question, ${q.id} (${q.domain} team): ${q.question}`,
    `What the schema lacked: ${(q.gap ?? '').trim()}`, '',
    'The draft patch:', '```yaml', patch.trim(), '```', '',
    'What the checks found:', ...problems.map((p) => `- ${p}`), '',
    'If a problem is about the class map (a line through a box, or crossing another line), add a layout part: pos places a class by its top-left corner as [x, y] (boxes are 140 by 48, the map is 848 by 1112), and ports routes a relationship as {from: [side, fraction], via: [[x, y], ...], to: [side, fraction]}, where side is left, right, top or bottom.',
    '', FORMAT.replace('layout:    leave out; the studio places new classes and routes new relationships.', 'layout:    only if the class map needs it, as above.'),
  ].join('\n');
}

/** The patch inside Claude's reply: the yaml fence's body, or the whole reply when there's no fence yet. */
export function fenced(text: string): string {
  const open = text.match(/```(?:ya?ml)?[ \t]*\n/);
  if (!open) return text.includes('```') ? '' : text;
  const body = text.slice(open.index! + open[0].length);
  const close = body.indexOf('```');
  return close < 0 ? body : body.slice(0, close);
}
