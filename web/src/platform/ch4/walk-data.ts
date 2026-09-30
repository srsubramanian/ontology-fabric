// The walkthrough's code for each step, and the lines Follow along stops on. Illustrative:
// the IDs, counts and chunk names are made up to match the running example.

export const WCODE: { lang: string; code: string }[][] = [
  [ { lang:'yaml', code:
`# question arriving from an agent over MCP
question: >
  Which merchants had the most 10.4 chargebacks last month,
  and what do the network rules say about 10.4?

# plan produced by the router node
graph_ranking:
  rank: Merchant by count(Chargeback)
  filter: reason code 10.4, opened in 2026-08
document_lookup:
  about: reason code 10.4
entry_points_needed:
  - the ReasonCode node for "10.4"
  - chunks that discuss it` } ],
  [ { lang:'opensearch', code:
`// hybrid = keyword + vector; a search pipeline normalizes the scores
GET entities,chunks/_search?search_pipeline=hybrid-minmax
{
  "size": 8,
  "_source": ["neptune_id", "chunk_id", "labels", "mentions"],
  "query": { "hybrid": { "queries": [
    { "multi_match": { "query": "10.4 card-absent fraud",
        "fields": ["codes^4", "name^2", "aliases", "text"] } },
    { "knn": { "embedding": { "vector": [ /* query embedding */ ], "k": 20 } } }
  ] } }
}` },
    { lang:'walktext', code:
`
# what comes back: IDs to hand to Neptune, not answers
entity  rc:visa:10.4                :ReasonCode
chunk   visa-rules-2026-04#c118     mentions rc:visa:10.4
chunk   disputes-runbook#c07        mentions rc:visa:10.4, proc:representment` } ],
  [ { lang:'cypher', code:
`// written by Claude using only the classes the ontology index returned
MATCH (rc:ReasonCode {id: $rc})<-[:HAS_REASON]-(cb:Chargeback)
      -[:DISPUTES]->(:Capture)-[:CAPTURES]->(:Authorization)
      -[:AT_MERCHANT]->(m:Merchant)
WHERE cb.opened_at >= datetime($from) AND cb.opened_at < datetime($to)
RETURN m.id AS merchant, m.name AS name, m.mcc AS mcc, count(cb) AS disputes
ORDER BY disputes DESC
LIMIT 10` },
    { lang:'json', code:
`
// parameters: rc from step 2, dates from the router
{ "rc": "rc:visa:10.4", "from": "2026-08-01T00:00:00Z", "to": "2026-09-01T00:00:00Z" }` },
    { lang:'walktext', code:
`
# checked against ontology 1.4 before it runs
pass  labels exist         ReasonCode, Chargeback, Capture, Authorization, Merchant
pass  directions allowed   HAS_REASON, DISPUTES, CAPTURES, AT_MERCHANT
pass  read-only            no CREATE, MERGE, SET or DELETE
pass  bounded              LIMIT present, every value passed as a parameter` } ],
  [ { lang:'walktext', code:
`# runs on a Neptune reader endpoint
merchant   name                  mcc    disputes
m:88213    Harbor Grill #4       5812   41
m:10442    Sunset Tickets        7922   33
m:77019    Bayside Electronics   5732   27
\u2026` },
    { lang:'cypher', code:
`
// optional second hop for context, same ID-driven style
MATCH (m:Merchant)-[:ACQUIRED_BY]->(a:Acquirer)
WHERE m.id IN $top_merchants
RETURN m.id, a.name` } ],
  [ { lang:'walktext', code:
`Harbor Grill #4 (MCC 5812) had the most 10.4 chargebacks opened in
August: 41. Sunset Tickets had 33 and Bayside Electronics 27.
  [graph: cypher run q-7f3a]

10.4 is Visa's fraud reason code for card-absent transactions. The
disputes runbook lists the representment steps and the evidence a
merchant needs to respond.
  [chunk: visa-rules-2026-04#c118] [chunk: disputes-runbook#c07]

# every sentence traces to a Cypher run or a source chunk` } ]
];

export const FOLLOW: [number, number, string][][] = [
  [[1,3,'The question exactly as the agent sent it'], [6,8,'The graph half: rank merchants by chargebacks'], [9,10,'The document half: what the rules say'], [11,13,'Both halves need an entry point first']],
  [[1,1,'One request searches both indexes'], [6,7,'Keyword half: codes and names weigh the most'], [8,8,'Vector half: matches on meaning'], [13,15,'Back come Neptune IDs and chunk IDs, not answers']],
  [[1,3,'The path, using only relationships the ontology allows'], [4,4,'Only chargebacks opened last month'], [5,7,'Count per merchant, rank, and cap the result'], [10,10,'$rc is the ID OpenSearch found in step 2'], [13,16,'Checked against the ontology before it runs']],
  [[2,4,'Neptune counted and ranked the merchants'], [8,10,'A second hop adds context, still starting from IDs']],
  [[0,2,'The ranking sentence cites the Cypher run'], [4,7,'The rules sentence cites the source chunks'], [9,9,'Every claim is traceable']]
];
