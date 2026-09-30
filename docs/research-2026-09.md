# Research notes, September 2026

What changed around this build, and what the pages rely on. Every finding below was re-checked against its source on 30 September 2026. Anything that couldn't be confirmed says so.

## Direction

- **AWS recommends the same shape we chose.** AWS prescriptive guidance (2026) describes an ontology-driven semantic layer for agentic AI, exposed through MCP and A2A, built on Neptune, Bedrock and AgentCore, and OpenSearch. It suggests:
  - virtualizing existing data sources, and materializing in the graph only what needs reasoning or cross-domain links;
  - Neptune has no built-in OWL reasoner, so pre-materialize inferences (for example, label chains).

  Sources:
  - Overview: https://docs.aws.amazon.com/prescriptive-guidance/latest/semantic-layer-agentic-ai-ontology-reasoning-virtual-knowledge-graph/semantic-layer-agentic-ai-ontology-reasoning-virtual-knowledge-graph.html
  - Trade-offs: https://docs.aws.amazon.com/prescriptive-guidance/latest/semantic-layer-agentic-ai-ontology-reasoning-virtual-knowledge-graph/technology-tradeoffs-alternatives.html
- **Semantic layers for agents shipped across the major data platforms between late 2025 and spring 2026:**
  - Snowflake: semantic views queryable with standard SQL (GA 2 March 2026; see Snowflake under Stores).
  - Databricks: Unity Catalog Business Semantics, including metric views, went GA on 2 April 2026. https://www.databricks.com/blog/redefining-semantics-data-layer-future-bi-and-ai
  - Microsoft Fabric IQ: its Ontology item, still in preview, defines entity types, relationships, rules and metrics, lets agents take governed actions, and can import RDF or OWL. https://learn.microsoft.com/fabric/iq/overview
  - Google: Looker BI agents grounded in the Looker semantic layer, announced at Next '26 in April 2026. https://cloud.google.com/blog/products/business-intelligence/looker-updates-for-agentic-bi-at-next26

## Agents and access

- **MCP spec 2026-07-28** is stateless: no initialize handshake or sessions. Requests carry `_meta` plus `Mcp-Method` and `Mcp-Name` headers, and results carry `resultType` and `structuredContent`. Source: https://aws.amazon.com/blogs/machine-learning/how-agentcore-gateway-supports-the-mcp-2026-07-28-spec/
- **AgentCore Policy went GA on 3 March 2026.** Cedar policies are attached to an AgentCore Gateway. With no matching policy the answer is deny, and any matching forbid beats every permit.
  - https://aws.amazon.com/about-aws/whats-new/2026/03/policy-amazon-bedrock-agentcore-generally-available/
  - https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-understanding-cedar.html
- **Neptune has no server-enforced read-only query flag.** Pair app-level validation with a read-only IAM role. Source: the BYOKG-RAG documentation at https://github.com/awslabs/graphrag-toolkit
- **MCP moved to the Linux Foundation's Agentic AI Foundation (AAIF), formed on 9 December 2025, and A2A joined it in August 2026.**
  - https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation
  - https://aaif.io/blog/a2a-joins-aaif

## Stores

- **Neptune's openCypher still has no full-text search integration with OpenSearch.** The Neptune guide still says it supports full-text search "in both Gremlin and SPARQL queries", so decision 12 stands. https://docs.aws.amazon.com/neptune/latest/userguide/full-text-search.html
- **Since 16 March 2026, openCypher queries can read S3 data** through `neptune.read()`. https://aws.amazon.com/about-aws/whats-new/2026/03/neptune-read-s3-opencypher/
- **OpenSearch**:
  - The hybrid search normalization processor (min-max, then a weighted arithmetic mean) is still current. https://docs.opensearch.org/latest/search-plugins/search-pipelines/normalization-processor/
  - Reciprocal rank fusion is available through the score-ranker processor. https://docs.opensearch.org/latest/vector-search/ai-search/hybrid-search/rrf/
  - An `s3vector` engine can back `knn_vector` fields on managed domains running OpenSearch 2.19 or later, keeping hybrid search, filters and aggregations. https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-opensearch.html
  - The next generation of OpenSearch Serverless went GA in May 2026 and can scale to zero. https://aws.amazon.com/about-aws/whats-new/2026/05/amazon-opensearch-serverless-next-generation-generally-available/
- **S3 Vectors has been generally available since 2 December 2025**, with up to 2 billion vectors per index. https://aws.amazon.com/about-aws/whats-new/2025/12/amazon-s3-vectors-generally-available/
- **Snowflake**:
  - The Snowflake-managed MCP server has been GA since 4 November 2025. It exposes Cortex Analyst (over semantic views), Cortex Search and SQL execution as tools, each call running under a specific Snowflake role. Preview notes: https://docs.snowflake.com/release-notes/2025/other/2025-10-02-mcp-server
  - On the managed MCP server, a Cortex Analyst tool generates SQL and returns the statement to the client rather than running it. A separate SQL execution tool runs statements, and its `read_only` setting (default `true`) allows only SELECT. Each call runs under the connecting user's default role, and each tool needs its own grant. Checked 30 September 2026: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp
  - Cortex Agents and MCP servers inside Snowflake Native Apps went GA on 7 August 2026: https://docs.snowflake.com/en/release-notes/2026/other/2026-08-07-native-apps-agents-mcp-ga
  - Semantic views can be queried with standard SQL (GA 2 March 2026), but they only see Snowflake data: https://atlan.com/know/snowflake/snowflake-semantic-views/
