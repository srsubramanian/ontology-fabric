// The design studio: build the ontology on its class map. Everyone in the organization builds on one shared working
// draft, the repository's checks run on every change, and one click opens a pull request with all of it.
// Routes: #studio for the map, #studio-<Class> to select a class, #studio-CQ-NN to answer a question.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { model as baseModel, rawQuestions, rawSchema } from '../explorer/data';
import { vars } from '../kit/css';
import { hashFor, isShowing, useHash } from '../kit/route';
import { analyse, baseCoverage, patchYaml } from './analysis';
import { Canvas, type Mode, type Selection } from './Canvas';
import { emptyDraft, inverse, live, type DraftDoc, type DraftUpdate, type Point } from './draft';
import { addClass, addSlot, applyOps, classExists, moveClass, removeClass, removeSlot, slotNameProblem, type Ctx, type Op } from './edits';
import { ClassPanel, QuestionPanel, RelPanel } from './Inspector';
import { askPrompt, queryPrompt } from './prompt';
import { SessionCard, StartPull } from './Pull';
import { sampleAdvice, useProfiles, useRuntime, type SampleError } from './runtime';
import { useDraftStore } from './store';

type Entry = { label: string; fwd: DraftUpdate; inv: DraftUpdate };
const snake = (s: string) => s.replace(/(?<!^)(?=[A-Z])/g, '_').toLowerCase();
const ago = (t?: number) => {
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleString();
};
const BASE = rawSchema.version ?? '';

