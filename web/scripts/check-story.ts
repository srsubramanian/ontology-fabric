// Reads every relationship and class in the ontology as the story lens does, and fails on a sentence a business
// reader would trip on: one that falls back to "links to … as its …", repeats a word, or doesn't end as a sentence.
// tools/test_studio.py runs it. Run by hand with: node --experimental-strip-types web/scripts/check-story.ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { buildModel } from '../src/explorer/model.ts';
import { classStory, relSentence } from '../src/studio/story.ts';

const root = new URL('../../ontology/', import.meta.url);
const read = (name: string) => parse(readFileSync(new URL(name, root), 'utf8'));
const model = buildModel(read('payments.yaml'), read('competency-questions.yaml'));
const bad: string[] = [];
const sentences = model.relationships.map((r) => relSentence(r));
for (const s of sentences) {
  if (s.includes(', as its ') && s.includes(' links to ')) bad.push(`falls back: ${s}`);
  if (/\b(\w+) \1\b/i.test(s)) bad.push(`repeats a word: ${s}`);
  if (!/^Each [a-z].*\.$/.test(s)) bad.push(`not a sentence: ${s}`);
}
for (const c of Object.values(model.classes)) for (const l of classStory(c, model, {})) if (!/[.?!]$/.test(l.text.trim())) bad.push(`${c.name}: ${l.text}`);
for (const b of bad) console.log('FAIL', b);
console.log(`${bad.length ? 'FAIL' : 'ok  '} ${sentences.length} relationships and ${Object.keys(model.classes).length} classes read as sentences`);
process.exit(bad.length ? 1 : 0);
