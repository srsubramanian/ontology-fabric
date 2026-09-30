# Research notes, September 2026

What changed around this build, and what the pages rely on. Where the source URL wasn't captured, the finding is marked **re-verify**. It came from a September 2026 web search, but check it before building on it.

## Direction

- **AWS recommends the same shape we chose.** AWS prescriptive guidance (2026) describes an ontology-driven semantic layer for agentic AI, exposed through MCP and A2A, built on Neptune, Bedrock and AgentCore, and OpenSearch. It suggests:
  - virtualizing existing data sources, and materializing in the graph only what needs reasoning or cross-domain links;
  - Neptune has no built-in OWL reasoner, so pre-materialize inferences (for example, label chains).

  Sources:
  - Overview: https://docs.aws.amazon.com/prescriptive-guidance/latest/semantic-layer-agentic-ai-ontology-reasoning-virtual-knowledge-graph/semantic-layer-agentic-ai-ontology-reasoning-virtual-knowledge-graph.html
  - Trade-offs: https://docs.aws.amazon.com/prescriptive-guidance/latest/semantic-layer-agentic-ai-ontology-reasoning-virtual-knowledge-graph/technology-tradeoffs-alternatives.html
- **Semantic layers for agents shipped across the major data platforms in early 2026**: Snowflake, Databricks, Microsoft Fabric IQ (whose ontology also covers rules and actions), and Google. **Re-verify.**

## Agents and access

- **MCP spec 2026-07-28** is stateless: no initialize handshake or sessions. Requests carry `_meta` plus `Mcp-Method` and `Mcp-Name` headers, and results carry `resultType` and `structuredContent`. Source: https://aws.amazon.com/blogs/machine-learning/how-agentcore-gateway-supports-the-mcp-2026-07-28-spec/
- **AgentCore Policy went GA in March 2026.** It uses Cedar policies at the gateway, default deny, and a forbid rule beats any permit. **Re-verify.**
- **Neptune has no server-enforced read-only query flag.** Pair app-level validation with a read-only IAM role. Source: the BYOKG-RAG documentation at https://github.com/awslabs/graphrag-toolkit
- **MCP moved to the Linux Foundation's Agentic AI Foundation in December 2025, and A2A joined it in August 2026.** **Re-verify.**

## Stores

- **Neptune's openCypher still has no full-text search integration with OpenSearch** (only Gremlin and SPARQL do). Since March 2026, openCypher queries can read S3 data through `neptune.read()`. **Re-verify.**
- **OpenSearch**:
  - The hybrid search normalization processor (min-max plus weighted arithmetic mean) is still current.
  - Reciprocal rank fusion is available.
  - An S3 Vectors engine can back vector fields while keeping hybrid search.
  - OpenSearch Serverless was rebuilt in May 2026 and can scale to zero.

  **Re-verify** each.
- **S3 Vectors has been generally available since December 2025.** **Re-verify.**
- **Snowflake**:
  - The Snowflake-managed MCP server has been GA since 4 November 2025. It exposes Cortex Analyst (over semantic views), Cortex Search and SQL execution as tools, each call running under a specific Snowflake role. Preview notes: https://docs.snowflake.com/release-notes/2025/other/2025-10-02-mcp-server
  - Cortex Agents and MCP servers inside Snowflake Native Apps went GA on 7 August 2026: https://docs.snowflake.com/en/release-notes/2026/other/2026-08-07-native-apps-agents-mcp-ga
  - Semantic views can be queried with standard SQL (GA 2 March 2026), but they only see Snowflake data: https://atlan.com/know/snowflake/snowflake-semantic-views/
- **Embeddings**: Nova 2 multimodal embeddings let you choose 256 to 3,072 dimensions. Cohere Embed v4 on Bedrock handles tables and charts and is tuned for finance. **Re-verify.**

## Reuse

- **AWS Labs' BYOKG-RAG** answers questions over a graph you bring. It combines four retrieval strategies (agentic, scoring-based, path-based, query-based), supports Neptune Database and Analytics with OpenSearch or S3 Vectors, and is Apache 2.0 licensed. https://github.com/awslabs/graphrag-toolkit
- **Bedrock Knowledge Bases GraphRAG** still builds its own graph from S3 documents, so it doesn't fit an ontology we own. **Re-verify.**
- **Durable execution**: Temporal released a LangGraph plugin in public preview in July 2026. **Re-verify.**

## Standards and payments

- **FIBO** lives at https://github.com/edmcouncil/fibo and https://spec.edmcouncil.org/fibo/ under the MIT licence.
  - It's published as RDF/XML modules, a single-file Turtle "Quickstart", SKOS, and a data dictionary in CSV and XLSX.
  - Scale: about 196 ontology files in the 2026 Q2 production release, and about 3,173 entities in a derived model. As much as a third can change in a quarter.
  - It covers parties, agreements and instruments well, but has little on the card lifecycle.

  **Re-verify** the counts.
- **ISO 20022**:
  - Swift counted 400+ messages across 20+ business areas back in 2017; BNY Mellon put it at 30 business areas in 2020.
  - The acquirer-to-issuer card messages (ATICA, about 30) cover authorisation, financial presentment, reversal, retrieval, chargeback, fraud reporting and fee collection.
  - Swift's CBPR+ rules start rejecting fully unstructured addresses on 14 November 2026.

  **Re-verify.**
- **SHACL 1.2 and RDF 1.2 are still W3C Working Drafts.** **Re-verify.**
- **Visa VAMP**:
  - The merchant Excessive threshold dropped from 2.2% to 1.5% on 1 April 2026 (the CEMEA region stays at 2.2%).
  - The ratio counts fraud reports (TC40) plus disputes (TC15).
  - The monitoring floor is 1,500 combined events a month.
  - The fee is $8 per fraudulent or disputed transaction.
  - Acquirer thresholds are 0.5% (above standard) and 0.7% (excessive).

  Sources:
  - https://merchantriskcouncil.org/learning/resource-center/member-news/blog/2026/stricter-vamp-ratio-thresholds-are-now-in-effect-heres-how-to-stay-compliant
  - https://www.chargeflow.io/blog/vamp-visa-acquirer-monitoring-program

## Standards the draft ontology maps to (checked 2026-09-30)

- **FIBO's party concepts now live in the OMG Commons Ontology Library.** FIBO's Parties ontology was changed to reuse Commons v1.1 and v1.2 (FND-380, FND-389). Source: https://spec.edmcouncil.org/fibo/ontology/FND/Parties/Parties/
- **Commons Parties and Situations, release 20250801:** `cmns-pts:Party` ("person or organization") and `cmns-pts:PartyRole` ("role played by an organization or individual that may be time bound"). Source: https://www.omg.org/spec/Commons/PartiesAndSituations/
- **Commons Organizations, release 20250801:** `cmns-org:Organization`. Source: https://www.omg.org/spec/Commons/Organizations/
- **FIBO People:** `fibo-fnd-aap-ppl:Person` ("individual human being, with consciousness of self"), read from FIBO master. Pin a quarterly release when the real core is mapped (decision 9). Source: https://spec.edmcouncil.org/fibo/ontology/FND/AgentsAndPeople/People/
- **LinkML 1.11.1:** `linkml-lint`, `gen-owl` and `gen-shacl` all run cleanly on `ontology/payments.yaml`. `close_mappings` come out as `skos:closeMatch`, and the OWL has no `owl:imports`.

## Claude Code

- **Project memory**: `./CLAUDE.md` loads at every session start, and `@path` imports pull in other files. Keep it concise. https://docs.claude.com/en/docs/claude-code/memory
