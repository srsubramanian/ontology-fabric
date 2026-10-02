// Prove it with data (decision 25, stage 4): a question's query run on a made-up sample world, beside the map. It shows
// the values it chose for the query's parameters, the checks, the rows, and the test case planted for it, drawn as a
// small graph: what the question should find in green, what it should leave out dashed, and red where it got it wrong.
import { useState } from 'react';
import { motion } from 'motion/react';
import { EASE_OUT, tr } from '../kit/motion';
import type { Proof } from './proof';
import type { Scenario } from './world';

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const cell = (v: unknown): string => (v == null ? '—' : Array.isArray(v) ? v.map(cell).join(', ') || '[]' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export type ProofView = {
  qid: string; question: string; lane: 'cypher' | 'sql';
  proof: Proof | null; running: boolean;
  scenario: Scenario | null; author?: string; seed: number;
};

export function ProofPanel({ v, editable, canWrite, writing, onAgain, onWrite, onStop, onRemove, onClose }: {
  v: ProofView; editable: boolean; canWrite: boolean;
  /** What Claude is doing while it writes a test case. */
  writing: string | null;
  onAgain(): void; onWrite(note: string): void; onStop(): void; onRemove(): void; onClose(): void;
}) {
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const p = v.proof;
  const planted = new Set(Object.values(p?.refs ?? {}));
  const byId = Object.fromEntries(Object.entries(p?.refs ?? {}).map(([r, id]) => [id, r]));
  const show = (x: unknown) => { const s = cell(x); return byId[s] ? <><span className="pid">{s}</span> <span className="pref">@{byId[s]}</span></> : s; };
  return (
    <section className="coach proof" aria-label={`Prove ${v.qid} with sample data`} data-lane={v.lane} data-ok={p ? String(p.ok) : undefined}>
      <header>
        <span className="ctag">Prove it · sample data</span>
        <b>{v.qid}</b>
        <span className="cact">
          <button type="button" className="vbtn tiny" onClick={onAgain} disabled={v.running} title="Build a different made-up world and run the query again">Another sample world</button>
          <button type="button" className="vbtn tiny" onClick={onClose}>Close</button>
        </span>
      </header>
      <p className="qbig">{v.question}</p>
      <p className="how">
        Illustrative: {p ? <><b>{p.world.nodes.toLocaleString()}</b> made-up instances of {p.world.classes} classes, as of {DATE.format(new Date(p.world.now))}</> : 'a made-up world built from the ontology'}
        {' · '}{v.lane === 'cypher' ? 'openCypher, on the page’s small graph engine, as Neptune would run it' : 'Snowflake SQL, on SQLite in this page, with tables built from the classes'}
        {p && ` · ${p.ms} ms`}{v.seed > 0 && ` · world ${v.seed + 1}`}
      </p>
      {v.running && !p && <p className="working" role="status"><span className="spin" aria-hidden="true" /> Building the sample world…</p>}
      {!v.running && !p && <p className="small muted">Nothing to run yet: this question has no query.</p>}
      {p && (
        <>
          {p.params.length > 0 && (
            <p className="params" aria-label="Parameters">
              {p.params.map((x) => <span key={x.name} className="param" title={x.why}><code>{v.lane === 'cypher' ? '$' : ':'}{x.name}</code> = {show(x.value)}</span>)}
            </p>
          )}
          <ul className="pchecks" aria-label="Checks">
            {p.checks.map((c, i) => <li key={i} className={c.ok ? 'ok' : 'bad'}>{c.ok ? '✓' : '✗'} {c.label}{c.detail && <span className="muted"> · {c.detail}</span>}</li>)}
          </ul>
          {p.columns.length > 0 && (
            <div className="xwrap ptable">
              <table>
                <thead><tr>{p.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {p.rows.slice(0, 25).map((r, i) => (
                    <tr key={i} className={r.some((x) => planted.has(cell(x))) ? 'planted' : undefined}>{r.map((x, j) => <td key={j}>{show(x)}</td>)}</tr>
                  ))}
                  {!p.rows.length && <tr><td colSpan={p.columns.length} className="muted">No rows. {v.scenario ? '' : 'The made-up world has nothing this question looks for; plant a test case that has it.'}</td></tr>}
                </tbody>
              </table>
              {p.rows.length > 25 && <p className="small muted">First 25 of {p.rows.length} rows.</p>}
            </div>
          )}
          {p.tables && p.tables.length > 0 && (
            <p className="small muted">Tables built from the query: {p.tables.map((t) => `${t.name} (${t.cls}, ${t.rows} rows${t.guessed.length ? `; made up: ${t.guessed.join(', ')}` : ''})`).join(' · ')}</p>
          )}
        </>
      )}
      <div className="ptest">
        <h3>Test case{v.scenario && v.author ? <span className="muted"> · {v.author}</span> : null}</h3>
        {v.scenario ? (
          <>
            {v.scenario.story && <p className="say">{v.scenario.story}</p>}
            {p && <Planted key={v.seed} s={v.scenario} p={p} />}
          </>
        ) : <p className="small muted">None yet. A test case plants the instances the question should find and the near misses it shouldn't, then says which rows to expect.</p>}
        {writing ? (
          <p className="working" role="status"><span className="spin" aria-hidden="true" /> {writing} <button type="button" className="linkish" onClick={onStop}>Stop</button></p>
        ) : editable && (
          <div className="row">
            {canWrite && <button type="button" className="vbtn go" onClick={() => (v.scenario ? setAsking(!asking) : onWrite(''))} aria-expanded={v.scenario ? asking : undefined}>
              {v.scenario ? 'Ask Claude for a different test…' : 'Plant a test case with Claude'}</button>}
            {v.scenario && <button type="button" className="vbtn danger" onClick={onRemove}>Remove the test case</button>}
            {!canWrite && !v.scenario && <span className="small muted">Claude plants test cases on the published page.</span>}
          </div>
        )}
        {asking && !writing && (
          <form className="again" onSubmit={(e) => { e.preventDefault(); onWrite(note); setNote(''); setAsking(false); }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} aria-label="What should the new test case check?" placeholder="What should it check? Such as: a merchant with two account changes" />
            <button type="submit" className="vbtn">Write it</button>
          </form>
        )}
      </div>
    </section>
  );
}

const W = 112, H = 22, GX = 36, GY = 6, HEAD = 15;

/**
 * The planted instances as a small graph, in columns by how late each one comes: an event that points at an earlier
 * one sits to its left. Each column holds its classes under their names, in the order that keeps lines straight. What
 * the answer names is green; what the test expects left out is dashed, and red if the answer names it anyway.
 */
function Planted({ s, p }: { s: Scenario; p: Proof }) {
  const nodes = s.nodes ?? [], links = (s.links ?? []).filter((l) => nodes.some((n) => n.ref === l.from) && nodes.some((n) => n.ref === l.to));
  if (!nodes.length) return null;
  const depth = new Map<string, number>();
  const deep = (ref: string, seen: Set<string>): number => {
    if (depth.has(ref)) return depth.get(ref)!;
    if (seen.has(ref)) return 0;
    seen.add(ref);
    const d = Math.max(0, ...links.filter((l) => l.from === ref).map((l) => 1 + deep(l.to, seen)));
    depth.set(ref, d);
    return d;
  };
  for (const n of nodes) deep(n.ref, new Set());
  const D = Math.max(0, ...depth.values());
  const cls = new Map(nodes.map((n) => [n.ref, n.class]));
  // Column by column, each instance sits level with what links to it from the left, so lines run straight.
  const row = new Map<string, number>(), at = new Map<string, [number, number]>(), heads: { x: number; y: number; t: string }[] = [];
  let height = 0;
  for (let c = 0; c <= D; c++) {
    const refs = nodes.filter((n) => D - depth.get(n.ref)! === c).map((n) => n.ref);
    const bary = (ref: string) => {
      const from = links.filter((l) => l.to === ref && row.has(l.from)).map((l) => row.get(l.from)!);
      return from.length ? from.reduce((a, b) => a + b, 0) / from.length : Infinity;
    };
    const groups = [...new Set(refs.map((r) => cls.get(r)!))].map((k) => ({ k, refs: refs.filter((r) => cls.get(r) === k) }))
      .map((g) => ({ ...g, b: Math.min(...g.refs.map(bary)) }))
      .sort((a, b) => (a.b === b.b ? 0 : a.b - b.b));
    let y = 0, slot = 0;
    for (const g of groups) {
      heads.push({ x: c * (W + GX), y: y + 10, t: g.k });
      y += HEAD;
      const ordered = [...g.refs].sort((a, b) => { const x = bary(a), z = bary(b); return x === z ? 0 : x - z; });
      for (const r of ordered) { at.set(r, [c * (W + GX), y]); row.set(r, slot++); y += H + GY; }
      y += 4;
    }
    height = Math.max(height, y);
  }
  const found = new Set(p.rows.flat().map(cell));
  const out = new Set((s.expect?.exclude ?? []).flatMap((x) => Object.values(x)).filter((x): x is string => typeof x === 'string' && x.startsWith('@')).map((x) => x.slice(1)));
  const width = (D + 1) * (W + GX) - GX;
  const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  return (
    <div className="xwrap">
      <svg className="pgraph" viewBox={`-2 0 ${width + 4} ${height}`} width={width + 4} height={height} role="img"
        aria-label={`The test case: ${nodes.length} planted instances and ${links.length} links`}>
        {heads.map((h, i) => <text key={i} className="ph" x={h.x} y={h.y}>{clip(h.t, 22)}</text>)}
        {links.map((l, i) => {
          const [x1, y1] = at.get(l.from)!, [x2, y2] = at.get(l.to)!;
          const fwd = x2 > x1, sx = fwd ? x1 + W : x1, ex = fwd ? x2 : x2 + W;
          return <motion.path key={i} className="pl" d={`M${sx},${y1 + H / 2} C${(sx + ex) / 2},${y1 + H / 2} ${(sx + ex) / 2},${y2 + H / 2} ${ex},${y2 + H / 2}`}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr({ duration: 0.4, delay: 0.1 + (x1 / (W + GX)) * 0.1, ease: EASE_OUT })} />;
        })}
        {nodes.map((n) => {
          const [x, y] = at.get(n.ref)!;
          const id = p.refs[n.ref];
          const named = !!id && found.has(id), excluded = out.has(n.ref);
          const state = excluded ? (named ? 'wrong' : 'miss') : named ? 'hit' : '';
          return (
            <motion.g key={n.ref} className={'pn ' + state} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={tr({ duration: 0.25, delay: (x / (W + GX)) * 0.1, ease: EASE_OUT })}>
              <title>{`@${n.ref}: ${n.class}${id ? `, ${id}` : ''}${state === 'hit' ? ', in the answer' : state === 'miss' ? ', left out, as expected' : state === 'wrong' ? ', in the answer, but the test expects it left out' : ''}`}</title>
              <rect x={x} y={y} width={W} height={H} rx={6} />
              <text x={x + 7} y={y + 14.5}>@{clip(n.ref, 6)}</text>
              {id && <text className="pc" x={x + W - 6} y={y + 14.5} textAnchor="end">{clip(id, 11)}</text>}
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
