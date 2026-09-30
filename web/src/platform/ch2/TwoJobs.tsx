import { inView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { rounded } from '../../kit/svg';
import { anim, packet, wait } from '../shared/anim';

// One pipeline, two jobs: it fills the graph, and now and then it proposes an ontology change
// that a person reviews. Then three reasons a person has to review it.

type Pt = [number, number];
const PATHS: { pts: Pt[]; cls: string; marker?: string; key?: 'src' | 'con' | 'main' }[] = [
  { pts: [[570, 155], [816, 155]], cls: 'evtrack' },
  { pts: [[470, 238], [470, 191]], cls: 'evl muted', marker: 'url(#mg-mut)', key: 'src' },
  { pts: [[240, 155], [369, 155]], cls: 'evl onto', marker: 'url(#mg-onto)', key: 'con' },
  { pts: [[570, 155], [819, 155]], cls: 'evl graph', marker: 'url(#mg-graph8)', key: 'main' },
  { pts: [[470, 120], [470, 48], [140, 48], [140, 119]], cls: 'evl onto dash', marker: 'url(#mg-onto)' },
];
/** The proposal's route, in three legs: to the pull request, to the review, back to the ontology. */
const LEGS = [rounded([[470, 120], [470, 48], [426, 48]], 10), 'M334,48 L256,48', rounded([[224, 48], [140, 48], [140, 120]], 10)];

export function TwoJobs() {
  const [ver, setVer] = useState('v1.4');
  const [reviewed, setReviewed] = useState(false);
  const [broken, setBroken] = useState(false);
  const [alias, setAlias] = useState('entities_v1_4');
  const svg = useRef<SVGSVGElement>(null), pk = useRef<SVGGElement>(null), whys = useRef<HTMLDivElement>(null);
  const paths = useRef<Record<string, SVGPathElement>>({}), legs = useRef<SVGPathElement[]>([]);
  const evRun = useRef(0);

  const evolve = async () => {
    const my = ++evRun.current, s = svg.current!, layer = pk.current!, p = paths.current;
    const verEl = s.querySelector('#ver'), chk = s.querySelector<SVGTextElement>('#gt .chk')!;
    flushSync(() => { setVer('v1.4'); setReviewed(false); });
    chk.style.opacity = '0';
    layer.replaceChildren();
    await packet(layer, p.con, 'var(--onto)', 0.7);
    if (my !== evRun.current) return;
    // The main job: a steady stream of records into the graph.
    const stream: Promise<unknown>[] = [];
    for (let i = 0; i < 12; i++) {
      stream.push(wait(i * 260)
        .then(() => (my === evRun.current ? packet(layer, p.src, 'var(--muted)', 0.35) : undefined))
        .then(() => (my === evRun.current ? packet(layer, p.main, 'var(--graph)', 1.1) : undefined)));
    }
    // The side job: a proposal goes through review and becomes the next version.
    await wait(1300); if (my !== evRun.current) return;
    await packet(layer, legs.current[0], 'var(--onto)', 0.9);
    anim(s.querySelector('#prc rect'), { scale: [1, 1.12, 1] }, { duration: 0.45 });
    await wait(500); if (my !== evRun.current) return;
    await packet(layer, legs.current[1], 'var(--onto)', 0.5);
    await wait(250); if (my !== evRun.current) return;
    flushSync(() => setReviewed(true));
    anim(chk, { opacity: [0, 1] }, { duration: 0.3 });
    await wait(400); if (my !== evRun.current) return;
    await packet(layer, legs.current[2], 'var(--onto)', 0.7);
    if (my !== evRun.current) return;
    await anim(verEl, { opacity: [1, 0], y: [0, -8] }, { duration: 0.2 });
    flushSync(() => setVer('v1.5'));
    anim(verEl, { opacity: [0, 1], y: [8, 0], scale: [1.3, 1] }, { duration: 0.4 });
    await Promise.all(stream);
  };

  useEffect(() => {
    let seen = false;
    return inView(svg.current!, () => { if (!seen) { seen = true; evolve(); } }, { amount: 0.5 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Why a person reviews: names aren't meanings, other teams break, and indexes rebuild.
  useEffect(() => inView(whys.current!, () => {
    (async () => {
      const w = whys.current!;
      anim(w.querySelector('#wq'), { rotate: [0, -12, 12, -8, 8, 0] }, { duration: 0.8, delay: 0.2 });
      await wait(700);
      flushSync(() => setBroken(true));
      anim(w.querySelector('#brkx'), { opacity: [0, 1], scale: [0.5, 1] }, { duration: 0.3 });
      await wait(700);
      const tgt = w.querySelector('#aliasTgt');
      await anim(tgt, { opacity: [1, 0], y: [0, -10] }, { duration: 0.25 });
      flushSync(() => setAlias('entities_v1_5'));
      anim(tgt, { opacity: [0, 1], y: [10, 0] }, { duration: 0.3 });
    })();
  }, { amount: 0.4 }), []);

  return (
    <section className="block" id="evolve" aria-labelledby="evh">
      <h3 className="sech" id="evh">One pipeline, two jobs</h3>
      <p className="intro">The extraction pipeline has one main job and one side job. It never writes the ontology itself.</p>
      <div className="diagram-wrap">
        <svg id="evsvg" className="v1map" viewBox="0 0 1100 292" role="img" aria-label="The ontology constrains the extraction pipeline, which fills Neptune and OpenSearch; occasionally it proposes a change through a pull request that a person reviews, producing the next ontology version" ref={svg}>
          <g id="evpaths">
            {PATHS.map((x, i) => <path key={i} d={rounded(x.pts, 10)} className={x.cls} markerEnd={x.marker}
              ref={(el) => { if (el && x.key) paths.current[x.key] = el; }} />)}
            {LEGS.map((d, i) => <path key={d} d={d} fill="none" ref={(el) => { if (el) legs.current[i] = el; }} />)}
          </g>
          <g><rect className="evbox onto" x="40" y="120" width="200" height="70" rx="10" /><text className="evt" x="58" y="148">Ontology</text><text className="evs" x="58" y="170">Written by people</text><text className="ver" id="ver" x="226" y="152">{ver}</text></g>
          <g><rect className="evbox" x="370" y="120" width="200" height="70" rx="10" /><text className="evt" x="388" y="148">Extraction pipeline</text><text className="evs" x="388" y="170">Follows the ontology</text></g>
          <g><rect className="evbox" x="820" y="120" width="240" height="70" rx="10" /><rect x="832" y="132" width="3" height="21" rx="1.5" style={{ fill: 'var(--graph)' }} /><rect x="832" y="157" width="3" height="21" rx="1.5" style={{ fill: 'var(--search)' }} /><text className="evt" x="848" y="148">Neptune + OpenSearch</text><text className="evs" x="848" y="170">Validated data</text></g>
          <g><rect className="evbox" x="370" y="238" width="200" height="38" rx="10" /><text className="evs" x="470" y="262" textAnchor="middle">Code, events, documents</text></g>
          <g className="prc" id="prc"><rect x="335" y="34" width="90" height="28" rx="14" /><text x="380" y="52">Pull request</text></g>
          <g className={'gt' + (reviewed ? ' ok' : '')} id="gt"><polygon points="240,33 255,48 240,63 225,48" /><text className="chk" x="240" y="53">✓</text><text className="gl" x="240" y="22">Person reviews</text></g>
          <text className="evlbl onto" x="305" y="144" textAnchor="middle">constrains</text>
          <text className="evlbl graph" x="695" y="140" textAnchor="middle">main job: fills the graph</text>
          <text className="evlbl onto" x="482" y="96">side job: proposes a change</text>
          <g id="evpk" aria-hidden="true" ref={pk}></g>
        </svg>
      </div>
      <div className="vbtns" style={{ marginTop: '10px' }}><button type="button" className="vbtn" id="evReplay" onClick={evolve}>Replay</button></div>
      <div className="whys" id="whys" ref={whys}>
        <div className="why"><div className="wv"><code>TxnDsptRec</code><span className="q" id="wq">≟</span><code>ChargebackCase</code></div><h4>Code names aren't meanings</h4><p>Whether two names are one concept is a judgment call.</p></div>
        <div className="why"><div className="wv"><svg viewBox="0 0 220 92" aria-hidden="true">
          <line className="dl" x1="30" y1="20" x2="110" y2="46" /><line className="dl" x1="30" y1="72" x2="110" y2="46" /><line className="dl" x1="190" y1="20" x2="110" y2="46" /><line className={'dl' + (broken ? ' broken' : '')} id="brk" x1="190" y1="72" x2="110" y2="46" />
          <circle cx="30" cy="20" r="8" className="tdot" /><circle cx="30" cy="72" r="8" className="tdot" /><circle cx="190" cy="20" r="8" className="tdot" /><circle cx="190" cy="72" r="8" className="tdot" />
          <rect x="78" y="33" width="64" height="26" rx="8" style={{ fill: 'var(--raised)', stroke: 'var(--onto)', strokeWidth: '1.5' }} /><text x="110" y="50" style={{ fontSize: '11px', fontWeight: '700', fill: 'var(--onto)', textAnchor: 'middle' }}>Ontology</text>
          <text id="brkx" x="158" y="72" style={{ fontSize: '14px', fontWeight: '800', fill: 'var(--bad)', textAnchor: 'middle' }} opacity="0">✕</text>
        </svg></div><h4>Other teams build on it</h4><p>An unreviewed change is a breaking change for them.</p></div>
        <div className="why"><div className="wv"><code className="al">entities</code><span className="q">→</span><code className="tgt" id="aliasTgt">{alias}</code></div><h4>Releases rebuild indexes</h4><p>Each version means new indexes and an alias swap.</p></div>
      </div>
      <p className="note">One exception: before v1 exists, the pipeline runs once to build the term inventory in step 2 above.</p>
    </section>
  );
}
