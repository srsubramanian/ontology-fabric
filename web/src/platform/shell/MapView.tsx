import { animate, type AnimationPlaybackControls } from 'motion/react';
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { reduce } from '../../kit/motion';
import { rounded } from '../../kit/svg';
import { DETAIL, EDGES, FLOWS, FLOW_CH, NODES, NODE_CH, OWN, W } from './map-data';

// The system map: pick a flow and watch packets move through the platform, step by step,
// or pick a node to see what it holds. The query flow plays once the map has drawn itself.

const FLOW_KEYS = ['design', 'ingest', 'sync', 'query'];
const SVG = 'http://www.w3.org/2000/svg';
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const MIN_STEP = reduce ? 4200 : 3600;

type Narr = { kind: 'step'; flow: string; i: number } | { kind: 'detail'; id: string; flow: string };
export type MapHandle = { playFlow: (k: string) => void };

export const MapView = forwardRef<MapHandle>(function MapView(_, ref) {
  const [flow, setFlow] = useState('query');
  const [pressed, setPressed] = useState<string | null>(null);
  const [narr, setNarr] = useState<Narr>({ kind: 'step', flow: 'query', i: 0 });
  const [playing, setPlayingState] = useState(false);
  const [lit, setLit] = useState<Set<string>>(() => new Set(FLOWS.query.steps[0].hops.flat().map((h) => h.replace(/^-/, ''))));
  const [selected, setSelected] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null), packets = useRef<SVGGElement>(null), narrEl = useRef<HTMLDivElement>(null), playBtn = useRef<HTMLButtonElement>(null);
  const edgeEls = useRef<Record<string, SVGPathElement>>({}), nodeEls = useRef<Record<string, SVGGElement>>({});
  // What the running flow reads between awaits, as the original script kept it.
  const cur = useRef('query'), curStep = useRef(0), mode = useRef<'flow' | 'detail'>('flow'), runId = useRef(0), playingRef = useRef(false);
  const live = useRef(new Set<AnimationPlaybackControls>());

  const setFlowColor = (c: string) => { svg.current!.style.setProperty('--flow', c); document.documentElement.style.setProperty('--flow', c); };
  const setPlaying = (v: boolean) => { playingRef.current = v; flushSync(() => setPlayingState(v)); };
  const cancelRun = () => {
    runId.current++;
    live.current.forEach((a) => { try { a.stop(); } catch { /* already done */ } });
    live.current.clear();
    packets.current!.replaceChildren();
    setPlaying(false);
  };

  /** Lights the edges given, and dims every node not given (none given: all at full strength). */
  const highlight = (nodeIds: string[], edgeIds: string[], sync = true) => {
    const nset = new Set(nodeIds);
    if (sync) flushSync(() => setLit(new Set(edgeIds)));
    NODES.forEach((n) => animate(nodeEls.current[n.id], { opacity: nset.size === 0 || nset.has(n.id) ? 1 : 0.28 }, { duration: reduce ? 0 : 0.35 }));
  };
  const fadeIn = () => { if (!reduce) animate(narrEl.current!, { opacity: [0, 1], y: [6, 0] }, { duration: 0.32, ease: [0.22, 1, 0.36, 1] }); };

  const showStep = (i: number, sync = true) => {
    mode.current = 'flow'; curStep.current = i;
    const f = FLOWS[cur.current], s = f.steps[i];
    setFlowColor(f.color);
    if (sync) flushSync(() => { setSelected(null); setNarr({ kind: 'step', flow: cur.current, i }); });
    highlight(s.nodes, [...new Set(s.hops.flat().map((h) => h.replace(/^-/, '')))], sync);
    fadeIn();
  };

  const pulse = (id: string) => {
    if (reduce) return;
    live.current.add(animate(nodeEls.current[id].querySelector('.halo')!, { opacity: [0.9, 0], scale: [1, 1.06] }, { duration: 0.6, ease: 'easeOut' }));
  };
  const packet = (edgeId: string, reverse: boolean, color: string) => {
    const path = edgeEls.current[edgeId], e = EDGES.find((x) => x.id === edgeId)!;
    if (reduce) { pulse(reverse ? e.f : e.t); return Promise.resolve(); }
    const len = path.getTotalLength();
    const g = document.createElementNS(SVG, 'g'), glow = document.createElementNS(SVG, 'circle'), core = document.createElementNS(SVG, 'circle');
    glow.setAttribute('r', '10'); glow.setAttribute('opacity', '0.22'); glow.style.fill = color;
    core.setAttribute('r', '5'); core.style.fill = color; core.style.stroke = 'var(--raised)'; core.style.strokeWidth = '1.5';
    g.append(glow, core); packets.current!.appendChild(g);
    const place = (v: number) => { const p = path.getPointAtLength((reverse ? 1 - v : v) * len); g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')'); };
    place(0);
    const a = animate(0, 1, { duration: Math.min(1.5, 0.45 + len / 520), ease: [0.45, 0, 0.2, 1], onUpdate: place });
    live.current.add(a);
    return Promise.resolve(a).then(() => {
      live.current.delete(a);
      pulse(reverse ? e.f : e.t);
      return Promise.resolve(animate(g, { opacity: [1, 0] }, { duration: 0.25 })).then(() => g.remove());
    });
  };

  const runStep = async (i: number, my: number) => {
    showStep(i);
    const t0 = performance.now(), f = FLOWS[cur.current], s = f.steps[i];
    for (const group of s.hops) {
      if (my !== runId.current) return false;
      await Promise.all(group.map((h) => packet(h.replace(/^-/, ''), h[0] === '-', f.color)));
    }
    return performance.now() - t0;
  };
  const play = async (from: number) => {
    cancelRun();
    const my = runId.current;
    setPlaying(true);
    const steps = FLOWS[cur.current].steps;
    for (let i = from; i < steps.length; i++) {
      if (my !== runId.current) return;
      const took = await runStep(i, my);
      if (my !== runId.current || took === false) return;
      if (i < steps.length - 1) await wait(Math.max(700, MIN_STEP - took));
    }
    if (my === runId.current) setPlaying(false);
  };

  const selectFlow = (k: string, autoplay: boolean) => {
    cancelRun();
    cur.current = k;
    flushSync(() => { setFlow(k); setPressed(k); });
    playBtn.current!.style.setProperty('--flow', FLOWS[k].color);
    if (autoplay && !reduce) play(0); else showStep(0);
  };

  const showDetail = (id: string) => {
    cancelRun();
    mode.current = 'detail';
    const n = NODES.find((x) => x.id === id)!, color = n.o ? OWN[n.o] : 'var(--ink)';
    setFlowColor(color);
    const touching = EDGES.filter((e) => e.f === id || e.t === id);
    const neighbors = new Set([id]); touching.forEach((e) => { neighbors.add(e.f); neighbors.add(e.t); });
    flushSync(() => { setSelected(id); setNarr({ kind: 'detail', id, flow: cur.current }); });
    highlight([...neighbors], touching.map((e) => e.id));
    fadeIn();
    pulse(id);
  };

  useImperativeHandle(ref, () => ({ playFlow: (k: string) => selectFlow(k, true) }));

  // The intro: nodes rise in, edges draw themselves, then the query flow plays.
  useLayoutEffect(() => {
    setPressed(cur.current);
    playBtn.current!.style.setProperty('--flow', FLOWS[cur.current].color);
    showStep(0, false);
    if (reduce) return;
    const ordered = NODES.slice().sort((a, b) => a.x - b.x || a.y - b.y).map((n) => nodeEls.current[n.id]);
    animate(ordered, { opacity: [0, 1], y: [10, 0] }, { duration: 0.5, delay: (i) => i * 0.045, ease: [0.22, 1, 0.36, 1] });
    EDGES.forEach((e, i) => {
      const p = edgeEls.current[e.id], len = p.getTotalLength();
      p.style.strokeDasharray = String(len); p.style.strokeDashoffset = String(len);
      Promise.resolve(animate(p, { strokeDashoffset: [len, 0] }, { duration: 0.6, delay: 0.55 + i * 0.025, ease: 'easeOut' }))
        .then(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
    });
    wait(1700).then(() => { if (mode.current === 'flow' && !playingRef.current && curStep.current === 0) play(0); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const f = FLOWS[flow];
  // Lit edges draw last, so they sit on top of the others.
  const edges = [...EDGES.filter((e) => !lit.has(e.id)), ...EDGES.filter((e) => lit.has(e.id))];
  const stepNow = narr.kind === 'step' ? narr.i : -1;

  return (
    <section id="map" aria-label="System map">
      <div className="controls">
        <div className="flows" role="group" aria-label="Choose a flow" id="flows">
          {FLOW_KEYS.map((k) => (
            <button key={k} type="button" className="flow" style={{ '--c': FLOWS[k].color } as CSSProperties}
              aria-pressed={pressed === null ? undefined : pressed === k ? 'true' : 'false'} onClick={() => selectFlow(k, true)}><span className="sw"></span>{FLOWS[k].name}</button>
          ))}
        </div>
        <div className="player">
          <button id="prev" type="button" aria-label="Previous step" disabled={narr.kind === 'step' ? narr.i === 0 : curStep.current === 0}
            onClick={() => { cancelRun(); if (curStep.current > 0) runStep(curStep.current - 1, runId.current); }}>Previous</button>
          <button id="play" type="button" ref={playBtn} onClick={() => {
            if (playingRef.current) { cancelRun(); return; }
            const last = FLOWS[cur.current].steps.length - 1;
            play(mode.current === 'flow' && curStep.current < last ? curStep.current : 0);
          }}>{playing ? 'Stop' : 'Play flow'}</button>
          <button id="next" type="button" aria-label="Next step" disabled={narr.kind === 'step' ? narr.i === f.steps.length - 1 : curStep.current === FLOWS[cur.current].steps.length - 1}
            onClick={() => { cancelRun(); runStep(Math.min(curStep.current + 1, FLOWS[cur.current].steps.length - 1), runId.current); }}>Next</button>
        </div>
      </div>

      <div className="diagram-wrap">
        <svg id="dia" viewBox="0 0 1100 530" role="img" aria-labelledby="diaTitle" ref={svg}>
          <title id="diaTitle">Architecture: ontology source and generator, extraction pipeline, Neptune Database, stream poller, OpenSearch, Bedrock, retrieval service and consumers</title>
          <defs>
            <marker id="arr-idle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,1 L9,5 L0,9 z" style={{ fill: 'var(--line)' }} /></marker>
            <marker id="arr-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,1 L9,5 L0,9 z" style={{ fill: 'var(--flow)' }} /></marker>
          </defs>
          <rect className="band" x="455" y="148" width="186" height="344" rx="12" />
          <g id="edges">
            {edges.map((e) => {
              const on = lit.has(e.id);
              return <path key={e.id} d={rounded(e.p)} className={'edge' + (e.dashed ? ' dashed' : '') + (on ? ' on' : '')} markerEnd={on ? 'url(#arr-on)' : 'url(#arr-idle)'}
                ref={(el) => { if (el) edgeEls.current[e.id] = el; }} />;
            })}
          </g>
          <g id="nodes">
            {NODES.map((n) => {
              const tx = n.o ? n.x + 18 : n.x + 14, tall = n.h > 60;
              return (
                <g key={n.id} className={'node' + (n.o ? ' o-' + n.o : '') + (n.star ? ' star' : '') + (selected === n.id ? ' selected' : '')} tabIndex={0} role="button" aria-label={n.t + ': ' + n.s + '. Show details'}
                  onClick={() => showDetail(n.id)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); showDetail(n.id); } }}
                  ref={(el) => { if (el) nodeEls.current[n.id] = el; }}>
                  <rect className="halo" x={n.x - 5} y={n.y - 5} width={W + 10} height={n.h + 10} rx="10" />
                  <rect className="box" x={n.x} y={n.y} width={W} height={n.h} rx="7" />
                  {n.o && <rect className="bar" x={n.x + 7} y={n.y + 10} width="3" height={n.h - 20} rx="1.5" />}
                  <text className="n-title" x={tx} y={n.y + (tall ? 25 : 23)}>{n.t}</text>
                  <text className="n-sub" x={tx} y={n.y + (tall ? 44 : 41)}>{n.s}</text>
                  {n.s2 && <text className="n-sub" x={tx} y={n.y + 61}>{n.s2}</text>}
                </g>
              );
            })}
          </g>
          <g className="gate" aria-hidden="true"><rect x="178" y="133" width="14" height="14" transform="rotate(45 185 140)" /><text x="185" y="126">review</text></g>
          <g id="packets" aria-hidden="true" ref={packets}></g>
          <g aria-hidden="true">
            <text className="colhead" x="105" y="516">Sources</text>
            <text className="colhead" x="325" y="516">Build and ingest</text>
            <text className="colhead" x="548" y="516">Stores</text>
            <text className="colhead" x="765" y="516">Models and serving</text>
            <text className="colhead" x="985" y="516">Consumers</text>
          </g>
        </svg>
      </div>
      <p className="scroll-hint">Scroll sideways to see the whole diagram.</p>
      <div className="legend">
        <span style={{ '--c': 'var(--onto)' } as CSSProperties}><i></i>Ontology</span>
        <span style={{ '--c': 'var(--graph)' } as CSSProperties}><i></i>Neptune graph</span>
        <span style={{ '--c': 'var(--search)' } as CSSProperties}><i></i>OpenSearch</span>
        <span style={{ '--c': 'var(--query)' } as CSSProperties}><i></i>Retrieval</span>
      </div>

      <section className="stage" aria-live="polite">
        <div className="narr" id="narr" ref={narrEl}>{narr.kind === 'step' ? <StepText flow={narr.flow} i={narr.i} /> : <DetailText id={narr.id} flow={narr.flow} onBack={() => showStep(curStep.current)} />}</div>
        <ol className="steps" id="steps" aria-label="Steps in this flow">
          {f.steps.map((s, i) => <li key={s.title}><button type="button" aria-current={i === stepNow ? 'step' : undefined} onClick={() => { cancelRun(); runStep(i, runId.current); }}>{s.title}</button></li>)}
        </ol>
      </section>
    </section>
  );
});

