// Lineage on screen: every field of a screen, traced lane by lane from the warehouse to what the analyst sees, and what
// it means in the ontology. Above the map, an overview of the screen's fields and, for the one picked, its trace drawn
// right to left as the data flows; beside the map, what it means, how it's built, and the decision on it. Each scan of
// the code is a version: pick one to read it, or see what changed since an earlier one.
import { useState } from 'react';
import { motion } from 'motion/react';
import { EASE_OUT, tr } from '../kit/motion';
import { ReplayButton } from '../kit/ReplayButton';
import { useReplay } from '../kit/useTimeline';
import { between, CHANGES, classOf, LAYERS, meansWords, tally, THRESHOLD, TRANSFORMS, type Change, type Field, type FieldDiff, type Hop, type Layer, type Lineage,
  type LineageDiff, type Means, type State, type Trace, type Version } from './lineage';
import { CodeBlock } from '../kit/CodeBlock';
import { RejectReason } from './Memory';

export const STATE_WORDS: Record<State, string> = {
  confirmed: 'confirmed', proposed: 'proposed by Claude', review: 'waits for a person', recheck: 'needs a re-check', shift: 'meaning shifts', gap: 'nothing holds it', rejected: 'rejected',
};
/** A change as a row of the overview names it. */
export const CHANGE_WORDS: Record<Change, string> = {
  gone: 'gone', added: 'new', reopened: 're-check', rebuilt: 'built differently', remapped: 'new meaning', confirmed: 'confirmed', moved: 'moved',
};
const CHANGE_COUNT: Record<Change, (n: number) => string> = {
  gone: (n) => `${n} gone`, added: (n) => `${n} new`, reopened: (n) => `${n} to re-check`, rebuilt: (n) => `${n} built differently`,
  remapped: (n) => `${n} with a new meaning`, confirmed: (n) => `${n} confirmed`, moved: () => '',
};
/** What a scan changed, as a few counts: "2 built differently", "2 to re-check". */
export const changeWords = (d: LineageDiff) => CHANGES.filter((c) => c !== 'moved' && d.count[c]).map((c) => CHANGE_COUNT[c](d.count[c]));
const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const day = (d: string | null, full = false) => (d ? (full ? fullFmt : dayFmt).format(new Date(d + 'T12:00:00Z')) : '');
/** Who confirmed a meaning: a person named in the mapping set (person:ana), or someone on the draft. */
export const personName = (by: string | null | undefined, who: (id?: string | null) => string) => (by?.startsWith('person:') ? by.slice('person:'.length) : who(by));
/** A field as its lane shows it: the screen's label, or the last part of a code or column name. */
const short = (f: Field) => (f.layer === 'ui' ? f.label : f.label.replace(/\[\]$/, '[ ]'));
const where = (f: Field) => f.id.replace(/^[a-z]+:/, '');

