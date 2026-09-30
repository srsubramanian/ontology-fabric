# Open questions and next steps

## Decisions still open

1. **Show the standards-first plan on the platform page.** The direction is agreed (decision 9 in `decisions.md`), but Chapter 1 and the build order still describe a people-led version 1. Update them to show:
   - standards first;
   - layered ownership (core, domain modules, team extensions);
   - review windows;
   - the two coverage numbers.

   While there, bring chapter 1's building-blocks deep dive in line with decision 6: its "Four forms" step still says only the Turtle and SHACL are written by hand, where with LinkML only the YAML is.
2. **Pick a durable execution engine** for the extraction pipeline's human reviews: Temporal's LangGraph plugin (preview), another orchestrator, or LangGraph with a Postgres checkpointer plus restart handling.
3. **Write the "what lives where" rules for each domain.** Disputes are settled. Authorization, settlement and fees still need rules for when a record is pulled into Neptune.
4. **Decide how Snowflake is called:** through the Snowflake-managed MCP server (Cortex Analyst over semantic views), or through a connector running reviewed SQL templates. The latter is what the retrieval page shows.
5. **Decide whether to add the ontology's "actions"** (binding ontology terms to MCP tools) in a later phase.
6. **Name the role classes.** Chapter 1's modeling patterns draw `IssuerRole` and `AcquirerRole`, while the Cypher on both pages uses `:Acquirer` and `:Merchant`. The draft in `ontology/` uses `Issuer`, `Acquirer`, `Merchant` and `Cardholder` under an abstract `PartyRole`. Settle one naming and make the platform page match.

## Next steps for the prototype

Follow the build order in Chapter 7 of `site/platform.html`, with the changes recorded in `decisions.md`:

1. **Ontology core.** Build LinkML for 15 to 25 classes, bootstrapped from ISO 20022 card messages and FIBO parties and agreements. Add 30 to 50 competency questions per domain as tests, and a generator for Neptune headers and OpenSearch mappings. Start from the draft in `ontology/`: it already passes `linkml-lint`, generates OWL and SHACL, and feeds the class explorer. Only 2 of its 21 concrete classes are mapped to a standard so far; ISO 20022 mappings are still to do. Review the draft's own modeling choices, which the pages don't settle: a card reaches its issuer through its BIN range, a chunk mentions only reason codes, and the owner and "where it lives" of classes the pages never covered. When mapping to FIBO, pin a quarterly release rather than master (decision 9).
2. **Graph first.** Load one month of disputes and the parties, cards and events they touch. Answer lineage questions by hand in Cypher.
3. **Search.** Build the three indexes behind aliases, with hybrid search and the ID join.
4. **Retrieval and agents.** Start from BYOKG-RAG, put the tools behind AgentCore Gateway and Policy, and add the Snowflake lane with VAMP-style metric templates.
5. **The change loop.** Set up the proposal bot, the three review lanes and release trains.

## Backlog for the pages

- Use Prism for the remaining plain code snippets in chapters 1, 6 and 7.
- Generate the pages in CI from the LinkML source, so they stay in step with each ontology release.
- Add a question tracer: pick a competency question and animate its Cypher or SQL, step by step, across the class graph. The explorer already highlights each question's walk from `ontology/competency-questions.yaml`; the tracer adds the query text and results.
- Candidate separate pages, each linked from its chapter like `retrieval.html`: ontology authoring, the ingestion pipeline, releases and governance.
- Port `platform.html` to `web/`, a chapter at a time (decision 21). Move its custom Prism grammars and shared diagram code into `web/src/kit/` as they're needed, and fold in the Snowflake gap and the standards-first update (question 1) as each chapter is ported.
- Add CI that runs `npm run check` and the smoke test, and fails if a built page in `site/` is stale against `web/`.

## Housekeeping

- Decision 8 says "SHACL 1.2 and RDF 1.2 are still drafts". SHACL 1.2 is; RDF 1.2 Concepts has been a Candidate Recommendation since 7 April 2026 (see the research notes). Waiting still holds, but the wording needs a touch.
- The published copies of the platform and retrieval pages on claude.ai predate the React port and don't link to the class explorer. Republish them from `main`, keeping their URLs.
- If the repository becomes public: the earlier "About the owner" text is still in git history, and "13 teams" appears in `site/platform.html` and `docs/handoff.md`.
