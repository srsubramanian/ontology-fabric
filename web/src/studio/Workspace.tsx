// One question's workspace: the patch beside the class map it changes, the repository's checks run live on every
// edit, Claude to draft or fix the patch, and the review that ends in a pull request.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { isMap, parseDocument } from 'yaml';
import { ClassMap } from '../explorer/ClassMap';
import { model as baseModel, rawQuestions, rawSchema } from '../explorer/data';
import { boxes } from '../explorer/layout';
import { hashFor } from '../kit/route';
import { vars } from '../kit/css';
import { useReplay } from '../kit/useTimeline';
import { checkOntology, type Coverage } from '../explorer/check';
import { BLANK_PATCH } from './example';
import { buildDraft, layoutYaml, type Draft } from './patch';
import { draftPrompt, fenced, fixPrompt } from './prompt';
import { SessionCard, StartPull, SERVER } from './Pull';
import { sampleAdvice, useProfiles, type Runtime, type SampleError } from './runtime';
import { dbAdvice, local, newId, STATUS, type Proposal, type Review } from './store';

let base: Coverage | undefined;
/** The schema's coverage today, to compare a draft with. */
const baseCoverage = () => (base ??= checkOntology(rawSchema, rawQuestions).coverage);

const STEPS = [['draft', 'Draft'], ['checks', 'Checks pass'], ['review', 'Review'], ['approved', 'Approved'], ['pr', 'Pull request']] as const;

/** Text cut at a word to at most n characters, with an ellipsis when cut. */
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)).replace(/[,;:]$/, '') + '…');

/** The layout the studio worked out, written into the patch's layout part, keeping the reader's comments. */
function pinLayout(text: string, d: Draft): string {
  const doc = parseDocument(text);
  for (const n of d.placed) doc.setIn(['layout', 'pos', n], doc.createNode(d.layout.pos![n], { flow: true }));
  for (const id of d.routed) doc.setIn(['layout', 'ports', id], doc.createNode(d.layout.ports![id], { flow: true }));
  for (const path of [['layout'], ['layout', 'pos'], ['layout', 'ports']]) {
    const node = doc.getIn(path, true);
    if (isMap(node)) node.flow = false;
  }
  return String(doc);
}

/** Whether the map can draw the draft: every box placed and every frame around something. */
function drawable(d: Draft): string | null {
  const m = d.report.model;
  if (!m) return 'The explorer can\'t read this draft, so the map shows the schema without it.';
  try {
    boxes(Object.fromEntries(Object.values(m.classes).map((c) => [c.name, c.children])), d.layout);
    return null;
  } catch (e) {
    return `The map can't draw this draft (${e instanceof Error ? e.message : String(e)}), so it shows the schema without it.`;
  }
}

type Props = {
  rt: Runtime; questionId: string;
  /** A saved proposal, live; absent for a draft kept in this browser. */
  proposal?: Proposal;
  /** Where the text starts when there's no proposal, and where it's kept in this browser. */
  start?: string; draftKey?: string;
};

