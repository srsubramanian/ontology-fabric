// The system map: its nodes and edges, the flows it plays, and what each node holds.
// Moved as it was from the page's original map script.

export type MapNode = { id: string; x: number; y: number; h: number; t: string; s: string; s2?: string; o?: 'onto' | 'graph' | 'search' | 'query'; star?: boolean };
export type MapEdge = { id: string; f: string; t: string; p: [number, number][]; dashed?: boolean };
export type FlowStep = { title: string; nodes: string[]; hops: string[][]; text: string };
export type Flow = { name: string; color: string; steps: FlowStep[] };
export type Detail = { title: string; what: string; holds?: string[]; holdsLabel?: string; keep?: string[]; watch: string };

/** Each node's width. */
export const W = 170;

export const OWN: Record<string, string> = { onto:'var(--onto)', graph:'var(--graph)', search:'var(--search)', query:'var(--query)' };

export const NODES: MapNode[] = [
  {id:'ontsrc', x:20,  y:50,  h:54, t:'Ontology source', s:'LinkML in Git', o:'onto'},
  {id:'repos',  x:20,  y:180, h:54, t:'Code repositories', s:'JPA, OpenAPI, Avro'},
  {id:'events', x:20,  y:280, h:54, t:'Payment events', s:'ISO 8583 and 20022'},
  {id:'docs',   x:20,  y:380, h:54, t:'Documents', s:'Rules and runbooks'},
  {id:'gen',    x:240, y:50,  h:54, t:'Schema generator', s:'SHACL and codegen', o:'onto'},
  {id:'extract',x:240, y:260, h:74, t:'Extraction pipeline', s:'Fills the graph', s2:'Proposes ontology PRs'},
  {id:'stage',  x:240, y:400, h:54, t:'Staging bucket', s:'Loader CSVs in S3'},
  {id:'pub',    x:460, y:50,  h:54, t:'Published ontology', s:'S3 and CloudFront', o:'onto'},
  {id:'neptune',x:460, y:160, h:80, t:'Neptune Database', s:'openCypher graph', s2:'System of record', o:'graph', star:true},
  {id:'poller', x:460, y:290, h:54, t:'Stream poller', s:'Lambda on Streams', o:'search'},
  {id:'opensearch',x:460,y:400,h:80, t:'OpenSearch', s:'Three indexes', s2:'Derived, rebuildable', o:'search', star:true},
  {id:'bedrock',x:680, y:50,  h:54, t:'Amazon Bedrock', s:'Claude and embeddings'},
  {id:'api',    x:680, y:260, h:74, t:'Retrieval service', s:'LangGraph on Fargate', s2:'Joins stores by ID', o:'query'},
  {id:'partners',x:900,y:50,  h:54, t:'Other teams', s:'Pin a version'},
  {id:'agents', x:900, y:230, h:54, t:'Agents', s:'Via AgentCore Gateway'},
  {id:'analysts',x:900,y:320, h:54, t:'Analyst UI', s:'Search and explore'}
];

export const EDGES: MapEdge[] = [
  {id:'d1', f:'ontsrc', t:'gen',  p:[[190,77],[240,77]]},
  {id:'d2', f:'gen', t:'pub',     p:[[410,77],[460,77]]},
  {id:'d3', f:'pub', t:'partners',p:[[545,50],[545,36],[985,36],[985,50]]},
  {id:'d4', f:'gen', t:'neptune', p:[[410,90],[436,90],[436,180],[460,180]]},
  {id:'d5', f:'gen', t:'extract', p:[[325,104],[325,260]]},
  {id:'d6', f:'gen', t:'opensearch', p:[[410,100],[450,100],[450,466],[460,466]]},
  {id:'i1', f:'repos', t:'extract', p:[[190,207],[215,207],[215,278],[240,278]]},
  {id:'i2', f:'events', t:'extract', p:[[190,307],[240,307]]},
  {id:'i3', f:'docs', t:'extract', p:[[190,407],[215,407],[215,322],[240,322]]},
  {id:'i4', f:'extract', t:'bedrock', p:[[410,270],[420,270],[420,140],[700,140],[700,104]]},
  {id:'i5', f:'extract', t:'stage', p:[[325,334],[325,400]]},
  {id:'i6', f:'stage', t:'neptune', p:[[410,427],[444,427],[444,222],[460,222]]},
  {id:'i7', f:'extract', t:'opensearch', p:[[410,318],[436,318],[436,418],[460,418]]},
  {id:'i8', f:'extract', t:'neptune', p:[[410,288],[428,288],[428,202],[460,202]]},
  {id:'i9', f:'extract', t:'ontsrc', p:[[265,260],[265,140],[105,140],[105,104]], dashed:true},
  {id:'y1', f:'neptune', t:'poller', p:[[545,240],[545,290]]},
  {id:'y2', f:'poller', t:'bedrock', p:[[630,305],[662,305],[662,86],[680,86]]},
  {id:'y3', f:'poller', t:'opensearch', p:[[545,344],[545,400]]},
  {id:'q1', f:'agents', t:'api', p:[[900,257],[876,257],[876,280],[850,280]]},
  {id:'q2', f:'analysts', t:'api', p:[[900,347],[876,347],[876,314],[850,314]]},
  {id:'q3', f:'api', t:'opensearch', p:[[680,318],[670,318],[670,450],[630,450]]},
  {id:'q4', f:'api', t:'neptune', p:[[680,276],[652,276],[652,200],[630,200]]},
  {id:'q5', f:'api', t:'bedrock', p:[[765,260],[765,104]]}
];

