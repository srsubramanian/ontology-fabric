// Stage 5's parts beside the map: the setting each person picks for how much Claude does, a tutor's question on a
// proposal, the reason someone gives for a decision, and what the team decided before.
import { useState } from 'react';
import { Field } from './Inspector';
import { LEVELS, REASONS, type Level, type Memory, type Prefs } from './memory';

/** Tutor, co-pilot or autopilot: each person's own, kept private to them. */
export function Dial({ level, setLevel, disabled }: { level: Level; setLevel(l: Level): void; disabled?: boolean }) {
  return (
    <div className="seg dial" role="radiogroup" aria-label="How much Claude does">
      {LEVELS.map((l) => (
        <button key={l.id} type="button" role="radio" aria-checked={level === l.id} disabled={disabled} title={l.says} onClick={() => setLevel(l.id)}>{l.label}</button>
      ))}
    </div>
  );
}

/** A tutor's question on a proposal: a wrong choice says why not, the right one opens the decision. */
export function Quiz({ quiz, solved, onSolved, onSkip }: { quiz: NonNullable<import('./draft').ProposalEdit['quiz']>; solved: boolean; onSolved(): void; onSkip(): void }) {
  const [said, setSaid] = useState<{ right: boolean; why: string } | null>(null);
  return (
    <div className="quiz">
      <p className="qq">{quiz.question}</p>
      <div className="choices">
        {quiz.choices.map((c) => (
          <button key={c.label} type="button" className="choice" onClick={() => { setSaid({ right: c.right, why: c.why }); if (c.right) onSolved(); }}>{c.label}</button>
        ))}
      </div>
      {said && <p className={'said ' + (said.right ? 'right' : 'wrong')}>{said.right ? 'Right. ' : 'Not quite. '}{said.why}</p>}
      {!solved && <button type="button" className="linkish small" onClick={onSkip}>Skip the question</button>}
    </div>
  );
}

/** Why a proposal is rejected: one click on a common reason, or a few words of one's own. It goes into the team's memory. */
export function RejectReason({ onReject, onCancel }: { onReject(reason: string | null): void; onCancel(): void }) {
  const [text, setText] = useState('');
  return (
    <form className="reason" onSubmit={(e) => { e.preventDefault(); onReject(text.trim() || null); }}>
      <p className="small">Why? The team and Claude will remember.</p>
      <div className="chips">{REASONS.map((r) => <button key={r} type="button" className="chip" onClick={() => onReject(r)}>{r}</button>)}</div>
      <div className="again">
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Your reason" placeholder="Or in your words, such as: we call it the settlement account" />
        <button type="submit" className="vbtn tiny">Reject</button>
        <button type="button" className="linkish small" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** What the team decided before, and what this person told Claude about themselves. */
export function MemoryPanel({ team, prefs, shared, me, who, editable, onForget, onAbout }: {
  team: [string, Memory][]; prefs: Prefs; shared: boolean; me: string | null; who(id?: string | null): string; editable: boolean;
  onForget(id: string, at: number): void; onAbout(text: string): void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? team.slice(0, 40) : team.slice(0, 6);
  return (
    <section className="isec memory">
      <h3>What the team decided · {team.length}</h3>
      {!team.length ? <p className="small muted">Nothing yet. Each proposal someone accepts or rejects, with the reason they give, is remembered{shared ? ' for everyone' : ' in this browser'}, and Claude reads it before it proposes.</p> : (
        <ul className="mems">
          {shown.map(([id, m]) => (
            <li key={id} className={m.state}>
              <span className="ms" aria-hidden="true">{m.state === 'accepted' ? '✓' : '✗'}</span>
              <span><b>{m.title}</b>{m.reason && <> · “{m.reason}”</>}
                <span className="small muted"> {m.state} by {who(m.by)}, {day.format(new Date(m.at))}</span></span>
              {editable && m.by === me && <button type="button" className="linkish small" onClick={() => onForget(id, m.at)} aria-label={`Forget: ${m.title}`}>Forget</button>}
            </li>
          ))}
        </ul>
      )}
      {team.length > 6 && <button type="button" className="linkish small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show ${Math.min(40, team.length) - 6} more`}</button>}
      <Field label="About you, for Claude (only you see this)" area value={prefs.about ?? ''}
        placeholder="Such as: I run chargeback operations. Explain modelling words, and use our network's terms."
        onSave={(v) => onAbout(v)} />
    </section>
  );
}
