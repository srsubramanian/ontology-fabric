# Open questions and next steps

## Decisions still open

1. **Show the standards-first plan on the platform page.** The direction is agreed (decision 9 in `decisions.md`), but Chapter 1 and the build order still describe a people-led version 1. Update them to show:
   - standards first;
   - layered ownership (core, domain modules, team extensions);
   - review windows;
   - the two coverage numbers.
2. **Pick a durable execution engine** for the extraction pipeline's human reviews: Temporal's LangGraph plugin (preview), another orchestrator, or LangGraph with a Postgres checkpointer plus restart handling.
3. **Write the "what lives where" rules for each domain.** Disputes are settled. Authorization, settlement and fees still need rules for when a record is pulled into Neptune.
4. **Decide how Snowflake is called:** through the Snowflake-managed MCP server (Cortex Analyst over semantic views), or through a connector running reviewed SQL templates. The latter is what the retrieval page shows.
5. **Decide whether to add the ontology's "actions"** (binding ontology terms to MCP tools) in a later phase.

## Next steps for the prototype

Follow the build order in Chapter 7 of `site/platform.html`, with the changes recorded in `decisions.md`:

1. **Ontology core.** Build LinkML for 15 to 25 classes, bootstrapped from ISO 20022 card messages and FIBO parties and agreements. Add 30 to 50 competency questions per domain as tests, and a generator for Neptune headers and OpenSearch mappings.
2. **Graph first.** Load one month of disputes and the parties, cards and events they touch. Answer lineage questions by hand in Cypher.
3. **Search.** Build the three indexes behind aliases, with hybrid search and the ID join.
4. **Retrieval and agents.** Start from BYOKG-RAG, put the tools behind AgentCore Gateway and Policy, and add the Snowflake lane with VAMP-style metric templates.
5. **The change loop.** Set up the proposal bot, the three review lanes and release trains.

## Backlog for the pages

- Use Prism for the remaining plain code snippets in chapters 1, 6 and 7.
- Build an ontology class explorer: an interactive class graph in the same hand-drawn style.
- Generate the pages in CI from the LinkML source, so they stay in step with each ontology release.
- Add a question tracer: pick a competency question and animate its Cypher path across the class graph.
- Candidate separate pages, each linked from its chapter like `retrieval.html`: ontology authoring, the ingestion pipeline, releases and governance.
- Optional: split `platform.html` into source partials with a small build step, if editing the single file gets slow.
