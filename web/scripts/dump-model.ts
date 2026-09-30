// Prints the class explorer's reading of the ontology as JSON: each class's label chain and
// its induced slots. tools/check_ontology.py compares this with LinkML's own SchemaView.
// Run with: node --experimental-strip-types web/scripts/dump-model.ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { buildModel } from '../src/explorer/model.ts';

const root = new URL('../../ontology/', import.meta.url);
const read = (name: string) => parse(readFileSync(new URL(name, root), 'utf8'));
const model = buildModel(read('payments.yaml'), read('competency-questions.yaml'));

const out: Record<string, { chain: string[]; slots: [string, string, boolean, boolean][] }> = {};
for (const c of Object.values(model.classes)) {
  out[c.name] = { chain: c.chain, slots: c.slots.map((s) => [s.name, s.range, s.required, s.multivalued]) };
}
console.log(JSON.stringify(out));
