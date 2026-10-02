// Ask anything, on screen: the card above the map for one question (what Claude understood, what's missing, and
// whether its design passes), the proposals beside the map to accept or reject one by one, and the list of
// questions people have asked on this draft.
import { useState } from 'react';
import { CodeBlock } from '../kit/CodeBlock';
import { hashFor } from '../kit/route';
import type { Analysis } from './analysis';
import type { InquiryEdit, ProposalEdit } from './draft';
import { blockedBy, pending } from './inquiry';
import { missionById } from './missions';
import type { Lens } from './presence';
import { proposalSentence } from './Story';

const KIND: Record<ProposalEdit['kind'], string> = { class: 'Class', relationship: 'Link', field: 'Field', enum: 'List', answer: 'Answer' };
/** A run that started this long ago and never answered was left behind by a closed tab. */
const STALE = 4 * 60_000;

export const isStale = (inq: InquiryEdit, running: boolean) =>
  inq.status === 'thinking' && !running && Date.now() - (inq.startedAt ?? inq.askedAt) > STALE;

/** Where a question stands, in a few words, for lists. */
export function inquiryState(inq: InquiryEdit, running: boolean): { label: string; tone: 'busy' | 'open' | 'done' | 'bad' } {
  if (inq.status === 'thinking') return isStale(inq, running) ? { label: 'stopped', tone: 'bad' } : { label: 'Claude is working', tone: 'busy' };
  if (inq.status === 'failed') return { label: 'didn\'t finish', tone: 'bad' };
  if (inq.answered) return { label: `already answered by ${inq.matches}`, tone: 'done' };
  const ps = Object.values(inq.proposals ?? {}).filter(Boolean);
  const waiting = pending(inq).length;
  if (waiting) return { label: `${waiting} to decide`, tone: 'open' };
  return ps.some((p) => p.state === 'accepted') ? { label: 'decided', tone: 'done' } : { label: 'nothing proposed', tone: 'bad' };
}