/** The chapter that explains each node, and each flow. */
export const NODE_CH: Record<string, number> = { ontsrc:1, gen:1, pub:1, repos:2, events:2, docs:2, extract:2, stage:2, neptune:3, poller:3, opensearch:3, api:4, bedrock:4, agents:5, analysts:5, partners:5 };
export const FLOW_CH: Record<string, number> = { design:1, ingest:2, sync:3, query:4 };

export const FLOWS: Record<string, Flow> = {
  design: { name:'Design time', color:'var(--onto)', steps:[
    { title:'Change the ontology', nodes:['ontsrc','gen'], hops:[['d1']],
      text:'A domain owner merges a pull request to the LinkML source. CI regenerates the OWL, the SHACL shapes and every other artifact, and checks sample data against the shapes; a failing check stops the release before anything reaches a store.' },
    { title:'Generate every schema from one source', nodes:['gen','neptune','extract','opensearch'], hops:[['d4','d5','d6']],
      text:'The generator emits Neptune label chains and bulk-loader CSV headers, the schema the LLM must extract against, and the OpenSearch index mappings plus the ontology index. Both stores get their schema from the same build, so they cannot drift apart.' },
    { title:'Publish the release', nodes:['gen','pub','partners'], hops:[['d2'],['d3']],
      text:'The release goes out at versioned IRIs as Turtle, JSON-LD and readable docs. Other teams pin a version and use the same definitions your graph uses, which is what makes the ontology a product rather than an internal schema.' }
  ]},
  ingest: { name:'Ingest', color:'var(--graph)', steps:[
    { title:'Collect sources', nodes:['repos','events','docs','extract'], hops:[['i1','i2','i3']],
      text:'Code is parsed with tree-sitter: entities, enums, state machines, OpenAPI and Avro. Payment events are mapped deterministically, with no LLM involved. Documents are split into chunks.' },
    { title:'Extract with Claude', nodes:['extract','bedrock'], hops:[['i4'],['-i4']],
      text:'For code and documents, Claude on Bedrock extracts entities and relationships constrained to the generated schema, and the embedding model embeds each chunk. Low-confidence results wait for human review, in a durable function that survives restarts.' },
    { title:'Write the graph', nodes:['extract','stage','neptune'], hops:[['i8','i5'],['i6']],
      text:'Everyday writes use openCypher MERGE on deterministic IDs, so a rerun never duplicates anything. First loads and backfills go through S3 and the Neptune bulk loader.' },
    { title:'Store chunk text in OpenSearch', nodes:['extract','opensearch','neptune'], hops:[['i7']],
      text:'Chunk text and vectors go to the chunks index. Neptune gets only a small :Chunk node with MENTIONS edges to the entities it names, so any answer traces back to its source without storing text twice.' },
    { title:'Propose ontology changes', nodes:['extract','ontsrc'], hops:[['i9']],
      text:'When code shows something the ontology lacks, such as a new dispute state or enum value, the pipeline opens a pull request against the LinkML source. A person accepts it; the ontology never changes on its own.' }
  ]},
  sync: { name:'Sync', color:'var(--search)', steps:[
    { title:'Capture the change', nodes:['neptune','poller'], hops:[['y1']],
      text:'Every committed write to Neptune appears on Neptune Streams in commit order. The poller resumes from the last stream position it checkpointed.' },
    { title:'Build the search document', nodes:['poller','bedrock'], hops:[['y2'],['-y2']],
      text:'For each changed entity, the poller reads its label chain, names, aliases and codes, writes a short summary, and embeds it with the same model used for chunks.' },
    { title:'Upsert into OpenSearch', nodes:['poller','opensearch'], hops:[['y3']],
      text:'The document is upserted into the entities index with neptune_id as its _id. The index is derived data: if it is lost or corrupted, rebuild it from Neptune.' }
  ]},
  query: { name:'Query', color:'var(--query)', steps:[
    { title:'Ask', nodes:['agents','api'], hops:[['q1']],
      text:'An agent calls a retrieval tool over MCP. For example: which merchants had the most 10.4 chargebacks last month, and what do the network rules say about 10.4?' },
    { title:'Find entry points in OpenSearch', nodes:['api','opensearch'], hops:[['q3'],['-q3']],
      text:'Hybrid search, keyword plus vector, over the entities and chunks indexes. It returns Neptune IDs and chunk IDs rather than answers. Misspelled merchant names and bare codes resolve here.' },
    { title:'Write and check the Cypher', nodes:['api','opensearch','bedrock'], hops:[['q3'],['-q3'],['q5'],['-q5']],
      text:'For counts and rankings, the service fetches the relevant classes from the ontology index, has Claude write a parameterized query, and validates it against the ontology before it runs.' },
    { title:'Traverse in Neptune', nodes:['api','neptune'], hops:[['q4'],['-q4']],
      text:'The query runs on a Neptune reader, starting from the IDs found in OpenSearch. openCypher cannot call OpenSearch from inside a query, so the service does the join, by ID.' },
    { title:'Answer with citations', nodes:['api','bedrock','agents'], hops:[['q5'],['-q5'],['-q1']],
      text:'Claude writes the answer from the subgraph and the retrieved chunks only, citing node IDs and chunk IDs. Every sentence traces to a Cypher run or a source document.' }
  ]}
};

