// The design studio: build the ontology on its class map. Everyone in the organization builds on one shared working
// draft, the repository's checks run on every change, and one click opens a pull request with all of it. Missions
// coach payments people through answering a question, step by step, on the same map and the same draft.
// Routes: #studio for the map, #studio-<Class> to select a class, #studio-CQ-NN to answer a question, and
// #studio-mission-CQ-NN for a mission.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { model as baseModel, rawQuestions, rawSchema } from '../explorer/data';
import { vars } from '../kit/css';
import { reduce } from '../kit/motion';
import { hashFor, isShowing, useHash } from '../kit/route';
import { analyse, baseCoverage, patchYaml } from './analysis';
import { Canvas, type Demo, type Mode, type Selection } from './Canvas';
import { Coach, type Said } from './Coach';
import { emptyDraft, inverse, live, type DraftDoc, type DraftUpdate, type Point } from './draft';
import { addClass, addSlot, applyOps, classExists, moveClass, removeClass, removeSlot, slotNameProblem, type Ctx, type Op } from './edits';
import { ClassPanel, QuestionPanel, RelPanel } from './Inspector';
import { doStep, missionById, MISSIONS, pendingLink, placeSpot, progress, stepLabel, type Choice, type Mission } from './missions';
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

/** What this viewer has seen: the think steps they answered, and whether they closed the welcome. Kept in this browser. */
const kept = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not kept */ } },
};

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

  // What's selected: a class or question from the route, or a relationship picked on the map. In a mission the
  // route holds the mission, so what's picked on the map stays local.
  const view = useHash('studio');
  const mission = view.startsWith('mission-') ? missionById(view.slice('mission-'.length)) ?? null : null;
  const [rel, setRel] = useState<string | null>(null);
  const [picked, setPicked] = useState<Selection>(null);
  useEffect(() => { setRel(null); setPicked(null); }, [view]);
  const question = /^CQ-\d+$/.test(view) && rawQuestions.questions.some((q) => q.id === view) ? view : null;
  const exists = (s: Selection) => !!s && (s.kind === 'rel' ? model.relationships.some((r) => r.id === s.id) : Object.hasOwn(model.classes, s.id));
  const selected: Selection = mission ? (exists(picked) ? picked : null)
    : rel && model.relationships.some((r) => r.id === rel) ? { kind: 'rel', id: rel }
      : Object.hasOwn(model.classes, view) ? { kind: 'class', id: view } : null;
  const inMission = !!mission;
  const select = useCallback((s: Selection) => {
    if (inMission) { setPicked(s); return; }
    if (s?.kind === 'rel') { setRel(s.id); return; }
    setRel(null);
    location.hash = hashFor('studio', s?.id ?? '');
  }, [inMission]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('select');
  const [walking, setWalking] = useState(false);
  useEffect(() => { setWalking(false); setMode('select'); }, [question, mission]);

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

  // A mission: the step it's on comes from the shared draft, and the think steps this viewer answered.
  const [thought, setThought] = useState<Set<string>>(() => new Set(kept.get<string[]>('studio:thought', [])));
  const step = mission ? progress(mission, ctx, a, thought) : 0;
  const s = mission?.steps[step];
  const [said, setSaid] = useState<Said | null>(null);
  const [placing, setPlacing] = useState(false);
  const [demo, setDemo] = useState<Demo | null>(null);
  useEffect(() => { setPlacing(false); setDemo(null); }, [mission, step]);
  useEffect(() => { setSaid(null); }, [mission]);
  const target = useMemo(() => (mission && s?.kind === 'place' && editable ? placeSpot(mission, step, ctx) : undefined), [mission, s, step, ctx, editable]);
  const doIt = (opts: Parameters<typeof doStep>[3] = {}) => {
    if (!mission || !s) return;
    void edit(doStep(mission, step, ctxRef.current, opts), `${mission.title}: ${stepLabel(s).toLowerCase()}`);
  };
  const choose = (c: Choice & { name?: string }) => {
    if (!mission || !s) return;
    if (!c.right) { setSaid({ text: `Not quite. ${c.why}`, right: false }); return; }
    setSaid({ text: c.why, right: true });
    if (s.kind === 'think') {
      const next = new Set(thought).add(`${mission.id}:${step}`);
      setThought(next); kept.set('studio:thought', [...next]);
    } else doIt();
  };
  const nextMission = (m: Mission) => MISSIONS.slice(MISSIONS.indexOf(m) + 1).concat(MISSIONS.slice(0, MISSIONS.indexOf(m)))
    .find((x) => progress(x, ctx, a, thought) < x.steps.length);
  const effectiveMode: Mode = (walking && question) || s?.kind === 'walk' ? 'walk' : placing ? 'place' : mode;

  // On the map.
  const place = (at: Point, exact?: boolean) => {
    if (mission && s?.kind === 'place') {
      setSaid(null);
      doIt(exact ? {} : { near: [at[0] + 70, at[1] + 24] });
      return;
    }
    let n = 1, name = 'NewClass';
    while (classExists(ctx, name)) name = `NewClass${++n}`;
    void edit(addClass(ctx, name, {}, { at }), `add ${name}`);
    setMode('select'); setFresh(name); select({ kind: 'class', id: name });
  };
  const link = (from: string, to: string) => {
    if (mission && s?.kind === 'link') {
      if (from !== s.from || to !== s.to) {
        setSaid({ text: from === s.to && to === s.from ? `Start from ${s.from}: the line reads ${s.from} → ${s.to}.` : `Let go over ${s.to}.`, right: false });
        return;
      }
      if (pendingLink(s, ctx)) return;
      setSaid(null);
    }
    let name = snake(to), n = 1;
    while (slotNameProblem(ctx, from, name)) name = `${snake(to)}_${++n}`;
    void edit(addSlot(ctx, from, name, to), `relate ${from} to ${to}`);
    if (mission) return;
    setFresh(`${from}.${name}`); select({ kind: 'rel', id: `${from}.${name}` });
  };
  const walkTo = (relId: string) => {
    if (mission && s?.kind === 'walk') {
      const ans = draft.answers[mission.id];
      const walks = ans?.walks ?? [];
      const upto = Math.max(0, s.walks.findIndex((w, i) => walks[i] !== w));
      const want = s.walks[upto];
      if (relId !== want) { setSaid({ text: `That's ${relId}. Look for the pulsing line: ${want}.`, right: false }); return; }
      setSaid(null);
      const q = rawQuestions.questions.find((x) => x.id === mission.id)!;
      void edit({ answers: { [mission.id]: { answered_in: ans?.answered_in ?? q.answered_in, query: ans?.query ?? '', walks: [...s.walks.slice(0, upto), relId] } } }, `walk ${relId}`);
      return;
    }
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
        if (mode !== 'select' || walking || placing) { setMode('select'); setWalking(false); setPlacing(false); } else select(null);
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
    const id = question ?? mission?.id;
    if (!rt.sample || !id) return;
    const q = rawQuestions.questions.find((x) => x.id === id)!;
    const ans = draft.answers[id] ?? { answered_in: q.answered_in, walks: [], query: '' };
    setWritingQuery(true);
    try {
      const res = await rt.sample.json<{ query?: string }>(queryPrompt(a.schema, { ...q, answered_in: ans.answered_in }, ans.walks), { cache: false });
      if (res?.query) await edit({ answers: { [id]: { ...ans, query: String(res.query) } } }, `Claude wrote ${id}'s query`);
    } catch (e) {
      const msg = sampleAdvice(e as SampleError);
      if (msg) setNote({ text: msg, bad: true });
    } finally { setWritingQuery(false); }
  };

  // What the checks say, and what they name, so the map can ring it. Problems in the ontology block the pull request;
  // the class map's tidy-ups don't, since its session tidies them.
  const problems = a.blocking;
  const pass = problems.length === 0;
  const flagged = useMemo(() => {
    const out = new Set<string>();
    const names = [...Object.keys(model.classes), ...model.relationships.map((r) => r.id)];
    for (const p of problems) for (const n of names) if (new RegExp(`(^|[^A-Za-z0-9_.])${n.replace('.', '\\.')}([^A-Za-z0-9_]|$)`).test(p)) out.add(n);
    return out;
  }, [problems, model]);
  const tidyUps = a.tidyUps;
  const added = useMemo(() => new Set(live(draft.classes).filter(([, e]) => e.added).map(([n]) => n)), [draft]);
  const addedRels = useMemo(() => new Set(a.changes.relationships), [a]);
  const lightQ = question ?? mission?.id;
  const walkLit = useMemo(() => (lightQ ? a.report.model?.questions.find((q) => q.id === lightQ)?.steps.map((x) => x.relationship.id) ?? [] : []), [a, lightQ]);
  // A mission's hints on the map: what it works on, what to use next, where to drag from, and where to place.
  const hints = useMemo(() => {
    if (!mission || !s) return {};
    const pulse = new Set<string>();
    let handleOn: string | undefined;
    if (s.kind === 'link' && !pendingLink(s, ctx)) { pulse.add(s.from).add(s.to); handleOn = s.from; }
    if (s.kind === 'fields') pulse.add(s.cls);
    if (s.kind === 'walk') {
      const walks = draft.answers[mission.id]?.walks ?? [];
      const upto = Math.max(0, s.walks.findIndex((w, i) => walks[i] !== w));
      if (s.walks[upto]) pulse.add(s.walks[upto]);
    }
    const mine = mission.steps.flatMap((x) => (x.kind === 'place' ? [x.cls.name] : []));
    return { focus: new Set([...mission.focus, ...mine]), pulse, handleOn };
  }, [mission, s, ctx, draft]);
  const show = mission && s && (s.kind === 'place' || s.kind === 'link' || s.kind === 'walk') ? () => setDemo({
    key: Date.now(), ...(s.kind === 'place' ? { kind: 'place' as const, at: target! } : s.kind === 'link' ? { kind: 'drag' as const, from: s.from, to: s.to }
      : { kind: 'walk' as const, rels: s.walks }),
  }) : undefined;
  // Each new step brings what it points at into view, below the coach.
  useEffect(() => {
    if (!mission) return;
    const t = window.setTimeout(() => {
      if (!isShowing('studio')) return;
      const el = document.querySelector('[data-app=studio] .canvas :is(.spot, [data-handle], .cr.pulse, .cn.pulse)');
      if (!el) return;
      const r = el.getBoundingClientRect(), coach = document.querySelector('[data-app=studio] .coach')?.getBoundingClientRect();
      if (r.top < (coach?.bottom ?? 0) || r.bottom > innerHeight - 60) el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }, 400);
    return () => window.clearTimeout(t);
  }, [mission, step]);
  const [welcome, setWelcome] = useState(() => !kept.get('studio:welcomed', false));
  useEffect(() => { if (mission && welcome) { setWelcome(false); kept.set('studio:welcomed', true); } }, [mission, welcome]);
  const firstOpen = MISSIONS.find((x) => progress(x, ctx, a, thought) < x.steps.length);
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
        {mission ? <a className="vbtn" href={hashFor('studio', '')}>← All missions</a> : (
          <button type="button" className={'vbtn' + (mode === 'place' ? ' on' : '')} aria-pressed={mode === 'place'} disabled={!editable}
            onClick={() => setMode(mode === 'place' ? 'select' : 'place')}>{mode === 'place' ? 'Click the map to place it' : '+ Class'}</button>
        )}
        {!mission && <form className="ask" onSubmit={(e) => { e.preventDefault(); void askClaude(); }}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} disabled={!rt.sample || !editable || !!asking}
            placeholder={rt.sample ? 'Ask Claude to build: "give fraud reports a fraud type: lost, stolen, counterfeit"' : 'Claude builds here on the published page'}
            aria-label="Ask Claude to build something" />
          {asking ? <button type="button" className="vbtn" onClick={() => asking.abort()}>Stop</button>
            : <button type="submit" className="vbtn go" disabled={!rt.sample || !ask.trim() || !editable}>Build</button>}
        </form>}
        {mission && <span className="mtitle"><b>{mission.id}</b> {rawQuestions.questions.find((q) => q.id === mission.id)?.question}</span>}
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
          {mission && !store.draft ? (
            <section className="coach" aria-label={`Mission: ${mission.title}`}><p className="say muted">Loading the working draft…</p></section>
          ) : mission ? (
            <Coach m={mission} at={step} ctx={ctx} a={a} editable={editable} said={said} onChoice={choose}
              onFields={(values) => { setSaid(null); doIt({ values }); }} onUseQuery={() => { setSaid(null); doIt(); }}
              writeQuery={rt.sample ? () => void writeQuery() : undefined} busy={writingQuery} placing={placing} setPlacing={setPlacing}
              onShow={show} onDoIt={() => (s?.kind === 'think' ? choose(s.choices.find((c) => c.right)!) : (setSaid(null), doIt()))}
              onRestartWalk={() => void edit({ answers: { [mission.id]: { ...(draft.answers[mission.id] ?? { answered_in: rawQuestions.questions.find((q) => q.id === mission.id)!.answered_in, query: '' }), walks: [] } } }, `start ${mission.id}'s walk over`)}
              onLeave={() => { location.hash = hashFor('studio', ''); }}
              next={nextMission(mission)} onNext={() => { const n = nextMission(mission); if (n) location.hash = hashFor('studio', `mission-${n.id}`); }} />
          ) : welcome && !question && (
            <section className="coach welcome" aria-label="Welcome">
              <header><span className="ctag">New here?</span><b>Build the ontology by answering real questions</b></header>
              <p className="say">Each mission takes one question risk can't answer yet, like what kind of fraud a report was, and builds the answer with you on the map in a few steps. No modelling background needed: it's in payments words, and every step says why.</p>
              <div className="row">
                {firstOpen && <a className="vbtn go" href={hashFor('studio', `mission-${firstOpen.id}`)}>Start a mission: {firstOpen.title}</a>}
                <button type="button" className="vbtn" onClick={() => { setWelcome(false); kept.set('studio:welcomed', true); }}>I know my way around</button>
              </div>
            </section>
          )}
          <div className="xwrap">
            <Canvas model={model} layout={a.patch.layout} added={added} addedRels={addedRels} flagged={flagged}
              selected={selected} lit={walkLit} mode={effectiveMode} editable={editable}
              focus={hints.focus} pulse={hints.pulse} handleOn={hints.handleOn} target={placing ? undefined : target}
              demo={demo} onDemoEnd={() => setDemo(null)}
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
          {mission && selected && <button type="button" className="vbtn tiny back" onClick={() => select(null)}>← Back to the mission</button>}
          {mission && !selected ? (
            <MissionPanel m={mission} at={step} ctx={ctx} a={a} thought={thought} />
          ) : question ? (
            <QuestionPanel ctx={ctx} a={a} editable={editable} edit={panel.edit} id={question} walking={walking} setWalking={setWalking}
              writeQuery={rt.sample ? () => void writeQuery() : undefined} busy={writingQuery} />
          ) : selected?.kind === 'class' ? (
            <ClassPanel key={selected.id} {...panel} name={selected.id} fresh={fresh === selected.id} />
          ) : selected?.kind === 'rel' ? (
            <RelPanel key={selected.id} {...panel} id={selected.id} fresh={fresh === selected.id} />
          ) : (
            <Overview d={draft} a={a} ctx={ctx} thought={thought} shared={store.shared} loaded={!!store.draft} who={who} gaps={gaps} editable={editable}
              pull={draft.status === 'pr' && draft.session ? <SessionCard d={draft} mcp={rt.mcp} />
                : !store.shared ? <p className="small muted">Pull requests open from the published page, where the draft is shared.</p>
                  : !rt.me.canEdit ? <p className="small muted">Someone who can edit this page opens the pull request.</p>
                    : !rt.mcp ? <p className="small muted">Opening a pull request needs the Claude Code Remote connector.</p>
                      : !a.changes.count ? <p className="small muted">Build something first.</p>
                        : !pass ? <p className="small muted">The ontology's checks must pass first. Map tidy-ups don't block it.</p>
                          : <StartPull d={draft} a={a} mcp={rt.mcp} me={rt.me.id!} write={write} />}
              next={draft.status === 'pr' ? () => void store.startNext() : undefined}
              onPick={(id) => (id.startsWith('CQ-') ? select({ kind: 'class', id }) : select(id.includes('.') ? { kind: 'rel', id } : { kind: 'class', id }))} />
          )}
        </aside>
      </div>

      <div className="sstatus" data-pass={pass ? '' : undefined}>
        <button type="button" className="checks" onClick={() => setShowProblems(!showProblems)} aria-expanded={showProblems}>
          {!pass ? `✗ ${problems.length} problem${problems.length === 1 ? '' : 's'}` : tidyUps.length ? '✓ Every ontology check passes' : '✓ Every check passes'}
        </button>
        {tidyUps.length > 0 && (
          <button type="button" className="tidy" onClick={() => setShowProblems(!showProblems)} aria-expanded={showProblems}
            title="Lines or boxes overlap on the class map. They don't block anything: the pull request's session tidies them.">
            {tidyUps.length} map tidy-up{tidyUps.length === 1 ? '' : 's'}
          </button>
        )}
        <span><b>{cov.answered}</b> of {cov.questions} questions answered{cov.answered !== base.answered && <em className={cov.answered > base.answered ? 'up' : 'down'}> {cov.answered > base.answered ? '+' : ''}{cov.answered - base.answered}</em>}</span>
        <span><b>{cov.mapped}</b> of {cov.concrete} classes mapped to a standard</span>
        {a.lane !== 'none' && <span className="lane" style={vars({ '--c': a.lane === 'minor' ? 'var(--onto)' : 'var(--muted)' })}>{a.lane} change · {a.owners.join(', ')}</span>}
        <span className="live">{!store.draft ? 'Loading…' : store.shared ? `Shared · ${draft.updatedBy ? `last change by ${who(draft.updatedBy)} ${ago(draft.updatedAt)}` : 'no changes yet'}` : 'Kept in this browser'}</span>
      </div>
      {showProblems && (problems.length > 0 || tidyUps.length > 0) && (
        <ul className="plist">
          {problems.map((p, i) => {
            const at = [...flagged].find((n) => p.includes(n));
            return <li key={i}><button type="button" onClick={() => at && (at.includes('.') ? select({ kind: 'rel', id: at }) : select({ kind: 'class', id: at }))}>{p}</button></li>;
          })}
          {tidyUps.length > 0 && <li className="tidyhead">Map tidy-ups. They don't block the pull request, whose session moves boxes and lines until the layout check passes. You can drag the new classes yourself.</li>}
          {tidyUps.map((p, i) => <li key={'t' + i} className="tidyup">{p}</li>)}
        </ul>
      )}
      {note && <p className={'toast' + (note.bad ? ' bad' : '')} role="status">{note.text}</p>}
    </main>
  );
}