export function Workspace({ rt, questionId, proposal, start, draftKey }: Props) {
  const question = rawQuestions.questions.find((q) => q.id === questionId)!;
  const mine = !!proposal && !!rt.me.id && proposal.author === rt.me.id;
  const editable = !proposal || (mine && (proposal.status === 'draft' || proposal.status === 'changes'));

  const [text, setText] = useState(() => proposal?.patch ?? (draftKey && local.get(draftKey)) ?? start ?? BLANK_PATCH);
  const [title, setTitle] = useState(() => proposal?.title ?? `Answer ${question.id}: ${clip(question.question, 70)}`);
  // Follow the saved patch when it changes elsewhere, unless the reader has edits of their own.
  const saved = useRef(proposal?.patch);
  useEffect(() => {
    if (proposal && proposal.patch !== saved.current) {
      setText((t) => (t === saved.current ? proposal.patch : t));
      saved.current = proposal.patch;
    }
  }, [proposal]);
  // Keep an edited draft in this browser; an untouched one isn't a draft yet.
  useEffect(() => {
    if (proposal || !draftKey) return;
    if (text === (start ?? BLANK_PATCH)) local.drop(draftKey); else local.set(draftKey, text);
  }, [text, proposal, draftKey, start]);

  // Check a moment after typing stops: placing a new class runs the layout check many times.
  const [checked, setChecked] = useState(text);
  useEffect(() => { const t = window.setTimeout(() => setChecked(text), 280); return () => clearTimeout(t); }, [text]);
  const draft = useMemo(() => buildDraft(rawSchema, rawQuestions, questionId, checked), [questionId, checked]);
  const stale = checked !== text;
  const problems = draft.parseError ? [`The patch isn't valid YAML: ${draft.parseError}`] : draft.report.problems;
  const pass = !problems.length && !stale;
  const cantDraw = drawable(draft);
  const shown = cantDraw ? baseModel : draft.report.model!;

  // What the map lights: what the draft adds or touches, and the question's walk.
  const { lit, litEdges } = useMemo(() => {
    const walk = draft.report.model?.questions.find((q) => q.id === questionId)?.steps ?? [];
    return {
      lit: new Set([...draft.changes.newClasses, ...draft.changes.touched, ...walk.flatMap((s) => [s.named, s.relationship.from, s.relationship.to])]),
      litEdges: [...new Set([...draft.changes.newRelationships, ...walk.map((s) => s.relationship.id)])],
    };
  }, [draft, questionId]);
  const fresh = useMemo(() => new Set(draft.changes.newClasses), [draft]);
  const [run, replay] = useReplay();

  // Asking Claude: the reply streams into the editor; Undo puts back what was there.
  const [asking, setAsking] = useState<{ mode: 'draft' | 'fix'; ctl: AbortController } | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [claudeNote, setClaudeNote] = useState<string | null>(null);
  // Leaving the workspace stops Claude, so the viewer doesn't pay for an answer nobody sees.
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  const ask = async (mode: 'draft' | 'fix') => {
    if (!rt.sample) return;
    const ctl = new AbortController();
    current.current = ctl;
    const before = text;
    setAsking({ mode, ctl }); setClaudeNote(null);
    const prompt = mode === 'draft' ? draftPrompt(rawSchema, rawQuestions, questionId) : fixPrompt(rawSchema, rawQuestions, questionId, text, problems);
    try {
      const r = await rt.sample(prompt, { signal: ctl.signal, cache: false, onText: ({ text: t }) => setText(fenced(t)) });
      setText(fenced(r.text).replace(/\s*$/, '\n'));
      setUndo(before);
      if (r.truncated) setClaudeNote('Claude\'s reply was cut short. Check the end of the patch.');
    } catch (e) {
      setText(before);
      setClaudeNote(sampleAdvice(e as SampleError));
    } finally { setAsking(null); }
  };
  const edit = (t: string) => { setText(t); setUndo(null); };

  // Tab indents. Escape, then Tab, leaves the editor, so the keyboard never gets stuck in it.
  const tabLeaves = useRef(false);
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') { tabLeaves.current = true; return; }
    if (e.key !== 'Tab' || e.shiftKey || tabLeaves.current) { tabLeaves.current = false; return; }
    e.preventDefault();
    const el = e.currentTarget, a = el.selectionStart, b = el.selectionEnd;
    edit(text.slice(0, a) + '  ' + text.slice(b));
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 2; });
  };

  // Saving and review, in the page's shared store.
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const summary = { answered: draft.report.coverage.answered, problems: problems.length, lane: draft.changes.lane, owners: draft.changes.owners };
  const write = async (f: () => Promise<void>) => {
    setBusy(true); setSaveError(null);
    try { await f(); } catch (e) { setSaveError(dbAdvice(e)); } finally { setBusy(false); }
  };
  const create = () => write(async () => {
    const id = newId(), now = Date.now();
    await rt.db!.doc(`proposals/${id}`).set({
      id, question: questionId, title: title.trim() || question.question, patch: text, status: 'draft',
      author: rt.me.id, createdAt: now, updatedAt: now, summary, reviews: [],
    });
    if (draftKey) local.drop(draftKey);
    location.hash = hashFor('studio', id);
  });
  const ref = proposal && rt.db ? rt.db.doc(`proposals/${proposal.id}`) : null;
  const save = () => write(async () => {
    await ref!.update({ patch: text, title: title.trim() || question.question, summary, updatedAt: Date.now() });
    saved.current = text;
  });
  const setStatus = (status: Proposal['status']) => write(() => ref!.update({ status, updatedAt: Date.now() }));
  const [note, setNote] = useState('');
  const review = (verdict: Review['verdict']) => write(async () => {
    const r: Review = { by: rt.me.id!, verdict, note: note.trim(), at: Date.now() };
    await ref!.update({
      status: verdict === 'approve' ? 'approved' : 'changes', updatedAt: Date.now(), reviews: [...(proposal!.reviews ?? []), r],
      ...(verdict === 'approve' ? { approved: { patch: proposal!.patch, layout: layoutYaml(draft.layout, draft), by: rt.me.id, at: Date.now() } } : {}),
    });
    setNote('');
  });

  const profiles = useProfiles(rt.user, [proposal?.author, proposal?.session?.by, ...(proposal?.reviews ?? []).map((r) => r.by)]);
  const who = (id?: string | null) => (id && id === rt.me.id ? 'you' : (id && profiles[id]?.name) || 'someone');
  const dirty = !!proposal && text !== proposal.patch;
  const stage = proposal ? proposal.status : pass ? 'checks' : 'draft';
  const reached = (s: string) => {
    const order = ['draft', 'checks', 'review', 'approved', 'pr'];
    const at = proposal ? Math.max(order.indexOf(proposal.status === 'changes' ? 'review' : proposal.status), pass ? 1 : 0) : pass ? 1 : 0;
    return order.indexOf(s) <= at;
  };
  const lines = text.split('\n').length;
  const gutter = useRef<HTMLDivElement>(null);
  const c = draft.changes;

  return (
    <main className="wrap wide studio">
      <nav className="crumbs"><a href={hashFor('studio', '')}>Studio</a> <span aria-hidden="true">/</span> {proposal ? proposal.id : question.id}</nav>
      <header className="qhead">
        <p className="qmeta"><b>{question.id}</b> · {question.domain} · {question.answered_in === 'snowflake' ? 'Snowflake' : 'Neptune'}
          {proposal && <span className="chip" style={vars({ '--c': STATUS[proposal.status].color })}>{STATUS[proposal.status].label}</span>}
        </p>
        <h1>{question.question}</h1>
        {question.gap && <p className="lede">What the schema lacks: {question.gap.trim()}</p>}
        <ol className="stepper" aria-label="Where this change is">
          {STEPS.map(([id, label]) => (
            <li key={id} data-on={reached(id) ? '' : undefined} aria-current={stage === id ? 'step' : undefined}>{label}</li>
          ))}
        </ol>
      </header>

      <div className="studio-grid">
        <section className="editcol" aria-label="The patch">
          <div className="edhead">
            <h2 className="h3">Patch</h2>
            <span className="muted small">YAML: <code>schema</code> merges into payments.yaml, <code>question</code> replaces the gap, <code>layout</code> places and routes.</span>
          </div>
          <div className="editor" data-busy={asking ? '' : undefined}>
            <div className="gutter" ref={gutter} aria-hidden="true">{Array.from({ length: lines }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
            <textarea value={text} spellCheck={false} wrap="off" readOnly={!editable || !!asking} aria-label="Patch YAML" aria-describedby="edhint"
              onChange={(e) => edit(e.target.value)} onKeyDown={onKey}
              onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }} />
          </div>
          <p id="edhint" className="muted small edhint">Tab indents. Press Escape, then Tab, to leave the editor.</p>

          {editable && (
            <div className="row">
              {rt.sample && !asking && <button type="button" className="vbtn" onClick={() => ask('draft')}>Draft with Claude</button>}
              {rt.sample && !asking && problems.length > 0 && text.trim() !== BLANK_PATCH.trim() && (
                <button type="button" className="vbtn" onClick={() => ask('fix')}>Fix with Claude</button>
              )}
              {asking && <button type="button" className="vbtn" onClick={() => asking.ctl.abort()}>Stop</button>}
              {asking && <span className="muted small" role="status">{asking.mode === 'draft' ? 'Claude is drafting…' : 'Claude is fixing…'}</span>}
              {undo !== null && !asking && <button type="button" className="vbtn" onClick={() => { setText(undo); setUndo(null); }}>Undo Claude</button>}
              {!rt.sample && rt.ready && <span className="muted small">Claude drafts here on the published page. The checks run anywhere.</span>}
            </div>
          )}
          {claudeNote && <p className="warn" role="alert">{claudeNote}</p>}

          <section className="flow" aria-label="Review">
            {!rt.db ? (
              <p className="muted small">{rt.ready ? 'This draft is kept in this browser. Saving, review and pull requests work on the published page, where the team shares proposals.' : 'Connecting…'}</p>
            ) : !rt.me.id ? (
              <p className="muted small">Sign in to claude.ai to save proposals and review them.</p>
            ) : !proposal ? (
              <div className="savebox">
                <label className="small">Title <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
                <button type="button" className="vbtn go" disabled={busy} onClick={create}>Save as a proposal</button>
              </div>
            ) : (
              <>
                <h3>{proposal.title}</h3>
                <p className="muted small">By {who(proposal.author)} · updated {new Date(proposal.updatedAt).toLocaleString()} · {proposal.question}</p>
                {editable && (
                  <div className="savebox">
                    <label className="small">Title <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
                    <div className="row">
                      <button type="button" className="vbtn" disabled={busy || (!dirty && title === proposal.title)} onClick={save}>Save changes</button>
                      <button type="button" className="vbtn go" disabled={busy || dirty || !pass} onClick={() => setStatus('review')}
                        title={!pass ? 'Every check must pass first' : dirty ? 'Save your changes first' : undefined}>Send for review</button>
                    </div>
                    {!pass && <p className="muted small">Send it for review once every check passes.</p>}
                  </div>
                )}
                {mine && proposal.status === 'review' && (
                  <div className="row"><button type="button" className="vbtn" disabled={busy} onClick={() => setStatus('draft')}>Take it back to edit</button></div>
                )}
                {proposal.reviews?.length > 0 && (
                  <ul className="reviews">
                    {proposal.reviews.map((r, i) => (
                      <li key={i} data-verdict={r.verdict}>
                        <b>{r.verdict === 'approve' ? 'Approved' : 'Asked for changes'}</b> · {who(r.by)} · {new Date(r.at).toLocaleString()}
                        {r.note && <p>{r.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                {proposal.status === 'review' && rt.me.canEdit && (
                  <div className="reviewbox">
                    <label className="small">Review note <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What to change, or why it's ready" /></label>
                    <div className="row">
                      <button type="button" className="vbtn go" disabled={busy || !pass} onClick={() => review('approve')}>
                        {mine ? 'Approve your own change' : 'Approve'}
                      </button>
                      <button type="button" className="vbtn" disabled={busy || !note.trim()} onClick={() => review('changes')}>Ask for changes</button>
                    </div>
                    <p className="muted small">Approving needs every check to pass. Owners for this change: {summary.owners.join(', ') || 'none'} (decision 10).</p>
                  </div>
                )}
                {proposal.status === 'review' && !rt.me.canEdit && <p className="muted small">Waiting for someone who can edit this page to review it.</p>}
                {proposal.status === 'approved' && (rt.mcp && rt.me.canEdit
                  ? <StartPull p={proposal} question={question} db={rt.db} mcp={rt.mcp} me={rt.me.id} />
                  : <p className="muted small">Approved. Someone who can edit this page opens the pull request, through their {SERVER} connector.</p>)}
                {proposal.status === 'pr' && proposal.session && <SessionCard p={proposal} mcp={rt.mcp} />}
              </>
            )}
            {saveError && <p className="warn" role="alert">{saveError}</p>}
          </section>
        </section>

        <section className="mapcol" aria-label="The class map with this draft">
          <div className="edhead">
            <h2 className="h3">Class map, with this draft</h2>
            <button type="button" className="vbtn" onClick={replay}>Replay</button>
          </div>
          <div className="xwrap">
            <ClassMap model={shown} lens="relationships" lit={lit.size ? lit : null} litEdges={litEdges} focusKey={litEdges.join(',')}
              run={run} onPick={() => {}} onClear={() => {}} layout={cantDraw ? undefined : draft.layout} fresh={fresh} />
          </div>
          <div className="legend">
            <span><i className="lg-new" />new class</span>
            <span><i className="lg-hl" />new relationship, or the question's walk</span>
          </div>
          {cantDraw && <p className="warn">{cantDraw}</p>}

          <div className="checks" data-pass={pass ? '' : undefined} aria-live="polite">
            <h3>{stale ? 'Checking…' : pass ? 'Every check passes' : `${problems.length} problem${problems.length === 1 ? '' : 's'}`}</h3>
            {problems.length > 0 && <ul className="problems">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
            <dl className="scover">
              <div><dt>Questions answered</dt><dd><b>{draft.report.coverage.answered}</b> of {draft.report.coverage.questions}
                <Delta now={draft.report.coverage.answered} was={baseCoverage().answered} /></dd></div>
              <div><dt>Classes mapped to a standard</dt><dd><b>{draft.report.coverage.mapped}</b> of {draft.report.coverage.concrete}
                <Delta now={draft.report.coverage.concrete - draft.report.coverage.mapped} was={baseCoverage().concrete - baseCoverage().mapped} unmapped /></dd></div>
              <div><dt>Change</dt><dd>{c.lane === 'none' ? 'nothing yet' : c.lane === 'minor' ? 'minor: the owning teams approve' : 'patch: auto-merges at 95% acceptance'}</dd></div>
            </dl>
            {c.lane !== 'none' && (
              <p className="adds">
                {c.newClasses.map((n) => <span key={n} className="add">+ class {n}</span>)}
                {c.newRelationships.map((n) => <span key={n} className="add">+ {n}</span>)}
                {c.newSlots.filter((s) => !c.newRelationships.some((r) => r.endsWith('.' + s))).map((n) => <span key={n} className="add">+ slot {n}</span>)}
                {c.newEnums.map((n) => <span key={n} className="add">+ enum {n}</span>)}
                {c.owners.length > 0 && <span className="muted"> · owners: {c.owners.join(', ')}</span>}
              </p>
            )}
            {(draft.placed.length > 0 || draft.routed.length > 0) && (
              <div className="placed">
                <p className="small">The studio {[draft.placed.length && `placed ${draft.placed.join(', ')}`, draft.routed.length && `routed ${draft.routed.join(', ')}`].filter(Boolean).join(' and ')} itself:</p>
                <pre className="mini">{layoutYaml(draft.layout, draft)}</pre>
                {editable && <button type="button" className="vbtn" onClick={() => edit(pinLayout(text, draft))}>Pin it in the patch</button>}
              </div>
            )}
          </div>
        </section>
      </div>
      <footer>The studio runs the repository's own checks (tools/check_ontology.py, ported to TypeScript and kept in step by tools/test_checks.py). Linting, the generator and the smoke test run in the pull request's session. Questions and gaps come from <code>ontology/competency-questions.yaml</code>; IDs and examples are illustrative.</footer>
    </main>
  );
}

/** How a number moved from the schema today. For unmapped classes, more is worse. */
function Delta({ now, was, unmapped }: { now: number; was: number; unmapped?: boolean }) {
  if (now === was) return <span className="muted"> · {unmapped ? 'no new unmapped classes' : 'no change'}</span>;
  const good = unmapped ? now < was : now > was;
  return <span className={good ? 'up' : 'down'}> · {unmapped ? `${now - was > 0 ? '+' : ''}${now - was} unmapped` : `${now > was ? '+' : ''}${now - was}`}</span>;
}
