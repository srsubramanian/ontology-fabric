import type { CSSProperties } from 'react';
import { Block } from '../shared/Block';

/** Decisions that are cheap to settle now and expensive to change once data is loaded. */
const DECISIONS: [c: string, title: string, text: string][] = [
  ['var(--query)', 'Join in the service, not in the query', "Neptune's built-in OpenSearch full-text search works from Gremlin and SPARQL queries, not openCypher. Your retrieval service searches OpenSearch first, then passes the IDs into Cypher as parameters."],
  ['var(--search)', 'Fork the replication poller', "AWS's Neptune-to-OpenSearch stack writes a document shape designed for that full-text search feature. Since you won't query it from openCypher, change the poller to write your entities documents instead."],
  ['var(--ink)', 'Pin one embedding model', 'Entities, chunks and ontology definitions must share it. Switching models means rebuilding all three indexes, so treat it like an ontology major version.'],
  ['var(--onto)', 'Version both stores together', 'Stamp ontology_version on nodes and documents. New release, new indexes, alias swap. Pair it with a Neptune snapshot so a rollback covers both stores.'],
  ['var(--graph)', 'Enforce access in layers', 'Neptune has no row-level security. Put the rules in AgentCore Policy at the gateway, give the query role read-only IAM access, and tag OpenSearch documents with a classification the service filters on.'],
  ['var(--graph)', 'Decide what lives in Neptune', 'Materialize what questions walk through or reason over. Leave high-volume authorizations in the lake, linked by ID, and pull a record in when a dispute or fraud report touches it. For wider risk walks, load daily summary edges from Snowflake, such as a device seen at a merchant.'],
  ['var(--query)', 'Make long waits survive crashes', 'LangGraph checkpoints save state, but a run lives in one process. Run the pipeline on Lambda durable functions instead: each step is checkpointed and retried, and a wait for a reviewer can last up to a year at no compute cost.'],
  ['var(--graph)', 'Own the graph instead of using managed GraphRAG', 'Bedrock Knowledge Bases GraphRAG builds its own graph in Neptune Analytics with its own entity extraction. Because your ontology is the product, you build and govern the graph; bring in Neptune Analytics later for algorithms.'],
];

export function DecideEarly() {
  return (
    <Block className="block" aria-labelledby="dech">
      <h3 className="sech" id="dech">Decide these early</h3>
      <p className="intro">Each of these is cheap to settle now and expensive to change after data is loaded.</p>
      <div className="decide">
        {DECISIONS.map(([c, title, text]) => <article key={title} style={{ '--c': c } as CSSProperties}><h3>{title}</h3><p>{text}</p></article>)}
      </div>
    </Block>
  );
}
