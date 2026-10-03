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
- Show results in the question tracer. It already steps each competency question's query line by line alongside its walk on the map; once step 2 of the build order loads a sample month, run the queries and show the rows they return, each cited by ID. The studio's proofs already do this on an illustrative world in the page; the tracer could reuse them.
- Candidate apps for the page, each linked from its chapter the way chapter 4 links to the retrieval walkthrough: the ingestion pipeline, releases and governance. Ontology authoring became the design studio (decision 24); link it from chapter 1.
- The open-world studio (decision 25), next:
  - No document connectors for now, at the owner's request. Stage 3 waits until the owner chooses to connect them. Before it starts, make the repository private and connect the Atlassian and Microsoft 365 connectors in claude.ai.
  - Pick a pilot: one real question, one document space, and an expert-and-engineer pair.
  - The story lens builds its sentences from names and descriptions with simple rules (acquired_by reads "is acquired by"). A relationship whose name the rules misread gets a stiff sentence; its description, written in words, is the fix. Watch for ones that read badly once real teams use it.
  - Presence shows people the room admits: members of the organization, signed in. Comments are on proposals only; comments on released classes could follow.
  - Stage 3, your documents (waiting, see above): search Confluence, Jira, SharePoint and OneDrive while proposing, through the page's `mcp` capability, and cite each source with a trust label. Read each connector's tool schema in a session before relying on it.
  - Stage 4, prove it with data, runs in the page (decision 25). Next:
    - The engines are stand-ins. The openCypher subset has no variable-length paths, and SQLite only approximates Snowflake. Run the same test cases on a real Neptune and Snowflake sample once step 2 of the build order loads one, and compare the rows.
    - Test cases stay on the shared draft. The pull request's session could commit them as fixtures beside the competency questions, so CI proves each answer with its own case.
    - Six competency questions find nothing in the background world, since they look for thresholds a few hundred instances don't reach (50 declines in a day, five merchants on one device). Their proof needs a test case.
    - The cloud-session version from the design (read the repositories, build a sample month from real shapes) can follow once connectors are back.
  - Stage 5, the dial and memory, is built (decision 25). Next:
    - Claude reads the last six months of the team's decisions. When the team builds more than that holds well, summarise older months into a glossary of the names the team chose.
    - Anyone can forget their own decisions; nobody can forget someone else's. Decide whether the core team should be able to, once teams rely on it.
    - Autopilot makes two or three paid Claude calls per question (design, test case, and the tools each uses), on the asker's account. Watch the cost once people use it.
    - A tutor's questions are Claude's own, checked only for shape (two to four choices, exactly one right). Have a payments expert review a sample.
  - Ask anything today: a proposal's place on the map is worked out when Claude proposes it. If the draft changes before it's accepted, it can land somewhere crowded and leave a tidy-up. Re-place on accept if that happens often.
  - A question asked in the studio gets the next free id, checked again when its answer is accepted. Two people accepting new questions at the same moment could still take one id; the pull request's session renumbers if the file has taken it.
