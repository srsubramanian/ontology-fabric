// Checks the lineage mapping sets in ontology/mappings/ (illustrative for now): each is SSSOM with the columns it needs,
// every mapping points at a class or slot the ontology has, every screen field traces through each layer to the
// warehouse, and the states the studio shows come out as the set intends: the gap, the meaning that shifts, and the
// mappings waiting for a person. tools/test_studio.py runs it. Run by hand with:
// node --experimental-strip-types web/scripts/check-lineage.ts
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { buildModel } from '../src/explorer/model.ts';
import { buildLineage, LAYERS, parseSssom, tally, unknownSlots } from '../src/studio/lineage.ts';

const root = new URL('../../', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');
const model = buildModel(parse(read('ontology/payments.yaml')), parse(read('ontology/competency-questions.yaml')));

let failed = 0;
const expect = (ok: boolean, label: string, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`); if (!ok) failed++; };

for (const file of readdirSync(new URL('ontology/mappings/', root)).filter((f) => f.endsWith('.sssom.tsv'))) {
  const tsv = read(`ontology/mappings/${file}`);
  const { meta, rows } = parseSssom(tsv);
  const need = ['subject_id', 'predicate_id', 'object_id', 'mapping_justification'];
  expect(rows.length > 0 && need.every((c) => c in rows[0]) && rows.every((r) => need.every((c) => r[c])), `${file} is SSSOM, with ${need.join(', ')} on every row`);
  const declared = ((meta.extension_definitions ?? []) as { slot_name: string }[]).map((d) => d.slot_name);
  const standard = new Set([...need, 'subject_label', 'object_label', 'author_id', 'reviewer_id', 'confidence', 'mapping_tool', 'comment']);
  const extra = Object.keys(rows[0] ?? {}).filter((c) => !standard.has(c));
  expect(extra.every((c) => declared.includes(c)), 'its extra columns are declared as extensions', extra.join(', '));
  expect(Object.keys((meta.curie_map ?? {}) as object).length > 0 && !!meta.mapping_set_id && !!meta.license, 'it has a curie map, an id and a licence');

  const l = buildLineage(tsv);
  const missing = unknownSlots(l, model);
  expect(!missing.length, 'every mapping points at a class or slot the ontology has', missing.join(', '));
  const partial = l.traces.filter((t) => LAYERS.some((x) => !t.lanes[x.id].length));
  expect(!partial.length, `all ${l.traces.length} screen fields trace through every layer`, partial.map((t) => t.field.label).join(', '));
  const t = tally(l.traces);
  console.log(`     ${l.traces.length} fields: ${t.confirmed} confirmed, ${t.proposed} proposed, ${t.review} waiting for a person, ${t.shift} shifting, ${t.gap} gap${t.gap === 1 ? '' : 's'}`);
  if (file === 'transaction-research.sssom.tsv') {
    const by = (s: string) => l.traces.filter((x) => x.state === s).map((x) => x.field.label).sort().join(', ');
    expect(by('gap') === 'Risk tier', 'the risk tier is the gap', by('gap'));
    expect(by('shift') === 'Settled on', '"Settled on" shifts meaning, from settlement to capture', by('shift'));
    expect(by('review') === 'Card, Device', 'the card and the device wait for a person (under 0.9)', by('review'));
    expect(l.traces.find((x) => x.field.label === 'Status')?.state === 'confirmed', 'the status, derived on purpose, doesn\'t count as a shift');
    const shift = l.traces.find((x) => x.state === 'shift')!.shift!;
    expect(shift.screen === 'Settlement.settled_at' && shift.source === 'Capture.captured_at' && shift.hop?.transform === 'derive', 'the shift names both meanings and the hop that derives it');
    const accepted = buildLineage(tsv, { 'ui:detail.device>Device.id': { state: 'accepted' } });
    expect(accepted.traces.find((x) => x.field.label === 'Device')?.state === 'confirmed', 'a person\'s decision confirms a mapping');
  }
}
process.exit(failed ? 1 : 0);
