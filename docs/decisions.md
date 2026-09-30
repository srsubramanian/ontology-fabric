# Decisions

Settled unless a later entry says otherwise. Newest changes are at the bottom of each section.

## Stores and what lives where

1. **Neptune Database (openCypher) holds the facts we reason over**: disputes, parties, instruments and the links between them. We chose it over RDF and SPARQL, since openCypher is converging on the ISO GQL standard.
2. **High-volume events stay where they are.** Every authorization and every settlement file stays in the lake or Snowflake, linked by ID. A record is pulled into Neptune when a question needs to walk through it, for example when a dispute touches an authorization. For authorizations, that means one a dispute or fraud report touches, pulled in with its capture and settlement. Risk walks that need ordinary authorizations use summary edges that Snowflake rebuilds daily instead, such as `(:Device)-[:SEEN_AT {auths, first_seen, last_seen}]->(:Merchant)`. A settlement record comes in only along such a chain; settlement files, batches and reconciliation stay in Snowflake. Fee amounts stay in Snowflake too, joined to graph records by ID; a fee program, such as an interchange category, becomes a code node only when a competency question walks to it.
3. **OpenSearch holds three derived, rebuildable indexes: entities, chunks and ontology.** Each sits behind an alias pointing at a versioned index, such as `entities_v1_6`. A release builds new indexes, runs the competency questions against them, then swaps all aliases in one atomic call. Entities and ontology use the fast in-memory tier. Chunks can use the cheaper S3 Vectors engine.
4. **One ID rule works across all stores**, for example `m:{merchant_id}`. The Neptune node ID, the OpenSearch `_id` and `neptune_id` field, and the Snowflake key all line up.
5. **Snowflake answers "how much" and "how often".** Metrics are defined once in the ontology and generated into Snowflake semantic views. Semantic views only see Snowflake data, so joins across stores happen in the retrieval service, by ID. The service runs a reviewed SQL template when one fits, through a connector. Otherwise Cortex Analyst, reached through the Snowflake-managed MCP server, writes SQL from the semantic views and hands it back; our validator checks it (decision 13) before the read-only SQL tool runs it, under the caller's Snowflake role.

## Ontology

6. **The ontology is a product, authored in Git.** LinkML is recommended, with Turtle as the fallback, and it's published as OWL. A generator produces:
   - Neptune loader headers and label chains, for example `:Chargeback:DisputeEvent:PaymentEvent`;
   - Pydantic models;
   - the extraction JSON Schema;
   - OpenSearch mappings;
   - Snowflake semantic views;
   - documentation.

   If you need OWL features LinkML can't express, keep a small hand-written Turtle file and merge it in CI with `robot merge`.
7. **Modeling rules:**
   - Model events, not status fields.
   - Make codes nodes when things link to them.
   - Give each relationship one canonical direction.
   - Keep hierarchies to 3 or 4 levels.
   - Organizations get roles rather than duplicate nodes. Role classes take plain names (`Issuer`, `Acquirer`, `Merchant`, `Cardholder`) under an abstract `PartyRole`, and a party reaches each role through `ACTS_AS`.
   - A card reaches its issuer through its BIN range (`Card IN_BIN_RANGE BinRange ASSIGNED_TO Issuer`), never a direct link, so a portfolio moving to another issuer is one edge change.
   - A chunk `MENTIONS` any entity it names, such as a merchant, a reason code or a dispute. In LinkML its range is `linkml:Any`. Who may see the chunk is still decided by its classification in OpenSearch.
8. **SHACL 1.0 core gates every load.** Missing required links reject the record. SHACL 1.2 is still a Working Draft and RDF 1.2 a Candidate Recommendation; wait until both are W3C Recommendations.
9. **Bootstrap from industry standards, then hand ownership to teams.** Chapter 1 of the platform page shows it.
   - Sources: ISO 20022 card and payment messages, FIBO for parties and agreements, and ISO code lists.
   - Align with them through `skos:closeMatch`. Never use `owl:imports`, and pin the FIBO release you mapped against.
   - Measure coverage rather than assume it, in two ways: how many competency questions the draft answers, and how many mined code terms map to a standard concept.
   - Ownership is layered. The core team owns the core, owning teams own domain modules through CODEOWNERS, and teams add their own extensions freely and promote them when shared.
   - Review windows default to a decision. Silence isn't a veto: after about five working days, the core team merges.
