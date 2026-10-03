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
- **Neptune's openCypher load format** (checked 2026-09-30), which `tools/generate.py` writes headers for:
  - Node files need `:ID`. `:LABEL` holds several labels separated by `;`, which is how a node gets its whole label chain.
  - Relationship files need `:START_ID`, `:END_ID` and `:TYPE`. `:ID` is required too while `userProvidedEdgeIds` is true, the default.
  - Property columns are `name:Type`. The types are Bool, Byte, Short, Int, Long, Float, Double, String and DateTime; no decimal type or list columns are documented.
  - https://docs.aws.amazon.com/neptune/latest/userguide/bulk-load-tutorial-format-opencypher.html
- **OpenSearch vector fields** (checked 2026-09-30):
  - OpenSearch names the cosine space `cosinesimil`; `cosine` isn't in its list of space types. https://docs.opensearch.org/latest/mappings/supported-field-types/knn-spaces/
  - The `s3vector` engine is set with `"method": {"engine": "s3vector"}` and needs `"index": {"knn": true}`. It supports `l2` and `cosinesimil`, and up to 4,096 dimensions. It requires OpenSearch 2.19 or later, on OpenSearch Optimized instances. https://docs.aws.amazon.com/opensearch-service/latest/developerguide/s3-vector-opensearch-integration-engine.html
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
- **FIBO People:** `fibo-fnd-aap-ppl:Person` ("individual human being, with consciousness of self"). Source: https://spec.edmcouncil.org/fibo/ontology/FND/AgentsAndPeople/People/
- **LinkML 1.11.1:** `linkml-lint`, `gen-owl` and `gen-shacl` all run cleanly on `ontology/payments.yaml`. `close_mappings` come out as `skos:closeMatch`, and the OWL has no `owl:imports`. By default `gen-owl` renders enum values as classes; pass `--default-permissible-value-type http://www.w3.org/2002/07/owl#NamedIndividual` so values that point at FIBO individuals, such as `VisaNetwork`, keep FIBO's typing.

### Prototype step 1: the draft mapped to pinned releases (checked 2026-09-30)

The schema pins FIBO 2026 Q2 and OMG Commons 20250801 in its annotations. Each ISO 20022 mapping names a message version. `tools/check_ontology.py` reported 13 of 21 concrete classes mapped: FIBO 7, ISO 20022 4, OMG Commons 2. The other eight say why no standard concept fits. Version 1.8.0 adds RetrievalRequest (ISO 20022, below), Arbitration and DisputeOutcome, for 14 of 24. Version 1.9.0 adds Reversal (ISO 20022) and Authentication, for 15 of 26. Version 1.11.0 adds ClearingBatch, Reconciliation and FeeCollection (ISO 20022), Payout, Adjustment and FeeProgram, for 18 of 32. Version 1.12.0 adds MonitoringNotice, a network rule with no standard, for 18 of 33.

- **FIBO 2026 Q2 has a card module**, LOAN "Card Accounts" (`fibo-loan-spc-crd`). It was read from the release's own modules: 155 files, each with a `versionIRI` under `master/2026Q2`. https://spec.edmcouncil.org/fibo/ontology/LOAN/LoansSpecific/CardAccounts/
  - `PaymentCard`: "legal document issued by a financial services provider that enables the cardholder to access the funds…" (a `cmns-doc:LegalDocument`). Card maps to it.
  - `Cardholder`: "account holder to whom a payment card is issued". Cardholder maps to it.
  - `IssuingFinancialInstitution`: "issuer and financial services provider that issues payment cards or performs, facilitates, or supports issuing services". Issuer maps to it. FIBO's plain `Issuer` means an issuer of financial instruments, so it isn't used.
  - `CreditCardNetwork`, with named individuals such as `VisaNetwork` and `MastercardNetwork`. The CardNetwork enum and its values map to them.
- **Elsewhere in FIBO 2026 Q2:**
  - BE Functional Entities: `Merchant` ("party engaged in the purchase and sales of goods produced by others for profit") and `MerchantCategoryCode`. Merchant and the `mcc` slot map to them. https://spec.edmcouncil.org/fibo/ontology/BE/FunctionalEntities/FunctionalEntities/
  - `IssuerIdentificationNumber` ("a numbering system that allows a credit, debit, or other card to be identified as having been issued by a particular financial institution"), in FBC North American Entities. BinRange maps to it.
  - `SettlementEvent` ("specific event involving the finalization a transaction or portion thereof"), in FBC Settlement. Settlement maps to it.
  - FIBO has no acquirer, device, refund or dispute concepts.
