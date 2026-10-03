// The design studio: build the ontology on its class map. Everyone in the organization builds on one shared working
// draft, the repository's checks run on every change, and one click opens a pull request with all of it. Missions
// coach payments people through answering a question, step by step, on the same map and the same draft. Ask anything
// takes any question in someone's own words: Claude proposes a design, drawn as ghosts, and people accept it piece by
// piece. Routes: #studio for the map, #studio-<Class> to select a class, #studio-CQ-NN to answer a question,
// #studio-mission-CQ-NN for a mission, and #studio-ask-<id> for a question someone asked.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { model as baseModel, rawQuestions, rawSchema } from '../explorer/data';
import { vars } from '../kit/css';
import { reduce } from '../kit/motion';
import { hashFor, isShowing, useHash } from '../kit/route';
import { analyse, baseCoverage, patchYaml } from './analysis';
import { Canvas, type Demo, type Mode, type Selection } from './Canvas';
import { Coach, type Said } from './Coach';
import { emptyDraft, inverse, live, type DraftDoc, type DraftUpdate, type InquiryEdit, type Point, type ProposalEdit } from './draft';
import { addClass, addSlot, classExists, moveClass, removeClass, removeSlot, slotNameProblem, type Ctx } from './edits';
import { ClassPanel, QuestionPanel, RelPanel } from './Inspector';
import { accept, decide, ghosts, pending, previewDraft, settle, think, type Asker } from './inquiry';
import { memoryId, type Memory } from './memory';
import { Dial, MemoryPanel } from './Memory';
import { useMemory } from './useMemory';
import { buildVersions, classOf, compareLineage, tally, versionsOf, type Means } from './lineage';
import { changeWords, day, LineageDetail, LineagePanel, STATE_WORDS } from './Lineage';
import TXN_RESEARCH from '../../../ontology/mappings/transaction-research.sssom.tsv?raw';
import { AskedList, InquiryCard, ProposalsPanel } from './Ask';
import { usePresence, type Here, type Lens } from './presence';
import { LensToggle, StoryClass, StoryRel } from './Story';
import { doStep, missionById, MISSIONS, pendingLink, placeSpot, progress, stepLabel, type Choice, type Mission } from './missions';
import { queryPrompt } from './prompt';
import { prove, type Proof } from './proof';
import { ProofPanel } from './Proof';
import { loadSql } from './sqlLoad';
import { cleanScenario, writeTest } from './testcase';
import { SessionCard, StartPull } from './Pull';
import { sampleAdvice, useProfiles, useRuntime, type SampleError } from './runtime';

// The Transaction Research mapping set's scans (illustrative): the earlier ones kept in history, then the current one.
const TXN_HISTORY = import.meta.glob('../../../ontology/mappings/history/transaction-research.*.sssom.tsv', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const TXN_VERSIONS = versionsOf(TXN_RESEARCH, Object.values(TXN_HISTORY));
const LATEST = TXN_VERSIONS.length - 1;
import { useDraftStore } from './store';

type Entry = { label: string; fwd: DraftUpdate; inv: DraftUpdate };
const snake = (s: string) => s.replace(/(?<!^)(?=[A-Z])/g, '_').toLowerCase();
const ago = (t?: number) => {
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleString();
};
const BASE = rawSchema.version ?? '';
/** Questions to start from, for someone who hasn't asked one yet. Illustrative. */
const EXAMPLES = [
  'Which merchants changed their payout bank account in the week before their disputes spiked?',
  'Which cards were used at two or more merchants within an hour of being reported stolen?',
  'Which acquirers have the most merchants on a card network monitoring program?',
];

/** What this viewer has seen: the think steps they answered, and whether they closed the welcome. Kept in this browser. */
const kept = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not kept */ } },
};

