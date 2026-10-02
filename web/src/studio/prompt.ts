// What Claude reads when someone asks it to build part of the ontology, or to write a question's query. Claude sees
// only this text, so it carries the modeling rules (docs/decisions.md 7 and 13), a compact reading of the schema as
// the draft leaves it, and the exact JSON to answer with. The studio checks every op before applying it.
import type { RawQuestions, RawSchema } from '../explorer/model.ts';

const RULES = `Rules the ontology follows:
- Model events, not status fields: a change that happens is a new event class, not a field that gets overwritten.
- Make codes nodes when things link to them; otherwise an enum is enough.
- Give each relationship one canonical direction. A relationship's Neptune type is its name in capitals, such as at_merchant -> AT_MERCHANT.
- Keep hierarchies to 3 or 4 levels. Organizations get roles (subclasses of PartyRole), not duplicate nodes.
- Class and enum names are CamelCase; field, relationship and enum value names are snake_case.
- A new class needs owner (core, authorization, settlement, disputes or risk), lives_in (graph, warehouse or search) and id_rule (such as "pf:{payfac_id}"). Give no_standard saying why no FIBO, OMG Commons or ISO 20022 concept fits, unless you are sure of one; never invent a standard identifier.
- A Neptune query is read-only openCypher with a LIMIT, using only labels and relationship types the schema has, each in its own direction.
- A Snowflake query is one SELECT or WITH with a LIMIT. Tables are snake_case, such as fct_authorization and dim_card. Mark each walked step with a comment naming it, such as "-- Card.in_bin_range", on the line that joins its two classes' tables.
- Field types are string, integer, decimal, boolean, date, datetime or uri, or an enum.`;

const OPS = `Reply with only a JSON object: {"summary": "<one short sentence>", "ops": [...]}, where each op is one of:
{"op": "addClass", "name": "PaymentFacilitator", "is_a": "PartyRole", "description": "...", "owner": "core", "lives_in": "graph", "id_rule": "pf:{payfac_id}", "no_standard": "..."}
{"op": "addEnum", "name": "FraudType", "description": "...", "values": {"lost": "Card reported lost", "stolen": "..."}}
{"op": "addField", "class": "FraudReport", "name": "fraud_type", "range": "FraudType", "required": false, "description": "..."}
{"op": "addRelationship", "from": "Merchant", "name": "sub_merchant_of", "to": "PaymentFacilitator", "multivalued": false, "description": "..."}
{"op": "answerQuestion", "id": "CQ-116", "answered_in": "neptune", "walks": ["Merchant.sub_merchant_of"], "query": "MATCH ... LIMIT 50"}
Ops apply in order, so add a class before a relationship to it, and an enum before a field that uses it. Add only what the request needs; never rename or remove anything. The studio places new classes and routes new relationships on the map itself.`;

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

const openQuestions = (questions: RawQuestions) => questions.questions.filter((q) => q.gap)
  .map((q) => `- ${q.id} (${q.domain}, ${q.answered_in}): ${q.question} Lacks: ${(q.gap ?? '').trim()}`).join('\n');

export function askPrompt(schema: RawSchema, questions: RawQuestions, request: string, focus?: string): string {
  return [
    'You are helping an ontology engineer build a payments ontology, written in LinkML, on a live class map. Turn their request into edits.',
    '', RULES, '', 'The ontology as it stands, with the team\'s working draft applied:', schemaSummary(schema), '',
    'Questions it can\'t answer yet:', openQuestions(questions) || '- none', '',
    ...(focus ? [`They have ${focus} selected on the map.`, ''] : []),
    `Their request: ${request.trim()}`, '', OPS,
  ].join('\n');
}

export function queryPrompt(schema: RawSchema, q: { id: string; question: string; answered_in: string }, walks: string[]): string {
  return [
    'Write the query that answers one competency question over a payments ontology, walking exactly the relationships given, in order.',
    '', RULES, '', schemaSummary(schema), '',
    `Question ${q.id}: ${q.question}`, `Store: ${q.answered_in === 'snowflake' ? 'Snowflake SQL' : 'Neptune openCypher'}`,
    `Walk: ${walks.join(' -> ') || '(none chosen)'}`, '',
    'Reply with only a JSON object: {"query": "<the query, with newlines as \\n>"}. Use parameters such as $merchant for values the asker supplies.',
  ].join('\n');
}