- **OMG Commons Documents, release 20250801:** `cmns-doc:Document` ("unitary expression of some realization of an intellectual or artistic work"). Document maps to it. https://www.omg.org/spec/Commons/Documents/
- **ISO 20022 card messages.** The current versions were read from the ISO 20022 message definitions page. It lists the acquirer-to-issuer set (`cain.001` to `cain.028`), plus `caad`, `cafc` (fee collection), `cafm` (file action) and `cafr` (fraud reporting and disposition). https://www.iso20022.org/iso-20022-message-definitions
  - `cain.001.001.05` AuthorisationInitiationV05: "sent by an acquirer or an agent to an issuer to request approval of a card transaction". Authorization maps to it.
  - `cain.003.001.05` FinancialInitiationV05: "allows the approved transaction amount to be billed or posted on the cardholder's account … and requests the clearing of the transaction". Capture maps to it.
  - `cain.027.001.04` ChargeBackInitiationV04: "sent by an issuer or agent to an acquirer to fully or partially nullify a previous financial transaction; namely when the issuer determines that a customer dispute exists or that an error or violation of rules has been committed". Chargeback maps to it.
  - `cafr.001.001.04` FraudReportingInitiationV04: "sent by a financial institution acting as an acquirer or as an issuer to an agent … to inform about a confirmed fraudulent transaction". FraudReport maps to it.
  - `cain.028.001.04` ChargeBackResponseV04 is "sent by an acquirer or an agent to an issuer in response to an ChargeBackInitiation message". Whether it carries the merchant's representment evidence couldn't be confirmed, so Representment isn't mapped yet.
  - iso20022.org refuses automated downloads of the schemas (HTTP 403). The scope texts above were read from the message pages on mx-message.com, such as https://www.mx-message.com/m/cain-027-001-04.
  - ISO 20022 messages use the XML namespace `urn:iso:std:iso:20022:tech:xsd:<message id>`. The schema uses it as the mapping IRI, since ISO 20022 publishes no IRIs for business concepts. https://developer.huntington.com/enterprisepayments/docs/xml.md
- **ISO code lists:** a new `currency` slot holds the ISO 4217 alphabetic code next to each amount. The `mcc` slot notes ISO 18245 (sources under ISO code lists above).

### Prototype step 1: standards the question gaps point to (checked 2026-09-30)

Some gaps in `ontology/competency-questions.yaml` name the standard concept that could close them. Each was checked.

- **ISO 20022 card messages**, read from the message definitions page: `cain.005.001.05` ReversalInitiationV05 (authorization reversals), `cain.021.001.04` RetrievalInitiationV04 (retrieval requests), `caad.005.001.05` ReconciliationInitiationV05 (reconciliation) and `cafc.001.001.04` FeeCollectionInitiationV04 (network fees). https://www.iso20022.org/iso-20022-message-definitions
- **FIBO 2026 Q2 card products:** the card module defines `CreditCard` ("card issued by a financial service provider that enables the cardholder to borrow funds") and `DebitCard` ("payment card … that enables the cardholder to access funds in a demand deposit account"), plus `CardProduct`, but no prepaid card. From version 1.9.0 the `credit` and `debit` funding sources close-map to them. https://spec.edmcouncil.org/fibo/ontology/master/2026Q2/LOAN/LoansSpecific/CardAccounts.rdf
- **The dispute lifecycle (version 1.8.0):**
  - `cain.021.001.04` RetrievalInitiationV04 "is sent by an issuer or agent to an acquirer to retrieve the original transaction details". RetrievalRequest maps to it. https://www.mx-message.com/m/cain-021-001-04
  - After a representment, both Visa and Mastercard have a pre-arbitration step, then arbitration, where the network's ruling is binding. In arbitration the acquirer stands for the merchant and the issuer for the cardholder, so an outcome records which of the two won. A side that misses its response window loses the case by default. https://www.chargeflow.io/blog/pre-arbitration-chargeback-merchants-guide-prevent-revenue-loss and https://stripe.com/resources/more/chargeback-arbitration-how-the-process-works-across-card-networks
  - Response windows differ by network and stage (Chargeflow reports roughly 10 days for a Visa pre-arbitration response, with no fixed window at Mastercard as of late 2024), so the schema stores each step's `respond_by` date rather than a rule.
  - No ISO 20022 card message stands for a dispute's outcome or for arbitration, going by the message list above.