- Lineage (decision 26), next:
  - Replace the illustrative mapping set with the real one for the transaction research screen: a Claude Code session reads the screen's, the backend's and the data API's repositories and Snowflake's metadata, read-only, and writes the same SSSOM format. First the repository goes private, and the session needs read access to the three repositories and to Snowflake's metadata, or exported view definitions.
  - The owner's real stack (asked 3 October 2026): the screen is React; the backend is Java with Spring; the data API is GraphQL, with the SQL written in its resolvers; Snowflake has no data catalog, so its own metadata is the source for that hop. The code can't be shared yet, so work stays on illustrative data shaped like this stack. Analysts open the screen most to see a transaction's whole life, which CQ-03 already asks.
  - Two ways to refresh a mapping set, both writing a new version and opening a pull request (the owner, 3 October 2026; the owner can't run Claude through an SDK in their environment, so decision 20's automated pipeline is out for now):
    - **Deep scan**, Claude Code on the owner's desktop: the first version, a new screen, a big refactor, and Snowflake's schema. Built (October 2026): the `lineage-scan` skill, `web/scripts/lineage-scan.ts` and `tools/lineage_sql.py`, tried on made-up repositories in `examples/lineage/`. Next: run it on the real transaction research repositories, once this repository is private, and see what the real code needs that the made-up code didn't (other ways of writing SQL, Kotlin, a generated GraphQL client).
    - **Quick refresh**, in the studio, through the owner's Bitbucket MCP connector: compare each repository's latest commit with the one the version read, take what changed since (commits or merged pull requests, and their diffs), keep only the files the set points at, and have Claude re-map only the hops they touch. It hands off to the deep scan when a change is too big: a file the set doesn't know, many fields at once, or a Snowflake change. Waits on the connector's exact name and its tools' names and inputs; the page declares them by name, and runs the connector as whoever opens it.
  - Where lineage lives: Git for now (the owner, 3 October 2026). Git suits the ontology; at enterprise scale lineage wants a queryable store with its own access controls, so impact questions such as "what breaks if this column changes" are a query and refreshes don't each need a review. Options when it's time: tables in Snowflake, a data catalog such as DataHub or OpenMetadata (both pull Snowflake's column-level lineage; neither reads application code or knows the ontology, so the studio would add those layers through its API), or a separate graph in Neptune. Until then the studio shows a new version once the page is rebuilt.
  - There are two screens now, each with its own mapping set (October 2026), and the studio gathers them by meaning in the page. Still open: keep one set per repository rather than per screen, so each scan rewrites only its own file and the data API's mappings serve every screen that calls it, with the studio stitching traces by field id. At hundreds of screens the meaning index belongs in the lineage store rather than in the page.
  - Start from a meaning, next (starting from a Snowflake column is built, October 2026): decide whether the names screens give a meaning ("Other names") become aliases in the ontology, which the explorer and search already read; and let a disagreement between screens become a ticket for the screens' owners, not only a question to Claude.
  - Decisions written back between scans change the current file in place; the history keeps each version as it stood when the next scan replaced it. Decide whether write-backs should be versions of their own.
  - Go further left: the source systems and pipelines that load Snowflake, in the same format.
  - Standards to line up with (research, 3 October 2026): emit the Snowflake-side hops as OpenLineage events (its Lineage Dataset Facet takes lineage with no run), so they show in Snowflake's own lineage graph; watch Apache Ossie's draft ontology mappings, which map fields to concepts with RDF or OWL IRIs; keep SSSOM, whose entity types have no column or screen field kind, so they go in as `rdfs resource`; and check the ECB's revised guide on risk data aggregation, expected in Q4 2026, for what it asks of lineage tied to definitions.
  - Pull requests open only when the draft changes the ontology; decisions on mappings ride along with one. Let them open a pull request of their own if people use the view on its own.
- The design studio, next:
  - Missions cover the 8 risk gaps. Write them for the other domains' questions as gaps open, and have each owning team review its mission's illustrative classes, codes and queries before they reach a pull request.
  - Placement when the map is crowded. Each mission on its own leaves the map clean; all eight on one draft leave 5 to 7 tidy-ups, since their designed spots overlap and the fallback search gives up after 160 tries. A wider, slower search could run in a worker, or the class map could grow a second room.
  - Confirm `create_session`'s answer from the first real pull request. Its shape isn't documented, so the studio looks for any session id in it; if it finds none, it says so and links to claude.ai/code.
  - Presence shows who else is in the studio (stage 2), but two people can still edit the same class at once. Each class, field and answer merges on its own, and the last edit to the same one wins.
  - Edits to released classes: the studio adds fields and relationships to them and leaves everything else to the change board. Moving a released class, or changing its description, could come next.
  - Who may open the pull request is enforced by the page, not the store. The pull request's review is the real gate. Wire CODEOWNERS-style module owners in (decision 9) when teams start using it.
  - The draft reaches the Claude Code session as text. The session is told to treat it as data, but a hostile edit could still try to steer it; keep the pull request's review as the gate.
- Fold the Snowflake lane (decision 5) into the overview. The chapter ports kept its content as it was.
- Move the overview's stylesheet (`platform.css`) onto the shared kit tokens and page styles, the way retrieval and the explorer use them, so the three apps can share one stylesheet.

## Housekeeping

- The repository is being made private (owner's decision, 30 September 2026). Its first two commits still hold the earlier "About the owner" text, so keep it private, or rewrite that history first, before making it public again.