/** The panel above the map: the screen's fields, lane by lane, and the trace of the one picked. */
export function LineagePanel({ l, pick, onPick, onClose, question, onProve, versions = [], at = 0, since = null, diff = null, onVersion, onSince }: {
  l: Lineage; pick: string | null; onPick(slug: string | null): void; onClose(): void;
  /** The competency question the screen answers, and a way to prove it on sample data. */
  question?: { id: string; text: string } | null; onProve?: () => void;
  /** Every scan of the set, oldest first; the one shown; the one it's compared with, and what changed since it. */
  versions?: Version[]; at?: number; since?: number | null; diff?: LineageDiff | null;
  onVersion?(i: number): void; onSince?(i: number | null): void;
}) {
  const [by, setBy] = useState<'field' | 'class'>('field');
  const t = tally(l.traces);
  type Row = { t: Trace; d?: FieldDiff };
  const all: Row[] = diff ? diff.fields.map((d) => ({ t: (d.after ?? d.before)!, d })) : l.traces.map((x) => ({ t: x }));
  const groupOf = (r: Row) => classOf(r.t.means?.slot ?? null) ?? 'Nothing in the ontology yet';
  const groups: [string, Row[]][] = by === 'field' ? [['', all]]
    : [...new Set(all.map(groupOf))].sort().map((g) => [g, all.filter((r) => groupOf(r) === g)]);
  const pickedRow = all.find((r) => r.t.slug === pick) ?? null;
  const picked = pickedRow?.t ?? null;
  const latest = at === versions.length - 1;
  return (
    <section className="coach lineage" aria-label="Lineage">
      <header>
        <span className="ctag">Lineage · illustrative</span>
        <b>{l.title.replace(/ \(illustrative\)$/, '')}</b>
        <span className="cact">
          <span className="seg tiny" role="group" aria-label="Group by">
            <button type="button" aria-pressed={by === 'field'} onClick={() => setBy('field')}>By screen field</button>
            <button type="button" aria-pressed={by === 'class'} onClick={() => setBy('class')}>By ontology class</button>
          </span>
          <button type="button" className="vbtn tiny" onClick={onClose}>Close</button>
        </span>
      </header>
      <p className="how">Each field of the screen, traced from Snowflake through the data API and the backend to what the analyst sees, and what it means in the ontology. Every name and line of code here is made up.</p>
      {versions.length > 1 && onVersion && onSince && (
        <div className="lver">
          <span className="seg tiny" role="group" aria-label="Version">
            {versions.map((v, i) => (
              <button key={i} type="button" aria-pressed={i === at} onClick={() => onVersion(i)}
                title={`${v.version}, scanned ${day(v.date, true)}`}>{v.version} · {day(v.date)}{i === versions.length - 1 ? ' · latest' : ''}</button>
            ))}
          </span>
          {at > 0 && (
            <span className="lsince">
              <button type="button" className="vbtn tiny" aria-pressed={since !== null} onClick={() => onSince(since === null ? at - 1 : null)}>What changed</button>
              {since !== null && at > 1 && (
                <label>since <select value={since} onChange={(e) => onSince(Number(e.target.value))}>
                  {versions.slice(0, at).map((v, i) => <option key={i} value={i}>{v.version}, {day(v.date)}</option>)}
                </select></label>
              )}
            </span>
          )}
          {!latest && <span className="small muted">An earlier scan, to read. Decisions go on the latest.</span>}
        </div>
      )}
      {question && (
        <p className="lq"><span>The screen answers <b>{question.id}</b>: {question.text}</span>
          {onProve && <button type="button" className="vbtn tiny" onClick={onProve}>Prove it with sample data</button>}</p>
      )}
      <p className="ltally" aria-label="Summary">
        <span><b>{l.traces.length}</b> fields</span>
        {(['confirmed', 'proposed', 'review', 'recheck', 'shift', 'gap', 'rejected'] as State[]).filter((s) => t[s]).map((s) => <span key={s} className={'st ' + s}><b>{t[s]}</b> {STATE_WORDS[s]}</span>)}
      </p>
      {diff && (
        <p className="lchanges" aria-label="What changed">
          <b>Since {diff.from}{versions[since ?? -1] ? `, ${day(versions[since!].date)}` : ''}:</b>
          {CHANGES.filter((c) => c !== 'moved' && diff.count[c]).map((c) => <span key={c} className={'chg c-' + c}>{CHANGE_COUNT[c](diff.count[c])}</span>)}
          {CHANGES.every((c) => c === 'moved' || !diff.count[c]) && <span>nothing that bears on a meaning</span>}
          {diff.lines > 0 && <span className="muted">code moved in {diff.lines} places, nothing to re-check for that</span>}
        </p>
      )}
      <div className="xwrap lwrap">
        <div className={'lgrid' + (diff ? ' cmp' : '')} role="table" aria-label="The screen's fields, layer by layer">
          <div className="lrow lhead" role="row">
            {diff && <span role="columnheader" className="lcell lchg" style={{ gridColumn: 1 }}>Since {diff.from}</span>}
            {LAYERS.map((x, i) => <span key={x.id} role="columnheader" className={'lcell lane-' + x.id} style={{ gridColumn: i * 2 + 1 + (diff ? 1 : 0) }} title={x.says}>{x.label}</span>)}
            <span role="columnheader" className="lcell lmeans" style={{ gridColumn: 9 + (diff ? 1 : 0) }}>Ontology</span>
          </div>
          {groups.map(([g, rows]) => (
            <div key={g || 'all'} role="rowgroup">
              {g && <p className="lgroup">{g}</p>}
              {rows.map((r) => <LineRow key={r.t.slug} t={r.t} d={r.d} cmp={!!diff} on={r.t.slug === pick} onPick={() => onPick(r.t.slug === pick ? null : r.t.slug)} />)}
            </div>
          ))}
        </div>
      </div>
      {picked ? <TraceDiagram key={picked.slug + (diff?.from ?? '')} t={picked} changed={pickedRow?.d ?? null} since={diff?.from ?? null} />
        : <p className="small muted">Pick a field to see how it's built, hop by hop, and what it means.</p>}
    </section>
  );
}

function LineRow({ t, d, cmp, on, onPick }: { t: Trace; d?: FieldDiff; cmp: boolean; on: boolean; onPick(): void }) {
  const o = cmp ? 1 : 0;
  const k = d?.kinds.find((c) => c !== 'moved');
  return (
    <div className={'lrow' + (on ? ' on' : '') + (k === 'gone' ? ' gone' : '')} role="row" data-trace={t.slug} data-state={t.state} data-change={d?.kinds.join(' ') || undefined}>
      {cmp && <span role="cell" className={'lcell lchg' + (k ? ' c-' + k : '')} style={{ gridColumn: 1 }} title={d?.kinds.map((c) => CHANGE_WORDS[c]).join(', ')}>{k ? CHANGE_WORDS[k] : ''}</span>}
      {LAYERS.map((x, i) => {
        const fs = t.lanes[x.id];
        const next = LAYERS[i + 1];
        const hs = next ? between(t, x.id, next.id) : [];
        const was = next && d?.hops.find((h) => h.from === x.id && h.to === next.id);
        return [
          <span key={x.id} role="cell" className={'lcell lane-' + x.id} style={{ gridColumn: i * 2 + 1 + o }}>
            {i === 0 ? <button type="button" className="lfield" onClick={onPick} aria-expanded={on}>{short(fs[0])}</button>
              : fs.length ? <span className="lchip" title={fs.map(where).join('\n')}>{short(fs[0])}{fs.length > 1 && <em> +{fs.length - 1}</em>}</span> : <span className="muted">—</span>}
          </span>,
          next && (
            <span key={x.id + 'h'} role="cell" className={'lhop t-' + (hs[0]?.transform ?? 'pass') + (was ? ' chg' : '')} style={{ gridColumn: i * 2 + 2 + o }}
              title={hs.map((h) => `${TRANSFORMS[h.transform]}: ${h.note}`).join('\n') + (was ? `\nChanged: was ${was.before.map((h) => TRANSFORMS[h.transform]).join(', ') || 'nothing'}` : '')}>
              ◂ {hs.length > 1 && new Set(hs.map((h) => h.transform)).size > 1 ? 'several' : TRANSFORMS[hs[0]?.transform ?? 'pass']}
            </span>
          ),
        ];
      })}
      <span role="cell" className={'lcell lmeans st ' + t.state} style={{ gridColumn: 9 + o }}>
        {t.means?.slot ? <code title={t.means.slot}>{t.means.slot}</code> : <span>nothing yet</span>}
        <small>{k === 'gone' ? `gone, was ${STATE_WORDS[t.state]}` : STATE_WORDS[t.state]}{t.state === 'review' || t.state === 'proposed' || t.state === 'recheck' ? ` · ${t.means!.confidence.toFixed(2)}` : ''}</small>
      </span>
    </div>
  );
}

const COL = 232, BW = 150, BH = 30, GAP = 10, TOP = 26;
const laneX = (i: number) => 8 + i * COL;

/** One field's trace, drawn as the data flows: from Snowflake on the right to the screen on the left, then down to what
 *  each end means in the ontology. A meaning that differs from the screen's is red. */
export function TraceDiagram({ t, changed = null, since = null }: { t: Trace; changed?: FieldDiff | null; since?: string | null }) {
  const [run, replay] = useReplay();
  // Since an earlier version: the hops between layers that changed, and the fields this version reads that it didn't.
  const fresh = new Set(changed?.after ? changed.hops.flatMap((h) => h.after) : []);
  const before = new Set(changed?.before ? LAYERS.flatMap((x) => changed.before!.lanes[x.id].map((f) => f.id)) : []);
  const isNew = (f: Field) => !!changed?.before && !!changed.after && !before.has(f.id);
  const at = new Map<string, [number, number]>();
  LAYERS.forEach((x, i) => t.lanes[x.id].forEach((f, j) => at.set(f.id, [laneX(i), TOP + j * (BH + GAP)])));
  const rows = Math.max(...LAYERS.map((x) => t.lanes[x.id].length), 1);
  const oy = TOP + rows * (BH + GAP) + 42;
  const ends: Means[] = [...(t.means ? [t.means] : []), ...t.sources];
  const slots = [...new Set(ends.map((m) => m.slot ?? '∅'))];
  const slotX = (i: number) => 8 + (slots.length === 1 ? 1.5 * COL : (i * (3 * COL)) / Math.max(1, slots.length - 1));
  const sat = new Map(slots.map((s, i) => [s, slotX(i)]));
  const delay = (lane: number) => (3 - lane) * 0.35;
  const off = (s: string) => t.means?.slot && s !== '∅' && t.means.predicate !== 'skos:relatedMatch' && classOf(s) !== classOf(t.means.slot);
  const W = laneX(3) + BW + 8, H = oy + BH + 10;
  return (
    <div className="trace">
      <div className="xwrap">
        <svg key={run} className="tgraph" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
          aria-label={`How ${t.field.label} is built, from Snowflake to the screen, and what it means`}>
          {LAYERS.map((x, i) => <text key={x.id} className={'th lane-' + x.id} x={laneX(i)} y={14}>{x.label}</text>)}
          {t.hops.map((h, i) => {
            const a = at.get(h.to), b = at.get(h.from);
            if (!a || !b) return null;
            const lane = LAYERS.findIndex((x) => t.lanes[x.id].some((f) => f.id === h.to));
            const x1 = a[0], y1 = a[1] + BH / 2, x2 = b[0] + BW, y2 = b[1] + BH / 2, mx = (x1 + x2) / 2;
            return (
              <g key={i}>
                <motion.path className={'hp t-' + h.transform + (fresh.has(h) ? ' chg' : '')} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 + 6},${y2}`} markerEnd="url(#lin-arrow)"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr({ duration: 0.35, delay: delay(lane) + 0.15, ease: EASE_OUT })} />
                <motion.text className={'hl' + (fresh.has(h) ? ' chg' : '')} x={x1 - 6} y={a[1] > TOP ? y1 + 14 : y1 - 6} textAnchor="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={tr({ duration: 0.2, delay: delay(lane) + 0.4 })}>{TRANSFORMS[h.transform]}</motion.text>
              </g>
            );
          })}
          {LAYERS.map((x, i) => t.lanes[x.id].map((f) => {
            const [bx, by] = at.get(f.id)!;
            return (
              <motion.g key={f.id} className={'tb lane-' + x.id + (isNew(f) ? ' chg' : '')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tr({ duration: 0.25, delay: delay(i) })}>
                <title>{where(f)}</title>
                <rect x={bx} y={by} width={BW} height={BH} rx={7} />
                <text x={bx + 9} y={by + 19}>{short(f).length > 19 ? short(f).slice(0, 18) + '…' : short(f)}</text>
              </motion.g>
            );
          }))}
          {ends.map((m) => {
            const f = at.get(m.field);
            if (!f) return null;
            const sx = sat.get(m.slot ?? '∅')! + BW / 2;
            return (
              <motion.path key={m.key} className={'ml' + (m.slot && off(m.slot) ? ' off' : '') + (m.slot ? '' : ' none')} d={`M${f[0] + BW / 2},${f[1] + BH} L${sx},${oy}`}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr({ duration: 0.35, delay: 1.6 })} />
            );
          })}
          {slots.map((s) => (
            <motion.g key={s} className={'tb onto' + (off(s) ? ' off' : '') + (s === '∅' ? ' none' : '')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tr({ duration: 0.25, delay: 1.9 })}>
              <rect x={sat.get(s)!} y={oy} width={BW} height={BH} rx={7} />
              <text x={sat.get(s)! + 9} y={oy + 19}>{s === '∅' ? 'nothing holds it' : s}</text>
            </motion.g>
          ))}
          <defs>
            <marker id="lin-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" className="ah" /></marker>
          </defs>
        </svg>
      </div>
      {since && changed?.after && fresh.size > 0 && <p className="small muted">Heavier lines and boxes changed since {since}.</p>}
      <ReplayButton label="Replay the trace" onClick={replay} />
    </div>
  );
}

const laneLabel = (x: Layer) => LAYERS.find((y) => y.id === x)!.label;
/** Hops as words: "derived from SETTLED_DT and CAPTURE_DT". */
function hopWords(hs: Hop[], fields: Map<string, Field>) {
  if (!hs.length) return 'nothing';
  const by = new Map<string, string[]>();
  for (const h of hs) by.set(TRANSFORMS[h.transform], [...(by.get(TRANSFORMS[h.transform]) ?? []), fields.get(h.to) ? short(fields.get(h.to)!) : where({ id: h.to, label: h.to, layer: 'sf' })]);
  return [...by].map(([w, names]) => `${w} from ${[...new Set(names)].join(' and ')}`).join('; ');
}
/** The code of a hop that changed: the lines it had, then the lines it has. */
function CodeDiff({ before, after }: { before: Hop[]; after: Hop[] }) {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const b = [...new Set(before.map((h) => norm(h.code)).filter(Boolean))], a = [...new Set(after.map((h) => norm(h.code)).filter(Boolean))];
  const lines: ['del' | 'ins', string][] = [...b.filter((x) => !a.includes(x)).map((x): ['del', string] => ['del', x]), ...a.filter((x) => !b.includes(x)).map((x): ['ins', string] => ['ins', x])];
  if (!lines.length) return null;
  return <div className="code ldiff" aria-label="The code before and after"><pre>{lines.map(([k, x], i) => <span key={i} className={k}>{k === 'del' ? '−\u00a0' : '+\u00a0'}{x}{'\n'}</span>)}</pre></div>;
}

/** What changed for one field since an earlier version, in words, with the code before and after. */
function Changes({ d, since, who }: { d: FieldDiff; since: string | null; who(id?: string | null): string }) {
  const b = d.before?.means, a = d.after?.means;
  // The fields of both versions, since a hop that changed can name a field only the earlier one has.
  const fields = new Map(LAYERS.flatMap((x) => [...(d.before?.lanes[x.id] ?? []), ...(d.after?.lanes[x.id] ?? [])]).map((f) => [f.id, f]));
  return (
    <section className="isec lchanged">
      <h3>What changed since {since}</h3>
      <ul className="chglist">
        {d.kinds.includes('added') && <li>New on the screen.</li>}
        {d.kinds.includes('gone') && <li>The screen doesn't show it any more.</li>}
        {d.kinds.includes('reopened') && <li className="re"><b>Re-check.</b> {personName(d.before!.confirmedBy, who)} confirmed what it means on {since}. How it's built has changed since, so a person needs to look again.</li>}
        {d.kinds.includes('remapped') && (
          <li>{b?.slot ? <>It {meansWords(b.predicate).replace(/^means/, 'meant').replace(/^is/, 'was')} <code>{b.slot}</code></> : 'It meant nothing in the ontology'}; now it {a?.slot ? <>{meansWords(a.predicate)} <code>{a.slot}</code></> : 'means nothing in the ontology'}{a?.author.startsWith('agent:') ? ', as Claude maps it' : ''}.</li>
        )}
        {d.kinds.includes('confirmed') && <li>{personName(d.after!.confirmedBy, who)} confirmed what it means.</li>}
        {d.hops.map((h) => (
          <li key={h.from + h.to}>
            <span className="hk">{laneLabel(h.to)} → {laneLabel(h.from)}</span> {hopWords(h.before, fields) === hopWords(h.after, fields)
              ? <>still {hopWords(h.after, fields)}, by different code.</> : <>was {hopWords(h.before, fields)}; now {hopWords(h.after, fields)}.</>}
            <CodeDiff before={h.before} after={h.after} />
          </li>
        ))}
        {d.moved.length > 0 && (
          <li className="small muted">Its code moved, nothing else: {d.moved.slice(0, 2).map((m) => `${m.was.split('/').pop()} → ${m.hop.location.split('/').pop()}`).join(', ')}{d.moved.length > 2 ? ` and ${d.moved.length - 2} more` : ''}. A decision holds through that.</li>
        )}
      </ul>
    </section>
  );
}

/** Beside the map: what the picked field means, how it's built, and the decision on its mapping. */
export function LineageDetail({ l, t, editable, who, decided, onDecide, onAsk, change = null, since = null, versions = [], latest = true }: {
  l: Lineage; t: Trace | null; editable: boolean; who(id?: string | null): string;
  decided?: { state: string; reason?: string | null; by?: string | null } | null;
  onDecide(m: Means, state: 'accepted' | 'rejected', reason: string | null): void;
  onAsk(text: string): void;
  /** What changed for the picked field since an earlier version (since), if anything. */
  change?: FieldDiff | null; since?: string | null;
  /** Every scan of the set, and whether the one shown is the latest, the only one decisions go on. */
  versions?: Version[]; latest?: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  if (!t) {
    const touched = [...new Set(l.means.map((m) => classOf(m.slot)).filter(Boolean))];
    return (
      <>
        <div className="ihead"><h2>Where the screen's data comes from</h2>
          <p className="small muted">Illustrative: every system, file, table and column here is made up, for a transaction research screen backed by an application, a data API and Snowflake.</p></div>
        <section className="isec">
          <h3>How to read it</h3>
          <ul className="legend">
            <li><span className="st confirmed">confirmed</span> a person agreed what it means</li>
            <li><span className="st proposed">proposed by Claude</span> {THRESHOLD} or more sure; accept or reject it</li>
            <li><span className="st review">waits for a person</span> Claude is less than {THRESHOLD} sure (decision 19)</li>
            <li><span className="st recheck">needs a re-check</span> a person confirmed it, then the code under it changed</li>
            <li><span className="st shift">meaning shifts</span> the screen means one thing, a source it's built from another</li>
            <li><span className="st gap">nothing holds it</span> a gap in the ontology</li>
          </ul>
        </section>
        <section className="isec"><h3>It touches · {touched.length} classes</h3><p className="small">{touched.join(', ')}. They stay bright on the map.</p></section>
        <section className="isec"><h3>Where it's kept</h3><p className="small">In the repository as a mapping set in SSSOM's format, <code>ontology/mappings/transaction-research.sssom.tsv</code>. Decisions made here go on the working draft, and the pull request writes them into the file.</p></section>
        {versions.length > 1 && (
          <section className="isec">
            <h3>Versions · {versions.length} scans</h3>
            <ol className="lversions">
              {[...versions].reverse().map((v) => (
                <li key={v.version}>
                  <b>{v.version}</b> · {day(v.date, true)}{v === versions[versions.length - 1] ? ' · latest' : ''}
                  <span className="small muted"> Read {LAYERS.filter((x) => x.id !== 'sf' && v.read[x.id]).map((x) => `${v.read[x.id]!.source.replace(/^repo:/, '')} at ${v.read[x.id]!.at}`).join(', ')}
                    {v.read.sf ? `, and Snowflake's ${v.read.sf.source.replace(/^snowflake:/, '')} schema of ${day(v.read.sf.at)}` : ''}.</span>
                </li>
              ))}
            </ol>
            <p className="small">Each scan reads the code and the schema, and Claude maps only what's new or changed. Merged, it's the next version, and the earlier ones stay in <code>ontology/mappings/history/</code>. A person's decision holds until the code under it changes; then it comes back as a re-check.</p>
          </section>
        )}
      </>
    );
  }
  const m = t.means;
  const stl = (f: Field) => LAYERS.find((x) => x.id === f.layer)!.label;
  const order = [...t.hops].sort((a, b) => LAYERS.findIndex((x) => x.id === l.fields.get(b.to)?.layer) - LAYERS.findIndex((x) => x.id === l.fields.get(a.to)?.layer));
  return (
    <>
      <div className="ihead">
        <p className="qmeta"><b>Screen field</b>{l.version ? ` · ${l.version} · ` : ' · '}{change?.kinds.includes('gone') ? <span className="st rejected">gone</span> : <span className={'st ' + t.state}>{STATE_WORDS[t.state]}</span>}</p>
        <h2>{t.field.label}</h2>
        {!latest && <p className="small muted">This is {l.version}, an earlier scan. Decisions go on the latest.</p>}
      </div>
      {change && change.kinds.length > 0 && <Changes d={change} since={since} who={who} />}
      {t.reopened && t.reopened.since === null && (
        <div className="said wrong">{personName(t.reopened.by, who)} accepted it on the draft, then a scan changed how it's built. A person needs to look again.</div>
      )}
      <section className="isec">
        <h3>What it means</h3>
        {m?.slot ? (
          <p className="story">On the screen, <b>{t.field.label}</b> {meansWords(m.predicate)} <code>{m.slot}</code>{m.author.startsWith('agent:') && !t.confirmedBy ? `, Claude says, ${m.confidence.toFixed(2)} sure` : ''}.</p>
        ) : <p className="story">Nothing in the ontology holds <b>{t.field.label}</b> yet.</p>}
        {m?.comment && <p className="small">{m.comment}</p>}
        {t.sources.map((s) => {
          const f = l.fields.get(s.field)!;
          return <p key={s.key} className={'small' + (t.shift && s.field === t.shift.field.id ? ' warn' : '')}>In Snowflake, <code>{where(f)}</code> {s.slot ? <>{meansWords(s.predicate)} <code>{s.slot}</code></> : 'means nothing in the ontology yet'}.</p>;
        })}
        {t.shift && (
          <div className="said wrong">
            The screen calls it {t.field.label.toLowerCase()} (<code>{t.shift.screen}</code>), but it's built from <code>{where(t.shift.field)}</code>, which means <code>{t.shift.source}</code>{t.shift.hop ? `: ${t.shift.hop.note.toLowerCase()}` : ''}. One field, two meanings.
            {editable && latest && <p className="row"><button type="button" className="vbtn tiny" onClick={() => onAsk(`On the transaction research screen, "${t.field.label}" means ${t.shift!.screen}, but it's built from ${where(t.shift!.field)}, which means ${t.shift!.source}${t.shift!.hop ? ` (${t.shift!.hop.note.toLowerCase()})` : ''}. What should the ontology do so a question about it can tell the two apart?`)}>Ask Claude what to do</button></p>}
          </div>
        )}
        {t.state === 'gap' && editable && latest && (
          <p className="row"><button type="button" className="vbtn tiny go" onClick={() => onAsk(`The transaction research screen shows "${t.field.label}", built from ${where(t.lanes.sf[0] ?? t.field)}. Nothing in the ontology holds it. What should the ontology add?`)}>Ask Claude what to add</button></p>
        )}
        {decided && <p className="small muted">{decided.state === 'accepted' ? 'Accepted' : 'Rejected'} by {who(decided.by)}{decided.reason ? `: “${decided.reason}”` : ''}.</p>}
        {t.confirmedBy && !decided && <p className="small muted">Confirmed by {personName(t.confirmedBy, who)}{m?.author.startsWith('agent:') ? `, as Claude proposed it, ${m.confidence.toFixed(2)} sure` : ''}.</p>}
        {m?.slot && (t.state === 'proposed' || t.state === 'review' || t.state === 'recheck') && editable && latest && !change?.kinds.includes('gone') && !rejecting && (
          <p className="row pact">
            <button type="button" className="vbtn tiny go" onClick={() => onDecide(m, 'accepted', null)}>Accept the mapping</button>
            <button type="button" className="vbtn tiny" onClick={() => setRejecting(true)}>Reject</button>
          </p>
        )}
        {rejecting && <RejectReason onReject={(r) => { setRejecting(false); onDecide(m!, 'rejected', r); }} onCancel={() => setRejecting(false)} />}
      </section>
      <section className="isec">
        <h3>How it's built · {t.hops.length} hops</h3>
        <ol className="hops">
          {order.map((h, i) => {
            const from = l.fields.get(h.to)!, to = l.fields.get(h.from)!;
            return (
              <li key={i}>
                <span className={'hk t-' + h.transform}>{TRANSFORMS[h.transform]}</span> {stl(from)} <code>{short(from)}</code> → {stl(to)} <code>{short(to)}</code>
                {h.note && <span className="small"> · {h.note}</span>}
                {h.location && <span className="loc">{h.location}</span>}
                {h.code && <CodeBlock code={h.code} lang={to.layer === 'ui' ? 'tsx' : to.layer === 'be' ? 'java' : 'sql'} />}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