function Overview({ d, a, ctx, thought, shared, loaded, who, gaps, editable, pull, next, onPick }: {
  d: DraftDoc; a: ReturnType<typeof analyse>; ctx: Ctx; thought: Set<string>; shared: boolean; loaded: boolean; who: (id?: string | null) => string;
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
      <section className="isec">
        <h3>Missions · learn by building</h3>
        <ul className="missions">
          {MISSIONS.map((m) => {
            const at = progress(m, ctx, a, thought), n = m.steps.length;
            return (
              <li key={m.id}>
                <a href={hashFor('studio', `mission-${m.id}`)} data-view={`mission-${m.id}`} className={at >= n ? 'done' : at > 0 ? 'started' : ''}>
                  <span className="mring" aria-hidden="true" style={vars({ '--p': String(at / n) })} />
                  <span><b>{m.title}</b><span className="small muted">{m.id} · {m.team} · {m.learn}</span></span>
                  <span className="mstate">{at >= n ? 'Done' : at > 0 ? `${at} of ${n}` : `${n} steps`}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      {editable && !c.count && (
        <p className="hint big">Or build freely: click <b>+ Class</b>, then a spot on the map. Select a class and drag its <b>⊕</b> onto another to relate them. Or ask Claude to build something.</p>
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

/** Beside the map in a mission: what it's for, its steps, and the question it answers. */
function MissionPanel({ m, at, ctx, a, thought }: { m: Mission; at: number; ctx: Ctx; a: ReturnType<typeof analyse>; thought: Set<string> }) {
  const q = rawQuestions.questions.find((x) => x.id === m.id)!;
  return (
    <>
      <div className="ihead">
        <p className="qmeta"><b>{m.id}</b> · {m.team} · mission</p>
        <h2>{m.title}</h2>
      </div>
      <p className="desc">{m.intro}</p>
      <p className="small muted">You'll use {m.learn}. The classes, codes and queries it adds are illustrative first answers, for the {m.team} team to review in the pull request.</p>
      <section className="isec">
        <h3>Steps · {Math.min(at, m.steps.length)} of {m.steps.length} done</h3>
        <ol className="msteps">
          {m.steps.map((x, j) => <li key={j} className={j < at ? 'done' : j === at ? 'now' : ''}>{stepLabel(x)}</li>)}
        </ol>
      </section>
      <section className="isec">
        <h3>The question</h3>
        <p className="desc">{q.question}</p>
        <p className="small muted">Asked by {q.domain}. Answered in {q.answered_in === 'snowflake' ? 'Snowflake' : 'Neptune'}.</p>
      </section>
      <section className="isec">
        <h3>Other missions</h3>
        <ul className="missions small">
          {MISSIONS.filter((x) => x.id !== m.id).map((x) => {
            const p = progress(x, ctx, a, thought);
            return <li key={x.id}><a href={hashFor('studio', `mission-${x.id}`)} className={p >= x.steps.length ? 'done' : ''}><span>{x.title}</span><span className="mstate">{p >= x.steps.length ? 'Done' : ''}</span></a></li>;
          })}
        </ul>
      </section>
    </>
  );
}