/** The card above the map: the question, what Claude made of it, and where its design stands. */
export function InquiryCard({ inq, by, running, step, elapsed, preview, editable, canAsk, onStop, onAgain, onClose, onShow }: {
  inq: InquiryEdit; by: string; running: boolean; step?: string; elapsed: number;
  /** The checks on the draft with every pending proposal accepted. */
  preview: Analysis | null;
  editable: boolean; canAsk: boolean;
  onStop(): void; onAgain(note: string): void; onClose(): void;
  /** Brings the proposals on the map into view. */
  onShow(): void;
}) {
  const [note, setNote] = useState('');
  const [again, setAgain] = useState(false);
  const stale = isStale(inq, running);
  const answer = inq.proposals?.answer;
  const mission = inq.matches ? missionById(inq.matches) : undefined;
  const fresh = preview && answer ? preview.blocking.filter((p) => p.startsWith(answer.name + ':')) : [];
  return (
    <section className="coach inquiry" aria-label="Your question" data-inquiry={inq.status}>
      <header>
        <span className="ctag">Question · asked by {by}</span>
        <span className="cact">
          {editable && canAsk && inq.status !== 'thinking' && <button type="button" className="vbtn tiny" aria-expanded={again} onClick={() => setAgain(!again)}>Ask again…</button>}
          <button type="button" className="vbtn tiny" onClick={onClose}>Close</button>
        </span>
      </header>
      <p className="qbig">{inq.question}</p>

      {inq.status === 'thinking' && !stale && (
        <p className="working" role="status">
          <span className="spin" aria-hidden="true" /> {running ? `${step ?? 'Reading your question'} · ${elapsed}s` : `Claude is working on this for ${by}…`}
          {running && <button type="button" className="linkish" onClick={onStop}>Stop</button>}
        </p>
      )}
      {(stale || inq.status === 'failed') && (
        <p className="said wrong">{stale ? 'This stopped before Claude answered, perhaps because a tab closed.' : inq.error || 'Claude didn\'t finish.'}
          {editable && canAsk && <> <button type="button" className="linkish" onClick={() => onAgain('')}>Try again</button></>}</p>
      )}

      {inq.status === 'proposed' && (
        <>
          {!!inq.understanding?.length && (
            <ul className="understood" aria-label="What Claude understood">
              {inq.understanding.map((u, i) => (
                <li key={i} className={u.maps_to ? 'known' : 'missing'} title={u.means}>
                  <span>“{u.phrase}”</span> <b>{u.maps_to ? `→ ${u.maps_to}` : '→ nothing yet'}</b>
                </li>
              ))}
            </ul>
          )}
          {inq.answered && inq.matches ? (
            <p className="said right">✓ {inq.matches} already asks this, and the ontology answers it. <a href={hashFor('explorer', inq.matches)}>Trace it in the explorer</a></p>
          ) : (
            <>
              {inq.gap && <p className="say"><b>What's missing.</b> {inq.gap}</p>}
              {inq.summary && <p className="how">{inq.summary}</p>}
              {mission && <p className="how">{inq.matches} asks this already. <a href={hashFor('studio', `mission-${mission.id}`)}>Its worked example, {mission.title}</a>, builds it step by step.</p>}
              {preview && pending(inq).length > 0 && (
                <p className={'verdict ' + (preview.blocking.length ? 'bad' : 'good')}>
                  With every proposal: {preview.blocking.length ? `✗ ${preview.blocking.length} problem${preview.blocking.length === 1 ? '' : 's'}` : '✓ every check passes'}
                  {answer && answer.state === 'proposed' && !fresh.length && ` · answers ${answer.name}`}
                  {` · ${preview.report.coverage.answered} of ${preview.report.coverage.questions} questions answered`}
                  {' '}<button type="button" className="linkish" onClick={onShow}>Show on the map</button>
                </p>
              )}
            </>
          )}
        </>
      )}

      {again && (
        <form className="again" onSubmit={(e) => { e.preventDefault(); onAgain(note); setNote(''); setAgain(false); }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} aria-label="What should Claude change?"
            placeholder="What should change? For example: keep the account on the merchant, not a new class" />
          <button type="submit" className="vbtn go">Ask again</button>
        </form>
      )}
    </section>
  );
}

/** Beside the map: each proposal, why, what it comes with, what people said, and the decision. */
export function ProposalsPanel({ inq, preview, editable, focus, setFocus, onAccept, onReject, onReopen, lens, who, onNote }: {
  inq: InquiryEdit; preview: Analysis | null; editable: boolean;
  focus: string | null; setFocus(id: string | null): void;
  onAccept(ids: string[]): void; onReject(id: string): void; onReopen(id: string): void;
  /** Story reads each proposal as a sentence; model by what it adds. */
  lens: Lens; who(id?: string | null): string;
  /** Comments on a proposal, when the draft is shared. */
  onNote?: (id: string, text: string) => void;
}) {
  const order = (inq.order ?? []).filter((id) => inq.proposals?.[id]);
  const waiting = pending(inq);
  const title = (id: string) => inq.proposals?.[id]?.title ?? id;
  if (inq.status !== 'proposed' || inq.answered) return null;
  return (
    <section className="isec proposals">
      <h3>Proposals · {order.length}
        {editable && waiting.length > 1 && <button type="button" className="vbtn tiny go" onClick={() => onAccept(waiting)}>Accept all {waiting.length}</button>}
      </h3>
      {!order.length && <p className="small muted">Claude proposed nothing to add. Ask again with more detail.</p>}
      <ol className="plist2">
        {order.map((id) => {
          const p = inq.proposals![id];
          const blocked = blockedBy(inq, id);
          const comes = p.needs.filter((n) => inq.proposals?.[n]?.state === 'proposed');
          const issues = preview && p.state === 'proposed' ? preview.blocking.filter((x) => x.includes(p.name)).slice(0, 2) : [];
          return (
            <li key={id} data-proposal={id} className={`${p.state}${focus === id ? ' focus' : ''}`}
              onMouseEnter={() => setFocus(id)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(id)}>
              <p className="ptop"><span className={`kind k-${p.kind}`}>{KIND[p.kind]}</span><b>{lens === 'story' ? proposalSentence(p, preview) : p.title}</b></p>
              {p.why && <p className="small">{p.why}</p>}
              {p.kind === 'answer' && lens === 'model' && <AnswerPreview p={p} />}
              {p.problem && <p className="small warn">The studio can't apply this: {p.problem}</p>}
              {!p.problem && blocked && p.state === 'proposed' && <p className="small warn">Needs “{title(blocked)}”, which was rejected.</p>}
              {issues.map((x) => <p key={x} className="small warn">{x}</p>)}
              {p.state === 'proposed' && !p.problem && !blocked && comes.length > 0 && <p className="small muted">Comes with: {comes.map(title).join('; ')}.</p>}
              <div className="pact">
                {p.state === 'proposed' && editable && !p.problem && !blocked && <button type="button" className="vbtn tiny go" onClick={() => onAccept([id])}>Accept</button>}
                {p.state === 'proposed' && editable && <button type="button" className="vbtn tiny" onClick={() => onReject(id)}>Reject</button>}
                {p.state === 'accepted' && <span className="done">✓ Accepted</span>}
                {p.state === 'rejected' && <><span className="no">Rejected</span>{editable && <button type="button" className="linkish" onClick={() => onReopen(id)}>Reconsider</button>}</>}
              </div>
              <Notes notes={p.notes} who={who} onNote={onNote && ((t) => onNote(id, t))} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function AnswerPreview({ p }: { p: ProposalEdit }) {
  const a = p.update.answers?.[p.name];
  if (!a) return null;
  return (
    <>
      <p className="small"><b>Walks:</b> {(a.walks ?? []).map((w) => <code key={w}>{w}</code>).reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, ' → ', x] : [x]), [])}</p>
      <details><summary className="small">The query</summary><CodeBlock code={a.query ?? ''} lang={a.answered_in === 'snowflake' ? 'sql' : 'cypher'} /></details>
    </>
  );
}

/** The questions people asked on this draft, newest first. */
export function AskedList({ items, who, running }: { items: [string, InquiryEdit][]; who(id?: string | null): string; running: string | null }) {
  if (!items.length) return <p className="small muted">Nothing asked yet. Type a question in the box above the map.</p>;
  return (
    <ul className="asked">
      {items.map(([id, inq]) => {
        const st = inquiryState(inq, running === id);
        return (
          <li key={id}>
            <a href={hashFor('studio', `ask-${id}`)} data-view={`ask-${id}`}>
              <span className="qtext">{inq.question}</span>
              <span className={'qstate ' + st.tone}>{st.label} · {who(inq.askedBy)}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** What people said about a proposal, oldest first, and a box to add to it. */
function Notes({ notes, who, onNote }: { notes: ProposalEdit['notes']; who(id?: string | null): string; onNote?: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const list = Object.values(notes ?? {}).filter((n): n is NonNullable<typeof n> => !!n).sort((x, y) => x.at - y.at);
  return (
    <div className="notes">
      {list.map((n, i) => <p key={i} className="note"><b>{who(n.by)}</b> {n.text}</p>)}
      {onNote && (open ? (
        <form className="again" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onNote(text.trim()); setText(''); setOpen(false); } }}>
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Your comment" placeholder="Say what you think of it" autoFocus />
          <button type="submit" className="vbtn tiny" disabled={!text.trim()}>Comment</button>
        </form>
      ) : <button type="button" className="linkish small" onClick={() => setOpen(true)}>Comment</button>)}
    </div>
  );
}
