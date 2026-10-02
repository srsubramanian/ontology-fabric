// The coach: a card above the map that walks a payments person through a mission, one step at a time, in payments
// words. It asks, explains why an answer is right or not, points at what to use on the map, can show a step or do it,
// and celebrates when the question is answered. Progress comes from the shared draft, so it's the team's progress.
import { motion } from 'motion/react';
import { useState } from 'react';
import { CodeBlock } from '../kit/CodeBlock';
import { EASE_OUT, reduce, tr } from '../kit/motion';
import type { Analysis } from './analysis';
import type { Ctx } from './edits';
import { pendingLink, stepLabel, type Choice, type Mission, type Step } from './missions';

export type Said = { text: string; right: boolean };
const LIVES: Record<string, string> = { graph: 'Neptune', warehouse: 'Snowflake', search: 'OpenSearch' };

export function Coach({ m, at, ctx, a, editable, said, onChoice, onFields, onUseQuery, writeQuery, busy, placing, setPlacing,
  onShow, onDoIt, onRestartWalk, onLeave, next, onNext }: {
  m: Mission; at: number; ctx: Ctx; a: Analysis; editable: boolean; said: Said | null;
  /** A think step's answer, or a link step's phrase. */
  onChoice: (c: Choice & { name?: string }) => void;
  onFields: (values: Record<string, string[]>) => void;
  onUseQuery: () => void; writeQuery?: () => void; busy: boolean;
  placing: boolean; setPlacing: (on: boolean) => void;
  onShow?: () => void; onDoIt: () => void; onRestartWalk: () => void; onLeave: () => void;
  next?: Mission; onNext: () => void;
}) {
  const n = m.steps.length;
  const s: Step | undefined = m.steps[at];
  return (
    <section className="coach" aria-label={`Mission: ${m.title}`} data-mission={m.id} data-step={at}>
      <header>
        <span className="ctag">Mission · {m.team}</span>
        <b>{m.title}</b>
        <ol className="dots" aria-label={at < n ? `Step ${at + 1} of ${n}` : 'Complete'}>
          {m.steps.map((x, j) => <li key={j} className={j < at ? 'done' : j === at ? 'now' : ''} title={stepLabel(x)} />)}
        </ol>
        <span className="cact">
          {s && editable && onShow && <button type="button" className="vbtn tiny" onClick={onShow}>Show me</button>}
          {s && editable && <button type="button" className="vbtn tiny" onClick={onDoIt}>Do it for me</button>}
          <button type="button" className="vbtn tiny" onClick={onLeave}>Leave</button>
        </span>
      </header>
      {said && <p className={'said ' + (said.right ? 'right' : 'wrong')} role="status">{said.right ? '✓ ' : ''}{said.text}</p>}
      {!s ? <Complete m={m} a={a} next={next} onNext={onNext} onLeave={onLeave} />
        : !editable ? <p className="say">{stepLabel(s)}. <span className="muted">The draft can't be changed now.</span></p>
          : <Body key={`${m.id}:${at}`} m={m} s={s} ctx={ctx} onChoice={onChoice} onFields={onFields} onUseQuery={onUseQuery} writeQuery={writeQuery}
            busy={busy} placing={placing} setPlacing={setPlacing} onRestartWalk={onRestartWalk} />}
    </section>
  );
}

