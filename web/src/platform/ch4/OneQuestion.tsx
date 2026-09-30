import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { reduce } from '../../kit/motion';
import { anim, dl } from '../shared/anim';
import { highlightLines } from '../shared/lines';
import { FOLLOW, WCODE } from './walk-data';

// One question, end to end: what each part of the system does, step by step, with the code
// or data it handles and an optional tour of that code.

type Part = 'api' | 'opensearch' | 'bedrock' | 'neptune';
const WALK: { title: string; touches: Part[]; text: string }[] = [
  { title: 'Route the question', touches: ['api'],
    text: 'The service splits the question. Ranking merchants by chargebacks is a graph question; what the rules say is a document question. Both need an entry point first.' },
  { title: 'Search OpenSearch for entry points', touches: ['api', 'opensearch'],
    text: 'One hybrid query finds the reason code and the chunks that discuss it, and returns IDs to hand to Neptune. Modeling reason codes as nodes, not just properties, lets documents and chargebacks meet at the same node.' },
  { title: 'Write and check the Cypher', touches: ['api', 'opensearch', 'bedrock'],
    text: 'Claude writes the query using only the classes the ontology index returned. The validator checks it against the ontology before anything runs; on failure the error goes back to Claude for a retry.' },
  { title: 'Traverse Neptune', touches: ['api', 'neptune'],
    text: 'Neptune walks from one reason code through chargebacks, captures and authorizations to merchants, then counts. The ID from OpenSearch is the starting point.' },
  { title: 'Answer with citations', touches: ['api', 'bedrock'],
    text: 'Claude writes only from the graph results and the retrieved chunks, and cites both. A reviewer can rerun the query or open the chunk behind any sentence.' },
];
const PARTS: { t: Part; c: string; label: string }[] = [
  { t: 'api', c: 'var(--query)', label: 'Retrieval service' },
  { t: 'opensearch', c: 'var(--search)', label: 'OpenSearch' },
  { t: 'bedrock', c: 'var(--ink)', label: 'Bedrock' },
  { t: 'neptune', c: 'var(--graph)', label: 'Neptune' },
];

export function OneQuestion() {
  const [cur, setCur] = useState(0);
  const [following, setFollowing] = useState(false);
  const [cap, setCap] = useState('');
  const root = useRef<HTMLElement>(null), code = useRef<HTMLDivElement>(null), band = useRef<HTMLDivElement>(null), capEl = useRef<HTMLParagraphElement>(null);
  const run = useRef(0);
  // Each step's blocks run on as one listing, a line per row.
  const html = useMemo(() => WCODE.map((blocks) => blocks
    .flatMap((b) => highlightLines(b.code, b.lang)).map((l) => '<span class="ln">' + (l || ' ') + '</span>').join('')), []);

  // Showing a step fades in its text and code, and pulses the parts it touches.
  useEffect(() => {
    if (!reduce) {
      const r = root.current!;
      anim(r.querySelector('#wtext'), { opacity: [0, 1] }, { duration: 0.3 });
      anim(r.querySelector(`.wpanel[data-w="${cur}"]`), { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, ease: [0.22, 1, 0.36, 1] });
      const on = r.querySelectorAll('.touch.on');
      if (on.length) anim(on, { scale: [0.92, 1] }, { duration: 0.3, delay: dl(0, 0.05) });
    }
  }, [cur]);

  const stop = () => { run.current++; anim(band.current, { opacity: 0 }, { duration: 0.2 }); setCap(''); setFollowing(false); };
  const follow = async () => {
    if (following) { stop(); return; }
    const my = ++run.current, w = cur;
    setFollowing(true);
    const lines = code.current!.querySelectorAll(`.wpanel[data-w="${w}"] .ln`);
    for (const [a, z, t] of FOLLOW[w]) {
      if (my !== run.current) return;
      const base = code.current!.getBoundingClientRect().top - code.current!.scrollTop;
      const top = lines[a].getBoundingClientRect().top - base;
      const h = lines[z].getBoundingClientRect().bottom - lines[a].getBoundingClientRect().top;
      setCap(t); anim(capEl.current, { opacity: [0, 1] }, { duration: 0.25 });
      await anim(band.current, { top: top + 'px', height: h + 'px', opacity: 1 }, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
      await new Promise((r) => setTimeout(r, 1700));
    }
    if (my === run.current) { anim(band.current, { opacity: 0 }, { duration: 0.3 }); setCap(''); setFollowing(false); }
  };

  const w = WALK[cur];
  return (
    <section className="block" aria-labelledby="walkh" ref={root}>
      <h3 className="sech" id="walkh">One question, end to end</h3>
      <p className="intro">A dispute analyst's agent asks: which merchants had the most 10.4 chargebacks last month, and what do the network rules say about 10.4? Step through what each part of the system does.</p>
      <div className="walk">
        <ol className="steps" id="wsteps" aria-label="Walkthrough steps" style={{ '--flow': 'var(--query)' } as CSSProperties}>
          {WALK.map((s, i) => <li key={s.title}><button type="button" aria-current={i === cur ? 'step' : undefined} onClick={() => { setCur(i); stop(); }}>{s.title}</button></li>)}
        </ol>
        <div>
          <p className="wtext" id="wtext">{w.text}</p>
          <div className="touches" id="touches">
            {PARTS.map((p) => <span key={p.t} className={'touch' + (w.touches.includes(p.t) ? ' on' : '')} data-t={p.t} style={{ '--c': p.c } as CSSProperties}>{p.label}</span>)}
          </div>
          <div className="code" id="wcode" ref={code}><div className="fband" id="fband" ref={band}></div>
            {html.map((h, i) => <div key={i} className="wpanel" data-w={i} hidden={i !== cur}><pre dangerouslySetInnerHTML={{ __html: h }} /></div>)}
          </div>
          <div className="frow"><button type="button" className="vbtn" id="followBtn" onClick={follow}>{following ? 'Stop' : 'Follow along'}</button><p className="fcap" id="fcap" aria-live="polite" ref={capEl}>{cap}</p></div>
        </div>
      </div>
    </section>
  );
}