export const DETAIL: Record<string, Detail> = {
  ontsrc:{ title:'Ontology source', what:'The product itself: payment classes, relationship types, properties and rules in LinkML, from which the OWL and the SHACL shapes that define valid data are generated. People write and approve it; the extraction pipeline only proposes changes as pull requests.',
    holds:['Class hierarchy, such as Chargeback under DisputeEvent under PaymentEvent','Allowed relationships and their direction','Property types and code lists','Mappings back to ISO 8583 data elements'],
    watch:'Treat renamed or removed classes as major versions. Every consumer, including your own indexes, pins a version.' },
  gen:{ title:'Schema generator', holdsLabel:'Outputs', what:'A CI job, rdflib plus templates, that turns the ontology into every schema the runtime needs, so nobody writes a schema by hand twice.',
    holds:['Neptune label chains and bulk-loader CSV headers with types','Pydantic models for pipeline validation','Allowed nodes and relationships for LLM extraction','OpenSearch mappings and ontology index documents','The ontology meta-graph load for Neptune'],
    watch:'Fail the build if any generated file differs from what is committed. Hand edits are how the two stores drift apart.' },
  pub:{ title:'Published ontology', what:'Each release at stable, versioned IRIs, served from S3 behind CloudFront as Turtle, JSON-LD and readable HTML.',
    holds:['Release notes and changelog','A page per class with definition and examples','Downloadable SHACL shapes'],
    watch:'Never overwrite a published version. Fix forward with a patch release.' },
  repos:{ title:'Code repositories', what:'Bitbucket repositories parsed with tree-sitter to see how payments are modeled in running code.',
    holds:['JPA entities and enums','State machines for dispute and settlement flows','OpenAPI specs and Avro schemas'],
    watch:'Code tells you what exists, not what it means. Its findings reach the ontology only as reviewed pull requests.' },
  events:{ title:'Payment events', what:'Authorization, capture, settlement, refund and chargeback events from the processing platform, mapped without an LLM.',
    holds:['Named properties such as pos_entry_mode and response_code, not raw DE keys','A mapping table back to ISO 8583 data elements and subfields'],
    watch:'Tokens only. No PANs in either store, including inside chunk text.' },
  docs:{ title:'Documents', what:'Network rules, reason code guides, dispute runbooks and internal specs.',
    holds:['Chunks that keep their section headings','Links from each chunk to the entities it mentions'],
    watch:'Set an access classification on every chunk at ingest. Adding it later means re-reading every document.' },
  extract:{ title:'Extraction pipeline', holdsLabel:'Two jobs', what:'Lambda durable functions: fan-out per source batch, steps that are checkpointed and retried, and a callback wait for human review of low-confidence results. Claude\'s mapping can run in LangGraph inside a step. Open-ended work on one repository, with the Claude Agent SDK, runs as a Fargate task the function waits on.',
    holds:['Main job: fill Neptune and OpenSearch with data validated against the generated schema','Side job: open a pull request when code shows something the ontology lacks','Never writes the ontology itself'],
    watch:'Make every write idempotent with deterministic IDs, so a retry or a rerun changes nothing.' },
  stage:{ title:'Staging bucket', what:'S3 staging for the Neptune bulk loader, in the openCypher CSV format with :ID, :LABEL, :START_ID, :END_ID, :TYPE and typed property columns.',
    holds:['First loads and backfills','A record of exactly what each release loaded'],
    watch:'Type codes such as MCC and response code as String, or leading zeros disappear.' },
  neptune:{ title:'Neptune Database', what:'The system of record for payment facts: every entity, event and relationship, queried with openCypher.',
    holds:['Entities and lifecycle events with deterministic IDs','Relationships with direction, per the ontology','The ontology as a small meta-graph','Chunk stubs with MENTIONS edges for provenance','ontology_version and source on every node'],
    keep:['Long text','Embeddings','PANs'],
    watch:'Neptune enforces no schema, so the pipeline is the only enforcement. Turn on IAM authentication and Streams from the first day.' },
  poller:{ title:'Stream poller', holdsLabel:'Inside', what:'A Lambda function that reads Neptune Streams and keeps the entities index current. Start from the AWS Neptune-to-OpenSearch replication stack and change its poller to write your document shape.',
    holds:['A checkpoint of the last stream position','The entity summary builder','The embedding call'],
    watch:'Alarm on replication lag. If the poller falls behind the stream retention window, rebuild the index from Neptune rather than catching up.' },
  opensearch:{ title:'OpenSearch', what:'The way into the graph. Three indexes, each derived from Neptune or from source documents, never the other way round.',
    holds:['entities: names, aliases, codes, labels, summary, vector','chunks: document text, vector, mentioned Neptune IDs','ontology: definitions used to write Cypher'],
    keep:['Relationships as the source of truth','Anything you could not rebuild'],
    watch:'Put codes such as MCCs, reason codes and BINs in keyword fields. Analyzed text fields split them apart.' },
  bedrock:{ title:'Amazon Bedrock', what:'Claude for extraction, Cypher generation and answers, plus one embedding model for entities, chunks and ontology definitions.',
    holds:['Extraction prompts built from the generated schema','The pinned embedding model ID'],
    watch:'Changing the embedding model means rebuilding all three indexes. Plan it like an ontology major version.' },
  api:{ title:'Retrieval service', holdsLabel:'Inside', what:'A LangGraph service that decides how to answer each question: lookups start in OpenSearch, relationship questions expand in Neptune, and counts or rankings go through validated text-to-Cypher.',
    holds:['The router','A Cypher validator built from the ontology','One access policy applied to results from both stores'],
    watch:'openCypher on Neptune cannot call OpenSearch from inside a query, so this service does the join, by ID.' },
  agents:{ title:'Agents', holdsLabel:'Tools', what:'Agents reach retrieval through MCP tools behind AgentCore Gateway, never through direct database access. Other teams\u2019 agents can hand them work over A2A.',
    holds:['search_entities','expand_subgraph','run_validated_cypher','get_ontology_class'],
    watch:'Do not expose a raw Cypher tool. Agents get validated, read-only, bounded queries.' },
  analysts:{ title:'Analyst UI', what:'A search box backed by OpenSearch and a graph explorer backed by Neptune. Every node links to its ontology definition.',
    holds:['Saved queries for common lineage questions'],
    watch:'Route it through the retrieval service so the same access policy applies as for agents.' },
  partners:{ title:'Other teams and partners', what:'Business units and partners consume ontology releases as the shared definition of payment concepts.',
    holds:['A pinned ontology version','Their own mappings to your classes'],
    watch:'Announce deprecations one release ahead, as you would for an API.' }
};
