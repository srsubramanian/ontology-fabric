# Decisions

Settled unless a later entry says otherwise. Newest changes are at the bottom of each section.

## Stores and what lives where

1. **Neptune Database (openCypher) holds the facts we reason over**: disputes, parties, instruments and the links between them. We chose it over RDF and SPARQL, since openCypher is converging on the ISO GQL standard.
2. **High-volume events stay where they are.** Every authorization and every settlement file stays in the lake or Snowflake, linked by ID. A record is pulled into Neptune when a question needs to walk through it, for example when a dispute touches an authorization.
3. **OpenSearch holds three derived, rebuildable indexes: entities, chunks and ontology.** Each sits behind an alias pointing at a versioned index, such as `entities_v1_6`. A release builds new indexes, runs the competency questions against them, then swaps all aliases in one atomic call. Entities and ontology use the fast in-memory tier. Chunks can use the cheaper S3 Vectors engine.
4. **One ID rule works across all stores**, for example `m:{merchant_id}`. The Neptune node ID, the OpenSearch `_id` and `neptune_id` field, and the Snowflake key all line up.
5. **Snowflake answers "how much" and "how often".** Metrics are defined once in the ontology and generated into Snowflake semantic views. Semantic views only see Snowflake data, so joins across stores happen in the retrieval service, by ID.

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
   - Organizations get roles rather than duplicate nodes.
8. **SHACL 1.0 core gates every load.** Missing required links reject the record. SHACL 1.2 and RDF 1.2 are still drafts, so wait for them.
9. **Bootstrap from industry standards, then hand ownership to teams.** This direction is agreed; updating the platform page to show it is still open.
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

17. **MCP follows the 2026-07-28 spec:** stateless calls, `Mcp-Method` and `Mcp-Name` headers, `_meta`, and structured results. Agents never get a raw Cypher tool. A2A handles agent-to-agent work.
18. **Access is enforced in layers:**
    - AgentCore Gateway checks identity.
    - AgentCore Policy (Cedar) is default deny, and a forbid rule beats any permit.
    - Our validator comes next.
    - The IAM role for Neptune is read-only, as the last lock.
    - Snowflake enforces its own role, row access and masking policies.
    - OpenSearch filters documents by classification.

## Extraction pipeline

19. **How code becomes ontology proposals:** tree-sitter extracts facts, Claude maps them to the ontology with a confidence score, and anything under 0.9 goes to a person. Gaps become ontology pull requests.
20. **Reviews can wait for days, so runs must survive restarts.** Which durable execution engine to use is still open (see `open-questions.md`).
