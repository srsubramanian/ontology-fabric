import { useEffect, useMemo, useRef, useState } from 'react';
import { vars } from '../kit/css';
import { reduce } from '../kit/motion';
import { hashFor, isShowing, useHash } from '../kit/route';
import { useReplay } from '../kit/useTimeline';
import { ClassMap, STORE, type Lens } from './ClassMap';
import { model } from './data';
import { Panel } from './Details';
import type { LivesIn } from './model';

const LENSES: [Lens, string][] = [['relationships', 'Relationships'], ['lives', 'Where it lives'], ['owner', 'Who owns it']];
const OWNERS = [...new Set(Object.values(model.classes).map((c) => c.owner))];
const go = (target: string) => { location.hash = hashFor('explorer', target); };

/** Classes whose name or aliases contain the query. */
function search(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return Object.values(model.classes)
    .map((c) => ({ c, alias: c.aliases.find((a) => a.toLowerCase().includes(q)) }))
    .filter(({ c, alias }) => c.name.toLowerCase().includes(q) || alias)
    .sort((a, b) => Number(!a.c.name.toLowerCase().startsWith(q)) - Number(!b.c.name.toLowerCase().startsWith(q)));
}

/** A class plus what it touches: its parents, its subclasses, and the classes at the far end of its relationships. */
function neighbourhood(name: string) {
  const c = model.classes[name];
  const edges = model.relationships.filter((r) => c.chain.includes(r.from) || c.chain.includes(r.to));
  // A relationship open to any class has no box at its far end.
  const ends = new Set(edges.flatMap((r) => (r.open ? [r.from] : [r.from, r.to])));
  const lit = new Set<string>([...c.chain, ...ends]);
  const addKids = (n: string) => model.classes[n].children.forEach((k) => { lit.add(k); addKids(k); });
  // An abstract class at the far end stands for all its subclasses; the class's own parents don't.
  [...ends].filter((n) => model.classes[n].abstract && !c.chain.includes(n)).forEach(addKids);
  if (c.abstract) addKids(name);
  return { lit, edges: edges.map((r) => r.id) };
}

