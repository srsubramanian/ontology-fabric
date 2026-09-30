import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { reduce } from '../../kit/motion';
import { anim, tween, wait } from '../shared/anim';
import { DeepDive, XPanel, useDeepDive, useTour, type DDStep } from '../shared/DeepDive';
import { linesHtml } from '../shared/lines';

// Deep dive: four documents, one query. Keyword and vector search score them on different
// scales; min-max normalization and a weighted mean turn that into one ranking.

const STEPS: DDStep[] = [
  { t: 'Two searches', k: ['Keyword search scores matching terms (BM25)', 'Vector search scores closeness in meaning', 'Their scores sit on different scales'] },
  { t: 'Normalize', k: ['Min-max rescales each list to 0 to 1', 'Top result becomes 1, bottom becomes 0', 'Now the two lists can be compared'] },
  { t: 'Combine', k: ['Each part is weighted, then added', 'Drag the weight and watch the ranking change', 'B wins: strong on words and on meaning'] },
  { t: 'The config', k: ['A search pipeline holds the recipe', 'The query names it with search_pipeline', 'Weights follow the order of the sub-queries'] },
  { t: 'Why both', k: ['Keywords nail exact codes and names', 'Vectors catch meaning in other words', 'Hybrid gets both'] },
];

type Doc = 'A' | 'B' | 'C' | 'D';
const DOCS: Record<Doc, string> = { A: 'Visa rules: 10.4 card-absent fraud', B: 'Runbook: orders the customer didn’t place', C: 'Glossary: reason code formats', D: 'Case notes: “not my order” claims' };
/** Illustrative scores: each search only returns its own top hits. */
const KW: Partial<Record<Doc, number>> = { A: 12.4, B: 9.1, C: 3.2 }, VEC: Partial<Record<Doc, number>> = { B: 0.83, D: 0.79, A: 0.61 };
const norm = (o: Partial<Record<Doc, number>>) => {
  const v = Object.values(o) as number[], lo = Math.min(...v), hi = Math.max(...v);
  return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, ((x as number) - lo) / (hi - lo)])) as Partial<Record<Doc, number>>;
};
const KWN = norm(KW), VECN = norm(VEC);
const ORDER: Doc[] = ['A', 'B', 'C', 'D'];

/** The blended score for each document at keyword weight `wk`, best first. */
const blend = (wk: number) => ORDER
  .map((k) => { const kw = wk * (KWN[k] || 0), ve = (1 - wk) * (VECN[k] || 0); return { k, kw, ve, tot: kw + ve }; })
  .sort((a, b) => b.tot - a.tot);
const weightText = (wk: number) => 'keyword ' + wk.toFixed(2) + ', vector ' + (1 - wk).toFixed(2);

const CFG = [
  'PUT /_search/pipeline/hybrid-minmax',
  '{',
  '  "description": "Blend keyword and vector scores",',
  '  "phase_results_processors": [',
  '    { "normalization-processor": {',
  '        "normalization": { "technique": "min_max" },',
  '        "combination": {',
  '          "technique": "arithmetic_mean",',
  '          "parameters": { "weights": [0.4, 0.6] }',
  '        } } }',
  '  ]',
  '}',
].join('\n');
const TOUR: [number, number, string][] = [
  [0, 0, 'Create a search pipeline named hybrid-minmax.'],
  [5, 5, 'First: rescale each result list to 0 to 1.'],
  [6, 8, 'Then: a weighted average, keyword 0.4 and vector 0.6.'],
  [8, 8, 'The weights line up with the order of the queries inside “hybrid”.'],
];

// Step 5: which search finds each query (1) and which misses it (0).
const WHY: [q: string, what: string, marks: number[]][] = [
  ['“10.4”', 'an exact code', [1, 0, 1]],
  ['“customer says the order wasn’t theirs”', 'same meaning, no shared words', [0, 1, 1]],
  ['“Harbor Grill disputes”', 'a name plus a topic', [1, 1, 1]],
];