export function App() {
  const rt = useRuntime();
  const store = useDraftStore(rt, BASE);
  const draft = store.draft ?? emptyDraft('loading', BASE);
  const a = useMemo(() => analyse(draft, rawSchema, rawQuestions), [draft]);
  const model = a.report.model ?? baseModel;
  const ctx: Ctx = useMemo(() => ({ draft, base: rawSchema, questions: rawQuestions }), [draft]);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const editable = !!store.draft && draft.status === 'open';

  // What's selected: a class or question from the route, or a relationship picked on the map.
  const view = useHash('studio');
  const [rel, setRel] = useState<string | null>(null);
  useEffect(() => setRel(null), [view]);
  const question = /^CQ-\d+$/.test(view) && rawQuestions.questions.some((q) => q.id === view) ? view : null;
  const selected: Selection = rel && model.relationships.some((r) => r.id === rel) ? { kind: 'rel', id: rel }
    : Object.hasOwn(model.classes, view) ? { kind: 'class', id: view } : null;
  const select = useCallback((s: Selection) => {
    if (s?.kind === 'rel') { setRel(s.id); return; }
    setRel(null);
    location.hash = hashFor('studio', s?.id ?? '');
  }, []);
  const [fresh, setFresh] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('select');
  const [walking, setWalking] = useState(false);
  useEffect(() => { setWalking(false); }, [question]);
  const effectiveMode: Mode = walking && question ? 'walk' : mode;

  // Every change goes through edit(), which keeps its inverse for Undo.
  const [hist, setHist] = useState<{ undo: Entry[]; redo: Entry[] }>({ undo: [], redo: [] });
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  useEffect(() => { if (!note) return; const t = window.setTimeout(() => setNote(null), 6000); return () => clearTimeout(t); }, [note]);
  const write = store.write;
  const edit = useCallback(async (u: DraftUpdate, label: string) => {
    if (!editable) return;
    const inv = inverse(ctxRef.current.draft, u);
    setHist((h) => ({ undo: [...h.undo.slice(-49), { label, fwd: u, inv }], redo: [] }));
    const err = await write(u);
    if (err) setNote({ text: err, bad: true });
  }, [editable, write]);
  const undo = useCallback(async () => {
    const e = hist.undo[hist.undo.length - 1];
    if (!e || !editable) return;
    setHist((h) => ({ undo: h.undo.slice(0, -1), redo: [...h.redo, e] }));
    const err = await write(e.inv);
    setNote(err ? { text: err, bad: true } : { text: `Undid: ${e.label}` });
  }, [hist, editable, write]);
  const redo = useCallback(async () => {
    const e = hist.redo[hist.redo.length - 1];
    if (!e || !editable) return;
    setHist((h) => ({ undo: [...h.undo, e], redo: h.redo.slice(0, -1) }));
    const err = await write(e.fwd);
    setNote(err ? { text: err, bad: true } : { text: `Redid: ${e.label}` });
  }, [hist, editable, write]);

  // On the map.
  const place = (at: Point) => {
    let n = 1, name = 'NewClass';
    while (classExists(ctx, name)) name = `NewClass${++n}`;
    void edit(addClass(ctx, name, {}, at), `add ${name}`);
    setMode('select'); setFresh(name); select({ kind: 'class', id: name });
  };
  const link = (from: string, to: string) => {
    let name = snake(to), n = 1;
    while (slotNameProblem(ctx, from, name)) name = `${snake(to)}_${++n}`;
    void edit(addSlot(ctx, from, name, to), `relate ${from} to ${to}`);
    setFresh(`${from}.${name}`); select({ kind: 'rel', id: `${from}.${name}` });
  };
  const walkTo = (relId: string) => {
    if (!question) return;
    const q = rawQuestions.questions.find((x) => x.id === question)!;
    const r = model.relationships.find((x) => x.id === relId)!;
    const ans = draft.answers[question] ?? { answered_in: q.answered_in, walks: [], query: '' };
    void edit({ answers: { [question]: { ...ans, walks: [...ans.walks, `${r.from}.${r.slot}`] } } }, `add ${relId} to ${question}'s walk`);
  };

  // Keys: Delete removes what the draft added, Escape steps back, Ctrl or Cmd Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isShowing('studio')) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && editable) {
        if (selected.kind === 'class' && draft.classes[selected.id]?.added) { e.preventDefault(); void edit(removeClass(ctx, selected.id), `remove ${selected.id}`); select(null); }
        if (selected.kind === 'rel') {
          const r = model.relationships.find((x) => x.id === selected.id);
          const key = r && `${r.from}:${r.slot}`;
          if (key && draft.slots[key]) { e.preventDefault(); void edit(removeSlot(ctx, key), `remove ${selected.id}`); select(null); }
        }
      } else if (e.key === 'Escape') {
        if (mode !== 'select' || walking) { setMode('select'); setWalking(false); } else select(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void (e.shiftKey ? redo() : undo());
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Claude: a request in plain words becomes ops, applied to the draft as one change you can undo.
  const [ask, setAsk] = useState('');
  const [asking, setAsking] = useState<AbortController | null>(null);
  const ctlRef = useRef<AbortController | null>(null);
  useEffect(() => () => ctlRef.current?.abort(), []);
  const askClaude = async () => {
    if (!rt.sample || !ask.trim() || asking) return;
    const ctl = new AbortController();
    ctlRef.current = ctl; setAsking(ctl);
    const focus = selected ? `${selected.kind === 'class' ? 'class' : 'relationship'} ${selected.id}` : question ? `question ${question}` : undefined;
    try {
      const res = await rt.sample.json<{ summary?: string; ops?: Op[] }>(askPrompt(a.schema, a.questions, ask, focus), { signal: ctl.signal, cache: false });
      const { update, done, skipped } = applyOps(ctxRef.current, Array.isArray(res?.ops) ? res.ops : []);
      if (done.length) await edit(update, `Claude: ${res.summary || ask}`);
      setNote({ text: done.length ? `Claude ${done.join(', ')}.${skipped.length ? ` Skipped ${skipped.length}: ${skipped.join(' ')}` : ''}` : `Claude didn't change anything${skipped.length ? `: ${skipped.join(' ')}` : '.'}`, bad: !done.length });
      if (done.length) setAsk('');
    } catch (e) {
      const msg = sampleAdvice(e as SampleError);
      if (msg) setNote({ text: msg, bad: true });
    } finally { setAsking(null); }
  };
  const [writingQuery, setWritingQuery] = useState(false);
  const writeQuery = async () => {
    if (!rt.sample || !question) return;
    const q = rawQuestions.questions.find((x) => x.id === question)!;
    const ans = draft.answers[question] ?? { answered_in: q.answered_in, walks: [], query: '' };
    setWritingQuery(true);
    try {
      const res = await rt.sample.json<{ query?: string }>(queryPrompt(a.schema, { ...q, answered_in: ans.answered_in }, ans.walks), { cache: false });
      if (res?.query) await edit({ answers: { [question]: { ...ans, query: String(res.query) } } }, `Claude wrote ${question}'s query`);
    } catch (e) {
      const msg = sampleAdvice(e as SampleError);
      if (msg) setNote({ text: msg, bad: true });
    } finally { setWritingQuery(false); }
  };

  // What the checks say, and what they name, so the map can ring it.
  const problems = a.report.problems;
  const pass = problems.length === 0;
  const flagged = useMemo(() => {
    const out = new Set<string>();
    const names = [...Object.keys(model.classes), ...model.relationships.map((r) => r.id)];
    for (const p of problems) for (const n of names) if (new RegExp(`(^|[^A-Za-z0-9_.])${n.replace('.', '\\.')}([^A-Za-z0-9_]|$)`).test(p)) out.add(n);
    return out;
  }, [problems, model]);
  const added = useMemo(() => new Set(live(draft.classes).filter(([, e]) => e.added).map(([n]) => n)), [draft]);
  const addedRels = useMemo(() => new Set(a.changes.relationships), [a]);
  const walkLit = useMemo(() => (question ? a.report.model?.questions.find((q) => q.id === question)?.steps.map((s) => s.relationship.id) ?? [] : []), [a, question]);
  const base = baseCoverage(rawSchema, rawQuestions);
  const cov = a.report.coverage;
  const [showProblems, setShowProblems] = useState(false);
  const [showYaml, setShowYaml] = useState(false);
  const people = useProfiles(rt.user, [draft.updatedBy, draft.session?.by]);
  const who = (id?: string | null) => (!id ? 'someone' : id === rt.me.id ? 'you' : people[id]?.name || 'someone');
  const gaps = rawQuestions.questions.filter((q) => q.gap);
  const panel = { ctx, a, model, editable, edit: (u: DraftUpdate, l: string) => void edit(u, l), select };

  return (
    <main className="studio" data-mode={effectiveMode}>
      <div className="stool" role="toolbar" aria-label="Build">
        <button type="button" className={'vbtn' + (mode === 'place' ? ' on' : '')} aria-pressed={mode === 'place'} disabled={!editable}
          onClick={() => setMode(mode === 'place' ? 'select' : 'place')}>{mode === 'place' ? 'Click the map to place it' : '+ Class'}</button>
        <form className="ask" onSubmit={(e) => { e.preventDefault(); void askClaude(); }}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} disabled={!rt.sample || !editable || !!asking}
            placeholder={rt.sample ? 'Ask Claude to build: "give fraud reports a fraud type: lost, stolen, counterfeit"' : 'Claude builds here on the published page'}
            aria-label="Ask Claude to build something" />
          {asking ? <button type="button" className="vbtn" onClick={() => asking.abort()}>Stop</button>
            : <button type="submit" className="vbtn go" disabled={!rt.sample || !ask.trim() || !editable}>Build</button>}
        </form>
        <span className="tgroup">
          <button type="button" className="vbtn" disabled={!hist.undo.length || !editable} onClick={() => void undo()} title={hist.undo.at(-1)?.label}>Undo</button>
          <button type="button" className="vbtn" disabled={!hist.redo.length || !editable} onClick={() => void redo()}>Redo</button>
          <button type="button" className={'vbtn' + (showYaml ? ' on' : '')} aria-pressed={showYaml} onClick={() => setShowYaml(!showYaml)}>YAML</button>
        </span>
      </div>
      {asking && <p className="working" role="status">Claude is building… changes land on the map when it's done.</p>}
      {store.draft && draft.base !== BASE && (
        <p className="banner">This draft builds on version {draft.base}; the released ontology is now {BASE}. <button type="button" className="vbtn" onClick={() => void store.startNext()}>Start a fresh draft</button></p>
      )}
      {store.error && <p className="banner bad">{store.error}</p>}

      <div className="sgrid">
        <div className="mapcol">
          <div className="xwrap">
            <Canvas model={model} layout={a.patch.layout} added={added} addedRels={addedRels} flagged={flagged}
              selected={selected} lit={walkLit} mode={effectiveMode} editable={editable}
              onSelect={select} onPlace={place} onMove={(n, at) => void edit(moveClass(ctx, n, at), `move ${n}`)} onLink={link} onWalk={walkTo} />
          </div>
          {showYaml && (
            <div className="yaml">
              <div className="yhead"><b>The draft as a patch</b>
                <button type="button" className="vbtn" onClick={() => { navigator.clipboard?.writeText(patchYaml(a.patch)).then(() => setNote({ text: 'Copied.' }), () => setNote({ text: 'Copy failed: select the text instead.', bad: true })); }}>Copy</button>
              </div>
              <pre>{patchYaml(a.patch)}</pre>
            </div>
          )}
        </div>

        <aside className="inspector" aria-live="polite">
          {question ? (
            <QuestionPanel ctx={ctx} a={a} editable={editable} edit={panel.edit} id={question} walking={walking} setWalking={setWalking}
              writeQuery={rt.sample ? () => void writeQuery() : undefined} busy={writingQuery} />
          ) : selected?.kind === 'class' ? (
            <ClassPanel key={selected.id} {...panel} name={selected.id} fresh={fresh === selected.id} />
          ) : selected?.kind === 'rel' ? (
            <RelPanel key={selected.id} {...panel} id={selected.id} fresh={fresh === selected.id} />
          ) : (
            <Overview d={draft} a={a} shared={store.shared} loaded={!!store.draft} who={who} gaps={gaps} editable={editable}
              pull={draft.status === 'pr' && draft.session ? <SessionCard d={draft} mcp={rt.mcp} />
                : !store.shared ? <p className="small muted">Pull requests open from the published page, where the draft is shared.</p>
                  : !rt.me.canEdit ? <p className="small muted">Someone who can edit this page opens the pull request.</p>
                    : !rt.mcp ? <p className="small muted">Opening a pull request needs the Claude Code Remote connector.</p>
                      : !a.changes.count ? <p className="small muted">Build something first.</p>
                        : !pass ? <p className="small muted">Every check must pass first.</p>
                          : <StartPull d={draft} a={a} mcp={rt.mcp} me={rt.me.id!} write={write} />}
              next={draft.status === 'pr' ? () => void store.startNext() : undefined}
              onPick={(id) => (id.startsWith('CQ-') ? select({ kind: 'class', id }) : select(id.includes('.') ? { kind: 'rel', id } : { kind: 'class', id }))} />
          )}
        </aside>
      </div>

      <div className="sstatus" data-pass={pass ? '' : undefined}>
        <button type="button" className="checks" onClick={() => setShowProblems(!showProblems)} aria-expanded={showProblems}>
          {pass ? '✓ Every check passes' : `✗ ${problems.length} problem${problems.length === 1 ? '' : 's'}`}
        </button>
        <span><b>{cov.answered}</b> of {cov.questions} questions answered{cov.answered !== base.answered && <em className={cov.answered > base.answered ? 'up' : 'down'}> {cov.answered > base.answered ? '+' : ''}{cov.answered - base.answered}</em>}</span>
        <span><b>{cov.mapped}</b> of {cov.concrete} classes mapped to a standard</span>
        {a.lane !== 'none' && <span className="lane" style={vars({ '--c': a.lane === 'minor' ? 'var(--onto)' : 'var(--muted)' })}>{a.lane} change · {a.owners.join(', ')}</span>}
        <span className="live">{!store.draft ? 'Loading…' : store.shared ? `Shared · ${draft.updatedBy ? `last change by ${who(draft.updatedBy)} ${ago(draft.updatedAt)}` : 'no changes yet'}` : 'Kept in this browser'}</span>
      </div>
      {showProblems && problems.length > 0 && (
        <ul className="plist">
          {problems.map((p, i) => {
            const target = [...flagged].find((n) => p.includes(n));
            return <li key={i}><button type="button" onClick={() => target && (target.includes('.') ? select({ kind: 'rel', id: target }) : select({ kind: 'class', id: target }))}>{p}</button></li>;
          })}
        </ul>
      )}
      {note && <p className={'toast' + (note.bad ? ' bad' : '')} role="status">{note.text}</p>}
    </main>
  );
}

function Overview({ d, a, shared, loaded, who, gaps, editable, pull, next, onPick }: {
  d: DraftDoc; a: ReturnType<typeof analyse>; shared: boolean; loaded: boolean; who: (id?: string | null) => string;
  gaps: { id: string; question: string; domain: string }[]; editable: boolean; pull: React.ReactNode; next?: () => void; onPick: (id: string) => void;
}) {
  const c = a.changes;
  const items = [
    ...c.newClasses.map((n) => [n, `+ class ${n}`]), ...c.relationships.map((n) => [n, `+ ${n}`]), ...c.fields.map((n) => [n.split('.')[0], `+ field ${n}`]),
    ...c.enums.map((n) => ['', `+ enum ${n}`]), ...c.editedClasses.map((n) => [n, `~ ${n}`]), ...c.answers.map((n) => [n, `✓ answers ${n}`]),
  ];
  const state = (id: string) => (!d.answers[id] ? 'gap' : a.report.problems.some((p) => p.startsWith(id + ':')) ? 'failing' : 'answered');
  return (
    <>
      <div className="ihead">
        <h2>Working draft</h2>
        <p className="small muted">{!loaded ? 'Loading…' : shared ? 'Everyone in your organization builds on this draft; changes appear as they happen.' : 'Kept in this browser. On the published page, the team shares one draft.'} Builds on version {d.base}.</p>
      </div>
      {editable && !c.count && (
        <p className="hint big">Click <b>+ Class</b>, then a spot on the map. Select a class and drag its <b>⊕</b> onto another to relate them. Or ask Claude to build something.</p>
      )}
      {c.count > 0 && (
        <section className="isec">
          <h3>What it changes · {c.count}</h3>
          <ul className="changes">{items.map(([id, label], i) => <li key={i}>{id ? <button type="button" onClick={() => onPick(id)}>{label}</button> : label}</li>)}</ul>
        </section>
      )}
      <section className="isec">
        <h3>Questions to answer · {gaps.filter((g) => state(g.id) !== 'answered').length} open</h3>
        <ul className="qlist2">
          {gaps.map((g) => (
            <li key={g.id}><a href={hashFor('studio', g.id)} data-view={g.id}><span className={'qs ' + state(g.id)} aria-hidden="true" /><b>{g.id}</b> {g.question}</a></li>
          ))}
        </ul>
      </section>
      <section className="isec">
        <h3>Pull request</h3>
        {pull}
        {next && <button type="button" className="vbtn" onClick={next}>Start the next draft</button>}
      </section>
      {d.updatedBy && shared && <p className="small muted">Last change by {who(d.updatedBy)}.</p>}
    </>
  );
}