- **Authorization detail (version 1.9.0):**
  - `cain.005.001.05` ReversalInitiationV05 "is sent by an acquirer, an originator or an agent to an issuer to request or advise of the reversal of an authorisation by the issuer". Reversal maps to it. https://www.mx-message.com/m/cain-005-001-05
  - EMV 3-D Secure's transaction status ends as Y (verified), A (attempts processing), N (not verified), R (rejected: don't attempt authorization) or U (couldn't be performed). C and D mean a challenge is still needed, and I is informational. The AuthenticationResult values follow the five final ones. https://www.checkout.com/docs/payments/authenticate-payments/3d-secure/standalone-sessions/non-hosted-sessions and https://www.emvco.com/emv-technologies/3-d-secure/
  - A Token Requestor ID is an 11-digit number, and includes the code of the token service provider that assigned it. https://solidgate.com/glossary/token-requestor-id/ and https://www.emvco.com/processes/token-service-provider-registration-programme-2/
  - BIN tables carry a range's funding source and country. Visa's BIN attributes include the account funding source (credit, debit or prepaid) and issuer country. Mastercard's BIN Lookup gives `fundingSource` (CREDIT, DEBIT, PREPAID or NONE) and the licensed country, as a numeric or alpha-3 code; the schema stores ISO 3166-1 alpha-2, so a loader converts. https://www.visa.com/en-us/products/visa-bin-attribute-service and https://developer.mastercard.com/bin-lookup/documentation/data-elements/
- **The rest of authorization (version 1.10.0):**
  - Visa has estimated and incremental authorizations; an incremental authorization increases an earlier estimated one. Mastercard requires every authorization to be marked as a preauthorization, an undefined authorization or a final authorization. https://usa.visa.com/content/dam/VCOM/regional/na/us/support-legal/documents/authorization-and-reversal-processing-best-practices-for-merchants.pdf and https://www.compliance101.com/pci-compliance-resources/mastercard-authorization-update/
  - The stored-credential framework splits cardholder-initiated from merchant-initiated transactions. Merchant-initiated ones follow a standing instruction (recurring, installment or unscheduled credential-on-file) or an industry practice (such as incremental, resubmission, delayed charges, reauthorization or no-show). https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/stored-credential-transaction-framework-vbs-10-may-17.pdf and https://merchantriskcouncil.org/learning/resource-center/member-news/blog/2025/card-on-file-done-right-how-to-stay-compliant-with-the-stored-credential-mandate
  - Visa's action code 10 means partial approval, and Visa's stand-in processing (STIP) answers when the issuer is unavailable. https://developer.visa.com/request_response_codes
- **Money flows (version 1.11.0):**
  - `caad.003.001.04` BatchTransferInitiationV04 "is used to transfer a series of transactions or administrative information in a single exchange". ClearingBatch maps to it. https://www.mx-message.com/m/caad-003-001-04
  - `caad.005.001.05` ReconciliationInitiationV05: "Reconciliation is the exchange between two interchanging parties (Acquirer, Issuer or Agent) of totals and/or counts of messages within a specific session." Reconciliation maps to it. https://www.mx-message.com/m/caad-005-001-05
  - `cafc.001.001.04` FeeCollectionInitiationV04 is sent "to claim or pay a miscellaneous service between financial institutions". FeeCollection maps to it. https://www.mx-message.com/m/cafc-001-001-04
  - `cain.020.001.04` AmendmentV04 "is used to inform the originator that the original message has been corrected/amended", so it isn't a close match for a financial adjustment, and Adjustment says so. https://www.mx-message.com/m/cain-020-001-04
- **The rest of disputes (version 1.12.0):**
  - Visa groups its reason codes by their first two digits: 10 fraud, 11 authorization, 12 processing errors, 13 consumer disputes. Mastercard groups its codes the same four ways, calling processing errors point-of-interaction errors (4834) and consumer disputes cardholder disputes (4853). https://www.chargebackgurus.com/chargeback-reason-codes and https://docs.adyen.com/risk-management/understanding-disputes/dispute-reason-codes
  - Mastercard runs the Excessive Chargeback Program, with two tiers: Excessive Chargeback Merchant (100 to 299 chargebacks and 150 to 299 basis points in a month) and High Excessive Chargeback Merchant (300 or more of each). Its Excessive Fraud Merchant program has a single tier. https://www.jpmorgan.com/content/dam/jpm/merchant-services/documents/payment-network-updates/MC_ExcessiveChargebacks_FAQ_02092022.pdf and https://www.chargeflow.io/blog/avoid-mastercard-chargeback-monitoring-programs
  - One source says Mastercard's Scam Merchant Monitoring Program reached full enforcement in July 2026; it isn't modelled yet. https://paykings.com/blog/mastercard-chargeback-monitoring-programs/
- **Fraud type:** issuers report one with each fraud report. Visa's is the TC40. Mastercard's SAFE is now formally the Fraud and Loss Database, whose confirmed-fraud types added type 57, first-party misuse, from 27 October 2024. https://developer.mastercard.com/fld-fraud-submission/documentation/parameters/annexure-1/ and https://chargebacks911.com/mastercard-safe/
- **The studio's fraud-type mission (checked 2 October 2026):** its seven codes are illustrative, picked from what the networks' fraud reports use. Mastercard's Fraud and Loss Database lists 00 lost, 02 never received, 04 counterfeit, 05 account takeover and 06 card not present (Annexure 1, above). Solidgate's fraud-code table gives Visa's TC40 types 0 lost, 1 stolen, 2 not received as issued and B account takeover, and Mastercard's 01 stolen. chargebacks911 names fraudulent applications among the types SAFE reports. https://docs.solidgate.com/risks/fraud-codes/ and https://chargebacks911.com/mastercard-safe/

## Claude Code

- **What the design studio relies on (checked 2 October 2026):**
  - claude.ai artifact runtime contract 0.2.45. A published page reaches each capability through `claude.use(name)`, which resolves null where the page can't use it. `db` is a shared document store whose declaring page is organization-internal; `user` gives an opaque per-organization id and, with the `profile` scope, names; `sample` asks Claude on the viewer's own account, with consent on the first call; `mcp` calls the viewer's connectors with their credentials, by connector name and tool. Source: the runtime's type definitions, served with Claude Code's artifact skill.
  - Runtime contract 0.2.66 lets a page pass its own functions to `sample` as `tools`. Claude calls them while it works, each round is a separate paid request on the viewer's account, a three-round call on the default tier commonly takes 30 to 90 seconds, the platform allows a handful of rounds, and calls with tools are never cached. Only views whose `limits()` report `tools` can run them; elsewhere the call rejects `tools_unavailable`. Source: the runtime's type definitions, as above.
  - The `room` capability shares each viewer's presence, one object of at most 4 KiB, with everyone viewing the page. The platform coalesces updates to about 30 a second, re-asserts them on reconnect and clears them when the viewer leaves. No names travel in it: the `user` capability's `profiles()` resolves each sender's id. Source: the runtime's type definitions, as above.
  - The studio's memory relies on the `db` capability's private subtree: documents under `data/users/<id>/`, where `<id>` is the `user` capability's `id()`, can be read and written only by that viewer, not even by the page's owner, unless a declared rule opens them. A store holds at most 25,000 documents of up to 256 KiB each, and the definitions advise against one document per event, so the team's decisions go one document per month. Source: runtime contract 0.2.66's type definitions, served with Claude Code's artifact skill.
  - Lineage mapping sets use SSSOM, the Simple Standard for Sharing Ontological Mappings: a TSV of mappings with subject, predicate, object, a required mapping justification from the semapv vocabulary (such as `semapv:ManualMappingCuration`), and optional confidence, author and reviewer. Its metadata block is YAML in `#` lines, `extension_definitions` declares extra columns, `sssom:NoTermFound` marks a subject with no match, and `predicate_modifier: Not` negates a mapping. https://mapping-commons.github.io/sssom/ (checked 3 October 2026)
  - SSSOM's mapping set slots for versions: `mapping_set_version` ("A version string for the mapping"), `publication_date` ("The date the mapping was published"), and `mapping_set_source` ("A mapping set or set of mapping set that was used to derive the mapping set", multivalued). Each mapping can say where its subject came from with `subject_source` ("URI of vocabulary or identifier source for the subject") and `subject_source_version` ("Version IRI or version string of the source of the subject term"). https://mapping-commons.github.io/sssom/dev/MappingSet/ (checked 3 October 2026)
  - sqlglot's `sqlglot.lineage` module builds column lineage for a SQL query: for an output column, the source columns it comes from. DataHub's SQL parser, which it uses for column-level lineage, is built on sqlglot. https://sqlglot.com/sqlglot/lineage.html and https://docs.datahub.com/docs/lineage/sql_parsing (checked 3 October 2026)
  - sqlglot 30.21.0 (the release pinned in `tools/requirements.txt`): `sqlglot.lineage.lineage(column, sql, dialect="snowflake")` walks an output column back to the table columns it's built from, including through `UNION ALL` branches and `COALESCE`. Its leaf nodes carry the source `Table` (schema and name) and the column, upper-cased as Snowflake folds unquoted names. A parsed statement's `named_selects` lists its output columns. Checked by running it on the made-up resolver's SQL. https://sqlglot.com/sqlglot/lineage.html (checked 3 October 2026)
  - Atlassian's Rovo MCP server, behind claude.ai's Atlassian connector, added Bitbucket Cloud on 8 April 2026. Its Bitbucket tools read workspaces, repositories, branches (`getBitbucketRepoBranch`), a commit (`getBitbucketRepoCommit`), file content (`getBitbucketRepoFileContent`), pull requests and their diffs (`listBitbucketRepoPullRequests`, `getBitbucketRepoPullRequestDiff`), and pipelines, and can create branches, commits and pull requests. None lists commit history or compares two commits. Bitbucket Data Center isn't covered, and the workspace must be linked to an Atlassian organization. https://www.atlassian.com/blog/bitbucket/the-atlassian-rovo-mcp-server-now-supports-bitbucket-cloud and https://support.atlassian.com/atlassian-rovo-mcp-server/docs/supported-tools/ (checked 3 October 2026)
  - Data catalogs that pull Snowflake's column-level lineage: DataHub's Snowflake source (column-level lineage on by default) and OpenMetadata's Snowflake connector, which reads `ACCOUNT_USAGE.ACCESS_HISTORY` by default and falls back to parsing query history. https://docs.datahub.com/docs/generated/ingestion/sources/snowflake and https://docs.open-metadata.org/v2.0.x/connectors/database/snowflake (checked 3 October 2026)
  - A published claude.ai page calls connectors as whoever opens it, and declares each by its display name with the exact names of the tools it calls; a local MCP server in the Claude desktop app is declared as `host:<name>` and answers only when the page is opened there. From the artifact runtime's capability guide, contract 0.2.66 (checked 3 October 2026).
  - Snowflake's `ACCOUNT_USAGE.ACCESS_HISTORY` view records column lineage: for each column a query writes, `objects_modified` lists the `directSources` and `baseSources` columns it came from. https://docs.snowflake.com/en/user-guide/access-history (checked 3 October 2026)
  - The studio's proofs run Snowflake SQL on sql.js 1.14.2 (released 14 August 2026, MIT licence), which bundles SQLite 3.49.1: checked by running `select sqlite_version()`. SQLite has no DATE_TRUNC, DATEADD, DATEDIFF, MEDIAN, COUNT_IF or RATIO_TO_REPORT, so the studio adds or rewrites them, and it lacks Snowflake's lateral column aliases, where a select list uses an alias it defined earlier. https://www.npmjs.com/package/sql.js and https://docs.snowflake.com/en/sql-reference/sql/select
  - The claude.ai connector directory has an Atlassian connector (Jira, Confluence and other Atlassian apps, with the user's own Atlassian permissions) and a Microsoft 365 connector (SharePoint, OneDrive, Outlook and Teams, with tools such as `sharepoint_search` and `read_resource`). GitHub isn't in it; a Claude Code session reaches repositories directly. Checked in the directory on 2 October 2026.
  - The Claude Code Remote connector's `list_environments` answers `{environments: [{environment_id, name, state, kind, ...}], has_more}`, and `get_session` answers `{ccr: {id, title, status_bucket, ...}}` with buckets such as `SESSION_STATUS_BUCKET_WORKING`. Both shapes come from real calls. `create_session` takes `prompt`, `environment_id`, `source_url`, `outcome_branch`, `title` and `tags`; its answer's shape isn't documented and wasn't called, since it starts a real session.

- **Project memory**: `./CLAUDE.md` loads at every session start, and `@path` imports pull in other files. Keep it concise. https://docs.claude.com/en/docs/claude-code/memory
