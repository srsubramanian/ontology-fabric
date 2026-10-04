// Lineage by meaning, on screen. The front page lists every meaning the screens carry, those with something to look at
// first, every screen and every Snowflake column; a meaning's view draws each screen field and Snowflake column that
// means it, around it, and says where they don't agree. A column's view reads the other way: every screen field built
// from it, what each means, and what a change to it would reopen. Beside the map: what the ontology says it is. On a
// class: which of its slots screens show.
import { useState } from 'react';
import { motion } from 'motion/react';
import { EASE_OUT, tr } from '../kit/motion';
import { ReplayButton } from '../kit/ReplayButton';
import { useReplay } from '../kit/useTimeline';
import type { Model } from '../explorer/model';
import { hashFor } from '../kit/route';
import { meansWords, tally, TRANSFORMS } from './lineage';
import { day, personName, STATE_WORDS } from './Lineage';
import { PROBLEMS, type Column, type Feed, type Finding, type Meaning, type ScreenSet, type Use } from './meaning';

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const where = (id: string) => id.replace(/^[a-z]+:/, '');
const screens = (m: Meaning) => new Set(m.uses.map((u) => u.set.id)).size;
const isProblem = (f: Finding) => PROBLEMS.includes(f.kind) && !(f.kind === 'built' && f.agree);

function flagsOf(m: Meaning): { text: string; bad: boolean }[] {
  const out: { text: string; bad: boolean }[] = [];
  if (m.findings.some((f) => f.kind === 'shift')) out.push({ text: 'meaning shifts', bad: true });
  if (m.findings.some((f) => f.kind === 'built' && !f.agree)) out.push({ text: 'built differently', bad: true });
  if (m.findings.some((f) => f.kind === 'label')) out.push({ text: 'same label, other meaning', bad: true });
  if (m.findings.some((f) => f.kind === 'labels')) out.push({ text: 'other names', bad: false });
  if (m.findings.some((f) => f.kind === 'built' && f.agree)) out.push({ text: 'different columns, same meaning', bad: false });
  return out;
}

function columnFlags(c: Column): { text: string; bad: boolean }[] {
  const out: { text: string; bad: boolean }[] = [];
  if (c.shifts.length) out.push({ text: 'feeds a field that means something else', bad: true });
  if (c.own.length > 1) out.push({ text: 'screens disagree on its meaning', bad: true });
  if (!c.own.length) out.push({ text: 'nothing in the ontology yet', bad: false });
  if (c.screens.length > 1) out.push({ text: `read by ${c.screens.length} screens`, bad: false });
  return out;
}

/** What the ontology says a meaning is: its slot's description, or its class's. */
function aboutOf(model: Model, key: string) {
  const [cls, slot] = key.split('.');
  const c = model.classes[cls];
  const s = slot ? c?.slots.find((x) => x.name === slot) : undefined;
  return { cls: c, slot: s, text: s?.description ?? c?.description ?? '' };
}

