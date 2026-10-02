// The studio's start: the loop at a glance, the questions the schema can't answer yet, and the team's proposals.
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { rawQuestions } from '../explorer/data';
import { vars } from '../kit/css';
import { EASE_OUT, play } from '../kit/motion';
import { hashFor } from '../kit/route';
import { useReplay } from '../kit/useTimeline';
import { EXAMPLE_QUESTION } from './example';
import { useProfiles, type Runtime } from './runtime';
import { local, STATUS, useProposals } from './store';

const icon = (d: ReactNode) => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">{d}</svg>;
const LOOP: { title: string; text: string; where: string; color: string; icon: ReactNode }[] = [
  { title: 'Question', text: 'A competency question the schema can\'t answer yet.', where: 'competency-questions.yaml', color: 'var(--onto)',
    icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7" /><circle cx="12" cy="17" r=".6" /></>) },
  { title: 'Draft', text: 'A YAML patch, written by hand or drafted by Claude.', where: 'here, with Claude', color: 'var(--query)',
    icon: icon(<><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 6l3 3" /></>) },
  { title: 'Check', text: 'The repository\'s own checks, on every edit, and the class map.', where: 'here, live', color: 'var(--onto)',
    icon: icon(<><path d="M4 12.5l5 5L20 6.5" /></>) },
  { title: 'Review', text: 'The owning teams approve a new class or relationship.', where: 'here, decision 10', color: 'var(--ink)',
    icon: icon(<><circle cx="8" cy="9" r="3" /><circle cx="16.5" cy="9" r="3" /><path d="M3 19c.8-3 2.7-4.5 5-4.5s4.2 1.5 5 4.5M12.5 15.2c1-.5 2.4-.7 4-.7 2.3 0 4.2 1.5 5 4.5" /></>) },
  { title: 'Pull request', text: 'A Claude Code session applies it, runs every check and opens the pull request.', where: 'Claude Code', color: 'var(--query)',
    icon: icon(<><circle cx="6" cy="5.5" r="2.2" /><circle cx="6" cy="18.5" r="2.2" /><circle cx="18" cy="18.5" r="2.2" /><path d="M6 7.7v8.6M18 16.3V10a3 3 0 0 0-3-3h-4M13 4.5L10.5 7 13 9.5" /></>) },
];

export function Home({ rt }: { rt: Runtime }) {
  const [run, replay] = useReplay();
  const { list, error } = useProposals(rt.db);
  const gaps = rawQuestions.questions.filter((q) => q.gap);
  const profiles = useProfiles(rt.user, (list ?? []).map((p) => p.author));
  const who = (id: string) => (id === rt.me.id ? 'you' : profiles[id]?.name || 'someone');

  return (
    <main className="wrap wide studio">
      <header>
        <h1>Close a gap in the ontology.</h1>
        <p className="lede">Pick a question the schema can't answer. Draft the change, watch it land on the class map, and fix what the checks find. Approved changes open their own pull request.</p>
      </header>

      <div className="loophead">
        <h2 className="h3">The loop</h2>
        <button type="button" className="vbtn" onClick={replay}>Replay</button>
      </div>
      <ol className="loop" key={run}>
        {LOOP.map((s, i) => (
          <motion.li key={s.title} style={vars({ '--c': s.color })}
            {...play(true, { opacity: 0, y: 10 }, { opacity: [0, 1], y: [10, 0] }, { duration: 0.45, delay: 0.15 + i * 0.22, ease: EASE_OUT })}>
            <span className="ic">{s.icon}</span>
            <b>{s.title}</b>
            <span>{s.text}</span>
            <small>{s.where}</small>
          </motion.li>
        ))}
      </ol>

      {rt.ready && (
        <p className="caps" aria-label="What works in this view">
          <Cap on={!!rt.db}>shared proposals</Cap>
          <Cap on={!!rt.sample}>Claude drafting</Cap>
          <Cap on={!!rt.mcp}>pull requests</Cap>
          {!rt.db && <span className="muted small">Drafting and checks work anywhere. The rest needs the published page.</span>}
        </p>
      )}

      <section aria-labelledby="gaps">
        <h2 id="gaps" className="h3">Questions the schema can't answer yet · {gaps.length}</h2>
        <div className="gapgrid">
          {gaps.map((q) => {
            const draft = local.get('draft:' + q.id);
            const open = (list ?? []).filter((p) => p.question === q.id).length;
            return (
              <a key={q.id} className="gap" href={hashFor('studio', q.id)} data-view={q.id}>
                <span className="qmeta"><b>{q.id}</b> · {q.domain} · {q.answered_in === 'snowflake' ? 'Snowflake' : 'Neptune'}</span>
                <span className="gq">{q.question}</span>
                <span className="gg">{q.gap!.trim()}</span>
                <span className="gfoot">{draft ? 'Resume your draft' : 'Start a draft'}{open > 0 && ` · ${open} proposal${open === 1 ? '' : 's'}`}</span>
              </a>
            );
          })}
          <a className="gap example" href={hashFor('studio', 'example')} data-view="example">
            <span className="qmeta"><b>Worked example</b> · {EXAMPLE_QUESTION}</span>
            <span className="gq">See the whole loop on a finished patch.</span>
            <span className="gg">An illustrative patch for payment facilitators and their sub-merchants: a new role, a new relationship, and its place on the map.</span>
            <span className="gfoot">Open the example</span>
          </a>
        </div>
      </section>

      <section aria-labelledby="proposals">
        <h2 id="proposals" className="h3">Proposals{list ? ` · ${list.length}` : ''}</h2>
        {!rt.db ? (
          <p className="muted">{rt.ready ? 'Proposals are shared on the published page. Here, each draft stays in this browser.' : 'Connecting…'}</p>
        ) : error ? <p className="warn">{error}</p> : !list ? <p className="muted">Loading…</p> : !list.length ? (
          <p className="muted">None yet. Start a draft from a question above.</p>
        ) : (
          <ul className="plist">
            {list.map((p) => (
              <li key={p.id}>
                <a href={hashFor('studio', p.id)}>{p.title}</a>
                <span className="chip" style={vars({ '--c': STATUS[p.status]?.color ?? 'var(--muted)' })}>{STATUS[p.status]?.label ?? p.status}</span>
                <span className="muted small">{p.question} · {who(p.author)} · {new Date(p.updatedAt).toLocaleDateString()}
                  {p.summary && ` · ${p.summary.problems ? `${p.summary.problems} problems` : 'checks pass'}`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <footer>Questions and gaps come from <code>ontology/competency-questions.yaml</code>. The worked example is illustrative. Proposals are kept with this page, shared inside your organization; the pull request's review and CI decide what merges.</footer>
    </main>
  );
}

function Cap({ on, children }: { on: boolean; children: ReactNode }) {
  return <span className="cap" data-on={on ? '' : undefined}><i aria-hidden="true" />{children}{on ? '' : ': off here'}</span>;
}
