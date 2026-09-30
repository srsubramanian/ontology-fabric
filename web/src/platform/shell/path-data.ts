// The reading path: the seven chapters, the part of the map each lights up, and the
// questions each chapter's check asks. Moved as it was from the page's original script.

export type Chapter = { n: number; title: string; short: string; c: string; nodes: string[] | null };
export type Question = { q: string; o: string[]; a: number; why: string };

export const CH: Chapter[] = [
  { n:1, title:'Design the ontology', short:'Ontology', c:'var(--onto)', nodes:['ontsrc','gen','pub'] },
  { n:2, title:'Fill the graph', short:'Ingest', c:'var(--graph)', nodes:['repos','events','docs','extract','stage','bedrock'] },
  { n:3, title:'Two stores, one join', short:'Stores', c:'var(--search)', nodes:['neptune','poller','opensearch'] },
  { n:4, title:'Answer a question', short:'Retrieval', c:'var(--query)', nodes:['api','opensearch','neptune','bedrock'] },
  { n:5, title:'Who uses it', short:'Users', c:'var(--query)', nodes:['agents','analysts','partners','api','pub'] },
  { n:6, title:'Keep it current', short:'Evolve', c:'var(--onto)', nodes:['extract','ontsrc','gen','pub'] },
  { n:7, title:'Build it', short:'Build', c:'var(--ink)', nodes:null }
];

export const QS: Record<number, Question[]> = {
  1:[ { q:'Who writes the ontology?', o:['The extraction pipeline','People, through reviewed pull requests','Neptune, from the data it holds'], a:1, why:'Machines propose; people decide what things mean.' },
      { q:'What should version 1 start from?', o:['Importing all of FIBO','One system\u2019s database schema','Standards, measured against the teams\u2019 questions'], a:2, why:'Map to ISO 20022 and FIBO, then count how many questions the draft answers.' },
      { q:'A chargeback arrives with no capture link. What stops it?', o:['OWL, because it defines Chargeback','SHACL, because the shape requires one Capture','Git, because the change wasn\u2019t reviewed'], a:1, why:'OWL would call the capture unknown; SHACL calls it missing and rejects the record.' } ],
  2:[ { q:'What is the extraction pipeline\u2019s main job?', o:['Fill Neptune and OpenSearch with validated data','Write the ontology','Answer agents\u2019 questions'], a:0, why:'It follows the ontology; it never writes it.' },
      { q:'Code shows a dispute state the ontology lacks. What happens?', o:['It goes straight into the graph','The pipeline opens a pull request for review','It is dropped silently'], a:1, why:'Gaps become proposals that a person accepts or rejects.' } ],
  3:[ { q:'Which store is the system of record?', o:['OpenSearch','Neptune','Both equally'], a:1, why:'OpenSearch is derived and can be rebuilt from Neptune.' },
      { q:'What links an OpenSearch document to the graph?', o:['A shared embedding','The document title','neptune_id'], a:2, why:'It is the only join between the two stores.' } ],
  4:[ { q:'What does OpenSearch return during a question?', o:['IDs to start from in Neptune','The final answer','The Cypher query'], a:0, why:'Search finds entry points; the graph does the reasoning.' },
      { q:'Why does the retrieval service join the stores itself?', o:['Neptune is too slow for search','openCypher can\u2019t call OpenSearch from inside a query','OpenSearch has no IDs'], a:1, why:'So the service searches first, then passes IDs into Cypher.' } ],
  5:[ { q:'How do agents reach the knowledge layer?', o:['Direct Cypher on Neptune','Through MCP tools behind AgentCore Gateway','By reading OpenSearch indexes'], a:1, why:'The gateway checks identity and policy, and every query is validated and read-only.' },
      { q:'Which tool would engineers use first to explore the graph?', o:['Graph Explorer','Linkurious Enterprise','A spreadsheet export'], a:0, why:'It is free, supports openCypher, and runs inside your VPC.' } ],
  6:[ { q:'A new alias for an existing class. Which lane?', o:['Change board','Owner approves','Auto-merge'], a:2, why:'Additive, low-risk changes are patch releases.' },
      { q:'When does a change type move to auto-merge?', o:['From day one','When reviewers accept nearly all of its proposals','Never'], a:1, why:'Autonomy is earned per change type, and breaking changes never qualify.' } ],
  7:[ { q:'What comes first in the build order?', o:['Agents and MCP tools','Search indexes','The ontology core and its generator'], a:2, why:'Everything else is generated from it.' },
      { q:'Where is access control enforced?', o:['Inside Neptune','In layers: gateway policy, our validator and a read-only IAM role','In each agent'], a:1, why:'Neptune has no row-level security, so the checks sit in front of it, with read-only IAM as the last lock.' } ]
};

QS[2].push({ q:'What does tree-sitter give the pipeline?', o:['An ontology class','A syntax tree of classes, fields and annotations','A Cypher query'], a:1, why:'Structure first, exactly; Claude maps it to the ontology afterwards.' });
QS[3].push({ q:'Why does \u201ccustomer says the order wasn\u2019t theirs\u201d find the 10.4 fraud chunk?', o:['They share keywords','Their embeddings sit close together','Neptune links them'], a:1, why:'Vector search matches meaning, not words.' });
QS[4].push({ q:'What does min-max normalization do in hybrid search?', o:['Rescales each result list to 0 to 1 so they can be combined','Removes duplicate results','Picks keyword or vector, whichever scored higher'], a:0, why:'Different scales become comparable, then a weighted average blends them.' });
QS[5].push({ q:'An agent sends a Cypher query that deletes nodes. What happens?', o:['Neptune deletes them','Policy at the gateway refuses it, and the IAM role could not write anyway','The agent is asked to confirm'], a:1, why:'Layers: gateway policy first, a read-only IAM role as the last lock.' });
QS[5].push({ q:'What does A2A connect?', o:['An agent to a database','An agent to another agent','Neptune to OpenSearch'], a:1, why:'MCP connects agents to tools; A2A lets one agent hand work to another.' });
QS[2].push({ q:'Every authorization, billions a year. Where does it live?', o:['All of it in Neptune','In the lake, linked by ID; a disputed one joins the graph','Only in OpenSearch'], a:1, why:'Materialize what questions walk through; leave the rest where it sits.' });
QS[4].push({ q:'What do we try before building our own retrieval service?', o:['Bedrock managed GraphRAG','AWS Labs\u2019 BYOKG-RAG on our own graph','A raw Cypher tool for agents'], a:1, why:'It already combines four retrieval strategies over a graph you bring.' });
QS[6].push({ q:'How do queries switch to a rebuilt OpenSearch index?', o:['Every client changes its index name','One atomic call moves the alias','The old index is deleted first'], a:1, why:'Queries use the alias, so they never notice the switch.' });
QS[1].push({ q:'In LinkML, what makes a Chargeback need exactly one capture?', o:['A SHACL file written by hand','slot_usage with required: true on a single-valued slot','An OWL restriction'], a:1, why:'gen-shacl turns it into sh:minCount 1 and sh:maxCount 1 for you.' });
