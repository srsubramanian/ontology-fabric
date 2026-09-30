import { inView } from 'motion/react';
import { useEffect, useRef } from 'react';
import { anim, dl, drawIn, hideAll } from '../shared/anim';

/** Watch list: what changed around this build over the past year, and what's coming. */
export function WatchList() {
  const root = useRef<HTMLElement>(null), wtl = useRef<SVGSVGElement>(null);
  // The timeline draws itself, its events land in turn, then the cards follow.
  useEffect(() => inView(wtl.current!, () => {
    drawIn(wtl.current!.querySelectorAll('.gmain'), 0, 0.55);
    const ev = wtl.current!.querySelectorAll('.wev');
    hideAll(ev);
    anim(ev, { opacity: [0, 1], y: [6, 0] }, { duration: 0.35, delay: dl(0.4, 0.18) });
    anim(root.current!.querySelectorAll('.wcard'), { opacity: [0, 1], y: [10, 0] }, { duration: 0.35, delay: dl(1.5, 0.1) });
  }, { amount: 0.3 }), []);

  return (
    <section className="block" id="watch" aria-labelledby="watchh" ref={root}>
      <h3 className="sech" id="watchh">Watch list</h3>
      <p className="intro">What changed around this build over the past year, and what to keep an eye on. Checked in September 2026.</p>
      <div className="xwrap"><svg id="wtl" className="xsvg" viewBox="0 0 760 200" role="img" aria-label="Timeline from December 2025 to November 2026 of changes relevant to the platform" ref={wtl}>
        <path className="gmain" d="M30,100 L610,100" />
        <path className="wfut" d="M610,100 L730,100" />
        <g className="wev"><circle cx="60" cy="100" r="8" /><text className="evt" x="40" y="42">Dec 2025</text><text className="evs" x="40" y="60">MCP to Linux Foundation</text><text className="evs" x="40" y="76">S3 Vectors GA</text></g>
        <g className="wev"><circle cx="200" cy="100" r="8" /><text className="evt" x="200" y="136" textAnchor="middle">Mar 2026</text><text className="evs" x="200" y="154" textAnchor="middle">AgentCore Policy GA</text><text className="evs" x="200" y="170" textAnchor="middle">Neptune reads S3</text></g>
        <g className="wev"><circle cx="300" cy="100" r="8" /><text className="evt" x="300" y="42" textAnchor="middle">May 2026</text><text className="evs" x="300" y="60" textAnchor="middle">OpenSearch Serverless</text><text className="evs" x="300" y="76" textAnchor="middle">rebuilt, scales to zero</text></g>
        <g className="wev"><circle cx="430" cy="100" r="8" /><text className="evt" x="430" y="136" textAnchor="middle">Jul 28, 2026</text><text className="evs" x="430" y="154" textAnchor="middle">MCP 2026-07-28 spec</text><text className="evs" x="430" y="170" textAnchor="middle">stateless calls</text></g>
        <g className="wev"><circle cx="500" cy="100" r="8" /><text className="evt" x="500" y="42" textAnchor="middle">Aug 2026</text><text className="evs" x="500" y="60" textAnchor="middle">A2A joins MCP</text><text className="evs" x="500" y="76" textAnchor="middle">at the same foundation</text></g>
        <g className="wev fut"><circle cx="690" cy="100" r="9" /><text className="evt" x="730" y="136" textAnchor="end">Nov 14, 2026</text><text className="evs" x="730" y="154" textAnchor="end">ISO 20022 addresses</text><text className="evs" x="730" y="170" textAnchor="end">must be structured</text></g>
        <text className="evs" x="620" y="92">coming up</text>
      </svg></div>
      <div className="wcards">
        <div className="wcard"><span className="wtag">draft</span><b>SHACL 1.2 and RDF 1.2</b><span>SHACL 1.2 is a Working Draft; RDF 1.2 is a Candidate Recommendation. Keep using SHACL 1.0 core; revisit when SHACL Rules is final, since it could replace custom inference.</span></div>
        <div className="wcard"><span className="wtag">trend</span><b>Ontologies with rules and actions</b><span>Platforms now model actions next to entities. Planned for a later phase: action types in the ontology become MCP tools that call the owning system, behind policy and human approval. Version 1 stays read-only.</span></div>
        <div className="wcard"><span className="wtag due">14 Nov 2026</span><b>ISO 20022 structured addresses</b><span>If cross-border payments are in scope, give Party a structured PostalAddress with town and country now.</span></div>
        <div className="wcard"><span className="wtag">not yet</span><b>GQL in Neptune</b><span>No announcement found. openCypher is converging on GQL, so today’s queries should carry over.</span></div>
      </div>
    </section>
  );
}
