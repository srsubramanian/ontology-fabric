// The design studio: a fourth app on the page, for ontology engineers. Its views are the start (#studio), a draft
// for one question (#studio-CQ-116), the worked example (#studio-example) and a saved proposal (#studio-p-…).
import { rawQuestions } from '../explorer/data';
import { hashFor, useHash } from '../kit/route';
import { EXAMPLE_PATCH, EXAMPLE_QUESTION } from './example';
import { Home } from './Home';
import { useRuntime } from './runtime';
import { useProposal } from './store';
import { Workspace } from './Workspace';

const isQuestion = (id: string) => rawQuestions.questions.some((q) => q.id === id);

export function App() {
  const view = useHash('studio');
  const rt = useRuntime();
  const proposalId = /^p-[a-z0-9]+$/.test(view) ? view : undefined;
  const proposal = useProposal(rt.db, proposalId);

  if (view === 'example') {
    return <Workspace key="example" rt={rt} questionId={EXAMPLE_QUESTION} start={EXAMPLE_PATCH} draftKey="draft:example" />;
  }
  if (isQuestion(view)) return <Workspace key={view} rt={rt} questionId={view} draftKey={'draft:' + view} />;
  if (proposalId) {
    if (proposal && isQuestion(proposal.question)) return <Workspace key={proposal.id} rt={rt} questionId={proposal.question} proposal={proposal} />;
    return (
      <main className="wrap wide studio">
        <nav className="crumbs"><a href={hashFor('studio', '')}>Studio</a> <span aria-hidden="true">/</span> {proposalId}</nav>
        <p className="lede">{!rt.ready || (rt.db && proposal === undefined) ? 'Loading the proposal…'
          : !rt.db ? 'Proposals live on the published page, shared inside your organization.'
            : 'There\'s no such proposal, or you can\'t see it.'}</p>
      </main>
    );
  }
  return <Home rt={rt} />;
}