10. **Change lanes:**
    - Patch changes (aliases, code values) auto-merge once acceptance is 95% or higher.
    - Minor changes (new class or relationship) need owner approval.
    - Major changes (rename, remove, split) go to a change board.
    - Semantic versioning throughout. Consumers pin version ranges.

## Retrieval

11. **Pipeline stages:** gateway, understand, entry points, then four parallel lanes (walk the graph, count in the graph, ask the warehouse, find the text), then assemble, answer and check.
12. **Entry points come from OpenSearch hybrid search.** It uses min-max normalization and a weighted mean, fuzzy matching and the ontology's aliases. Neptune's openCypher has no full-text search, so the join happens in the service.
13. **Reviewed templates first, then generated queries.** Generated Cypher and SQL are validated against the ontology: labels, directions, read-only access and a LIMIT. Rejections go back to Claude with the error and the allowed options.
14. **Choose the engine by the shape of the count.** Counts that follow relationships go to Neptune. Sums, ratios and time series over big tables go to Snowflake. **The model never calculates**: numbers come from query results.
15. **Every claim cites an ID.** Before an answer leaves, code checks the citations, numbers, thresholds and data freshness, and the caller's access to every source.
16. **Reuse before building:** prototype retrieval on AWS Labs' BYOKG-RAG. We don't use Bedrock Knowledge Bases GraphRAG, because it builds its own graph from S3 documents.

## Agents and access

17. **MCP follows the 2026-07-28 spec:** stateless calls, `Mcp-Method` and `Mcp-Name` headers, `_meta`, and structured results. Agents never get a raw Cypher tool. A2A handles agent-to-agent work. Version 1 is read-only. Actions come in a later phase, once retrieval proves out: action types defined in the ontology and generated into MCP tools, such as `open_representment` taking a `Chargeback` and its `Document`s. Each calls the owning system's API, never a Neptune write, behind a Cedar permit and human approval; the change reaches the graph through the normal loads.
18. **Access is enforced in layers:**
    - AgentCore Gateway checks identity.
    - AgentCore Policy (Cedar) is default deny, and a forbid rule beats any permit.
    - Our validator comes next.
    - The IAM role for Neptune is read-only, as the last lock.
    - Snowflake enforces its own role, row access and masking policies.
    - OpenSearch filters documents by classification.

## Extraction pipeline

19. **How code becomes ontology proposals:** tree-sitter extracts facts, Claude maps them to the ontology with a confidence score, and anything under 0.9 goes to a person. Gaps become ontology pull requests.
20. **Reviews can wait for days, so runs must survive restarts.** The pipeline runs on Lambda durable functions: each step is checkpointed and retried, a crash replays past finished steps, and a reviewer's decision arrives as a callback the run waits on, up to a year, at no compute cost. Claude's mapping can use LangGraph inside a step. Each invocation keeps Lambda's 15-minute limit, so sources are split into batches, and long agent work on one repository runs as a Fargate task the function waits on.

## The pages

21. **The learning pages move to React, one page at a time** (Vite, React 19, TypeScript, `motion/react`). Each page still builds into one self-contained HTML file in `site/`, so publishing and the smoke test don't change. Shared parts live in `web/src/kit/`. The retrieval page moved first, with every view pixel-identical to the hand-written version. The platform page follows chapter by chapter: it already builds from `web/`, its original markup and scripts moved there unchanged (every view identical), and each chapter moves to React in turn. All seven chapters have moved, each with every view identical; the shell (map, section nav, reading path, router) is still the original scripts. The class explorer and question tracer are built in React from the start.
22. **Pages read the ontology from its LinkML source, never from a hand-copied list.** The class explorer imports `ontology/payments.yaml` at build time and derives label chains, inherited slots and relationships the way LinkML's SchemaView does. Until prototype step 1 delivers the real core, that file is an illustrative draft written down from the pages themselves.
