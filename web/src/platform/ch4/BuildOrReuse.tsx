import { inView } from 'motion/react';
import { useEffect, useRef } from 'react';
import { anim, dl, drawIn, hideAll } from '../shared/anim';
import { Block } from '../shared/Block';

/** Build or reuse: our retrieval steps mapped onto BYOKG-RAG's strategies, and what's left to build. */
export function BuildOrReuse() {
  const root = useRef<HTMLElement>(null), rmap = useRef<SVGSVGElement>(null);
  useEffect(() => inView(rmap.current!, () => {
    const boxes = rmap.current!.querySelectorAll('.rb');
    hideAll(boxes);
    anim(boxes, { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, delay: dl(0, 0.07) });
    drawIn(rmap.current!.querySelectorAll('.rline'), 0.7, 0.55);
    anim(root.current!.querySelectorAll('.rchips span'), { opacity: [0, 1], scale: [0.85, 1] }, { duration: 0.3, delay: dl(1.3, 0.05) });
  }, { amount: 0.3 }), []);

  return (
    <Block className="block" id="reuse" aria-labelledby="reuseh" ref={root}>
      <h3 className="sech" id="reuseh">Build or reuse</h3>
      <p className="intro">AWS Labs’ open-source BYOKG-RAG already answers questions over a graph you bring. Most of our retrieval steps map onto its strategies, so phase 4 starts on it and we build only what it lacks.</p>
      <div className="rhead"><span>Our retrieval steps</span><span>BYOKG-RAG strategies</span></div>
      <div className="xwrap"><svg id="rmap" className="xsvg" ref={rmap} viewBox="0 0 760 250" role="img" aria-label="Our four retrieval steps mapped to BYOKG-RAG's four strategies">
        <path className="rline" d="M280,39 L479,39" /><path className="rline" d="M280,99 L479,99" /><path className="rline" d="M280,159 L479,159" /><path className="rline new" d="M280,219 L479,219" />
        <g className="rb"><rect className="evbox" x="20" y="16" width="260" height="46" rx="10" /><text className="evt" x="36" y="36">Find entry points</text><text className="evs" x="36" y="53">hybrid search over entities</text></g>
        <g className="rb"><rect className="evbox" x="20" y="76" width="260" height="46" rx="10" /><text className="evt" x="36" y="96">Walk from those IDs</text><text className="evs" x="36" y="113">multi-hop traversal</text></g>
        <g className="rb"><rect className="evbox" x="20" y="136" width="260" height="46" rx="10" /><text className="evt" x="36" y="156">Count and rank</text><text className="evs" x="36" y="173">validated Cypher</text></g>
        <g className="rb"><rect className="evbox ghostb" x="20" y="196" width="260" height="46" rx="10" /><text className="evt" x="36" y="216">Explore unclear paths</text><text className="evs" x="36" y="233">something we don’t do yet</text></g>
        <g className="rb"><rect className="evbox" x="480" y="16" width="260" height="46" rx="10" /><rect x="488" y="26" width="3" height="26" rx="1.5" style={{ fill: 'var(--query)' }} /><text className="evt" x="502" y="36">Scoring-based triplets</text><text className="evs" x="502" y="53">semantic match on graph facts</text></g>
        <g className="rb"><rect className="evbox" x="480" y="76" width="260" height="46" rx="10" /><rect x="488" y="86" width="3" height="26" rx="1.5" style={{ fill: 'var(--query)' }} /><text className="evt" x="502" y="96">Path-based retrieval</text><text className="evs" x="502" y="113">multi-hop entity paths</text></g>
        <g className="rb"><rect className="evbox" x="480" y="136" width="260" height="46" rx="10" /><rect x="488" y="146" width="3" height="26" rx="1.5" style={{ fill: 'var(--query)' }} /><text className="evt" x="502" y="156">Query-based retrieval</text><text className="evs" x="502" y="173">Cypher from the question</text></g>
        <g className="rb"><rect className="evbox" x="480" y="196" width="260" height="46" rx="10" /><rect x="488" y="206" width="3" height="26" rx="1.5" style={{ fill: 'var(--query)' }} /><text className="evt" x="502" y="216">Agentic retrieval</text><text className="evs" x="502" y="233">LLM-guided exploration</text></g>
      </svg></div>
      <div className="reuse2">
        <div className="rcol"><b>Reuse from BYOKG-RAG</b><div className="rchips"><span>Four retrieval strategies</span><span>Blocks mutating Cypher</span><span>Neptune Database and Analytics</span><span>OpenSearch or S3 Vectors for vectors</span><span>Apache 2.0</span></div></div>
        <div className="rcol"><b>Still ours to build</b><div className="rchips mine"><span>Ontology-checked Cypher</span><span>Hybrid search over document chunks</span><span>AgentCore Gateway and Policy</span><span>Answers with our citations</span><span>An evaluation set of real questions</span></div></div>
      </div>
    </Block>
  );
}
