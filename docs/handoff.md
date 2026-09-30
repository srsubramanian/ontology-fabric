# Handoff: the story so far

Ontology Fabric is the project name, chosen at the end of the claude.ai conversation. This project started in a claude.ai chat project called "Ontology and RAG" in September 2026. It grew from one question, "how should Neptune and OpenSearch fit together?", into two learning pages and a set of decisions. The published copies on claude.ai are:

- Platform overview: https://claude.ai/artifact/A5HhgTYfgDiRmbzBhz7gRA
- Retrieval walkthrough: https://claude.ai/artifact/Sd5jT4CmwRLyvoMY3QUQSk
- Class explorer: https://claude.ai/artifact/BqDPHaioHftbPxMQobyz74

The files in `site/` are the same pages, with the links between them as relative paths. All three were republished from `main` on 30 September 2026; each published copy is the built page with its links to the other two pointed at these URLs.

## How the pages are organised

`site/platform.html` has a map and seven chapters, each split into sub-pages:

| Chapter | Sub-pages |
|---|---|
| 1 Design the ontology | Building blocks (OWL, Turtle, Git, SHACL, four forms from one LinkML source), Version 1 (standards first, the two coverage numbers, who owns it), Turtle or LinkML, Check yourself |
| 2 Fill the graph | Code to graph, What lives where, Two jobs, Check yourself |
| 3 Two stores, one join | Two stores, Who owns what, Indexes (with storage tiers), Check yourself |
| 4 Answer a question | Hybrid search, One question, Build or reuse, Check yourself |
| 5 Who uses it | Tool calls (MCP 2026, guardrails, A2A), Four ways in, Check yourself |
| 6 Keep it current | Versions and alias swaps, The loop, Check yourself |
| 7 Build it | Build order, Decisions, Watch list, Check yourself |

`site/retrieval.html` has a map with five example questions, and 11 stages that follow one mixed question: "Was Sunset Tickets over Visa's VAMP threshold in August, and what drove it?"

- Snowflake computes the ratio.
- Neptune finds the shared stolen-card pattern.
- OpenSearch supplies the VAMP rules.
- Code checks the numbers before anything is answered.

Reading progress on the platform page is stored in the browser under `pkl-progress-v1`.

## How the thinking moved

1. **The architecture.** We settled on Neptune openCypher as the source of truth, OpenSearch as three derived indexes, and joining the two by `neptune_id` in the retrieval service. Neptune's openCypher has no full-text search, which is why the join lives there.
2. **The ontology process.** Competency questions become tests, code mining produces a term inventory, and modeling patterns are settled before anything is named. Every change then goes through the continuous loop.
3. **Presentation.** The owner prefers visual learning. Mermaid and ELK were tried and rejected in favour of hand-drawn SVG with Motion. The long single-scroll page was then split into separate views, with tabs and a pager.
4. **Deep dives in every chapter**, built around the Maya and Harbor Grill story.
5. **The September 2026 research check.** The direction held. Updates added: the MCP 2026-07-28 spec, AgentCore Policy, a read-only IAM role, the S3 Vectors tier, BYOKG-RAG, "what lives where", A2A, durable execution and a watch list.
6. **The standards-first plan.** Bootstrap about 80% of the ontology from ISO 20022 and FIBO, then hand ownership to teams through layers and review windows, so the project isn't blocked waiting on every team. Chapter 1 shows it: standards come first on the version 1 map, two coverage numbers measure the draft, and "Who owns it" shows the core, domain modules and team extensions, with a five-day review window.
7. **Snowflake joins retrieval** as the warehouse lane, with metrics defined once in the ontology and computed in SQL.
8. **The pages move to React.** The single-file platform page was getting hard to extend, and the backlog (class explorer, question tracer, pages generated from LinkML) needs components and data. The retrieval page was ported first to `web/`; it still builds into one HTML file, and every view matches the hand-written version pixel for pixel. The platform page followed: it builds from `web/`, and all seven chapters are React, each ported identical; chapter 1 was then made standards-first.
9. **A class explorer, read from LinkML.** The draft ontology in `ontology/` writes down what the pages already show, and `site/ontology.html` draws it: classes, abstract parents as frames, relationships in their one direction, where each class's data lives, who owns it, and the competency questions it must answer. Pick a question and play its walk: the map adds one relationship at a time, and the query (openCypher for Neptune, SQL for Snowflake) lights the line that walks it.

## Clarifications worth keeping

- **At question time the retrieval service never reads the ontology files in Git.** It uses the copies each release generates: the OpenSearch ontology index, the label chains and meta-graph in Neptune, and the validator's rules, all stamped with the same `ontology_version`.
- **People own the ontology; machines draft and generate.** Machines draft proposals and generate everything downstream. Nobody writes graph data by hand.
- **Claude on its own answers from training.** The knowledge layer is what adds your own data, agreed meaning, citations and checks.
