import type { CSSProperties } from 'react';
import { Block } from '../shared/Block';

/** Who owns what: Neptune holds what is true, OpenSearch finds where to start, one ID joins them. */
export function WhoOwnsWhat() {
  return (
    <Block className="block" aria-labelledby="own">
      <h3 className="sech" id="own">Who owns what</h3>
      <p className="intro">Most of the design follows from one split. Neptune is the system of record for payment facts and how they connect. OpenSearch is a derived index that turns words and meaning into Neptune IDs.</p>
      <div className="split">
        <div className="side" style={{ '--c': 'var(--graph)' } as CSSProperties}>
          <h3>Neptune</h3>
          <p className="sub">What is true, and how it connects</p>
          <ul>
            <li><b>Identity</b><span>Parties, instruments and the events you reason over, with deterministic IDs so reloads are idempotent.</span></li>
            <li><b>Lifecycle chains</b><span>Authorization to capture to settlement, refund or chargeback, as events linked by relationships.</span></li>
            <li><b>Provenance</b><span>Source, extraction run and ontology version on every node; chunk stubs with MENTIONS edges.</span></li>
            <li><b>The ontology itself</b><span>A small meta-graph of classes and allowed relationships that agents can read before writing Cypher.</span></li>
            <li><b>Questions it answers</b><span>Paths, lineage, neighbors, counts over relationships.</span></li>
          </ul>
        </div>
        <div className="join">
          <div className="link"><div className="key">neptune_id</div></div>
          <p>Every OpenSearch document carries the Neptune ID of what it describes, plus the ontology version. That is the only join between the stores.</p>
        </div>
        <div className="side" style={{ '--c': 'var(--search)' } as CSSProperties}>
          <h3>OpenSearch</h3>
          <p className="sub">Where to start looking</p>
          <ul>
            <li><b>Words</b><span>Fuzzy merchant names, aliases, codes such as MCCs and reason codes.</span></li>
            <li><b>Meaning</b><span>Vector similarity over entity summaries, document chunks and ontology definitions.</span></li>
            <li><b>Filtering and ranking</b><span>Dates, classes, access classification, relevance scores.</span></li>
            <li><b>Document text</b><span>Chunk text and embeddings, which Neptune never stores.</span></li>
            <li><b>Questions it answers</b><span>Which thing did they mean, and what has been written about it.</span></li>
          </ul>
        </div>
      </div>
      <p className="rule">If OpenSearch disappeared tomorrow, you could rebuild it from Neptune and the source documents in S3. Never let the reverse become true.</p>
    </Block>
  );
}
