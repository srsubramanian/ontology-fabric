// Runs the TypeScript port of tools/check_ontology.py (web/src/explorer/check.ts) on the ontology and prints what
// the Python checker prints about coverage and problems, so tools/test_checks.py can compare the two.
// Run with: node --experimental-strip-types web/scripts/check-ontology.ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { checkOntology } from '../src/explorer/check.ts';

const root = new URL('../../ontology/', import.meta.url);
const read = (name: string) => parse(readFileSync(new URL(name, root), 'utf8'));
const { problems, summary } = checkOntology(read('payments.yaml'), read('competency-questions.yaml'));

for (const line of summary) console.log(line);
for (const p of problems) console.log('  problem:', p);
process.exit(problems.length ? 1 : 0);
