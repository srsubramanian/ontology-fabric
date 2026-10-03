// The story lens: the ontology read as plain sentences, for the business expert beside the engineer. Each sentence is
// built from the model itself (names, descriptions, how many, where it's kept), so the two lenses always say the same
// thing: "Each merchant is acquired by one acquirer." Nothing here is stored; edits made in the story lens change the
// same draft fields the model lens does.
import type { ClassInfo, Model, Relationship } from '../explorer/model.ts';

/** PayoutAccountChange -> payout account change; FraudReport -> fraud report. */
export const words = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').toLowerCase();
const article = (w: string) => (/^[aeiou]/.test(w) ? 'an' : 'a');
const IRREGULAR = new Set(['paid', 'held', 'seen', 'sent', 'made', 'bound', 'given', 'taken', 'known', 'run', 'built', 'kept', 'sold', 'bought']);
const PREP: Record<string, string> = { at: 'happens at', with: 'uses', from: 'comes from', in: 'is in', under: 'falls under', for: 'is for', on: 'is on', to: 'goes to', via: 'goes through', of: 'is about', about: 'is about' };

/**
 * The verb phrase a relationship's name reads as, between its two classes: acquired_by -> "is acquired by",
 * at_merchant -> "happens at", sub_merchant_of -> "is a sub merchant of", qualifies_for -> "qualifies for". A name
 * that reads as neither falls back to "links to … as its <name>".
 */
export function verb(slot: string, to: string): { phrase: string; as?: string } {
  const target = new Set(words(to).split(' '));
  let parts = slot.split('_');
  // Words that only repeat the target's name: at_merchant -> at, in_bin_range -> in, used_email -> used.
  while (parts.length > 1 && target.has(parts[parts.length - 1])) parts = parts.slice(0, -1);
  const [first, ...rest] = parts;
  const all = parts.join(' ');
  if (parts.length === 1 && PREP[first]) return { phrase: PREP[first] };
  if (first === 'has' || first === 'have') return rest.length ? { phrase: 'has', as: rest.join(' ') } : { phrase: 'has' };
  if (parts.length === 1 && /ed$/.test(first)) return { phrase: first };
  if (/ed$/.test(first) || IRREGULAR.has(first)) return { phrase: `is ${all}` };
  if (all === 'part of') return { phrase: 'is part of' };
  if (parts[parts.length - 1] === 'of' && parts.length > 1) return { phrase: `is ${article(parts[0])} ${all}` };
  if (/[^s]s$/.test(first) || /ies$/.test(first)) return { phrase: all };
  if (PREP[first]) return { phrase: `${PREP[first].split(' ')[0] === 'is' ? 'is' : PREP[first].split(' ')[0]} ${all}` };
  return { phrase: 'links to', as: slot.split('_').join(' ') };
}

/** One relationship as a sentence: "Each authorization happens at one merchant." */
export function relSentence(r: Pick<Relationship, 'from' | 'slot' | 'to' | 'multivalued' | 'open'>): string {
  const many = r.multivalued ? 'one or more' : 'one';
  if (r.open) return `Each ${words(r.from)} ${verb(r.slot, 'thing').phrase} anything it names.`;
  const v = verb(r.slot, r.to);
  const target = `${many} ${words(r.to)}${r.multivalued ? 's' : ''}`.replace(/ys$/, 'ies').replace(/(ss|ch|sh|x)s$/, '$1es');
  return `Each ${words(r.from)} ${v.phrase} ${target}${v.as ? `, as its ${v.as}` : ''}.`;
}

const TYPE: Record<string, string> = {
  string: 'text', integer: 'a whole number', decimal: 'a number', boolean: 'yes or no', date: 'a date', datetime: 'a date and time', uri: 'a link',
};
/** What a field holds, in plain words: "a date and time", "one of: lost card, stolen card". */
export function holds(range: string, enums: Record<string, { values: { code: string; description?: string }[] }>): string {
  if (TYPE[range]) return TYPE[range];
  const e = enums[range];
  if (e) {
    const vals = e.values.slice(0, 6).map((v) => (v.description || v.code.replace(/_/g, ' ')).replace(/\.$/, ''));
    return `one of: ${vals.join(', ')}${e.values.length > 6 ? ', and more' : ''}`;
  }
  return words(range);
}

const LIVES: Record<string, string> = { graph: 'in Neptune', warehouse: 'in Snowflake, never in the graph', search: 'in OpenSearch' };

/** A class as a few sentences, in the order a business reader wants them. */
export function classStory(c: ClassInfo, model: Model, enums: Record<string, { values: { code: string; description?: string }[] }>) {
  const w = words(c.name);
  const out: { kind: 'what' | 'kind' | 'home' | 'id' | 'records' | 'link' | 'in'; text: string; rel?: string }[] = [];
  out.push({ kind: 'what', text: c.description ? c.description.trim() : `Nobody has said what ${article(w)} ${w} is yet.` });
  if (c.parent) out.push({ kind: 'kind', text: `${article(w)[0].toUpperCase()}${article(w).slice(1)} ${w} is a kind of ${words(c.parent)}.` });
  if (!c.abstract) {
    out.push({ kind: 'home', text: `It's owned by the ${c.owner} team and kept ${LIVES[c.livesIn] ?? c.livesIn}.` });
    if (c.idRule) out.push({ kind: 'id', text: `Each one is known by an ID like ${c.idRule}.` });
  }
  const fields = c.slots.filter((s) => !s.relationship && !s.identifier);
  if (fields.length) out.push({ kind: 'records', text: `It records ${fields.map((s) => `${s.name.replace(/_/g, ' ')} (${holds(s.range, enums)})`).join('; ')}.` });
  for (const r of model.relationships.filter((x) => c.chain.includes(x.from))) out.push({ kind: 'link', text: relSentence({ ...r, from: c.name }), rel: r.id });
  for (const r of model.relationships.filter((x) => x.to === c.name)) out.push({ kind: 'in', text: relSentence(r), rel: r.id });
  return out;
}
