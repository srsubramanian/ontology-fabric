// Lineage on screen: every field of a screen, traced lane by lane from the warehouse to what the analyst sees, and what
// it means in the ontology. Above the map, an overview of the screen's fields and, for the one picked, its trace drawn
// right to left as the data flows; beside the map, what it means, how it's built, and the decision on it.
import { useState } from 'react';
import { motion } from 'motion/react';
import { EASE_OUT, tr } from '../kit/motion';
import { ReplayButton } from '../kit/ReplayButton';
import { useReplay } from '../kit/useTimeline';
import { classOf, LAYERS, meansWords, tally, THRESHOLD, TRANSFORMS, type Field, type Layer, type Lineage, type Means, type State, type Trace } from './lineage';
import { RejectReason } from './Memory';

export const STATE_WORDS: Record<State, string> = {
  confirmed: 'confirmed', proposed: 'proposed by Claude', review: 'waits for a person', shift: 'meaning shifts', gap: 'nothing holds it', rejected: 'rejected',
};
/** A field as its lane shows it: the screen's label, or the last part of a code or column name. */
const short = (f: Field) => (f.layer === 'ui' ? f.label : f.label.replace(/\[\]$/, '[ ]'));
const where = (f: Field) => f.id.replace(/^[a-z]+:/, '');

/** The panel above the map: the screen's fields, lane by lane, and the trace of the one picked. */
export function LineagePanel({ l, pick, onPick, onClose }: { l: Lineage; pick: string | null; onPick(slug: string | null): void; onClose(): void }) {
  const [by, setBy] = useState<'field' | 'class'>('field');
  const t = tally(l.traces);
  const groups: [string, Trace[]][] = by === 'field' ? [['', l.traces]]
    : [...new Set(l.traces.map((x) => classOf(x.means?.slot ?? null) ?? 'Nothing in the ontology yet'))].sort()
      .map((g) => [g, l.traces.filter((x) => (classOf(x.means?.slot ?? null) ?? 'Nothing in the ontology yet') === g)]);
  const picked = l.traces.find((x) => x.slug === pick) ?? null;
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
      <p className="how">Each field of the screen, traced from Snowflake through the data API and the backend to what the analyst sees, and what it means in the ontology. Every name here is made up.</p>
      <p className="ltally" aria-label="Summary">
        <span><b>{l.traces.length}</b> fields</span>
        {(['confirmed', 'proposed', 'review', 'shift', 'gap', 'rejected'] as State[]).filter((s) => t[s]).map((s) => <span key={s} className={'st ' + s}><b>{t[s]}</b> {STATE_WORDS[s]}</span>)}
      </p>
      <div className="xwrap lwrap">
        <div className="lgrid" role="table" aria-label="The screen's fields, layer by layer">
          <div className="lrow lhead" role="row">
            {LAYERS.map((x, i) => <span key={x.id} role="columnheader" className={'lcell lane-' + x.id} style={{ gridColumn: i * 2 + 1 }} title={x.says}>{x.label}</span>)}
            <span role="columnheader" className="lcell lmeans" style={{ gridColumn: 9 }}>Ontology</span>
          </div>
          {groups.map(([g, rows]) => (
            <div key={g || 'all'} role="rowgroup">
              {g && <p className="lgroup">{g}</p>}
              {rows.map((x) => <LineRow key={x.slug} t={x} on={x.slug === pick} onPick={() => onPick(x.slug === pick ? null : x.slug)} />)}
            </div>
          ))}
        </div>
      </div>
      {picked ? <TraceDiagram key={picked.slug} t={picked} /> : <p className="small muted">Pick a field to see how it's built, hop by hop, and what it means.</p>}
    </section>
  );
}

function LineRow({ t, on, onPick }: { t: Trace; on: boolean; onPick(): void }) {
  const hopBetween = (a: Layer, b: Layer) => t.hops.filter((h) => t.lanes[a].some((f) => f.id === h.from) && t.lanes[b].some((f) => f.id === h.to));
  return (
    <div className={'lrow' + (on ? ' on' : '')} role="row" data-trace={t.slug} data-state={t.state}>
      {LAYERS.map((x, i) => {
        const fs = t.lanes[x.id];
        const next = LAYERS[i + 1];
        const hs = next ? hopBetween(x.id, next.id) : [];
        return [
          <span key={x.id} role="cell" className={'lcell lane-' + x.id} style={{ gridColumn: i * 2 + 1 }}>
            {i === 0 ? <button type="button" className="lfield" onClick={onPick} aria-expanded={on}>{short(fs[0])}</button>
              : fs.length ? <span className="lchip" title={fs.map(where).join('\n')}>{short(fs[0])}{fs.length > 1 && <em> +{fs.length - 1}</em>}</span> : <span className="muted">—</span>}
          </span>,
          next && (
            <span key={x.id + 'h'} role="cell" className={'lhop t-' + (hs[0]?.transform ?? 'pass')} style={{ gridColumn: i * 2 + 2 }}
              title={hs.map((h) => `${TRANSFORMS[h.transform]}: ${h.note}`).join('\n')}>
              ◂ {hs.length > 1 && new Set(hs.map((h) => h.transform)).size > 1 ? 'several' : TRANSFORMS[hs[0]?.transform ?? 'pass']}
            </span>
          ),
        ];
      })}
      <span role="cell" className={'lcell lmeans st ' + t.state} style={{ gridColumn: 9 }}>
        {t.means?.slot ? <code title={t.means.slot}>{t.means.slot}</code> : <span>nothing yet</span>}
        <small>{STATE_WORDS[t.state]}{t.state === 'review' || t.state === 'proposed' ? ` · ${t.means!.confidence.toFixed(2)}` : ''}</small>
      </span>
    </div>
  );
}

