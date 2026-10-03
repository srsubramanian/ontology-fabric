// Checks the lineage mapping sets in ontology/mappings/ (illustrative for now): each is SSSOM with the columns it needs,
// every mapping points at a class or slot the ontology has, every screen field traces through each layer to the
// warehouse, and the states the studio shows come out as the set intends: the gap, the meaning that shifts, and the
// mappings waiting for a person. Each scan is a version, and the earlier ones are kept in ontology/mappings/history/: the
// checks read every version, and that what each scan changed comes out as intended, with a person's decision holding
// until the code under it changes. tools/test_studio.py runs it. Run by hand with:
// node --experimental-strip-types web/scripts/check-lineage.ts
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { buildModel } from '../src/explorer/model.ts';
import { buildLineage, buildVersions, compareLineage, LAYERS, parseSssom, tally, unknownSlots, versionsOf, type Change, type LineageDiff } from '../src/studio/lineage.ts';

const root = new URL('../../', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');
const model = buildModel(parse(read('ontology/payments.yaml')), parse(read('ontology/competency-questions.yaml')));

let failed = 0;
const expect = (ok: boolean, label: string, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`); if (!ok) failed++; };

const need = ['subject_id', 'predicate_id', 'object_id', 'mapping_justification'];
const standard = new Set([...need, 'subject_label', 'object_label', 'author_id', 'reviewer_id', 'confidence', 'mapping_tool', 'comment', 'subject_source', 'subject_source_version', 'predicate_modifier']);
/** What every version of a set must be: SSSOM, its extra columns declared, and every field traced to the ontology. */
function sssom(file: string, tsv: string) {
  const { meta, rows } = parseSssom(tsv);
  expect(rows.length > 0 && need.every((c) => c in rows[0]) && rows.every((r) => need.every((c) => r[c])), `${file} is SSSOM, with ${need.join(', ')} on every row`);
  const declared = ((meta.extension_definitions ?? []) as { slot_name: string }[]).map((d) => d.slot_name);
  const extra = Object.keys(rows[0] ?? {}).filter((c) => !standard.has(c));
  expect(extra.every((c) => declared.includes(c)), 'its extra columns are declared as extensions', extra.join(', '));
  expect(Object.keys((meta.curie_map ?? {}) as object).length > 0 && !!meta.mapping_set_id && !!meta.license, 'it has a curie map, an id and a licence');
  const l = buildLineage(tsv);
  const missing = unknownSlots(l, model);
  expect(!missing.length, 'every mapping points at a class or slot the ontology has', missing.join(', '));
  const partial = l.traces.filter((t) => LAYERS.some((x) => !t.lanes[x.id].length));
  expect(!partial.length, `all ${l.traces.length} screen fields trace through every layer`, partial.map((t) => t.field.label).join(', '));
  return { meta, rows, l };
}
const changed = (d: LineageDiff, c: Change) => d.fields.filter((f) => f.kinds.includes(c)).map((f) => f.field.label).sort().join(', ');

for (const file of readdirSync(new URL('ontology/mappings/', root)).filter((f) => f.endsWith('.sssom.tsv'))) {
  const tsv = read(`ontology/mappings/${file}`);
  const { l } = sssom(file, tsv);
  const cq = l.question ? model.questions.find((q) => q.id === l.question) : undefined;
  expect(!l.question || (!!cq && !!cq.query), `the screen's question ${l.question ?? '(none)'} is one the ontology answers`);
  if (cq) {
    // A class counts when the screen shows it or one of its kinds, such as a Chargeback for DisputeEvent.
    const touched = l.means.map((m) => m.slot?.split('.')[0]).filter((c): c is string => !!c && !!model.classes[c]);
    const missed = cq.steps.map((x) => x.relationship.from).filter((c) => !touched.some((t) => model.classes[t].chain.includes(c)));
    expect(!missed.length, `the screen shows every class ${cq.id} walks from`, missed.join(', '));
  }

  // The earlier scans of this set, oldest first, then this one.
  const stem = file.replace(/\.sssom\.tsv$/, '');
  const hist = new URL('ontology/mappings/history/', root);
  const kept = readdirSync(hist).filter((f) => f.startsWith(stem + '.') && f.endsWith('.sssom.tsv'));
  for (const f of kept) sssom(`history/${f}`, read(`ontology/mappings/history/${f}`));
  const versions = versionsOf(tsv, kept.map((f) => read(`ontology/mappings/history/${f}`)));
  const lineages = buildVersions(versions);
  const now = lineages[lineages.length - 1];
  if (kept.length) {
    expect(versions.every((v) => v.version && v.date) && new Set(versions.map((v) => v.version)).size === versions.length,
      'every version names its version and when it was published, once each', versions.map((v) => `${v.version} ${v.date}`).join(', '));
    expect(versions[versions.length - 1].tsv === tsv, `the current set, ${now.version}, is the newest`);
    expect(versions.slice(1).every((v, i) => v.source?.endsWith(`${stem}.${versions[i].version}.sssom.tsv`)), 'each version names the one before it (mapping_set_source)');
    expect(versions.every((v) => LAYERS.every((x) => v.read[x.id]?.source && v.read[x.id]?.at)), 'each version says what it read in every layer, and at which commit or day');
  }

  const t = tally(now.traces);
  console.log(`     ${now.version ?? ''} ${now.traces.length} fields: ${t.confirmed} confirmed, ${t.proposed} proposed, ${t.review} waiting for a person, ${t.recheck} to re-check, ${t.shift} shifting, ${t.gap} gap${t.gap === 1 ? '' : 's'}`);
  if (file === 'transaction-research.sssom.tsv') {
    const by = (s: string) => now.traces.filter((x) => x.state === s).map((x) => x.field.label).sort().join(', ');
    expect(by('gap') === 'Risk tier', 'the risk tier is the gap', by('gap'));
    expect(by('shift') === 'Settled on', '"Settled on" shifts meaning, from settlement to capture', by('shift'));
    expect(by('review') === 'Card, Device', 'the card and the device wait for a person (under 0.9)', by('review'));
    expect(now.traces.find((x) => x.field.label === 'Status')?.state === 'confirmed', 'the status, derived on purpose, doesn\'t count as a shift');
    const shift = now.traces.find((x) => x.state === 'shift')!.shift!;
    expect(shift.screen === 'Settlement.settled_at' && shift.source === 'Capture.captured_at' && shift.hop?.transform === 'derive', 'the shift names both meanings and the hop that derives it');
    const key = 'ui:TransactionLifecycle.device>Device.id';
    const accepted = buildLineage(tsv, { [key]: { state: 'accepted' } });
    expect(accepted.traces.find((x) => x.field.label === 'Device')?.state === 'confirmed', 'a person\'s decision confirms a mapping');

    // What each scan changed.
    expect(versions.map((v) => v.version).join(' ') === 'v1 v2 v3', 'the set has three scans, v1 to v3', versions.map((v) => v.version).join(' '));
    const [d12, d23] = [compareLineage(lineages[0], lineages[1]), compareLineage(lineages[1], lineages[2])];
    expect(changed(d12, 'added') === 'Chargeback reason, Refunded amount, Respond by' && changed(d12, 'gone') === 'Auth code', 'v2 added the dispute section and the refunds, and dropped the auth code',
      `${changed(d12, 'added')}; gone ${changed(d12, 'gone')}`);
    expect(changed(d12, 'rebuilt') === 'Merchant, Status' && changed(d12, 'remapped') === 'Merchant', 'in v2 the merchant comes from the name the cardholder sees, and means Merchant.name',
      `${changed(d12, 'rebuilt')}; remapped ${changed(d12, 'remapped')}`);
    expect(changed(d23, 'rebuilt') === 'Captured amount, Settled on' && changed(d23, 'reopened') === 'Captured amount, Settled on', 'v3 changed how two confirmed fields are built, and reopened both',
      `${changed(d23, 'rebuilt')}; reopened ${changed(d23, 'reopened')}`);
    expect(d23.lines === 16 && d23.fields.filter((f) => f.kinds.join() === 'moved').length === 14, 'code that only moved changes nothing a person decided', `${d23.lines} lines moved`);
    expect(by('recheck') === 'Captured amount', 'the captured amount needs a re-check, since partial captures are now added up', by('recheck'));
    expect(!!now.traces.find((x) => x.field.label === 'Settled on')?.reopened, 'the settlement date was confirmed on v2, so its shift is a re-check too');

    // A person's decision on the draft holds while the field is built the same way.
    const dev = now.traces.find((x) => x.field.label === 'Device')!;
    const held = buildLineage(tsv, { [key]: { state: 'accepted', by: 'u1', basis: dev.fingerprint } }, lineages[1]);
    const stale = buildLineage(tsv, { [key]: { state: 'accepted', by: 'u1', basis: 'older' } }, lineages[1]);
    expect(held.traces.find((x) => x.field.label === 'Device')?.state === 'confirmed' && stale.traces.find((x) => x.field.label === 'Device')?.state === 'recheck',
      'a decision on the draft holds until the field is built differently, then comes back as a re-check');
  }
}
process.exit(failed ? 1 : 0);
