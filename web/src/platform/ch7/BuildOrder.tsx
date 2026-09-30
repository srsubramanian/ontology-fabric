/** Build order: graph first, then search, then agents, each phase with a test that says it's done. */
export function BuildOrder() {
  return (
    <section className="block" aria-labelledby="phh">
      <h3 className="sech" id="phh">Build order</h3>
      <p className="intro">Get the graph right before adding search, and search right before adding agents. Each phase has a test that tells you it's done.</p>
      <ol className="phases">
        <li><div><h3>Ontology core and generator</h3><p>Draft 15 to 25 core classes from ISO 20022 card messages, FIBO parties and agreements, and ISO code lists, then measure how many competency questions they answer. Build the SHACL gate and a generator that emits Neptune CSV headers, the extraction schema and OpenSearch mappings. <a href="#v1">See how v1 is made.</a></p><p className="done"><b>Done when</b> renaming a class in the LinkML source regenerates every artifact, CI fails if a committed artifact is stale, and every build prints both coverage numbers.</p></div></li>
        <li><div><h3>Graph first</h3><p>Load one month of disputes into Neptune with deterministic IDs, plus the parties, cards and events they touch. Leave the full authorization stream in the lake. Answer chargeback lineage questions by hand in Cypher before any LLM is involved.</p><p className="done"><b>Done when</b> reloading the same month changes nothing, and the lineage queries return what your dispute team expects.</p></div></li>
        <li><div><h3>Search layer</h3><p>Deploy the stream poller and the entities index, then the chunks index for network rules and runbooks. Build hybrid search that returns Neptune IDs.</p><p className="done"><b>Done when</b> misspelled merchant names and bare codes resolve to the right Neptune IDs.</p></div></li>
        <li><div><h3>Retrieval service and agents</h3><p>Start from AWS Labs’ BYOKG-RAG, put the tools behind AgentCore Gateway and Policy, and add ontology-checked Cypher where it falls short. Collect real questions from dispute and operations teams as an evaluation set before tuning anything.</p><p className="done"><b>Done when</b> the evaluation set passes at a threshold those teams agreed to.</p></div></li>
        <li><div><h3>Extend</h3><p>Run code extraction across repositories at scale, hand domain modules to their owning teams, publish ontology releases, and load Neptune Analytics snapshots for graph algorithms such as fraud-ring detection.</p><p className="done"><b>Done when</b> another team builds on a pinned ontology version without asking you what a class means.</p></div></li>
      </ol>
    </section>
  );
}