export function App() {
  const rt = useRuntime();
  const store = useDraftStore(rt, BASE);
  // Stage 5: how much Claude does for this person, and what the team and they decided before.
  const mem = useMemory(rt);
  const memRef = useRef(mem);
  memRef.current = mem;
  const asker = (): Asker => ({ level: memRef.current.level, team: memRef.current.team, prefs: memRef.current.prefs });
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
  const inquiryId = view.startsWith('ask-') ? view.slice('ask-'.length) : null;
  const inquiry = inquiryId ? draft.inquiries?.[inquiryId] ?? null : null;
  // Lineage: a screen's fields traced to the warehouse and to the ontology (illustrative). #studio-lineage-<field> picks one,
  // and #studio-lineage-changes opens what the latest scan changed. Which scan shows, and what it's compared with, stay local.
  const lineageView = view === 'lineage' || view.startsWith('lineage-');
  const lineagePick = view.startsWith('lineage-') ? view.slice('lineage-'.length) : null;
  const [lv, setLv] = useState<{ at: number; since: number | null }>({ at: LATEST, since: null });
  useEffect(() => { if (view === 'lineage-changes') setLv({ at: LATEST, since: Math.max(0, LATEST - 1) }); }, [view]);
  const lineages = useMemo(() => buildVersions(TXN_VERSIONS, draft.mappings ?? {}), [draft.mappings]);
  const lineage = lineages[lv.at], current = lineages[LATEST];
  const lineageDiff = useMemo(() => (lv.since !== null && lv.since < lv.at ? compareLineage(lineages[lv.since], lineages[lv.at]) : null), [lineages, lv]);
  const priorDiff = useMemo(() => (lv.at > 0 ? compareLineage(lineages[lv.at - 1], lineages[lv.at]) : null), [lineages, lv.at]);
  // The picked field's changes: since the version it's compared with, or else since the scan before, when they bear on it.
  const pickedChange = (lineageDiff ?? priorDiff)?.fields.find((f) => f.slug === lineagePick) ?? null;
  const fieldChange = lineageDiff || pickedChange?.kinds.some((k) => k !== 'moved') ? pickedChange : null;
  const pickedTrace = lineage.traces.find((t) => t.slug === lineagePick) ?? (lineageDiff ? pickedChange?.before ?? null : null);
  const [rel, setRel] = useState<string | null>(null);
  const [picked, setPicked] = useState<Selection>(null);
  useEffect(() => { setRel(null); setPicked(null); }, [view]);
  const question = /^CQ-\d+$/.test(view) && rawQuestions.questions.some((q) => q.id === view) ? view : null;
  const exists = (s: Selection) => !!s && (s.kind === 'rel' ? model.relationships.some((r) => r.id === s.id) : Object.hasOwn(model.classes, s.id));
  // In a mission or a question, what's picked on the map stays local, since the route holds the mission or question.
  const local = !!mission || !!inquiryId || lineageView;
  const selected: Selection = local ? (exists(picked) ? picked : null)
    : rel && model.relationships.some((r) => r.id === rel) ? { kind: 'rel', id: rel }
      : Object.hasOwn(model.classes, view) ? { kind: 'class', id: view } : null;
  const select = useCallback((s: Selection) => {
    if (local) { setPicked(s); return; }
    if (s?.kind === 'rel') { setRel(s.id); return; }
    setRel(null);
    location.hash = hashFor('studio', s?.id ?? '');
  }, [local]);
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

  // Ask anything: a question, or a request, becomes an inquiry on the shared draft, and Claude's design lands on it as
  // proposals. Nothing reaches the draft until a person accepts it.
  const [ask, setAsk] = useState('');
  const [running, setRunning] = useState<{ id: string; ctl: AbortController; step: string; started: number } | null>(null);
  const runRef = useRef(running);
  runRef.current = running;
  useEffect(() => () => runRef.current?.ctl.abort(), []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!running) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [running]);
  const askQuestion = async (text: string, again?: { id: string; note: string }) => {
    if (!rt.sample || !editable || runRef.current) return;
    const prev = again ? ctxRef.current.draft.inquiries?.[again.id] : null;
    const q = (again ? prev?.question : text)?.trim();
    if (!q) return;
    const id = again?.id ?? 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const startedAt = Date.now();
    const err = await write({ inquiries: { [id]: again ? { status: 'thinking', error: null, startedAt }
      : { question: q, askedBy: rt.me.id, askedAt: startedAt, startedAt, status: 'thinking' } } });
    if (err) { setNote({ text: err, bad: true }); return; }
    if (!again) setAsk('');
    location.hash = hashFor('studio', `ask-${id}`);
    const ctl = new AbortController();
    setRunning({ id, ctl, step: 'Reading your question', started: startedAt });
    try {
      const who = asker();
      const reply = await think(rt.sample, () => ctxRef.current, q, {
        signal: ctl.signal, step: (st) => setRunning((r) => r && { ...r, step: st }), note: again?.note || undefined, before: prev?.summary ?? undefined, who,
      });
      const settled = settle(ctxRef.current, q, reply, who);
      // Proposals from an earlier run that this one doesn't repeat are dropped.
      const old = Object.keys(ctxRef.current.draft.inquiries?.[id]?.proposals ?? {});
      const proposals = { ...Object.fromEntries(old.map((k) => [k, null])), ...settled.proposals };
      const e2 = await write({ inquiries: { [id]: { ...settled, proposals, auto: null } as Partial<InquiryEdit> } });
      if (e2) setNote({ text: e2, bad: true });
      // The draft may not have caught up with the write yet, so autopilot works from the design as settled.
      else if (who.level === 'autopilot' && settled.proposals?.answer) {
        await autopilot(id, { question: q, askedAt: startedAt, ...settled, proposals: settled.proposals } as InquiryEdit, ctl.signal, (st) => setRunning((r) => r && { ...r, step: st }));
      }
    } catch (e) {
      const se = e as SampleError;
      await write({ inquiries: { [id]: { status: 'failed', error: se?.code === 'cancelled' ? 'Stopped.' : sampleAdvice(se) || 'Claude didn\'t finish.' } } });
    } finally { setRunning(null); }
  };
  const [focusP, setFocusP] = useState<string | null>(null);
  const titleOf = (id: string) => inquiry?.proposals?.[id]?.title ?? id;
  // Every decision goes into the team's memory and the decider's own, with its reason, for Claude to read next time.
  const remember = (inq: InquiryEdit, ids: string[], state: 'accepted' | 'rejected', reason: string | null) => {
    const at = Date.now();
    const ms: [string, Memory][] = ids.map((pid) => inq.proposals?.[pid]).filter((p): p is NonNullable<typeof p> => !!p && p.kind !== 'answer')
      .map((p) => [memoryId(), {
        state, kind: p.kind, name: p.name, title: p.title, question: inq.question.slice(0, 300), by: rt.me.id, at,
        reason: reason ?? (Object.values(p.notes ?? {}).filter(Boolean).map((n) => n!.text).at(-1)?.slice(0, 300) || null),
      }]);
    void mem.remember(ms).then((err) => err && setNote({ text: err, bad: true }));
  };
  const acceptProposals = (ids: string[]) => {
    if (!inquiry || !inquiryId) return;
    const u = accept(ctx, inquiryId, inquiry, ids, rt.me.id);
    void edit(u, ids.length > 1 ? `accept ${ids.length} proposals` : `accept: ${titleOf(ids[0])}`);
    const now = Object.entries(u.inquiries?.[inquiryId]?.proposals ?? {}).filter(([, p]) => p?.state === 'accepted').map(([pid]) => pid);
    remember(inquiry, now, 'accepted', null);
  };
  const decideProposal = (id: string, state: 'rejected' | 'proposed', reason: string | null = null) => {
    if (!inquiryId) return;
    const u = decide(inquiryId, id, state, rt.me.id);
    if (state === 'rejected') (u.inquiries![inquiryId]!.proposals![id] as Partial<ProposalEdit>).reason = reason;
    void edit(u, `${state === 'rejected' ? 'reject' : 'reconsider'}: ${titleOf(id)}`);
    if (state === 'rejected' && inquiry) remember(inquiry, [id], 'rejected', reason);
  };
  // The map shows the draft as it would be with every pending proposal accepted, those drawn as ghosts.
  const preview = useMemo(() => (inquiry?.status === 'proposed' ? analyse(previewDraft(draft, inquiry), rawSchema, rawQuestions) : null), [draft, inquiry]);
  const ghostSet = useMemo(() => ghosts(inquiry), [inquiry]);
  const mapA = preview ?? a;
  const mapModel = mapA.report.model ?? model;
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

  // Prove it with data: a question's query on a made-up sample world, with its test case planted. An asked question
  // proves on the draft as it would be with every proposal accepted.
  const [proving, setProving] = useState<{ qid: string; on: 'draft' | 'preview'; seed: number } | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [proofRunning, setProofRunning] = useState(false);
  const [writingTest, setWritingTest] = useState<{ step: string; ctl: AbortController } | null>(null);
  // A proof stays open while someone picks fields of the same screen's lineage; any other view closes it.
  const viewKind = lineageView ? 'lineage' : view;
  useEffect(() => { setProving(null); setProof(null); }, [viewKind]);
  const writingRef = useRef(writingTest);
  writingRef.current = writingTest;
  useEffect(() => () => writingRef.current?.ctl.abort(), []);
  const proofA = proving ? (proving.on === 'preview' && preview ? preview : a) : null;
  const proofQ = proving ? proofA?.report.model?.questions.find((x) => x.id === proving.qid) ?? null : null;
  const testDoc = proving ? draft.tests?.[proving.qid] ?? null : null;
  const scenario = useMemo(() => { try { return testDoc ? cleanScenario(JSON.parse(testDoc.scenario)) : null; } catch { return null; } }, [testDoc]);
  useEffect(() => {
    if (!proving || !proofA?.report.model || !proofQ?.query) { setProof(null); return; }
    let live = true;
    setProofRunning(true);
    const t = window.setTimeout(async () => {
      try {
        const SQL = proofQ.language === 'sql' ? await loadSql() : null;
        const res = prove(proofA.report.model!, proofA.schema, { query: proofQ.query, language: proofQ.language, scenario: scenario ?? undefined, seed: proving.seed ? `ontology-fabric-${proving.seed}` : undefined }, SQL);
        if (live) setProof(res);
      } catch (e) {
        if (live) setNote({ text: `The warehouse engine didn't load: ${(e as Error).message}`, bad: true });
      } finally { if (live) setProofRunning(false); }
    }, 0);
    return () => { live = false; window.clearTimeout(t); };
  }, [proving, proofA, proofQ?.query, proofQ?.language, scenario]);
  const startProof = (qid: string, on: 'draft' | 'preview') => {
    setProof(null); setProving({ qid, on, seed: 0 });
    window.setTimeout(() => document.querySelector('[data-app=studio] .coach.proof')?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }), 50);
  };
  const plantTest = async (instruction: string) => {
    if (!rt.sample || !proving || !proofQ || !proofA?.report.model || !editable) return;
    const ctl = new AbortController();
    setWritingTest({ step: 'Claude is writing a test case', ctl });
    try {
      const SQL = proofQ.language === 'sql' ? await loadSql() : null;
      const sc = await writeTest(rt.sample, proofA.report.model, proofA.schema,
        { id: proofQ.id, question: proofQ.question, query: proofQ.query, language: proofQ.language, classes: proofQ.classes }, SQL,
        { signal: ctl.signal, step: (st) => setWritingTest((w) => w && { ...w, step: st }), note: instruction || undefined });
      if (!sc.nodes?.length) { setNote({ text: 'Claude didn\'t plant anything. Try again.', bad: true }); return; }
      await edit({ tests: { [proofQ.id]: { scenario: JSON.stringify(sc), by: rt.me.id, at: Date.now(), author: 'claude' } } }, `plant a test case for ${proofQ.id}`);
    } catch (e) {
      const se = e as SampleError;
      if (se?.code !== 'cancelled') setNote({ text: sampleAdvice(se) || 'Claude didn\'t finish the test case.', bad: true });
    } finally { setWritingTest(null); }
  };

  // Autopilot: after proposing, Claude plants a test case on the design as it would be with every proposal accepted and
  // proves the answer, so the person asking decides once, with the proof in front of them. Nothing lands until they do.
  const autopilot = async (id: string, inq: InquiryEdit, signal: AbortSignal, step: (s: string) => void) => {
    const ans = inq.proposals?.answer;
    if (!rt.sample || !ans) return;
    step('Autopilot: planting a test case');
    await write({ inquiries: { [id]: { auto: { status: 'testing', at: Date.now(), error: null } } } });
    try {
      const pa = analyse(previewDraft(ctxRef.current.draft, inq), rawSchema, rawQuestions);
      const q = pa.report.model?.questions.find((x) => x.id === ans.name);
      if (!pa.report.model || !q?.query) throw new Error('the answer has no query to prove');
      const SQL = q.language === 'sql' ? await loadSql() : null;
      const sc = await writeTest(rt.sample, pa.report.model, pa.schema, { id: q.id, question: q.question, query: q.query, language: q.language, classes: q.classes }, SQL, { signal, step });
      if (!sc.nodes?.length) throw new Error('Claude planted nothing');
      step('Autopilot: proving the answer');
      const pr = prove(pa.report.model, pa.schema, { query: q.query, language: q.language, scenario: sc }, SQL);
      await write({ tests: { [q.id]: { scenario: JSON.stringify(sc), by: rt.me.id, at: Date.now(), author: 'claude' } },
        inquiries: { [id]: { auto: { status: 'ready', passes: pr.ok, checks: pr.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.label}`), error: null, at: Date.now() } } } });
      startProof(q.id, 'preview');
    } catch (e) {
      const se = e as SampleError;
      const msg = se?.code === 'cancelled' ? 'stopped' : sampleAdvice(se) || (e as Error)?.message || 'something went wrong';
      await write({ inquiries: { [id]: { auto: { status: 'failed', error: msg, at: Date.now() } } } });
    }
  };

  // A decision on a lineage mapping goes on the draft, for the pull request to write into the mapping set, and into memory.
  const decideMapping = (m: Means, state: 'accepted' | 'rejected', reason: string | null) => {
    const label = current.fields.get(m.field)?.label ?? m.field;
    // The decision rests on how the field is built now: a later scan that changes it brings it back for a re-check.
    const basis = current.traces.find((t) => t.means?.key === m.key)?.fingerprint ?? null;
    void edit({ mappings: { [m.key]: { state, reason, by: rt.me.id, at: Date.now(), basis, version: current.version } } }, `${state === 'accepted' ? 'accept' : 'reject'} the mapping of ${label} to ${m.slot}`);
    void mem.remember([[memoryId(), { state, kind: 'mapping', name: m.key, title: `Map “${label}” to ${m.slot}`, reason, question: current.title, by: rt.me.id, at: Date.now() }]])
      .then((err) => err && setNote({ text: err, bad: true }));
  };
  const askAbout = (text: string) => {
    setAsk(text);
    window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-app=studio] .ask input')?.focus(), 0);
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
  const lightQ = question ?? mission?.id ?? (lineageView ? lineage.question : null) ?? (inquiry?.matches && inquiry.answered ? inquiry.matches : inquiry?.proposals?.answer?.name);
  const walkLit = useMemo(() => (lightQ ? mapA.report.model?.questions.find((q) => q.id === lightQ)?.steps.map((x) => x.relationship.id) ?? [] : []), [mapA, lightQ]);
  // A mission's hints on the map: what it works on, what to use next, where to drag from, and where to place.
  const hints = useMemo(() => {
    if (lineageView) {
      // The classes the screen touches stay bright, or those of the field picked.
      const ms = pickedTrace ? [pickedTrace.means, ...pickedTrace.sources] : lineage.means;
      return { focus: new Set(ms.map((m) => classOf(m?.slot ?? null)).filter((c): c is string => !!c)) };
    }
    if (inquiry?.status === 'proposed') {
      // A question's hints: the classes it touches stay bright, and the proposal in hand pulses.
      const focus = new Set<string>();
      for (const u of inquiry.understanding ?? []) if (u.maps_to) focus.add(u.maps_to.split('.')[0]);
      for (const g of ghostSet) focus.add(g.split('.')[0]);
      for (const id of walkLit) { const r = mapModel.relationships.find((x) => x.id === id); if (r) focus.add(r.from).add(r.to); }
      const p = focusP ? inquiry.proposals?.[focusP] : null;
      return { focus: focus.size ? focus : undefined, pulse: new Set(p && (p.kind === 'class' || p.kind === 'relationship') ? [p.name] : []) };
    }
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
  }, [mission, s, ctx, draft, inquiry, ghostSet, walkLit, mapModel, focusP, lineageView, pickedTrace, lineage]);
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
  useEffect(() => { if ((mission || inquiryId) && welcome) { setWelcome(false); kept.set('studio:welcomed', true); } }, [mission, inquiryId, welcome]);
  const asked = useMemo(() => live(draft.inquiries).sort(([, x], [, y]) => y.askedAt - x.askedAt), [draft]);
  const firstOpen = MISSIONS.find((x) => progress(x, ctx, a, thought) < x.steps.length);
  const base = baseCoverage(rawSchema, rawQuestions);
  const cov = a.report.coverage;
  const [showProblems, setShowProblems] = useState(false);
  const [showYaml, setShowYaml] = useState(false);
  // Two lenses: each person reads the ontology as plain sentences or as its model, and everyone here sees who's
  // where, in which lens, through the page's room.
  const [lens, setLensState] = useState<Lens>(() => (kept.get<string>('studio:lens', 'model') === 'story' ? 'story' : 'model'));
  const setLens = (l: Lens) => { setLensState(l); kept.set('studio:lens', l); };
  const { peers, cursor } = usePresence(rt.room, { view, sel: selected?.id ?? null, lens });
  const people = useProfiles(rt.user, [draft.updatedBy, draft.session?.by, ...asked.slice(0, 20).map(([, q]) => q.askedBy), ...peers.map((x) => x.by)]);
  const who = (id?: string | null) => (!id ? 'someone' : id === rt.me.id ? 'you' : people[id]?.name || 'someone');
  const gaps = rawQuestions.questions.filter((q) => q.gap);
  const panel = { ctx, a, model, editable, edit: (u: DraftUpdate, l: string) => void edit(u, l), select };
  const name = (x: Here) => (x.by ? people[x.by]?.name : '') || 'Someone';
  const where = (x: Here) => {
    const v = x.view;
    const at = !v ? 'on the map' : v.startsWith('ask-') ? 'on a question' : v.startsWith('mission-') ? 'in a worked example' : `on ${v}`;
    return x.sel && x.sel !== v ? `${at}, looking at ${x.sel}` : at;
  };
  // Following someone: go where they are, and pick what they picked when it's here.
  const follow = (x: Here) => {
    if (x.view !== view) { location.hash = hashFor('studio', x.view); return; }
    if (x.sel) select(x.sel.includes('.') ? { kind: 'rel', id: x.sel } : { kind: 'class', id: x.sel });
  };
  const comment = (pid: string, text: string) => {
    if (!inquiryId) return;
    const nid = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const n = { by: rt.me.id, at: Date.now(), text: text.slice(0, 1000) };
    void write({ inquiries: { [inquiryId]: { proposals: { [pid]: { notes: { [nid]: n } } } } } } as unknown as DraftUpdate)
      .then((err) => err && setNote({ text: err, bad: true }));
  };

  return (
    <main className="studio" data-mode={effectiveMode}>
      <div className="stool" role="toolbar" aria-label="Build">
        {mission ? <a className="vbtn" href={hashFor('studio', '')}>← All missions</a> : (
          <button type="button" className={'vbtn' + (mode === 'place' ? ' on' : '')} aria-pressed={mode === 'place'} disabled={!editable}
            onClick={() => setMode(mode === 'place' ? 'select' : 'place')}>{mode === 'place' ? 'Click the map to place it' : '+ Class'}</button>
        )}
        {!mission && <form className="ask" onSubmit={(e) => { e.preventDefault(); void askQuestion(ask); }}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} disabled={!rt.sample || !editable || !!running}
            placeholder={rt.sample ? 'Ask a question, or describe what to add, in your own words' : 'Ask questions on the published page, where Claude answers'}
            aria-label="Ask a question or describe what to add" />
          {running ? <button type="button" className="vbtn" onClick={() => running.ctl.abort()}>Stop</button>
            : <button type="submit" className="vbtn go" disabled={!rt.sample || !ask.trim() || !editable}>Ask</button>}
        </form>}
        {!mission && <Dial level={mem.level} setLevel={(l) => void mem.setPrefs({ level: l }).then((err) => err && setNote({ text: err, bad: true }))} />}
        {mission && <span className="mtitle"><b>{mission.id}</b> {rawQuestions.questions.find((q) => q.id === mission.id)?.question}</span>}
        <span className="tgroup">
          <button type="button" className="vbtn" disabled={!hist.undo.length || !editable} onClick={() => void undo()} title={hist.undo.at(-1)?.label}>Undo</button>
          <button type="button" className="vbtn" disabled={!hist.redo.length || !editable} onClick={() => void redo()}>Redo</button>
          <button type="button" className={'vbtn' + (showYaml ? ' on' : '')} aria-pressed={showYaml} onClick={() => setShowYaml(!showYaml)}>YAML</button>
          <button type="button" className={'vbtn' + (lineageView ? ' on' : '')} aria-pressed={lineageView} title="Where a screen's data comes from, and what it means"
            onClick={() => { location.hash = hashFor('studio', lineageView ? '' : 'lineage'); }}>Lineage</button>
        </span>
      </div>
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
          ) : inquiryId ? (inquiry ? (
            <InquiryCard inq={inquiry} by={who(inquiry.askedBy)} running={running?.id === inquiryId} step={running?.id === inquiryId ? running.step : undefined}
              elapsed={running ? Math.max(0, Math.round((now - running.started) / 1000)) : 0} preview={preview} editable={editable} canAsk={!!rt.sample && !running}
              onStop={() => running?.ctl.abort()} onAgain={(n) => void askQuestion('', { id: inquiryId, note: n })} onClose={() => { location.hash = hashFor('studio', ''); }}
              onShow={() => document.querySelector('[data-app=studio] .canvas .ghost')?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })}
              onProve={inquiry.proposals?.answer && inquiry.proposals.answer.state !== 'rejected' ? () => startProof(inquiry.proposals!.answer.name, 'preview')
                : inquiry.matches && inquiry.answered ? () => startProof(inquiry.matches!, 'draft') : undefined} proving={!!proving}
              onAcceptAll={() => acceptProposals(pending(inquiry))} />
          ) : (
            <section className="coach" aria-label="Your question"><p className="say muted">{store.draft ? 'This question isn\'t on the working draft. It may belong to an earlier draft.' : 'Loading the working draft…'}</p></section>
          )) : welcome && !question && !lineageView && (
            <section className="coach welcome" aria-label="Welcome">
              <header><span className="ctag">New here?</span><b>Ask the ontology a question</b></header>
              <p className="say">Type a question in the box above, in your own words, the way you'd ask a colleague. Claude works out what the ontology is missing and proposes the design on the map. You keep what's right.</p>
              {rt.sample && editable && (
                <div className="examples" aria-label="Example questions">
                  {EXAMPLES.map((x) => <button key={x} type="button" className="chip" onClick={() => { setAsk(x); document.querySelector<HTMLInputElement>('[data-app=studio] .ask input')?.focus(); }}>{x}</button>)}
                </div>
              )}
              <div className="row">
                {firstOpen && <a className="vbtn" href={hashFor('studio', `mission-${firstOpen.id}`)}>Learn with a worked example: {firstOpen.title}</a>}
                <button type="button" className="vbtn" onClick={() => { setWelcome(false); kept.set('studio:welcomed', true); }}>I know my way around</button>
              </div>
            </section>
          )}
          {lineageView && (
            <LineagePanel l={lineage} pick={lineagePick} onClose={() => { location.hash = hashFor('studio', ''); }}
              question={lineage.question ? { id: lineage.question, text: rawQuestions.questions.find((q) => q.id === lineage.question)?.question ?? '' } : null}
              onProve={lineage.question ? () => startProof(lineage.question!, 'draft') : undefined}
              onPick={(sl) => { location.hash = hashFor('studio', sl ? `lineage-${sl}` : 'lineage'); }}
              versions={TXN_VERSIONS} at={lv.at} since={lineageDiff ? lv.since : null} diff={lineageDiff}
              onVersion={(i) => setLv(({ since }) => ({ at: i, since: since !== null && i > 0 ? Math.min(since, i - 1) : null }))}
              onSince={(i) => setLv(({ at }) => ({ at, since: i }))} />
          )}
          {proving && (
            <ProofPanel key={proving.qid} editable={editable} canWrite={!!rt.sample} writing={writingTest?.step ?? null}
              v={{ qid: proving.qid, question: proofQ?.question ?? '', lane: proofQ?.language ?? 'cypher', proof, running: proofRunning, scenario, seed: proving.seed,
                author: testDoc ? `${testDoc.author === 'claude' ? 'written by Claude for' : 'written by'} ${who(testDoc.by)}` : undefined }}
              onAgain={() => setProving((x) => x && { ...x, seed: x.seed + 1 })} onWrite={(n) => void plantTest(n)} onStop={() => writingTest?.ctl.abort()}
              onRemove={() => void edit({ tests: { [proving.qid]: null } }, `remove ${proving.qid}'s test case`)} onClose={() => setProving(null)} />
          )}
          <div className="xwrap">
            <Canvas model={mapModel} layout={mapA.patch.layout} added={added} addedRels={addedRels} flagged={flagged} ghosts={ghostSet}
              selected={selected} lit={walkLit} mode={effectiveMode} editable={editable}
              focus={hints.focus} pulse={hints.pulse} handleOn={hints.handleOn} target={placing ? undefined : target}
              demo={demo} onDemoEnd={() => setDemo(null)}
              onSelect={(sel) => {
                // A ghost belongs to a proposal: picking it shows that proposal.
                const pid = sel && ghostSet.has(sel.id) ? Object.entries(inquiry?.proposals ?? {}).find(([, p]) => p?.name === sel.id)?.[0] : undefined;
                if (pid) { setFocusP(pid); document.querySelector(`[data-app=studio] [data-proposal="${pid}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); return; }
                select(sel);
              }} onPlace={place} onMove={(n, at) => void edit(moveClass(ctx, n, at), `move ${n}`)} onLink={link} onWalk={walkTo}
              peers={peers.map((x) => ({ peer: x.peer, label: name(x), color: x.color, cursor: x.cursor, sel: x.sel, away: x.view !== view }))} onCursor={rt.room ? cursor : undefined} />
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
          <LensToggle lens={lens} setLens={setLens} />
          {selected && (local || !question) && <button type="button" className="vbtn tiny back" onClick={() => select(null)}>Back to the {mission ? 'mission' : lineageView ? 'lineage' : inquiryId ? 'proposals' : 'overview'}</button>}
          {mission && !selected ? (
            <MissionPanel m={mission} at={step} ctx={ctx} a={a} thought={thought} />
          ) : inquiryId && !selected ? (
            <>
              {inquiry && <ProposalsPanel inq={inquiry} preview={preview} editable={editable} focus={focusP} setFocus={setFocusP} lens={lens} who={who} onNote={editable ? comment : undefined}
                onAccept={acceptProposals} onReject={(id, reason) => decideProposal(id, 'rejected', reason)} onReopen={(id) => decideProposal(id, 'proposed')}
                tutor={mem.level === 'tutor' && Object.values(inquiry.proposals ?? {}).some((p) => p?.quiz)} />}
              <section className="isec"><h3>Questions asked · {asked.length}</h3><AskedList items={asked} who={who} running={running?.id ?? null} /></section>
            </>
          ) : lineageView && !selected ? (
            <LineageDetail l={lineage} t={pickedTrace} editable={editable} who={who} onDecide={decideMapping} onAsk={askAbout}
              change={fieldChange} since={(lineageDiff ?? priorDiff)?.from ?? null} versions={TXN_VERSIONS} latest={lv.at === LATEST}
              decided={(() => {
                const d = lv.at === LATEST && pickedTrace?.means ? draft.mappings?.[pickedTrace.means.key] : null;
                return d && (!d.basis || d.basis === pickedTrace!.fingerprint) ? d : null;
              })()} />
          ) : question ? (
            <QuestionPanel ctx={ctx} a={a} editable={editable} edit={panel.edit} id={question} walking={walking} setWalking={setWalking}
              writeQuery={rt.sample ? () => void writeQuery() : undefined} busy={writingQuery}
              prove={() => startProof(question, 'draft')} proving={proving?.qid === question} hasTest={!!draft.tests?.[question]} />
          ) : selected?.kind === 'class' ? (
            lens === 'story' ? <StoryClass key={selected.id} {...panel} name={selected.id} /> : <ClassPanel key={selected.id} {...panel} name={selected.id} fresh={fresh === selected.id} />
          ) : selected?.kind === 'rel' ? (
            lens === 'story' ? <StoryRel key={selected.id} {...panel} id={selected.id} /> : <RelPanel key={selected.id} {...panel} id={selected.id} fresh={fresh === selected.id} />
          ) : (
            <Overview d={draft} a={a} ctx={ctx} thought={thought} shared={store.shared} loaded={!!store.draft} who={who} gaps={gaps} editable={editable}
              asked={asked} running={running?.id ?? null}
              pull={draft.status === 'pr' && draft.session ? <SessionCard d={draft} mcp={rt.mcp} />
                : !store.shared ? <p className="small muted">Pull requests open from the published page, where the draft is shared.</p>
                  : !rt.me.canEdit ? <p className="small muted">Someone who can edit this page opens the pull request.</p>
                    : !rt.mcp ? <p className="small muted">Opening a pull request needs the Claude Code Remote connector.</p>
                      : !a.changes.count ? <p className="small muted">Build something first.</p>
                        : !pass ? <p className="small muted">The ontology's checks must pass first. Map tidy-ups don't block it.</p>
                          : <StartPull d={draft} a={a} mcp={rt.mcp} me={rt.me.id!} write={write} />}
              next={draft.status === 'pr' ? () => void store.startNext() : undefined}
              lineage={(() => { const t = tally(current.traces), d = LATEST > 0 ? compareLineage(lineages[LATEST - 1], current) : null; return (
                <section className="isec">
                  <h3>Where the data comes from</h3>
                  <a className="lcard" href={hashFor('studio', 'lineage')} data-view="lineage">
                    <b>{current.title.replace(/ to the payments ontology \(illustrative\)$/, '')}</b>
                    <span className="small muted">Illustrative · {current.traces.length} fields traced to Snowflake · {t.shift} {STATE_WORDS.shift} · {t.gap} with nothing to hold it · {t.review} {STATE_WORDS.review}</span>
                  </a>
                  {d && (
                    <p className="small"><a href={hashFor('studio', 'lineage-changes')} data-view="lineage-changes">What the latest scan changed</a> ({current.version}, {day(current.date)}): {changeWords(d).join(', ') || 'nothing that bears on a meaning'}.</p>
                  )}
                  {current.traces.some((x) => x.state === 'shift' || x.state === 'gap' || x.state === 'recheck') && (
                    <p className="small">Look at {current.traces.filter((x) => x.state === 'shift' || x.state === 'gap' || x.state === 'recheck').map((x, i) => (
                      <span key={x.slug}>{i ? ', ' : ''}<a href={hashFor('studio', `lineage-${x.slug}`)} data-view={`lineage-${x.slug}`}>{x.field.label}</a> ({STATE_WORDS[x.state]})</span>
                    ))}.</p>
                  )}
                </section>
              ); })()}
              memory={<MemoryPanel team={mem.team} prefs={mem.prefs} shared={mem.shared} me={rt.me.id} who={who} editable={!!store.draft}
                onForget={(id, at) => void mem.forget(id, at).then((err) => err && setNote({ text: err, bad: true }))}
                onAbout={(t) => void mem.setPrefs({ about: t || null }).then((err) => err && setNote({ text: err, bad: true }))} />}
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
        {peers.length > 0 && (
          <span className="here" aria-label="Who else is here">
            {peers.map((x) => (
              <button key={x.peer} type="button" className={`who pc${x.color}`} onClick={() => follow(x)} title={`Go to ${name(x)}: ${where(x)}`}>
                <i aria-hidden="true" />{name(x)} <span>· {x.lens} lens · {where(x)}</span>
              </button>
            ))}
          </span>
        )}
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

function Overview({ d, a, ctx, thought, shared, loaded, who, gaps, editable, asked, running, pull, next, onPick, memory, lineage }: {
  d: DraftDoc; a: ReturnType<typeof analyse>; ctx: Ctx; thought: Set<string>; shared: boolean; loaded: boolean; who: (id?: string | null) => string;
  asked: [string, InquiryEdit][]; running: string | null;
  gaps: { id: string; question: string; domain: string }[]; editable: boolean; pull: React.ReactNode; next?: () => void; onPick: (id: string) => void;
  /** What the team decided before, and what this person told Claude. */
  memory: React.ReactNode;
  /** Where a screen's data comes from, traced to the ontology. */
  lineage: React.ReactNode;
}) {
  const c = a.changes;
  const items = [
    ...c.newClasses.map((n) => [n, `+ class ${n}`]), ...c.relationships.map((n) => [n, `+ ${n}`]), ...c.fields.map((n) => [n.split('.')[0], `+ field ${n}`]),
    ...c.enums.map((n) => ['', `+ enum ${n}`]), ...c.editedClasses.map((n) => [n, `~ ${n}`]),
    ...c.answers.map((n) => [n, c.newQuestions.includes(n) ? `+ question ${n}, answered` : `✓ answers ${n}`]),
  ];
  const state = (id: string) => (!d.answers[id] ? 'gap' : a.report.problems.some((p) => p.startsWith(id + ':')) ? 'failing' : 'answered');
  return (
    <>
      <div className="ihead">
        <h2>Working draft</h2>
        <p className="small muted">{!loaded ? 'Loading…' : shared ? 'Everyone in your organization builds on this draft; changes appear as they happen.' : 'Kept in this browser. On the published page, the team shares one draft.'} Builds on version {d.base}.</p>
      </div>
      <section className="isec">
        <h3>Questions asked · {asked.length}</h3>
        <AskedList items={asked.slice(0, 6)} who={who} running={running} />
      </section>
      {memory}
      {lineage}
      <section className="isec">
        <h3>Worked examples · learn by building</h3>
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
        <p className="hint big">Or build by hand: click <b>+ Class</b>, then a spot on the map. Select a class and drag its <b>⊕</b> onto another to relate them.</p>
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