export function App() {
  const hash = useHash('explorer');
  const selected = Object.hasOwn(model.classes, hash) ? model.classes[hash] : undefined;
  const question = model.questions.find((q) => q.id === hash);
  const [lens, setLens] = useState<Lens>('relationships');
  const [owner, setOwner] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [run, replay] = useReplay();
  const matches = useMemo(() => search(query), [query]);
  // The question tracer: null shows the whole walk; a number shows the walk up to that step.
  const [trace, setTrace] = useState<{ id: string; step: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const step = question && trace?.id === question.id ? trace.step : null;
  const mapWrap = useRef<HTMLDivElement>(null);
  const target = selected?.name ?? question?.steps[0]?.named;

  // On a narrow screen the map scrolls sideways: bring the picked class into view.
  useEffect(() => {
    const wrap = mapWrap.current;
    const el = target && wrap?.querySelector(`[data-class="${target}"]`);
    if (!wrap || !el || wrap.scrollWidth <= wrap.clientWidth) return;
    const w = wrap.getBoundingClientRect(), r = el.getBoundingClientRect();
    wrap.scrollTo({ left: wrap.scrollLeft + r.left + r.width / 2 - (w.left + w.width / 2), behavior: reduce ? 'auto' : 'smooth' });
  }, [target]);

  // What stays bright: search results while typing, else the selection, else the owner filter.
  const focus = useMemo(() => {
    if (query.trim()) return { key: 'q:' + query, lit: new Set(matches.map((m) => m.c.name)), edges: [] as string[] };
    if (selected) return { key: 'c:' + selected.name, ...neighbourhood(selected.name) };
    if (question?.steps.length) {
      const walked = question.steps.slice(0, step === null ? question.steps.length : step + 1);
      const lit = new Set(walked.flatMap((s) => [s.named, s.relationship.from, s.relationship.to]));
      if (!walked.length) lit.add(question.steps[0].named);
      return { key: 'w:' + question.id, lit, edges: [...new Set(walked.map((s) => s.relationship.id))] };
    }
    if (lens === 'owner' && owner) {
      return { key: 'o:' + owner, lit: new Set(Object.values(model.classes).filter((c) => c.owner === owner).map((c) => c.name)), edges: [] };
    }
    return { key: 'none', lit: null, edges: [] };
  }, [query, matches, selected, question, step, lens, owner]);

  // Playing the walk adds one step at a time, then stops on the last.
  useEffect(() => {
    if (!playing || !question) return;
    const at = trace?.id === question.id ? trace.step : -1;
    if (at >= question.steps.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setTrace({ id: question.id, step: at + 1 }), at < 0 ? 600 : 1300);
    return () => clearTimeout(timer);
  }, [playing, question, trace]);
  // A new question starts from its whole walk.
  useEffect(() => { setPlaying(false); setTrace(null); }, [question?.id]);

  // Escape clears the search and the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isShowing('explorer')) { setQuery(''); if (hash) go('map'); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hash]);

  const pick = (name: string) => { setQuery(''); go(name); };
  const concrete = Object.values(model.classes).filter((c) => !c.abstract);

  return (
    <main className="wrap wide">
      <header>
        <h1>The payments ontology, class by class.</h1>
        <p className="lede">An illustrative draft, read straight from its LinkML source, <code>ontology/payments.yaml</code>. Boxes are classes, dashed frames are abstract parents, and arrows are relationships, each stored in one direction.</p>
        <p className="stats">
          <span><b>{Object.keys(model.classes).length}</b> classes</span>
          <span><b>{model.relationships.length}</b> relationships</span>
          <span><b>{model.questions.length}</b> competency questions</span>
          <span>version <b>{model.version}</b></span>
        </p>
      </header>

      <div className="toolbar">
        <div className="find">
          <input type="search" value={query} placeholder="Find a class or alias, such as CB or BIN" aria-label="Find a class by name or alias"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) pick(matches[0].c.name); }} />
          {query.trim() && (
            <div className="found" aria-label="Matching classes">
              {matches.length
                ? matches.slice(0, 6).map(({ c, alias }) => (
                  <button key={c.name} type="button" onClick={() => pick(c.name)}>
                    {c.name}{alias && <span className="muted"> · also called {alias}</span>}
                  </button>
                ))
                : <span className="muted">No class or alias matches.</span>}
            </div>
          )}
        </div>
        <div className="seg" role="group" aria-label="Colour the map by">
          {LENSES.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={lens === id} onClick={() => { setLens(id); setOwner(null); }}>{label}</button>
          ))}
        </div>
        <button type="button" className="vbtn" onClick={replay}>Replay</button>
      </div>

      <div className="explore">
        <div className="mapcol">
          <div className="xwrap" ref={mapWrap}>
            <ClassMap model={model} lens={lens} lit={focus.lit} litEdges={focus.edges} selected={selected?.name}
              focusKey={focus.key} stagger={step === null} run={run} onPick={pick} onClear={() => go('map')} />
          </div>
          <div className="legend">
            {lens === 'relationships' && (
              <>
                <span><i className="lg-box" />class</span>
                <span><i className="lg-frame" />abstract parent: its label goes on every subclass</span>
                <span><i className="lg-arrow" />relationship, stored in one direction</span>
              </>
            )}
            {lens === 'lives' && (Object.keys(STORE) as LivesIn[]).map((k) => (
              <span key={k} style={vars({ '--c': STORE[k].color })}><i />{STORE[k].label} · {concrete.filter((c) => c.livesIn === k).length}</span>
            ))}
            {lens === 'owner' && OWNERS.map((o) => (
              <button key={o} type="button" className="ownerchip" aria-pressed={owner === o} onClick={() => setOwner(owner === o ? null : o)}>
                {o} · {Object.values(model.classes).filter((c) => c.owner === o).length}
              </button>
            ))}
          </div>
        </div>
        <aside className="panel" aria-live="polite">
          <Panel model={model} selected={selected} question={question}
            onPick={pick} onQuestion={(id) => { setQuery(''); go(id); }} onHome={() => go('map')}
            trace={{
              step, playing,
              onStep: (n) => { setPlaying(false); setTrace(question && n !== null ? { id: question.id, step: n } : null); },
              onPlay: () => { if (question) { setTrace({ id: question.id, step: -1 }); setPlaying(true); } },
            }} />
        </aside>
      </div>

      <footer>An illustrative draft ontology for learning, written down from what the overview and retrieval walkthrough already show, and now growing into the real core. IDs and examples are illustrative. Standard mappings were checked in September 2026 against FIBO 2026 Q2, OMG Commons 20250801 and the current ISO 20022 card messages.</footer>
    </main>
  );
}
