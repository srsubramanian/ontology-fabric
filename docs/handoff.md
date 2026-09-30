# Handoff: the story so far

Ontology Fabric is the project name, chosen at the end of the claude.ai conversation. This project started in a claude.ai chat project called "Ontology and RAG" in September 2026. It grew from one question, "how should Neptune and OpenSearch fit together?", into learning pages and a set of decisions. The pages are now one page, published on claude.ai at https://claude.ai/artifact/A5HhgTYfgDiRmbzBhz7gRA, and `site/index.html` is the same file. It holds three apps, switched by a bar at the top: the platform overview, the retrieval walkthrough and the class explorer.

The retrieval walkthrough (https://claude.ai/artifact/Sd5jT4CmwRLyvoMY3QUQSk) and the class explorer (https://claude.ai/artifact/BqDPHaioHftbPxMQobyz74) were also published on their own before the merge. Those copies no longer update.

## How the page is organised

The overview (`#map`) has a map and seven chapters, each split into sub-pages (`#ch3`, `#ch3-2`):

| Chapter | Sub-pages |
|---|---|
| 1 Design the ontology | Building blocks (OWL, Turtle, Git, SHACL, four forms from one LinkML source), Version 1 (standards first, the two coverage numbers, who owns it), Turtle or LinkML, Check yourself |
| 2 Fill the graph | Code to graph, What lives where, Two jobs, Check yourself |
| 3 Two stores, one join | Two stores, Who owns what, Indexes (with storage tiers), Check yourself |
| 4 Answer a question | Hybrid search, One question, Build or reuse, Check yourself |
| 5 Who uses it | Tool calls (MCP 2026, guardrails, A2A), Four ways in, Check yourself |
| 6 Keep it current | Versions and alias swaps, The loop, Check yourself |
| 7 Build it | Build order, Decisions, Watch list, Check yourself |

The retrieval walkthrough (`#retrieval`) has a map with five example questions, and 11 stages (`#retrieval-s1` to `#retrieval-s11`) that follow one mixed question: "Was Sunset Tickets over Visa's VAMP threshold in August, and what drove it?"

- Snowflake computes the ratio.
- Neptune finds the shared stolen-card pattern.
- OpenSearch supplies the VAMP rules.
- Code checks the numbers before anything is answered.

The class explorer (`#explorer`) shows the draft ontology: `#explorer-Chargeback` picks a class, `#explorer-CQ-04` traces a competency question, and `#explorer-CQ-27` shows one the schema can't answer yet.

Reading progress through the overview's chapters is stored in the browser under `pkl-progress-v1`.

## How the thinking moved

1. **The architecture.** We settled on Neptune openCypher as the source of truth, OpenSearch as three derived indexes, and joining the two by `neptune_id` in the retrieval service. Neptune's openCypher has no full-text search, which is why the join lives there.
2. **The ontology process.** Competency questions become tests, code mining produces a term inventory, and modeling patterns are settled before anything is named. Every change then goes through the continuous loop.
3. **Presentation.** The owner prefers visual learning. Mermaid and ELK were tried and rejected in favour of hand-drawn SVG with Motion. The long single-scroll page was then split into separate views, with tabs and a pager.
4. **Deep dives in every chapter**, built around the Maya and Harbor Grill story.
5. **The September 2026 research check.** The direction held. Updates added: the MCP 2026-07-28 spec, AgentCore Policy, a read-only IAM role, the S3 Vectors tier, BYOKG-RAG, "what lives where", A2A, durable execution and a watch list.
6. **The standards-first plan.** Bootstrap about 80% of the ontology from ISO 20022 and FIBO, then hand ownership to teams through layers and review windows, so the project isn't blocked waiting on every team. Chapter 1 shows it: standards come first on the version 1 map, two coverage numbers measure the draft, and "Who owns it" shows the core, domain modules and team extensions, with a five-day review window.
7. **Snowflake joins retrieval** as the warehouse lane, with metrics defined once in the ontology and computed in SQL.
8. **The pages move to React.** The single-file platform page was getting hard to extend, and the backlog (class explorer, question tracer, pages generated from LinkML) needs components and data. The retrieval page was ported first to `web/`; it still builds into one HTML file, and every view matches the hand-written version pixel for pixel. The platform page followed chapter by chapter, then its shell (map, reading path, router), each ported with every view identical, so it's all React now. Chapter 1 was also made standards-first.
9. **A class explorer, read from LinkML.** The draft ontology in `ontology/` writes down what the pages already show, and the class explorer draws it: classes, abstract parents as frames, relationships in their one direction, where each class's data lives, who owns it, and the competency questions it must answer. Pick a question and play its walk: the map adds one relationship at a time, and the query (openCypher for Neptune, SQL for Snowflake) lights the line that walks it.
10. **One page.** The three pages merged into one, so there's a single link to share and the links between them became jumps within it. A bar switches between the overview, retrieval and the class explorer. Each app keeps exactly its old look, because only the showing app's styles are in the page.
11. **The ontology core begins.** Prototype step 1 maps the draft to FIBO, OMG Commons and ISO 20022 at pinned releases, and a generator writes every artifact from it. Then 120 competency questions, 30 per domain, measure it. The explorer groups them by domain and shows each gap the schema can't answer yet. The dispute lifecycle was the first set of gaps closed (retrieval requests, arbitration and outcomes), then all of authorization (reversals, 3-D Secure, tokens, funding source, country, authorization types, stored credentials, partial approvals and stand-in), then money flows (interchange programs, FX, payouts and reserves, adjustments, clearing batches, reconciliation and network fees). The class map grew routed lines for them, and a check that keeps every line clear of boxes and other lines.

## Clarifications worth keeping

- **At question time the retrieval service never reads the ontology files in Git.** It uses the copies each release generates: the OpenSearch ontology index, the label chains and meta-graph in Neptune, and the validator's rules, all stamped with the same `ontology_version`.
- **People own the ontology; machines draft and generate.** Machines draft proposals and generate everything downstream. Nobody writes graph data by hand.
- **Claude on its own answers from training.** The knowledge layer is what adds your own data, agreed meaning, citations and checks.
