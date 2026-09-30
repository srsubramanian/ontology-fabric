# Open questions and next steps

## Decisions still open

1. **Show the standards-first plan on the platform page.** The direction is agreed (decision 9 in `decisions.md`), but Chapter 1 and the build order still describe a people-led version 1. Update them to show:
   - standards first;
   - layered ownership (core, domain modules, team extensions);
   - review windows;
   - the two coverage numbers.

   While there, bring chapter 1's building-blocks deep dive in line with decision 6: its "Four forms" step still says only the Turtle and SHACL are written by hand, where with LinkML only the YAML is.

## Next steps for the prototype

Follow the build order in Chapter 7 of `site/platform.html`, with the changes recorded in `decisions.md`:

1. **Ontology core.** Build LinkML for 15 to 25 classes, bootstrapped from ISO 20022 card messages and FIBO parties and agreements. Add 30 to 50 competency questions per domain as tests, and a generator for Neptune headers and OpenSearch mappings. Start from the draft in `ontology/`: it already passes `linkml-lint`, generates OWL and SHACL, and feeds the class explorer. Only 2 of its 21 concrete classes are mapped to a standard so far; ISO 20022 mappings are still to do. When mapping to FIBO, pin a quarterly release rather than master (decision 9).
2. **Graph first.** Load one month of disputes and the parties, cards and events they touch. Answer lineage questions by hand in Cypher.
3. **Search.** Build the three indexes behind aliases, with hybrid search and the ID join.
4. **Retrieval and agents.** Start from BYOKG-RAG, put the tools behind AgentCore Gateway and Policy, and add the Snowflake lane: VAMP-style metric templates first, then Cortex Analyst behind the validator for questions no template fits (decision 5).
5. **The change loop.** Set up the proposal bot, the three review lanes and release trains.
6. **Actions, later.** Once retrieval proves out, add action types to the ontology and generate them into MCP tools that call the owning systems (decision 17).

## Backlog for the pages

- Generate the pages in CI from the LinkML source, so they stay in step with each ontology release.
- Show results in the question tracer. It already steps each competency question's query line by line alongside its walk on the map; once step 2 of the build order loads a sample month, run the queries and show the rows they return, each cited by ID.
- Candidate separate pages, each linked from its chapter like `retrieval.html`: ontology authoring, the ingestion pipeline, releases and governance.
- Port `platform.html` to `web/`, a chapter at a time (decision 21). Move its custom Prism grammars and shared diagram code into `web/src/kit/` as they're needed, and fold in the Snowflake gap and the standards-first update (question 1) as each chapter is ported.

## Housekeeping

- The published copies of the platform and retrieval pages on claude.ai predate the React port and don't link to the class explorer. Republish them from `main`, keeping their URLs.
- If the repository becomes public: the earlier "About the owner" text is still in git history, and "13 teams" appears in `site/platform.html` and `docs/handoff.md`.
