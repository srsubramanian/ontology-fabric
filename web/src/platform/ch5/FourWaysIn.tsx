import { inView } from 'motion/react';
import { useEffect, useRef } from 'react';
import { reduce } from '../../kit/motion';
import { rounded } from '../../kit/svg';
import { anim, tween } from '../shared/anim';
import { Block } from '../shared/Block';

// Four ways in: agents and analysts through the retrieval service, engineers straight to the
// graph, other teams through the published ontology.

type Pt = [number, number];
const E: Record<string, Pt[]> = {
  a: [[230, 44], [290, 44], [290, 70], [339, 70]], u: [[230, 118], [290, 118], [290, 92], [339, 92]], api: [[570, 81], [689, 81]],
  e: [[230, 210], [339, 210]], gx: [[570, 210], [815, 210], [815, 119]], t: [[230, 286], [339, 286]],
};
/** Who travels which route, in what colour: each chain of legs runs in turn. */
const CHAINS: [string, string][][] = [
  [['a', 'var(--query)'], ['api', 'var(--query)']],
  [['u', 'var(--query)'], ['api', 'var(--query)']],
  [['e', 'var(--graph)'], ['gx', 'var(--graph)']],
  [['t', 'var(--onto)']],
];
const SVG = 'http://www.w3.org/2000/svg';

export function FourWaysIn() {
  const svg = useRef<SVGSVGElement>(null), pk = useRef<SVGGElement>(null);
  const paths = useRef<Record<string, SVGPathElement>>({});

  /** Sends a dot along one route. */
  const go = (key: string, color: string, dur: number) => {
    if (reduce) return Promise.resolve();
    const p = paths.current[key], len = p.getTotalLength();
    const g = document.createElementNS(SVG, 'g'), h = document.createElementNS(SVG, 'circle'), c = document.createElementNS(SVG, 'circle');
    h.setAttribute('r', '10'); h.setAttribute('opacity', '0.22'); h.style.fill = color;
    c.setAttribute('r', '5'); c.style.fill = color; c.style.stroke = 'var(--raised)'; c.style.strokeWidth = '1.5';
    g.append(h, c); pk.current!.appendChild(g);
    const put = (v: number) => { const pt = p.getPointAtLength(v * len); g.setAttribute('transform', 'translate(' + pt.x + ',' + pt.y + ')'); };
    put(0);
    return tween({ duration: dur || 0.8, ease: [0.45, 0, 0.2, 1], onUpdate: put }).then(() => g.remove());
  };
  const play = async () => {
    pk.current!.replaceChildren();
    await Promise.all(CHAINS.map((ch, i) => new Promise((r) => setTimeout(r, i * 350)).then(async () => { for (const [k, col] of ch) await go(k, col, 0.75); })));
  };

  useEffect(() => inView(svg.current!, () => {
    anim(svg.current!.querySelectorAll('.unode'), { opacity: [0, 1] }, { duration: 0.4, delay: (i) => i * 0.07 });
    setTimeout(play, 600);
  }, { amount: 0.45 }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Block className="block" id="users" aria-labelledby="usersh">
      <h3 className="sech" id="usersh">Four ways in</h3>
      <p className="intro">Everyone reaches the same knowledge, just not the same way. Agents and analysts go through the retrieval service, engineers explore the graph directly, and other teams consume the published ontology.</p>
      <div className="diagram-wrap"><svg id="usesvg" className="loopsvg" ref={svg} viewBox="0 0 960 330" role="img" aria-label="Agents and the analyst UI reach Neptune and OpenSearch through the retrieval service; engineers use Graph Explorer; other teams use the published ontology">
        <g id="upaths">
          {Object.entries(E).map(([k, pts]) => <path key={k} d={rounded(pts, 10)} className="le" markerEnd="url(#mg-line)" ref={(el) => { if (el) paths.current[k] = el; }} />)}
        </g>
        <g className="unode"><rect className="evbox" x="20" y="16" width="210" height="56" rx="10" /><text className="evt" x="38" y="40">Agents</text><text className="evs" x="38" y="60">Through MCP tools</text></g>
        <g className="unode"><rect className="evbox" x="20" y="90" width="210" height="56" rx="10" /><text className="evt" x="38" y="114">Analyst UI</text><text className="evs" x="38" y="134">Search and graph views</text></g>
        <g className="unode"><rect className="evbox" x="20" y="182" width="210" height="56" rx="10" /><text className="evt" x="38" y="206">Engineers</text><text className="evs" x="38" y="226">Explore and debug</text></g>
        <g className="unode"><rect className="evbox" x="20" y="258" width="210" height="56" rx="10" /><text className="evt" x="38" y="282">Other teams, partners</text><text className="evs" x="38" y="302">Pin an ontology version</text></g>
        <g className="unode"><rect className="evbox" x="340" y="44" width="230" height="74" rx="10" /><rect x="348" y="56" width="3" height="50" rx="1.5" style={{ fill: 'var(--query)' }} /><text className="evt" x="362" y="70">Retrieval service</text><text className="evs" x="362" y="90">Behind AgentCore Gateway</text><text className="evs" x="362" y="108">Validated, read-only queries</text></g>
        <g className="unode"><rect className="evbox" x="340" y="182" width="230" height="56" rx="10" /><rect x="348" y="192" width="3" height="36" rx="1.5" style={{ fill: 'var(--graph)' }} /><text className="evt" x="362" y="206">Graph Explorer</text><text className="evs" x="362" y="226">Free, runs in your VPC</text></g>
        <g className="unode"><rect className="evbox" x="340" y="258" width="230" height="56" rx="10" /><rect x="348" y="268" width="3" height="36" rx="1.5" style={{ fill: 'var(--onto)' }} /><text className="evt" x="362" y="282">Published ontology</text><text className="evs" x="362" y="302">Versioned releases</text></g>
        <g className="unode"><rect className="evbox" x="690" y="44" width="250" height="74" rx="10" /><rect x="698" y="56" width="3" height="22" rx="1.5" style={{ fill: 'var(--graph)' }} /><rect x="698" y="84" width="3" height="22" rx="1.5" style={{ fill: 'var(--search)' }} /><text className="evt" x="712" y="74">Neptune + OpenSearch</text><text className="evs" x="712" y="96">The knowledge layer</text></g>
        <g id="upk" aria-hidden="true" ref={pk}></g>
      </svg></div>
      <div className="vbtns" style={{ marginTop: '10px' }}><button type="button" className="vbtn" id="uReplay" onClick={play}>Replay</button></div>
      <h4 className="toolh">The agent toolset</h4>
      <div className="tools"><code>search_entities</code><code>expand_subgraph</code><code>run_validated_cypher</code><code>get_ontology_class</code></div>
      <p className="note">No raw Cypher tool for agents. Every call passes AgentCore Policy at the gateway, and every query is checked against the ontology, read-only and bounded. Agents from other teams hand work over A2A instead.</p>
      <div className="aud">
        <div><b>Graph Explorer</b><span>Engineers and the ontology team. Free, AWS open source, openCypher, with a schema view.</span></div>
        <div><b>G.V()</b><span>Developers writing Cypher every day. A paid query IDE with graph views.</span></div>
        <div><b>Linkurious Enterprise</b><span>Investigations at scale. Paid, and it brings its own access rules: a second policy to maintain.</span></div>
      </div>
    </Block>
  );
}
