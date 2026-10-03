// Lineage by meaning, on screen. The front page lists every meaning the screens carry, those with something to look at
// first, and every screen; a meaning's view draws each screen field and Snowflake column that means it, around it, and
// says where they don't agree. Beside the map: what the ontology says it is. On a class: which of its slots screens show.
import { useState } from 'react';
import { motion } from 'motion/react';
import { EASE_OUT, tr } from '../kit/motion';
import { ReplayButton } from '../kit/ReplayButton';
import { useReplay } from '../kit/useTimeline';
import type { Model } from '../explorer/model';
import { meansWords, tally } from './lineage';
import { day, STATE_WORDS } from './Lineage';
import { PROBLEMS, type Finding, type Meaning, type ScreenSet, type Use } from './meaning';

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

/** What the ontology says a meaning is: its slot's description, or its class's. */
function aboutOf(model: Model, key: string) {
  const [cls, slot] = key.split('.');
  const c = model.classes[cls];
  const s = slot ? c?.slots.find((x) => x.name === slot) : undefined;
  return { cls: c, slot: s, text: s?.description ?? c?.description ?? '' };
}

/** The panel above the map when Lineage opens: start from a meaning, or from a screen. */
export function LineageHome({ sets, meanings, gaps, tab, setTab, onMeaning, onSet, onField, onClose }: {
  sets: ScreenSet[]; meanings: Meaning[]; gaps: { set: ScreenSet; trace: Use['trace'] }[];
  tab: 'meaning' | 'screen'; setTab(t: 'meaning' | 'screen'): void;
  onMeaning(key: string): void; onSet(id: string): void; onField(set: string, slug: string): void; onClose(): void;
}) {
  const [q, setQ] = useState('');
  const words = q.trim().toLowerCase();
  const shown = meanings.filter((m) => !words || m.key.toLowerCase().includes(words) || m.uses.some((u) => u.trace.field.label.toLowerCase().includes(words)));
  return (
    <section className="coach lineage lhome" aria-label="Lineage">
      <header>
        <span className="ctag">Lineage · illustrative</span>
        <b>Where the data comes from</b>
        <span className="cact">
          <span className="seg tiny" role="group" aria-label="Start from">
            <button type="button" aria-pressed={tab === 'meaning'} onClick={() => setTab('meaning')}>By meaning</button>
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

/** Beside the map on lineage's front page: why start from a meaning, and how to read the flags. */
export function LineageAbout({ sets, meanings }: { sets: ScreenSet[]; meanings: Meaning[] }) {
  const fields = sets.reduce((n, s) => n + s.lineage.traces.length, 0);
  const shared = meanings.filter((m) => screens(m) > 1).length;
  return (
    <>
      <div className="ihead">
        <p className="qmeta"><b>Lineage</b> · illustrative</p>
        <h2>Start from a meaning</h2>
        <p className="small muted">Every system, file, table and column here is made up.</p>
      </div>
      <section className="isec">
        <h3>Why a meaning</h3>
        <p className="small">An organization has hundreds of screens. Each field maps to the ontology, not to the next layer, so one meaning gathers every screen that shows it, whatever the screen calls it. {plural(sets.length, 'screen')} so far: {plural(fields, 'field')}, {plural(meanings.length, 'meaning')}, {shared} on more than one screen.</p>
      </section>
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
        <p className="small">One mapping set per screen in <code>ontology/mappings/</code>, each written by the deep scan. The index is worked out from them in the page.</p>
      </section>
    </>
  );
}

/** One meaning, above the map: every screen field and column that means it, drawn around it, and where they disagree. */
export function MeaningPanel({ m, model, onUse, onMeaning, onHome, onClose, onAsk, editable }: {
  m: Meaning; model: Model; onUse(set: string, slug: string): void; onMeaning(key: string): void; onHome(): void; onClose(): void;
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
                <td>{u.trace.lanes.sf.map((c) => <code key={c.id}>{where(c.id)}</code>)}</td>
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