- **Embeddings:**
  - Amazon Nova Multimodal Embeddings (October 2025) offers 256, 384, 1,024 or 3,072 dimensions. https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-nova-multimodal-embeddings
  - Cohere Embed v4 on Bedrock (October 2025) reads documents with tables and charts, and is tuned for industries including finance. https://aws.amazon.com/about-aws/whats-new/2025/10/coheres-embed-v4-multimodal-embeddings-bedrock

## Reuse

- **AWS Labs' BYOKG-RAG** answers questions over a graph you bring. It combines four retrieval strategies (agentic, scoring-based, path-based, query-based), supports Neptune Database and Analytics with OpenSearch or S3 Vectors, and is Apache 2.0 licensed. https://github.com/awslabs/graphrag-toolkit
- **Bedrock Knowledge Bases GraphRAG** still builds its own graph, in Neptune Analytics, from the documents you upload to S3, so it doesn't fit an ontology we own. https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-build-graphs-build.html
- **Durable execution** (checked 30 September 2026):
  - Lambda durable functions run for up to one year. Steps are checkpointed and retried; after an interruption the code replays from the start and skips finished steps. Waits and callbacks suspend without compute charges, which suits human review. SDKs for Python, JavaScript, TypeScript and Java. https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html
  - Temporal's LangGraph plugin for Python is still in public preview (announced 16 July 2026), and experimental in the Temporal Python SDK. https://temporal.io/blog/temporal-langgraph-plugin-durable-execution and https://docs.temporal.io/develop/python/integrations/langgraph
  - LangGraph's `interrupt()` pauses a run on its checkpointer, and a `Command(resume=...)` on the same thread ID continues it. Nothing re-drives a run a crash left mid-step. https://docs.langchain.com/oss/python/langgraph/interrupts

## Standards and payments

- **FIBO** lives at https://github.com/edmcouncil/fibo and https://spec.edmcouncil.org/fibo/ under the MIT licence.
  - It's published as RDF/XML modules, a single-file Turtle "Quickstart", SKOS, and a data dictionary in CSV and XLSX.
  - Scale: the 2026 Q2 production release imports 153 ontologies, which declare 2,228 classes. We counted both from the release itself (`AboutFIBOProd`), which is why these figures replace the earlier estimates. https://spec.edmcouncil.org/fibo/ontology/master/2026Q2/AboutFIBOProd.rdf
  - It covers parties, agreements and instruments well, but has little on the card lifecycle.
- **ISO 20022**:
  - The Registration Authority's list of business areas (dated 4 June 2025) defines at least 48, each with a four-letter code such as `cain` for acquirer-to-issuer card transactions. We counted them from the list; the "30 business areas" figure often quoted is from 2020. https://www.iso20022.org/sites/default/files/media/file/ISO20022_BusinessAreas.pdf
  - The acquirer-to-issuer card messages (ATICA) span the `cain`, `caad` and `cafm` message families: authorisation, financial presentment, reversal, reconciliation, retrieval, inquiry, verification, card management, chargeback and file actions. Public listings show at least 23 message definitions. The exact current count couldn't be confirmed, because iso20022.org refuses automated requests. https://www.iotafinance.com/en/SWIFT-ISO20022-Business-area-cain-Acquirer-to-Issuer-Card-Transactions.html
  - From 14 November 2026, CBPR+ rejects fully unstructured postal addresses. Messages need at least a structured town and country; hybrid addresses are allowed. https://www.bny.com/content/dam/bnymellon/documents/pdf/iso-20022/hybrid-postal-address-industry-requirement.pdf
- **ISO code lists** (checked 2026-09-30), shown on chapter 1 as the third standard:
  - Merchant category codes are ISO 18245; the current edition is ISO 18245:2023. https://www.iso.org/standard/79450.html
  - Currency codes are ISO 4217 and country codes ISO 3166. https://www.iso.org/iso-4217-currency-codes.html and https://www.iso.org/iso-3166-country-codes.html
  - Dispute reason codes aren't an ISO list: each card network publishes its own.
- **SHACL 1.2 Core is still a W3C Working Draft**; the latest is dated 18 September 2026. https://www.w3.org/standards/history/shacl12-core/
- **RDF 1.2 has moved further:** RDF 1.2 Concepts has been a Candidate Recommendation since 7 April 2026, but it isn't a Recommendation yet. Decision 8 now says so; waiting still holds. https://www.w3.org/standards/history/rdf12-concepts/
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