const COL = 232, BW = 150, BH = 30, GAP = 10, TOP = 26;
const laneX = (i: number) => 8 + i * COL;

/** One field's trace, drawn as the data flows: from Snowflake on the right to the screen on the left, then down to what
 *  each end means in the ontology. A meaning that differs from the screen's is red. */
export function TraceDiagram({ t }: { t: Trace }) {
  const [run, replay] = useReplay();
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
                <motion.path className={'hp t-' + h.transform} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 + 6},${y2}`} markerEnd="url(#lin-arrow)"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr({ duration: 0.35, delay: delay(lane) + 0.15, ease: EASE_OUT })} />
                <motion.text className="hl" x={x1 - 6} y={a[1] > TOP ? y1 + 14 : y1 - 6} textAnchor="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={tr({ duration: 0.2, delay: delay(lane) + 0.4 })}>{TRANSFORMS[h.transform]}</motion.text>
              </g>
            );
          })}
          {LAYERS.map((x, i) => t.lanes[x.id].map((f) => {
            const [bx, by] = at.get(f.id)!;
            return (
              <motion.g key={f.id} className={'tb lane-' + x.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tr({ duration: 0.25, delay: delay(i) })}>
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
      <ReplayButton label="Replay the trace" onClick={replay} />
    </div>
  );
}

/** Beside the map: what the picked field means, how it's built, and the decision on its mapping. */
export function LineageDetail({ l, t, editable, who, decided, onDecide, onAsk }: {
  l: Lineage; t: Trace | null; editable: boolean; who(id?: string | null): string;
  decided?: { state: string; reason?: string | null; by?: string | null } | null;
  onDecide(m: Means, state: 'accepted' | 'rejected', reason: string | null): void;
  onAsk(text: string): void;
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
            <li><span className="st shift">meaning shifts</span> the screen means one thing, a source it's built from another</li>
            <li><span className="st gap">nothing holds it</span> a gap in the ontology</li>
          </ul>
        </section>
        <section className="isec"><h3>It touches · {touched.length} classes</h3><p className="small">{touched.join(', ')}. They stay bright on the map.</p></section>
        <section className="isec"><h3>Where it's kept</h3><p className="small">In the repository as a mapping set in SSSOM's format, <code>ontology/mappings/transaction-research.sssom.tsv</code>. Decisions made here go on the working draft, and the pull request writes them into the file.</p></section>
      </>
    );
  }
  const m = t.means;
  const stl = (f: Field) => LAYERS.find((x) => x.id === f.layer)!.label;
  const order = [...t.hops].sort((a, b) => LAYERS.findIndex((x) => x.id === l.fields.get(b.to)?.layer) - LAYERS.findIndex((x) => x.id === l.fields.get(a.to)?.layer));
  return (
    <>
      <div className="ihead">
        <p className="qmeta"><b>Screen field</b> · <span className={'st ' + t.state}>{STATE_WORDS[t.state]}</span></p>
        <h2>{t.field.label}</h2>
      </div>
      <section className="isec">
        <h3>What it means</h3>
        {m?.slot ? (
          <p className="story">On the screen, <b>{t.field.label}</b> {meansWords(m.predicate)} <code>{m.slot}</code>{m.author.startsWith('agent:') ? `, Claude says, ${m.confidence.toFixed(2)} sure` : ''}.</p>
        ) : <p className="story">Nothing in the ontology holds <b>{t.field.label}</b> yet.</p>}
        {m?.comment && <p className="small">{m.comment}</p>}
        {t.sources.map((s) => {
          const f = l.fields.get(s.field)!;
          return <p key={s.key} className={'small' + (t.shift && s.field === t.shift.field.id ? ' warn' : '')}>In Snowflake, <code>{where(f)}</code> {s.slot ? <>{meansWords(s.predicate)} <code>{s.slot}</code></> : 'means nothing in the ontology yet'}.</p>;
        })}
        {t.shift && (
          <div className="said wrong">
            The screen calls it {t.field.label.toLowerCase()} (<code>{t.shift.screen}</code>), but it's built from <code>{where(t.shift.field)}</code>, which means <code>{t.shift.source}</code>{t.shift.hop ? `: ${t.shift.hop.note.toLowerCase()}` : ''}. One field, two meanings.
            {editable && <p className="row"><button type="button" className="vbtn tiny" onClick={() => onAsk(`On the transaction research screen, "${t.field.label}" means ${t.shift!.screen}, but it's built from ${where(t.shift!.field)}, which means ${t.shift!.source}${t.shift!.hop ? ` (${t.shift!.hop.note.toLowerCase()})` : ''}. What should the ontology do so a question about it can tell the two apart?`)}>Ask Claude what to do</button></p>}
          </div>
        )}
        {t.state === 'gap' && editable && (
          <p className="row"><button type="button" className="vbtn tiny go" onClick={() => onAsk(`The transaction research screen shows "${t.field.label}", built from ${where(t.lanes.sf[0] ?? t.field)}. Nothing in the ontology holds it. What should the ontology add?`)}>Ask Claude what to add</button></p>
        )}
        {decided && <p className="small muted">{decided.state === 'accepted' ? 'Accepted' : 'Rejected'} by {who(decided.by)}{decided.reason ? `: “${decided.reason}”` : ''}.</p>}
        {m?.slot && (t.state === 'proposed' || t.state === 'review') && editable && !rejecting && (
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
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