/** Keyword and vector scores side by side, one bar per document. */
function ScoreCols({ id, normalized }: { id: string; normalized: boolean }) {
  const col = (title: string, sub: string, o: Partial<Record<Doc, number>>, fmt: (v: number) => string, max: number, cls: string) => (
    <div className="scol"><b>{title}</b><small>{sub}</small>
      {(Object.keys(o) as Doc[]).map((k) => (
        <div key={k} className="srow"><span className="sdoc"><i>{k}</i>{DOCS[k]}</span><div className="strack"><div className={'sbar ' + cls} data-w={((o[k] as number) / max * 100).toFixed(1)}></div></div><span className="sval" data-v={o[k]}>{fmt(o[k] as number)}</span></div>
      ))}
    </div>
  );
  return (
    <div className="scorecols" id={id}>
      {col('Keyword (BM25)', normalized ? 'rescaled to 0 to 1' : 'scores roughly 0 to 15', KW, normalized ? (v) => v.toFixed(2) : (v) => v.toFixed(1), 15, 'kw')}
      {col('Vector (k-NN)', normalized ? 'rescaled to 0 to 1' : 'similarity 0 to 1', VEC, (v) => v.toFixed(2), 1, 'vec')}
    </div>
  );
}

export function HybridSearch() {
  const api = useDeepDive();
  const tour = useTour(api, TOUR);
  const html = useMemo(() => linesHtml(CFG, 'opensearch'), []);
  const q = (sel: string) => api.root!.querySelectorAll<HTMLElement>(sel);

  // ---------- Steps 1 and 2: raw scores, then rescaled ----------
  const grow = () => q('#x4raw .sbar').forEach((b, i) => {
    anim(b, { width: ['0%', b.dataset.w + '%'] }, { duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] });
    if (reduce) b.style.width = b.dataset.w + '%';
  });
  const normalize = async () => {
    q('#x4norm .srow .sbar').forEach((b) => { b.style.width = b.dataset.w + '%'; });
    await wait(700);
    q('#x4norm .scol').forEach((col, ci) => {
      const src = ci === 0 ? KWN : VECN;
      col.querySelectorAll<HTMLElement>('.srow').forEach((r) => {
        const k = r.querySelector('i')!.textContent as Doc, b = r.querySelector<HTMLElement>('.sbar')!, v = r.querySelector('.sval')!.firstChild!;
        anim(b, { width: ((src[k] as number) * 100).toFixed(1) + '%' }, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
        if (reduce) b.style.width = ((src[k] as number) * 100) + '%';
        const from = Number(r.querySelector<HTMLElement>('.sval')!.dataset.v), to = src[k] as number;
        tween({ duration: 0.7, onUpdate: (t) => { v.nodeValue = (from + (to - from) * t).toFixed(2); } });
      });
    });
  };

  // ---------- Step 3: combine, with a weight to drag ----------
  const [order, setOrder] = useState(() => blend(0.4).map((s) => s.k));
  const [totals, setTotals] = useState(() => Object.fromEntries(blend(0.4).map((s) => [s.k, s.tot.toFixed(2)])));
  const [wv, setWv] = useState(weightText(0.4));
  const slider = useRef<HTMLInputElement>(null), combo = useRef<HTMLDivElement>(null);
  const row = (k: Doc) => combo.current!.querySelector<HTMLElement>(`.crow[data-k="${k}"]`)!;
  const setParts = (animate: boolean) => {
    blend(Number(slider.current!.value)).forEach((s) => {
      const kwp = row(s.k).querySelector<HTMLElement>('.cpart.kw')!, vep = row(s.k).querySelector<HTMLElement>('.cpart.vec')!;
      if (animate) { anim(kwp, { width: (s.kw * 100) + '%' }, { duration: 0.4 }); anim(vep, { width: (s.ve * 100) + '%' }, { duration: 0.4 }); }
      if (!animate || reduce) { kwp.style.width = (s.kw * 100) + '%'; vep.style.width = (s.ve * 100) + '%'; }
    });
  };
  const combine = () => {
    const wk = Number(slider.current!.value), scored = blend(wk);
    const first = new Map(ORDER.map((k) => [k, row(k).getBoundingClientRect().top]));
    setParts(true);
    flushSync(() => { setWv(weightText(wk)); setTotals(Object.fromEntries(scored.map((s) => [s.k, s.tot.toFixed(2)]))); setOrder(scored.map((s) => s.k)); });
    ORDER.forEach((k) => { const d = first.get(k)! - row(k).getBoundingClientRect().top; if (d) anim(row(k), { y: [d, 0] }, { duration: 0.45, ease: [0.22, 1, 0.36, 1] }); });
  };
  useLayoutEffect(() => setParts(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Step 5: which search finds what ----------
  const [marks, setMarks] = useState<boolean[]>(Array(9).fill(false));
  const why = () => {
    setMarks(Array(9).fill(false));
    WHY.flatMap(([, , m]) => m).forEach((_, i) => setTimeout(() => {
      flushSync(() => setMarks((ms) => ms.map((x, j) => (j === i ? true : x))));
      anim(q('#x4why .mk')[i], { scale: [0.3, 1] }, { duration: 0.25 });
    }, reduce ? 0 : 200 + i * 180));
  };

  const run = {
    1: () => { q('#x4raw .sbar').forEach((b) => { b.style.width = '0%'; }); grow(); },
    2: () => { normalize(); },
    3: () => { requestAnimationFrame(() => combine()); },
    4: () => { tour.play(); },
    5: why,
  };

  return (
    <DeepDive api={api} id="dd4" title="Deep dive: how hybrid search blends scores" steps={STEPS} run={run}
      intro="Four documents, one query: “10.4 card-absent fraud”. Watch keyword and vector search score them on different scales, then see how one number comes out."
      next={{ href: '#walkh', label: 'Next: one question, end to end' }}>
      <XPanel n={1}><ScoreCols id="x4raw" normalized={false} /><p className="note">Document C has no vector score and D has no keyword score: each search only returns its own top hits.</p></XPanel>
      <XPanel n={2}><div className="formula">normalized = (score − lowest) ÷ (highest − lowest)</div><ScoreCols id="x4norm" normalized /></XPanel>
      <XPanel n={3}>
        <div className="wctl"><label htmlFor="x4w">Keyword weight</label><input type="range" id="x4w" min="0" max="1" step="0.05" defaultValue="0.4" ref={slider} onChange={combine} /><span id="x4wv">{wv}</span></div>
        <div className="combo" id="x4combo" ref={combo}>
          {order.map((k) => <div key={k} className="crow" data-k={k}><span className="sdoc"><i>{k}</i>{DOCS[k]}</span><div className="ctrack"><div className="cpart kw"></div><div className="cpart vec"></div></div><span className="ctot">{totals[k]}</span></div>)}
        </div>
        <div className="blegend"><span><i className="sw" style={{ background: 'var(--graph)' }}></i>Keyword part</span><span><i className="sw" style={{ background: 'var(--query)' }}></i>Vector part</span></div>
      </XPanel>
      <XPanel n={4}>
        <div className="ddcode" id="x4box" ref={tour.box}><div className="ddband"></div><pre id="x4code" dangerouslySetInnerHTML={{ __html: html }} /></div>
        <p className="reading" id="x4cap" ref={tour.capEl}>{tour.cap}</p>
        <div className="vbtns"><button type="button" className="vbtn go" id="x4play" onClick={tour.play}>Play the tour</button></div>
      </XPanel>
      <XPanel n={5}>
        <div className="why3" id="x4why">
          <div className="w3 h"><span>Query</span><span>Keyword</span><span>Vector</span><span>Hybrid</span></div>
          {WHY.map(([query, what, m], r) => (
            <div key={query} className="w3"><span><b>{query}</b><small>{what}</small></span>
              {m.map((v, c) => { const on = marks[r * 3 + c]; return <span key={c} className={'mk' + (on ? (v ? ' ok' : ' no') : '')} data-v={v}>{on ? (v ? '✓' : '✕') : ''}</span>; })}
            </div>
          ))}
        </div>
        <p className="note">Vectors blur exact codes: 10.4 and 10.5 mean almost the same thing to an embedding. Keywords keep them apart.</p>
      </XPanel>
    </DeepDive>
  );
}
