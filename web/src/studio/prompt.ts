// What Claude reads about the ontology: the modeling rules (docs/decisions.md 7 and 13) and a compact reading of the
// schema as the draft leaves it, shared by Ask anything (inquiry.ts) and by writing a question's query. Claude sees
// only this text, so it carries everything, with the exact JSON to answer with.
import type { RawQuestions, RawSchema } from '../explorer/model.ts';

export const RULES = `Rules the ontology follows:
- Model events, not status fields: a change that happens is a new event class, not a field that gets overwritten.
- Make codes nodes when things link to them; otherwise an enum is enough.
- Give each relationship one canonical direction. A relationship's Neptune type is its name in capitals, such as at_merchant -> AT_MERCHANT.
- Keep hierarchies to 3 or 4 levels. Organizations get roles (subclasses of PartyRole), not duplicate nodes.
- Class and enum names are CamelCase; field, relationship and enum value names are snake_case.
- A new class needs owner (core, authorization, settlement, disputes or risk), lives_in (graph, warehouse or search) and id_rule (such as "pf:{payfac_id}"). Give no_standard saying why no FIBO, OMG Commons or ISO 20022 concept fits, unless you are sure of one; never invent a standard identifier.
- A Neptune query is read-only openCypher with a LIMIT, using only labels and relationship types the schema has, each in its own direction.
- A Snowflake query is one SELECT or WITH with a LIMIT. Tables are snake_case, such as fct_authorization and dim_card. Mark each walked step with a comment naming it, such as "-- Card.in_bin_range", on the line that joins its two classes' tables.
- Field types are string, integer, decimal, boolean, date, datetime or uri, or an enum.`;

/** The schema as Claude needs it: each class with its parent, owner, home and own slots, then enums and prefixes. */
export function schemaSummary(schema: RawSchema): string {
  const slot = (name: string, usage?: { range?: string }) => {
    const s = schema.slots[name];
    return `${name}: ${usage?.range ?? s?.range ?? schema.default_range ?? 'string'}${s?.multivalued ? '*' : ''}`;
  };
  const classes = Object.entries(schema.classes).map(([name, c]) => {
    const a = c.annotations ?? {};
    const head = [name, c.is_a && `is_a ${c.is_a}`, c.abstract && 'abstract', a.owner && `owner ${a.owner}`, a.lives_in && `in ${a.lives_in}`]
      .filter(Boolean).join(', ');
    return `- ${head}${c.slots?.length ? ` | ${c.slots.map((s) => slot(s, c.slot_usage?.[s])).join('; ')}` : ''}`;
  });
  const enums = Object.entries(schema.enums ?? {}).map(([n, e]) => `- ${n}: ${Object.keys(e.permissible_values ?? {}).slice(0, 12).join(', ')}`);
  return ['Classes (slots marked * are multivalued; inherited slots aren\'t repeated):', ...classes, '', 'Enums:', ...enums].join('\n');
}

export const openQuestions = (questions: RawQuestions) => questions.questions.filter((q) => q.gap)
  .map((q) => `- ${q.id} (${q.domain}, ${q.answered_in}): ${q.question} Lacks: ${(q.gap ?? '').trim()}`).join('\n');

export function queryPrompt(schema: RawSchema, q: { id: string; question: string; answered_in: string }, walks: string[]): string {
  return [
    'Write the query that answers one competency question over a payments ontology, walking exactly the relationships given, in order.',
    '', RULES, '', schemaSummary(schema), '',
    `Question ${q.id}: ${q.question}`, `Store: ${q.answered_in === 'snowflake' ? 'Snowflake SQL' : 'Neptune openCypher'}`,
    `Walk: ${walks.join(' -> ') || '(none chosen)'}`, '',
    'Reply with only a JSON object: {"query": "<the query, with newlines as \\n>"}. Use parameters such as $merchant for values the asker supplies.',
  ].join('\n');
}
