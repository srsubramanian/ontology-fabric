import { inView } from 'motion/react';
import { useEffect, useRef, type CSSProperties } from 'react';
import { reduce } from '../../kit/motion';
import { anim } from '../shared/anim';

/** The three OpenSearch indexes, and the two storage tiers their vectors can use. */
export function Indexes() {
  const tiers = useRef<HTMLDivElement>(null);
  // The tier bars grow to their (illustrative) widths when they scroll into view.
  useEffect(() => inView(tiers.current!, () => {
    tiers.current!.querySelectorAll<HTMLElement>('.mtrack i').forEach((b, i) => {
      if (reduce) { b.style.width = b.dataset.w + '%'; return; }
      anim(b, { width: ['0%', b.dataset.w + '%'] }, { duration: 0.8, delay: 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] });
    });
  }, { amount: 0.4 }), []);

  return (
    <section className="block" aria-labelledby="ixh">
      <h3 className="sech" id="ixh">OpenSearch indexes</h3>
      <p className="intro">Three indexes, all generated from the ontology and all rebuildable. Each index name is an alias that points at a versioned index, such as entities_v1_4.</p>
      <div className="indexes">
        <div className="ix">
          <h3>entities <small>one per searchable node</small> <span className="tierb hot">hot tier</span></h3>
          <p>Resolves names, codes and descriptions to Neptune IDs. Written only by the stream poller.</p>
          <table>
            <tr><td>neptune_id<span className="ty">keyword</span></td><td>The join key; also the document _id</td></tr>
            <tr><td>labels<span className="ty">keyword</span></td><td>Full label chain, for class filters</td></tr>
            <tr><td>name<span className="ty">text + keyword</span></td><td>Fuzzy and exact matching</td></tr>
            <tr><td>aliases<span className="ty">text</span></td><td>Trading names, old names</td></tr>
            <tr><td>codes<span className="ty">keyword</span></td><td>MCC, reason codes, BIN ranges</td></tr>
            <tr><td>summary<span className="ty">text</span></td><td>Built from properties and neighbors</td></tr>
            <tr><td>embedding<span className="ty">knn_vector</span></td><td>Same model as the other indexes</td></tr>
            <tr><td>ontology_version<span className="ty">keyword</span></td><td>Release that shaped this document</td></tr>
          </table>
        </div>
        <div className="ix">
          <h3>chunks <small>one per document chunk</small> <span className="tierb cheap">S3 Vectors tier</span></h3>
          <p>Holds the text Neptune doesn't. Written by the extraction pipeline.</p>
          <table>
            <tr><td>chunk_id<span className="ty">keyword</span></td><td>Stable per document version</td></tr>
            <tr><td>doc_id, title<span className="ty">keyword, text</span></td><td>For citations</td></tr>
            <tr><td>text<span className="ty">text</span></td><td>The chunk itself</td></tr>
            <tr><td>embedding<span className="ty">knn_vector</span></td><td>Stored on the S3 Vectors engine</td></tr>
            <tr><td>mentions<span className="ty">keyword</span></td><td>Neptune IDs of entities named</td></tr>
            <tr><td>classification<span className="ty">keyword</span></td><td>Access filter on every query</td></tr>
            <tr><td>ontology_version<span className="ty">keyword</span></td><td>For release rollbacks</td></tr>
          </table>
        </div>
        <div className="ix">
          <h3>ontology <small>one per class or relationship</small> <span className="tierb hot">hot tier</span></h3>
          <p>Lets the retrieval service fetch only the schema a question needs before writing Cypher.</p>
          <table>
            <tr><td>iri<span className="ty">keyword</span></td><td>Versioned identifier</td></tr>
            <tr><td>kind<span className="ty">keyword</span></td><td>Class, relationship or property</td></tr>
            <tr><td>label, definition<span className="ty">text</span></td><td>What text-to-Cypher reads</td></tr>
            <tr><td>domain, range<span className="ty">keyword</span></td><td>Allowed direction</td></tr>
            <tr><td>parents<span className="ty">keyword</span></td><td>Superclass chain</td></tr>
            <tr><td>cypher_pattern<span className="ty">keyword</span></td><td>A ready-made pattern to paste into the prompt</td></tr>
            <tr><td>embedding<span className="ty">knn_vector</span></td><td>Match questions to classes</td></tr>
          </table>
        </div>
      </div>
      <p className="release"><strong>Releasing a new ontology version:</strong> build the next set of versioned indexes, backfill them from Neptune and the chunk store, run the evaluation questions against them, then move the three aliases together. Rolling back is moving the aliases back.</p>
    <div className="tiers" id="tiers" ref={tiers}>
        <div className="tierc" style={{ '--c': 'var(--search)' } as CSSProperties}><b>Hot tier</b><span>Vectors held in memory (HNSW)</span>
          <div className="meter"><em>Query speed</em><div className="mtrack"><i data-w="92"></i></div></div>
          <div className="meter"><em>Storage cost</em><div className="mtrack"><i data-w="88"></i></div></div>
          <small>For entities and the ontology: small, and queried on every question.</small></div>
        <div className="tierc" style={{ '--c': 'var(--graph)' } as CSSProperties}><b>S3 Vectors engine</b><span>Vectors stored in S3; text, filters and hybrid search stay in OpenSearch</span>
          <div className="meter"><em>Query speed</em><div className="mtrack"><i data-w="45"></i></div></div>
          <div className="meter"><em>Storage cost</em><div className="mtrack"><i data-w="18"></i></div></div>
          <small>For document chunks: large, and fine with slower vector queries.</small></div>
      </div>
      <p className="note">Bars are illustrative. For development and bursty workloads, the rebuilt OpenSearch Serverless can also scale to zero.</p>


    </section>
  );
}
