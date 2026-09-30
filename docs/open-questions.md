# Open questions and next steps

## Decisions still open

None right now. New ones go here.

## Next steps for the prototype

Follow the build order in chapter 7 of the overview (`site/index.html#ch7`), with the changes recorded in `decisions.md`:

1. **Ontology core.** Build LinkML for 15 to 25 classes, bootstrapped from ISO 20022 card messages, FIBO parties and agreements, and ISO code lists. Add 30 to 50 competency questions per domain as tests, and a generator for Neptune headers and OpenSearch mappings. Start from the draft in `ontology/`: it already passes `linkml-lint`, generates OWL and SHACL, and feeds the class explorer. Only 2 of its 21 concrete classes are mapped to a standard so far; ISO 20022 mappings are still to do. When mapping to FIBO, pin a quarterly release rather than master (decision 9).
2. **Graph first.** Load one month of disputes and the parties, cards and events they touch. Answer lineage questions by hand in Cypher.
3. **Search.** Build the three indexes behind aliases, with hybrid search and the ID join.
4. **Retrieval and agents.** Start from BYOKG-RAG, put the tools behind AgentCore Gateway and Policy, and add the Snowflake lane: VAMP-style metric templates first, then Cortex Analyst behind the validator for questions no template fits (decision 5).
5. **The change loop.** Set up the proposal bot, the three review lanes and release trains.
6. **Actions, later.** Once retrieval proves out, add action types to the ontology and generate them into MCP tools that call the owning systems (decision 17).

## Backlog for the pages

- Generate the pages in CI from the LinkML source, so they stay in step with each ontology release.
- Show results in the question tracer. It already steps each competency question's query line by line alongside its walk on the map; once step 2 of the build order loads a sample month, run the queries and show the rows they return, each cited by ID.
- Candidate apps for the page, each linked from its chapter the way chapter 4 links to the retrieval walkthrough: ontology authoring, the ingestion pipeline, releases and governance.
- Fold the Snowflake lane (decision 5) into the overview. The chapter ports kept its content as it was.
- Move the overview's stylesheet (`platform.css`) onto the shared kit tokens and page styles, the way retrieval and the explorer use them, so the three apps can share one stylesheet.

## Housekeeping

- The repository is being made private (owner's decision, 30 September 2026). Its first two commits still hold the earlier "About the owner" text, so keep it private, or rewrite that history first, before making it public again.