/** The panel above the map when Lineage opens: start from a meaning, or from a screen. */
export type HomeTab = 'meaning' | 'screen' | 'column';
export function LineageHome({ sets, meanings, columns, gaps, tab, setTab, onMeaning, onColumn, onSet, onField, onClose }: {
  sets: ScreenSet[]; meanings: Meaning[]; columns: Column[]; gaps: { set: ScreenSet; trace: Use['trace'] }[];
  tab: HomeTab; setTab(t: HomeTab): void;
  onMeaning(key: string): void; onColumn(key: string): void; onSet(id: string): void; onField(set: string, slug: string): void; onClose(): void;
}) {
  const [q, setQ] = useState('');
  const words = q.trim().toLowerCase();
  const shown = meanings.filter((m) => !words || m.key.toLowerCase().includes(words) || m.uses.some((u) => u.trace.field.label.toLowerCase().includes(words)));
  const shownCols = columns.filter((c) => !words || where(c.key).toLowerCase().includes(words) || c.own.some((o) => o.means.slot!.toLowerCase().includes(words))
    || c.feeds.some((f) => f.trace.field.label.toLowerCase().includes(words)));
  return (
    <section className="coach lineage lhome" aria-label="Lineage">
      <header>
        <span className="ctag">Lineage · illustrative</span>
        <b>Where the data comes from</b>
        <span className="cact">
          <span className="seg tiny" role="group" aria-label="Start from">
            <button type="button" aria-pressed={tab === 'meaning'} onClick={() => setTab('meaning')}>By meaning</button>
            <button type="button" aria-pressed={tab === 'column'} onClick={() => setTab('column')}>By column</button>
            <button type="button" aria-pressed={tab === 'screen'} onClick={() => setTab('screen')}>By screen</button>
          </span>
          <button type="button" className="vbtn tiny" onClick={onClose}>Close</button>
        </span>
      </header>
      {tab === 'meaning' ? (
        <>
          <p className="how">Every screen field and Snowflake column, gathered under what it means in the ontology. Pick a meaning to see every screen that shows it, and where they don't agree. {plural(sets.length, 'screen')} so far, all made up.</p>
          <input className="msearch" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a meaning or a field" placeholder="Find a meaning or a field, such as settled or merchant" />
          <ul className="mlist">
            {shown.map((m) => {
              const flags = flagsOf(m);
              return (
                <li key={m.key}>
                  <button type="button" className="mrow" data-meaning={m.key} onClick={() => onMeaning(m.key)}>
                    <code>{m.key}</code>
                    <span className="small muted">{plural(screens(m), 'screen')} · {plural(m.uses.length, 'field')} · {plural(m.columns.length, 'column')}</span>
                    <span className="mflags">{flags.map((f) => <span key={f.text} className={'mflag' + (f.bad ? ' bad' : '')}>{f.text}</span>)}</span>
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="small muted">No meaning or field matches.</li>}
          </ul>
          {gaps.length > 0 && !words && (
            <p className="small mgaps"><b>Nothing in the ontology yet:</b> {gaps.map((g, i) => (
              <span key={g.set.id + g.trace.slug}>{i ? ', ' : ''}<button type="button" className="linkish" onClick={() => onField(g.set.id, g.trace.slug)}>{g.trace.field.label}</button> on {g.set.title}</span>
            ))}.</p>
          )}
        </>
      ) : tab === 'column' ? (
        <>
          <p className="how">Every Snowflake column the screens read. Pick one to see what a change to it reaches: each screen field built from it, what each means, and whose decisions would come back.</p>
          <input className="msearch" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a column" placeholder="Find a column, a field or a meaning, such as cb_id" />
          <ul className="mlist">
            {shownCols.map((c) => (
              <li key={c.key}>
                <button type="button" className="mrow crow" data-column={c.key} onClick={() => onColumn(c.key)}>
                  <code>{where(c.key)}</code>
                  <span className="small muted">{plural(c.screens.length, 'screen')} · {plural(c.feeds.length, 'field')}</span>
                  <span className="mflags">{columnFlags(c).map((f) => <span key={f.text} className={'mflag' + (f.bad ? ' bad' : '')}>{f.text}</span>)}</span>
                </button>
              </li>
            ))}
            {!shownCols.length && <li className="small muted">No column, field or meaning matches.</li>}
          </ul>
        </>
      ) : (
        <>
          <p className="how">Each screen's mapping set, written by the deep scan. Pick one to trace its fields from Snowflake to the screen.</p>
          <div className="lscreens">
            {sets.map((s) => {
              const t = tally(s.lineage.traces);
              return (
                <button key={s.id} type="button" className="lcard" data-set={s.id} onClick={() => onSet(s.id)}>
                  <b>{s.title}</b>
                  <span className="small muted">{plural(s.lineage.traces.length, 'field')} · {t.confirmed} confirmed{t.proposed + t.review + t.recheck ? ` · ${t.proposed + t.review + t.recheck} for a person to look at` : ''}{t.shift ? ` · ${t.shift} ${STATE_WORDS.shift}` : ''}{t.gap ? ` · ${t.gap} with nothing to hold it` : ''}</span>
                  <span className="small muted">{s.lineage.version} · {day(s.lineage.date)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/** Beside the map on lineage's front page: why start from a meaning or a column, and how to read the flags. */
export function LineageAbout({ sets, meanings, columns, tab }: { sets: ScreenSet[]; meanings: Meaning[]; columns: Column[]; tab: HomeTab }) {
  const fields = sets.reduce((n, s) => n + s.lineage.traces.length, 0);
  const shared = meanings.filter((m) => screens(m) > 1).length;
  const wide = columns.filter((c) => c.screens.length > 1).length;
  return (
    <>
      <div className="ihead">
        <p className="qmeta"><b>Lineage</b> · illustrative</p>
        <h2>{tab === 'column' ? 'Start from a column' : tab === 'screen' ? 'Start from a screen' : 'Start from a meaning'}</h2>
        <p className="small muted">Every system, file, table and column here is made up.</p>
      </div>
      {tab === 'column' ? (
        <section className="isec">
          <h3>Why a column</h3>
          <p className="small">Before a column is renamed, retyped or dropped, see what reads it: every screen field built from it, what each means, and whose decisions would come back for a re-check. {plural(columns.length, 'column')} so far, {wide} read by more than one screen.</p>
        </section>
      ) : (
        <section className="isec">
          <h3>Why a meaning</h3>
          <p className="small">An organization has hundreds of screens. Each field maps to the ontology, not to the next layer, so one meaning gathers every screen that shows it, whatever the screen calls it. {plural(sets.length, 'screen')} so far: {plural(fields, 'field')}, {plural(meanings.length, 'meaning')}, {shared} on more than one screen.</p>
        </section>
      )}
      <section className="isec">
        <h3>What the flags say</h3>
        <ul className="legend">
          <li><span className="st shift">meaning shifts</span> a field means this, but a column it's built from means something else</li>
          <li><span className="st shift">built differently</span> screens build it from columns that don't all mean it</li>
          <li><span className="st shift">same label, other meaning</span> another screen's field has the same name and means something else</li>
          <li><span className="st confirmed">other names</span> screens call it different things</li>
          <li><span className="st confirmed">different columns, same meaning</span> worth knowing, not a problem</li>
        </ul>
      </section>
      <section className="isec">
        <h3>Where it's kept</h3>
        <p className="small">One mapping set per screen in <code>ontology/mappings/</code>, each written by the deep scan. Meanings and columns are worked out from them in the page.</p>
      </section>
    </>
  );
}

/** One meaning, above the map: every screen field and column that means it, drawn around it, and where they disagree. */
export function MeaningPanel({ m, model, onUse, onMeaning, onColumn, onHome, onClose, onAsk, editable }: {
  m: Meaning; model: Model; onUse(set: string, slug: string): void; onMeaning(key: string): void; onColumn(key: string): void; onHome(): void; onClose(): void;
  onAsk(text: string): void; editable: boolean;
}) {
  const about = aboutOf(model, m.key);
  const field = (u: Use) => <button type="button" className="linkish" onClick={() => onUse(u.set.id, u.trace.slug)}>{u.trace.field.label}</button>;
  const problems = m.findings.filter(isProblem);
  return (
    <section className="coach lineage meaning" aria-label="Meaning">
      <header>
        <span className="ctag">Meaning · illustrative</span>
        <b><code>{m.key}</code></b>
        <span className="cact">
          <button type="button" className="vbtn tiny" onClick={onHome}>All meanings</button>
          <button type="button" className="vbtn tiny" onClick={onClose}>Close</button>
        </span>
      </header>
      {about.text && <p className="how">{about.text}</p>}
      <MeaningHub m={m} />
      <ul className="mfinds" aria-label="What the screens say">
        {m.findings.filter((f) => f.kind !== 'waiting').map((f, i) => {
          if (f.kind === 'shift') return (
            <li key={i} className="bad"><b>Meaning shifts.</b> On {f.use.set.title}, {field(f.use)} means <code>{m.key}</code>, but it's built from <code>{where(f.column.id)}</code>, which means <code>{f.source}</code>.
              {editable && <> <button type="button" className="vbtn tiny" onClick={() => onAsk(`On the ${f.use.set.title} screen, "${f.use.trace.field.label}" means ${m.key}, but it's built from ${where(f.column.id)}, which means ${f.source}. What should the ontology do so a question about it can tell the two apart?`)}>Ask Claude what to do</button></>}</li>
          );
          if (f.kind === 'built') return (
            <li key={i} className={f.agree ? '' : 'bad'}><b>{f.agree ? 'Different columns, same meaning.' : 'Built differently.'}</b> {f.uses.map((u, j) => (
              <span key={u.set.id + u.trace.slug}>{j ? '; o' : 'O'}n {u.set.title}, {field(u)} reads {u.trace.lanes.sf.map((c, k) => <span key={c.id}>{k ? ' and ' : ''}<code>{where(c.id)}</code></span>)}</span>
            ))}.{f.agree ? ' Each of those columns means it too.' : ''}</li>
          );
          if (f.kind === 'label') return (
            <li key={i} className="bad"><b>Same label, other meaning.</b> {f.other.set.title} also has a field called {f.other.trace.field.label}, but it means <button type="button" className="linkish" onClick={() => onMeaning(f.other.means.slot!)}><code>{f.other.means.slot}</code></button>.
              {editable && <> <button type="button" className="vbtn tiny" onClick={() => onAsk(`"${f.use.trace.field.label}" on the ${f.use.set.title} screen means ${m.key}, but on the ${f.other.set.title} screen it means ${f.other.means.slot}. Should the ontology tell the two apart for people, and how?`)}>Ask Claude what to do</button></>}</li>
          );
          if (f.kind === 'labels') return (
            <li key={i}><b>Other names.</b> Called {f.labels.map((l, j) => <span key={l.label}>{j ? (j === f.labels.length - 1 ? ' and ' : ', ') : ''}“{l.label}” on {l.uses.map((u) => u.set.title).join(' and ')}</span>)}.</li>
          );
          return null;
        })}
        {!problems.length && <li className="good"><b>{m.uses.length > 1 ? 'They agree.' : 'One screen so far.'}</b> {m.uses.length > 1 ? 'Every screen that shows it means it the same way, built from columns that mean it too.' : 'Nothing to compare it with yet.'}</li>}
      </ul>
      <div className="xwrap">
        <table className="muses">
          <thead><tr><th>Screen</th><th>Field</th><th>How it reaches the meaning</th><th>From Snowflake</th></tr></thead>
          <tbody>
            {m.uses.map((u) => (
              <tr key={u.set.id + u.trace.slug} data-use={`${u.set.id}:${u.trace.slug}`}>
                <td>{u.set.title}</td>
                <td>{field(u)}</td>
                <td><span className={'st ' + u.trace.state}>{STATE_WORDS[u.trace.state]}</span> <span className="small muted">· {meansWords(u.means.predicate)}{u.means.author.startsWith('agent:') && !u.trace.confirmedBy ? `, ${u.means.confidence.toFixed(2)}` : ''}</span></td>
                <td>{u.trace.lanes.sf.map((c) => <button key={c.id} type="button" className="linkish col" data-column={c.id} onClick={() => onColumn(c.id)}><code>{where(c.id)}</code></button>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const W = 780, LX = 8, LW = 200, CX = 262, CW = 190, RX = 510, RW = 262, FH = 40, CH = 30, GAP = 10, TOP = 26;

/** The meaning in the middle, the screen fields that mean it on the left, the columns that mean it on the right. */
function MeaningHub({ m }: { m: Meaning }) {
  const [run, replay] = useReplay();
  const left = m.uses, right = m.columns;
  const lh = left.length * (FH + GAP) - GAP, rh = right.length * (CH + GAP) - GAP;
  const H = TOP + Math.max(lh, rh, 50) + 16;
  const mid = TOP + Math.max(lh, rh, 50) / 2;
  const ly = (i: number) => TOP + (Math.max(lh, rh, 50) - lh) / 2 + i * (FH + GAP);
  const ry = (i: number) => TOP + (Math.max(lh, rh, 50) - rh) / 2 + i * (CH + GAP);
  const line = (p: string, shift = false) => 'ml ' + (p === 'skos:closeMatch' ? 'close' : p === 'skos:relatedMatch' ? 'related' : 'exact') + (shift ? ' off' : '');
  return (
    <div className="trace">
      <div className="xwrap">
        <svg key={run} className="tgraph mhub" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
          aria-label={`${m.uses.length} screen fields and ${m.columns.length} Snowflake columns that mean ${m.key}`}>
          <text className="th" x={LX} y={14}>Screens</text>
          <text className="th onto" x={CX} y={14}>Ontology</text>
          <text className="th lane-sf" x={RX} y={14}>Snowflake</text>
          {left.map((u, i) => (
            <motion.path key={'l' + i} className={line(u.means.predicate, u.trace.shift?.screen === m.key)} d={`M${LX + LW},${ly(i) + FH / 2} C${(LX + LW + CX) / 2},${ly(i) + FH / 2} ${(LX + LW + CX) / 2},${mid} ${CX},${mid}`}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr({ duration: 0.4, delay: 0.3 + i * 0.08, ease: EASE_OUT })} />
          ))}
          {right.map((c, i) => (
            <motion.path key={'r' + i} className={line(c.means.predicate)} d={`M${RX},${ry(i) + CH / 2} C${(CX + CW + RX) / 2},${ry(i) + CH / 2} ${(CX + CW + RX) / 2},${mid} ${CX + CW},${mid}`}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr({ duration: 0.4, delay: 0.3 + i * 0.08, ease: EASE_OUT })} />
          ))}
          {left.map((u, i) => {
            const off = u.trace.shift?.screen === m.key;
            return (
              <motion.g key={'lb' + i} className={'tb lane-ui' + (off ? ' off' : '')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tr({ duration: 0.25, delay: i * 0.06 })}>
                <title>{`${u.trace.field.label} on ${u.set.title}`}</title>
                <rect x={LX} y={ly(i)} width={LW} height={FH} rx={7} />
                <text x={LX + 9} y={ly(i) + 17}>{u.trace.field.label.length > 24 ? u.trace.field.label.slice(0, 23) + '…' : u.trace.field.label}</text>
                <text className="sub" x={LX + 9} y={ly(i) + 32}>{off ? `also built from ${u.trace.shift!.field.label}` : u.set.title}</text>
              </motion.g>
            );
          })}
          <motion.g className="tb onto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tr({ duration: 0.3, delay: 0.7 })}>
            <rect x={CX} y={mid - 22} width={CW} height={44} rx={8} />
            <text x={CX + 10} y={mid + 5}>{m.key.length > 25 ? m.key.slice(0, 24) + '…' : m.key}</text>
          </motion.g>
          {right.map((c, i) => (
            <motion.g key={'rb' + i} className="tb lane-sf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tr({ duration: 0.25, delay: i * 0.06 })}>
              <title>{where(c.field.id)}</title>
              <rect x={RX} y={ry(i)} width={RW} height={CH} rx={7} />
              <text x={RX + 9} y={ry(i) + 19}>{(() => { const s = where(c.field.id).split('.').slice(-2).join('.'); return s.length > 36 ? s.slice(0, 35) + '…' : s; })()}</text>
            </motion.g>
          ))}
        </svg>
      </div>
      <p className="small muted mkey"><span className="k exact" /> means exactly <span className="k close" /> means nearly <span className="k related" /> is derived from <span className="k off" /> means something else too</p>
      <ReplayButton label="Replay" onClick={replay} />
    </div>
  );
}

/** One Snowflake column, above the map: every screen field built from it, and what a change to it would reach. */
export function ColumnPanel({ c, who, onUse, onMeaning, onHome, onClose }: {
  c: Column; who(id?: string | null): string; onUse(set: string, slug: string): void; onMeaning(key: string): void; onHome(): void; onClose(): void;
}) {
  const own = c.own[0]?.means ?? null;
  const field = (f: Feed) => <button type="button" className="linkish" onClick={() => onUse(f.set.id, f.trace.slug)}>{f.trace.field.label}</button>;
  const slot = (key: string) => <button type="button" className="linkish" data-meaning={key} onClick={() => onMeaning(key)}><code>{key}</code></button>;
  const questions = c.screens.filter((x) => x.lineage.question);
  return (
    <section className="coach lineage column" aria-label="Column">
      <header>
        <span className="ctag">Column · illustrative</span>
        <b><code>{where(c.key)}</code></b>
        <span className="cact">
          <button type="button" className="vbtn tiny" onClick={onHome}>All columns</button>
          <button type="button" className="vbtn tiny" onClick={onClose}>Close</button>
        </span>
      </header>
      <p className="how">{own ? <>In the ontology it {meansWords(own.predicate)} {slot(own.slot!)}.</> : 'Nothing in the ontology holds it yet.'} Before it changes, here is everything that reads it.</p>
      <ColumnFan c={c} />
      <ul className="mfinds cimpact" aria-label="What a change reaches">
        <li className={c.feeds.length > 1 ? 'reach' : ''}><b>If it changes,</b> {plural(c.feeds.length, 'screen field')} on {plural(c.screens.length, 'screen')} change{c.feeds.length === 1 ? 's' : ''} with it: {c.feeds.map((f, i) => <span key={f.set.id + f.trace.slug}>{i ? ', ' : ''}{field(f)} on {f.set.title}</span>)}.</li>
        {c.shifts.map((f) => (
          <li key={'s' + f.set.id + f.trace.slug} className="bad"><b>Meaning shifts on the way.</b> On {f.set.title}, {field(f)} is built from it, but means {slot(f.trace.means!.slot!)}{own ? <>, where the column means <code>{own.slot}</code></> : ''}.</li>
        ))}
        {c.own.length > 1 && (
          <li className="bad"><b>Screens disagree on what it means.</b> {c.own.map((o, i) => <span key={o.means.slot}>{i ? '; ' : ''}{o.sets.map((x) => x.title).join(' and ')} say{o.sets.length === 1 ? 's' : ''} {slot(o.means.slot!)}</span>)}.</li>
        )}
        {c.confirmed.length > 0 && (
          <li><b>Would come back for a re-check.</b> {c.confirmed.map((f, i) => <span key={'c' + f.set.id + f.trace.slug}>{i ? ', ' : ''}{field(f)} on {f.set.title}, confirmed by {personName(f.trace.confirmedBy, who)}</span>)}. A change to the column changes the code that reads it, and a person's decision holds only while that code stays the same.</li>
        )}
        {questions.length > 0 && (
          <li><b>Questions that read it.</b> {questions.map((x, i) => <span key={x.id}>{i ? ', ' : ''}<a href={hashFor('studio', x.lineage.question!)}>{x.lineage.question}</a> on {x.title}</span>)}.</li>
        )}
      </ul>
      <div className="xwrap">
        <table className="muses cfeeds">
          <thead><tr><th>Screen</th><th>Field</th><th>How it's built from the column</th><th>What the field means</th></tr></thead>
          <tbody>
            {c.feeds.map((f) => (
              <tr key={f.set.id + f.trace.slug} data-feed={`${f.set.id}:${f.trace.slug}`}>
                <td>{f.set.title}</td>
                <td>{field(f)}</td>
                <td><span className="small">{f.via.map((h) => TRANSFORMS[h.transform]).join(', ')} into the data API{f.only ? ', its only column' : `, with ${plural(f.trace.lanes.sf.length - 1, 'other column')}`}</span></td>
                <td>{f.trace.means?.slot ? slot(f.trace.means.slot) : <span className="muted">nothing yet</span>} <span className={'st ' + f.trace.state}>{STATE_WORDS[f.trace.state]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const FW = 780, SX = 8, SW = 210, AX = 292, AW = 220, KX = 572, KW = 200, BH = 40;

/** The column on the right, the data API fields that read it in the middle, and the screen fields they reach on the
 *  left, drawn as the data flows. A field that means something else is red. */
function ColumnFan({ c }: { c: Column }) {
  const [run, replay] = useReplay();
  const apis = [...new Set(c.feeds.flatMap((f) => f.via.map((h) => h.from)))];
  const apiOf = (id: string) => c.feeds.find((f) => f.via.some((h) => h.from === id))!;
  const apiLabel = (id: string) => { const f = apiOf(id).set.lineage.fields.get(id); return f?.label ?? where(id); };
  const apiHop = (id: string) => apiOf(id).via.find((h) => h.from === id)!;
  const rows = Math.max(c.feeds.length, apis.length, 1);
  const span = rows * (BH + GAP) - GAP;
  const H = TOP + span + 16, mid = TOP + span / 2;
  const fy = (i: number) => TOP + (span - (c.feeds.length * (BH + GAP) - GAP)) / 2 + i * (BH + GAP);
  const ay = (i: number) => TOP + (span - (apis.length * (BH + GAP) - GAP)) / 2 + i * (BH + GAP);
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
  const cut = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  return (
    <div className="trace">
      <div className="xwrap">
        <svg key={run} className="tgraph cfan" viewBox={`0 0 ${FW} ${H}`} width={FW} height={H} role="img"
          aria-label={`${where(c.key)} feeds ${c.feeds.length} screen fields through ${apis.length} data API fields`}>
          <text className="th" x={SX} y={14}>Screens</text>
          <text className="th" x={AX} y={14}>Data API</text>
          <text className="th lane-sf" x={KX} y={14}>Snowflake</text>
          {apis.map((id, i) => (
            <motion.path key={'k' + id} className={'hp t-' + apiHop(id).transform} d={curve(KX, mid, AX + AW, ay(i) + BH / 2)}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr({ duration: 0.4, delay: 0.3 + i * 0.08, ease: EASE_OUT })} />
          ))}
          {c.feeds.flatMap((f, i) => f.via.map((h) => {
            const j = apis.indexOf(h.from);
            return (
              <motion.path key={'f' + i + h.from} className={'hp' + (c.shifts.includes(f) ? ' off' : '')} d={curve(AX, ay(j) + BH / 2, SX + SW, fy(i) + BH / 2)}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr({ duration: 0.4, delay: 0.8 + i * 0.08, ease: EASE_OUT })} />
            );
          }))}
          <motion.g className="tb lane-sf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tr({ duration: 0.3 })}>
            <title>{where(c.key)}</title>
            <rect x={KX} y={mid - BH / 2} width={KW} height={BH} rx={7} />
            <text x={KX + 9} y={mid - 2}>{cut(c.field.label, 26)}</text>
            <text className="sub" x={KX + 9} y={mid + 13}>{cut(where(c.key).split('.').slice(0, -1).join('.'), 30)}</text>
          </motion.g>
          {apis.map((id, i) => (
            <motion.g key={'a' + id} className="tb lane-api" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tr({ duration: 0.25, delay: 0.5 + i * 0.06 })}>
              <title>{where(id)}</title>
              <rect x={AX} y={ay(i)} width={AW} height={BH} rx={7} />
              <text x={AX + 9} y={ay(i) + 17}>{cut(apiLabel(id), 28)}</text>
              <text className="sub" x={AX + 9} y={ay(i) + 32}>{TRANSFORMS[apiHop(id).transform]} from it · {cut(apiOf(id).set.title, 20)}</text>
            </motion.g>
          ))}
          {c.feeds.map((f, i) => {
            const off = c.shifts.includes(f);
            return (
              <motion.g key={'s' + i} className={'tb lane-ui' + (off ? ' off' : '')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tr({ duration: 0.25, delay: 1 + i * 0.06 })}>
                <title>{`${f.trace.field.label} on ${f.set.title}`}</title>
                <rect x={SX} y={fy(i)} width={SW} height={BH} rx={7} />
                <text x={SX + 9} y={fy(i) + 17}>{cut(f.trace.field.label, 24)}</text>
                <text className="sub" x={SX + 9} y={fy(i) + 32}>{off ? `means ${cut(f.trace.means!.slot!, 22)}` : cut(f.set.title, 28)}</text>
              </motion.g>
            );
          })}
        </svg>
      </div>
      <ReplayButton label="Replay" onClick={replay} />
    </div>
  );
}

/** Beside the map, for a column: what it means, and why to start from one. */
export function ColumnDetail({ c, model }: { c: Column; model: Model }) {
  const parts = where(c.key).split('.');
  return (
    <>
      <div className="ihead">
        <p className="qmeta"><b>Snowflake column</b> · {plural(c.screens.length, 'screen')} · {plural(c.feeds.length, 'field')}</p>
        <h2>{parts.at(-1)}</h2>
        <p className="small muted"><code>{parts.slice(0, -1).join('.')}</code>, illustrative</p>
      </div>
      <section className="isec">
        <h3>What it means</h3>
        {c.own.length ? c.own.map((o) => {
          const about = aboutOf(model, o.means.slot!);
          return <p key={o.means.slot} className="story">It {meansWords(o.means.predicate)} <code>{o.means.slot}</code>{about.text ? `: ${about.text.replace(/\.$/, '').replace(/^./, (x) => x.toLowerCase())}` : ''}.</p>;
        }) : <p className="story">Nothing in the ontology holds it yet.</p>}
      </section>
      <section className="isec">
        <h3>Why start from a column</h3>
        <p className="small">Before a column is renamed, retyped or dropped, see what reads it. Every screen's mapping set says which fields are built from it, so a change shows its reach, and whose decisions it reopens, before it ships.</p>
      </section>
      <section className="isec">
        <h3>Where it comes from</h3>
        <ul className="legend">{c.screens.map((x) => <li key={x.id}>{x.title}: {x.lineage.version ?? 'its scan'}{x.lineage.date ? `, ${day(x.lineage.date)}` : ''}</li>)}</ul>
        <p className="small muted">Each screen's deep scan reads Snowflake's column export, <code>INFORMATION_SCHEMA.COLUMNS</code>.</p>
      </section>
    </>
  );
}

/** Beside the map, for a meaning: what the ontology says it is, and where the screens' mappings come from. */
export function MeaningDetail({ m, model, sets }: { m: Meaning; model: Model; sets: ScreenSet[] }) {
  const about = aboutOf(model, m.key);
  const waiting = m.findings.find((f): f is Extract<Finding, { kind: 'waiting' }> => f.kind === 'waiting');
  return (
    <>
      <div className="ihead">
        <p className="qmeta"><b>Meaning</b> · {plural(screens(m), 'screen')} · {plural(m.uses.length, 'field')}</p>
        <h2>{m.key}</h2>
      </div>
      <section className="isec">
        <h3>What the ontology says</h3>
        {about.slot ? <p className="story">The <code>{about.slot.name}</code> of a <b>{m.cls}</b>{about.slot.description ? `: ${about.slot.description.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase())}` : ''}. It's {about.slot.relationship ? 'a link to' : 'a'} {about.slot.range}{about.slot.multivalued ? ', one or more' : ''}.</p>
          : <p className="story">{about.cls?.description}</p>}
        {about.cls && <p className="small muted">{m.cls} is owned by the {about.cls.owner} team{about.cls.aliases.length ? `, also called ${about.cls.aliases.join(', ')}` : ''}.</p>}
      </section>
      {waiting && (
        <section className="isec">
          <h3>Waiting for a person · {waiting.uses.length}</h3>
          <ul className="legend">{waiting.uses.map((u) => <li key={u.set.id + u.trace.slug}><span className={'st ' + u.trace.state}>{STATE_WORDS[u.trace.state]}</span> {u.trace.field.label} on {u.set.title}</li>)}</ul>
          <p className="small muted">Open the field on its screen to accept or reject what Claude proposed.</p>
        </section>
      )}
      <section className="isec">
        <h3>Where it comes from</h3>
        <p className="small">Gathered from each screen's mapping set in <code>ontology/mappings/</code>, {plural(sets.length, 'screen')} so far, each written by the deep scan. A field joins its meaning here, whatever the screen calls it, so screens that disagree show up side by side.</p>
      </section>
    </>
  );
}

/** On a class's panel: which of its slots the screens show, and whether they agree. */
export function ScreenUses({ cls, meanings, onMeaning }: { cls: string; meanings: Meaning[]; onMeaning(key: string): void }) {
  const mine = meanings.filter((m) => m.cls === cls && m.uses.length);
  if (!mine.length) return null;
  const n = mine.reduce((s, m) => s + m.uses.length, 0);
  return (
    <section className="isec screenuses">
      <h3>On screens · {plural(n, 'field')}</h3>
      <ul className="legend">
        {mine.map((m) => (
          <li key={m.key}>
            <button type="button" className="linkish" onClick={() => onMeaning(m.key)}><code>{m.slot ?? m.cls}</code></button>
            <span className="small muted"> {m.uses.map((u) => `“${u.trace.field.label}” on ${u.set.title}`).join(', ')}</span>
            {m.problems > 0 && <span className="st shift"> · {plural(m.problems, 'thing')} to look at</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
