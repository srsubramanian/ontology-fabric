# Handoff: the story so far

Ontology Fabric is the project name, chosen at the end of the claude.ai conversation. This project started in a claude.ai chat project called "Ontology and RAG" in September 2026. It grew from one question, "how should Neptune and OpenSearch fit together?", into learning pages and a set of decisions. The pages are now one page, published on claude.ai at https://claude.ai/artifact/A5HhgTYfgDiRmbzBhz7gRA, and `site/index.html` is the same file. It holds four apps, switched by a bar at the top: the platform overview, the retrieval walkthrough, the class explorer and the design studio.

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

The design studio (`#studio`) is the class map as an editor, on the team's shared working draft. `#studio-Merchant` selects a class, `#studio-CQ-116` opens a question to answer, `#studio-mission-CQ-116` coaches a newcomer through answering it, and `#studio-ask-<id>` opens a question someone asked in their own words, with Claude's proposals.

Reading progress through the overview's chapters is stored in the browser under `pkl-progress-v1`; outside the published page, the studio keeps its working draft there too, under `studio:draft`. The studio also keeps, per browser, the mission questions a viewer answered (`studio:thought`) and whether they closed its welcome (`studio:welcomed`).

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
11. **The ontology core begins.** Prototype step 1 maps the draft to FIBO, OMG Commons and ISO 20022 at pinned releases, and a generator writes every artifact from it. Then 120 competency questions, 30 per domain, measure it. The explorer groups them by domain and shows each gap the schema can't answer yet. The dispute lifecycle was the first set of gaps closed (retrieval requests, arbitration and outcomes), then all of authorization (reversals, 3-D Secure, tokens, funding source, country, authorization types, stored credentials, partial approvals and stand-in), then money flows (interchange programs, FX, payouts and reserves, adjustments, clearing batches, reconciliation and network fees), then the rest of disputes (reason-code categories and network monitoring notices). The class map grew routed lines for them, and a check that keeps every line clear of boxes and other lines.
12. **A design studio.** Asked what building the ontology is like for a newcomer, a trial found the checks could mislead: a failing query still counted as answered, a SQL step marker passed on any line, and a Node failure printed only its version. Those were fixed, `tools/test_checks.py` now plants each kind of mistake to prove the checks name it, and the checks were ported to TypeScript so they run in the browser. On them sits the studio, the page's fourth app, for ontology engineers. Its first version had people write YAML patches beside the map; the owner wanted a live place to build instead, so the map became the editor: add and drag classes, drag from one to another to relate them, edit fields in a panel, ask Claude to build in plain words, all on one working draft the organization shares live, checked on every change, and opened as a pull request with one click (decision 24).
13. **Missions for payments people.** The owner found the studio not beginner friendly, and chose guided missions in payments words for people with no modelling background. Each of the eight risk gaps became a mission of a few steps (choose, place, connect, record fields, walk, query) that says why each answer is right or not and points at what to use on the map, with Show me and Do it for me. Every mission is played offline in CI. Building them showed the router couldn't keep a crowded map clean, so the class map's tidy-ups stopped blocking the pull request; its session tidies them, and CI's layout check still holds (decision 24).
14. **The open-world studio.** The owner found the missions too scripted, and wanted something open and much smarter. An interview settled the direction (decision 25): any question in someone's own words; a business expert and an engineer side by side, each in their own lens; a dial from tutor to autopilot, with people always deciding; knowledge from the organization's own Confluence, Jira, SharePoint, OneDrive and GitHub; quick work in the page and deep work in a cloud session. A visual design (https://claude.ai/artifact/KHkFePCG7dEJmBLrTK4a95, private) splits it into five stages. Stage 1, ask anything, is built: Claude proposes a design it has checked, the map shows it as ghosts, and people accept it piece by piece. The question becomes a new competency question. Stage 2 followed: a story lens that reads the ontology as plain sentences beside the map's model, comments on proposals, and live presence, so an expert and an engineer see each other's pointers and selections. The owner asked to keep document connectors off for now, so stage 3 waits.

## Clarifications worth keeping

- **At question time the retrieval service never reads the ontology files in Git.** It uses the copies each release generates: the OpenSearch ontology index, the label chains and meta-graph in Neptune, and the validator's rules, all stamped with the same `ontology_version`.
- **People own the ontology; machines draft and generate.** Machines draft proposals and generate everything downstream. Nobody writes graph data by hand.
- **Claude on its own answers from training.** The knowledge layer is what adds your own data, agreed meaning, citations and checks.