function Body({ m, s, ctx, onChoice, onFields, onUseQuery, writeQuery, busy, placing, setPlacing, onRestartWalk }: {
  m: Mission; s: Step; ctx: Ctx; onChoice: (c: Choice & { name?: string }) => void; onFields: (v: Record<string, string[]>) => void;
  onUseQuery: () => void; writeQuery?: () => void; busy: boolean; placing: boolean; setPlacing: (on: boolean) => void; onRestartWalk: () => void;
}) {
  const [values, setValues] = useState<Record<string, string[]>>(() =>
    s.kind === 'fields' ? Object.fromEntries(s.fields.filter((f) => f.list).map((f) => [f.name, Object.keys(f.list!.values)])) : {});
  switch (s.kind) {
    case 'think':
      return (
        <>
          <p className="say">{s.ask}</p>
          <div className="choices">{s.choices.map((c) => <button key={c.label} type="button" onClick={() => onChoice(c)}>{c.label}</button>)}</div>
        </>
      );
    case 'place': {
      const c = s.cls;
      return (
        <>
          <p className="say">{s.say}</p>
          <dl className="spec">
            <div><dt>Name</dt><dd><code>{c.name}</code></dd></div>
            {c.is_a && <div><dt>Is a kind of</dt><dd>{c.is_a}</dd></div>}
            <div><dt>ID looks like</dt><dd><code>{c.id_rule}</code></dd></div>
            <div><dt>Stored in</dt><dd>{LIVES[c.lives_in]}</dd></div>
            <div><dt>Owned by</dt><dd>{c.owner}</dd></div>
          </dl>
          <p className="how">Click the glowing box on the map to add it there.{' '}
            <button type="button" className="linkish" aria-pressed={placing} onClick={() => setPlacing(!placing)}>
              {placing ? 'Or click any empty spot. Cancel' : 'Or pick your own spot'}
            </button>
          </p>
        </>
      );
    }
    case 'link': {
      const drawn = pendingLink(s, ctx);
      return drawn ? (
        <>
          <p className="say">{s.ask.split(':')[0]}:</p>
          <p className="sent"><b>{s.from}</b> <span className="blank">…</span> <b>{s.to}</b></p>
          <div className="choices">{s.phrases.map((c) => <button key={c.label} type="button" onClick={() => onChoice(c)}>{c.label}</button>)}</div>
        </>
      ) : (
        <>
          <p className="say">{s.say}</p>
          <p className="how">The <b>⊕</b> pulses on {s.from}. Hold it, and let go over {s.to}.</p>
        </>
      );
    }
    case 'fields': {
      const ok = s.fields.every((f) => !f.list || (values[f.name]?.length ?? 0) > 0);
      return (
        <>
          <p className="say">{s.say}</p>
          {s.fields.map((f) => (
            <div key={f.name} className="ffield">
              <p><b>{f.label}</b> <code>{s.cls}.{f.name}</code> <span className="muted">{f.list ? `one of a list: ${f.list.name}` : f.type === 'datetime' ? 'a date and time' : f.type === 'decimal' ? 'a number' : f.type}</span></p>
              {f.list && (
                <div className="codes">
                  {Object.entries(f.list.values).map(([v, label]) => {
                    const on = values[f.name]?.includes(v);
                    return (
                      <label key={v} className={on ? 'on' : ''}>
                        <input type="checkbox" checked={on} onChange={() => setValues({ ...values, [f.name]: on ? values[f.name].filter((x) => x !== v) : [...values[f.name], v] })} />
                        {label} <code>{v}</code>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          <button type="button" className="vbtn go" disabled={!ok} onClick={() => onFields(values)}>Add to {s.cls}</button>
        </>
      );
    }
    case 'walk': {
      const walks = ctx.draft.answers[m.id]?.walks ?? [];
      const done = s.walks.findIndex((w, i) => walks[i] !== w);
      const upto = done < 0 ? s.walks.length : done;
      return (
        <>
          <p className="say">{s.say}</p>
          <ol className="wsteps">
            {s.walks.map((w, i) => <li key={w} className={i < upto ? 'done' : i === upto ? 'now' : ''}><code>{w}</code></li>)}
          </ol>
          <p className="how">Click the pulsing line on the map.{walks.length > 0 && <> <button type="button" className="linkish" onClick={onRestartWalk}>Start over</button></>}</p>
        </>
      );
    }
    case 'query': {
      const q = ctx.questions.questions.find((x) => x.id === m.id)!;
      return (
        <>
          <p className="say">{s.say}</p>
          <p className="how">{s.explain}</p>
          <CodeBlock code={s.query} lang={q.answered_in === 'snowflake' ? 'sql' : 'cypher'} />
          <div className="row">
            <button type="button" className="vbtn go" onClick={onUseQuery}>Use this query</button>
            {writeQuery && <button type="button" className="vbtn" disabled={busy} onClick={writeQuery}>{busy ? 'Claude is writing…' : 'Write it with Claude instead'}</button>}
          </div>
        </>
      );
    }
  }
}

function Complete({ m, a, next, onNext, onLeave }: { m: Mission; a: Analysis; next?: Mission; onNext: () => void; onLeave: () => void }) {
  const q = a.questions.questions.find((x) => x.id === m.id);
  return (
    <div className="complete">
      <Burst />
      <div>
        <h3>Mission complete</h3>
        <p>{m.done}</p>
        <p className="small muted">{q ? <>{m.id} is answered: “{q.question}”</> : <>{m.id} is answered.</>} You used {m.learn}. The checks run again on every change, and the pull request takes it to review.</p>
        <div className="row">
          {next ? <button type="button" className="vbtn go" onClick={onNext}>Next mission: {next.title}</button> : <p className="small"><b>That's every mission.</b></p>}
          <button type="button" className="vbtn" onClick={onLeave}>Back to the studio</button>
        </div>
      </div>
    </div>
  );
}

/** A small burst of dots around a tick. Under reduced motion, just the tick. */
function Burst() {
  const dots = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);
  return (
    <svg className="burst" viewBox="-40 -40 80 80" aria-hidden="true">
      {!reduce && dots.map((t, i) => (
        <motion.circle key={i} r={3} fill={i % 2 ? 'var(--onto)' : 'var(--query)'} initial={{ cx: 0, cy: 0, opacity: 1 }}
          animate={{ cx: Math.cos(t) * 32, cy: Math.sin(t) * 32, opacity: [1, 1, 0] }} transition={tr({ duration: 0.9, ease: EASE_OUT, delay: 0.1 })} />
      ))}
      <motion.circle r={18} fill="var(--query)" initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={tr({ duration: 0.4, ease: EASE_OUT })} />
      <path d="M-8,0 l5,6 l11,-12" fill="none" stroke="var(--paper)" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
