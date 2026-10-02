// Checks the class map's hand-drawn layout (web/src/explorer/layout.ts) with web/src/explorer/layoutCheck.ts:
// every class placed and every relationship routed, no two boxes overlap, a frame holds only its own
// subclasses, no line passes through a box, no two lines cross, and no label sits on a box or another label.
// Prints each problem and exits 1 if there are any.
// tools/check_ontology.py runs it. Run by hand with: node --experimental-strip-types web/scripts/check-layout.ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { buildModel } from '../src/explorer/model.ts';
import { checkLayout } from '../src/explorer/layoutCheck.ts';

const root = new URL('../../ontology/', import.meta.url);
const read = (name: string) => parse(readFileSync(new URL(name, root), 'utf8'));
const model = buildModel(read('payments.yaml'), read('competency-questions.yaml'));
const { problems, boxes, lines } = checkLayout(model);

for (const p of problems) console.log(p);
console.log(`class map: ${boxes} boxes, ${lines} lines, ${problems.length} layout problems`);
process.exit(problems.length ? 1 : 0);
