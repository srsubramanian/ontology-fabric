# Open questions and next steps

## Decisions still open

None right now. New ones go here.

## Next steps for the prototype

Follow the build order in chapter 7 of the overview (`site/index.html#ch7`), with the changes recorded in `decisions.md`:

1. **Ontology core.** Build LinkML for 15 to 25 classes, bootstrapped from ISO 20022 card messages, FIBO parties and agreements, and ISO code lists. Add 30 to 50 competency questions per domain as tests, and a generator for Neptune headers and OpenSearch mappings. Start from the draft in `ontology/`: it already passes `linkml-lint`, generates OWL and SHACL, and feeds the class explorer.
   - Done: 18 of its 33 concrete classes map to FIBO 2026 Q2, OMG Commons 20250801 or an ISO 20022 card message. The other fifteen say why none fits, and `tools/check_ontology.py` enforces both.
   - Done: the generator, `tools/generate.py`. It writes `generated/`: OWL, SHACL, the extraction JSON Schema, Pydantic models, Neptune load headers with label chains, and the three OpenSearch mappings. CI fails when `generated/` is stale, and renaming a class regenerates every artifact.
   - Drafted: 120 competency questions, 30 per domain (disputes, authorization, settlement, risk). The schema answers 87 of them. The other 33 are gaps: each says what the schema lacks, and counts against coverage until an ontology change closes it.
   - Done: the dispute lifecycle, the first gaps the owner chose to close (version 1.8.0). Retrieval requests, arbitration and a dispute's outcome are now events, and each dispute step carries its amount and respond-by date. The schema answers 93 of the 120 questions; 27 gaps remain.
   - Done: authorization detail, the second set the owner chose (version 1.9.0). Reversals and 3-D Secure authentications are now events. An authorization records the credential it used (card number, card-on-file token or wallet token) and the token requestor. A BIN range carries its funding source and country, and a merchant its country, so cross-border can be told from domestic. The schema answers 98 of 120; 22 gaps remain.
   - Done: the rest of authorization (version 1.10.0), which now answers all 30 of its questions. An authorization records its type (final, estimated, incremental or undefined), with an incremental one linked to the authorization it adds to, who initiated it and any standing instruction, the approved amount for a partial approval, and who decided (the issuer or stand-in). The schema answers 102 of 120; 18 gaps remain.
   - Done: money flows (version 1.11.0), which answers all 30 settlement questions. Captures qualify for a fee program (an interchange category, a code node) and record their interchange and conversion rate; settlements carry their amount. Payouts, adjustments, clearing batches, reconciliations and network fee collections are classes. The owner's call: the warehouse-only ones never load into Neptune but stay in the ontology, so the semantic views cover them (decision 2). The schema answers 110 of 120; 10 gaps remain.
   - Done: the rest of disputes (version 1.12.0), which now answers all 30 of its questions. A reason code carries its category (fraud, authorization, processing error or consumer dispute, the same across networks), and a monitoring notice records a network identifying a merchant in a program such as VAMP or Mastercard's ECP for a month, with its tier and ratio. The schema answers 112 of 120; the 8 gaps left are all in risk.
   - Next: the owning teams review the questions, and the remaining gaps are prioritized. Risk lacks fraud type, merchant risk ratings, fraud scores, payment facilitators, merchant history, IP, email and address links, data breaches and card status events.
   - Later: Snowflake semantic views, once metrics are defined in the ontology (decision 5). Confirm the embedding model in step 3; the mappings assume 1,024 dimensions.
   - Open: confirm whether ISO 20022's ChargeBackResponse (`cain.028`) carries representment evidence. If it does, map Representment to it.
2. **Graph first.** Load one month of disputes and the parties, cards and events they touch. Answer lineage questions by hand in Cypher.
3. **Search.** Build the three indexes behind aliases, with hybrid search and the ID join.
4. **Retrieval and agents.** Start from BYOKG-RAG, put the tools behind AgentCore Gateway and Policy, and add the Snowflake lane: VAMP-style metric templates first, then Cortex Analyst behind the validator for questions no template fits (decision 5).
5. **The change loop.** Set up the proposal bot, the three review lanes and release trains.
6. **Actions, later.** Once retrieval proves out, add action types to the ontology and generate them into MCP tools that call the owning systems (decision 17).

## Backlog for the pages

- Generate the pages in CI from the LinkML source, so they stay in step with each ontology release.
- Show results in the question tracer. It already steps each competency question's query line by line alongside its walk on the map; once step 2 of the build order loads a sample month, run the queries and show the rows they return, each cited by ID.
- Candidate apps for the page, each linked from its chapter the way chapter 4 links to the retrieval walkthrough: the ingestion pipeline, releases and governance. Ontology authoring became the design studio (decision 24); link it from chapter 1.
- The design studio, next:
  - Missions cover the 8 risk gaps. Write them for the other domains' questions as gaps open, and have each owning team review its mission's illustrative classes, codes and queries before they reach a pull request.
  - Placement when the map is crowded. Each mission on its own leaves the map clean; all eight on one draft leave 5 to 7 tidy-ups, since their designed spots overlap and the fallback search gives up after 160 tries. A wider, slower search could run in a worker, or the class map could grow a second room.
  - Confirm `create_session`'s answer from the first real pull request. Its shape isn't documented, so the studio looks for any session id in it; if it finds none, it says so and links to claude.ai/code.
  - Show who else is in the studio right now (the page's `room` capability), so two people don't edit the same class at once. Today each class, field and answer merges on its own, and the last edit to the same one wins.
  - Edits to released classes: the studio adds fields and relationships to them and leaves everything else to the change board. Moving a released class, or changing its description, could come next.
  - Who may open the pull request is enforced by the page, not the store. The pull request's review is the real gate. Wire CODEOWNERS-style module owners in (decision 9) when teams start using it.
  - The draft reaches the Claude Code session as text. The session is told to treat it as data, but a hostile edit could still try to steer it; keep the pull request's review as the gate.
- Fold the Snowflake lane (decision 5) into the overview. The chapter ports kept its content as it was.
- Move the overview's stylesheet (`platform.css`) onto the shared kit tokens and page styles, the way retrieval and the explorer use them, so the three apps can share one stylesheet.

## Housekeeping

- The repository is being made private (owner's decision, 30 September 2026). Its first two commits still hold the earlier "About the owner" text, so keep it private, or rewrite that history first, before making it public again.