/** A flow step's narration, and the chapter that explains the flow. */
function StepText({ flow, i }: { flow: string; i: number }) {
  const f = FLOWS[flow], s = f.steps[i];
  return (
    <>
      <p className="count">{f.name}, step {i + 1} of {f.steps.length}</p>
      <h3>{s.title}</h3><p className="body">{s.text}</p>
      <a className="chlink" href={'#ch' + FLOW_CH[flow]}>Chapter {FLOW_CH[flow]} explains this flow</a>
    </>
  );
}

/** What a node is, what it holds and what to watch for. */
function DetailText({ id, flow, onBack }: { id: string; flow: string; onBack: () => void }) {
  const d = DETAIL[id], n = NODES.find((x) => x.id === id)!, color = n.o ? OWN[n.o] : 'var(--ink)';
  return (
    <>
      <h3><span className="dot" style={{ '--c': color } as CSSProperties}></span>{d.title}</h3><p className="body">{d.what}</p>
      {d.holds && <><h4>{d.holdsLabel || 'Holds'}</h4><ul>{d.holds.map((x) => <li key={x}>{x}</li>)}</ul></>}
      {d.keep && <><h4>Keep out</h4><ul>{d.keep.map((x) => <li key={x}>{x}</li>)}</ul></>}
      <p className="watch"><strong>Watch for:</strong> {d.watch}</p>
      {NODE_CH[id] && <a className="chlink" href={'#ch' + NODE_CH[id]}>Read chapter {NODE_CH[id]}</a>}
      <button type="button" className="back" onClick={onBack}>Back to the {FLOWS[flow].name.toLowerCase()} flow</button>
    </>
  );
}
