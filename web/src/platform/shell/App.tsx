import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate } from 'motion/react';
import { reduce } from '../../kit/motion';
import { chapter1 } from '../ch1/Chapter1';
import { chapter2 } from '../ch2/Chapter2';
import { chapter3 } from '../ch3/Chapter3';
import { chapter4 } from '../ch4/Chapter4';
import { chapter5 } from '../ch5/Chapter5';
import { chapter6 } from '../ch6/Chapter6';
import { chapter7 } from '../ch7/Chapter7';
import { Watch } from '../shared/Chapter';
import { ChapterView } from './ChapterView';
import { MapView, type MapHandle } from './MapView';
import { PathView } from './PathView';
import { ProgressProvider, useProgress } from './progress';
import { Toc } from './Toc';

// The platform page: the map and your path, then seven chapters, one view at a time.
// Routes: #map, #chN, #chN:K for a chapter's sub-page, or any element's id, which shows the
// view (and sub-page) that holds it.

const CHAPTERS = [chapter1, chapter2, chapter3, chapter4, chapter5, chapter6, chapter7];
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** What the last route change still has to do once it has rendered. */
type Effects = { first: boolean; changed: boolean; order: number; dir: number; target: HTMLElement | null };
/** The view showing (0 for the map, N for chapter N; -1 before the first route), and each chapter's sub-page. */
type Route = { view: number; subs: number[]; fx: Effects | null };

/** A chapter's sub-pages as rendered: each block, then its check and next row together. */
const pagesOf = (ch: HTMLElement) => {
  const blocks = Array.from(ch.children).filter((e) => e.matches('section.block')).map((b) => [b]);
  return [...blocks, [ch.querySelector(':scope > .check')!, ch.querySelector(':scope > .chnext')!]];
};

export function App() {
  return <ProgressProvider><Page /></ProgressProvider>;
}

function Page() {
  const { done } = useProgress();
  const [route, setRoute] = useState<Route>({ view: -1, subs: CHAPTERS.map(() => 0), fx: null });
  const [here, setHere] = useState('');
  const routeRef = useRef(route);
  routeRef.current = route;
  const map = useRef<MapHandle>(null);

  const go = (first: boolean) => {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    let view = 0, idx: number | null = null, target: HTMLElement | null = null;
    const m = h.match(/^(ch\d+)(?::(\d+))?$/);
    if (m) {
      const ch = document.getElementById(m[1]);
      view = ch && ch.matches('section.chapter') ? Number(ch.dataset.ch) : 0;
      idx = m[2] ? Number(m[2]) - 1 : null;
    } else if (h) {
      target = document.getElementById(h);
      const ch = target?.closest<HTMLElement>('section.chapter');
      view = ch ? Number(ch.dataset.ch) : 0;
    }
    const prev = routeRef.current, changed = prev.view !== view, subs = [...prev.subs];
    let dir = 0;
    if (view !== 0) {
      const pages = pagesOf(document.getElementById('ch' + view)!), was = prev.subs[view - 1];
      if (idx === null && target) idx = Math.max(0, pages.findIndex((els) => els.some((e) => e.contains(target))));
      if (idx === null) idx = changed ? 0 : was;
      idx = Math.max(0, Math.min(pages.length - 1, idx));
      dir = changed ? 0 : idx > was ? 1 : idx < was ? -1 : 0;
      subs[view - 1] = idx;
    }
    if (changed) setHere(view === 0 ? '#map' : '#ch' + view);
    setRoute({ view, subs, fx: { first, changed, order: view - Math.max(prev.view, 0), dir, target } });
  };

  useLayoutEffect(() => {
    go(true);
    const on = () => go(false);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Once a route has rendered: slide the sub-page in, bring its tab into the bar, fade a new view
  // in, then scroll to the target or the top.
  useLayoutEffect(() => {
    const fx = route.fx;
    if (!fx) return;
    document.body.classList.toggle('in-chapter', route.view !== 0);
    const viewEl = route.view === 0 ? document.getElementById('home')! : document.getElementById('ch' + route.view)!;
    if (route.view !== 0) {
      const cur = route.subs[route.view - 1], shown = [...pagesOf(viewEl)[cur], viewEl.querySelector(':scope > .pager')!];
      if (fx.dir && !reduce) animate(shown, { opacity: [0, 1], x: [fx.dir * 32, 0] }, { duration: 0.34, ease: EASE });
      const tab = viewEl.querySelectorAll<HTMLElement>('.subtab')[cur], bar = tab.parentElement!;
      if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: tab.offsetLeft - bar.clientWidth / 2 + tab.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
    }
    if (fx.changed && !fx.first && !reduce) animate(viewEl, { opacity: [0, 1], y: [fx.order >= 0 ? 18 : -18, 0] }, { duration: 0.38, ease: EASE });
    if (route.view === 0 && fx.target && fx.target.id !== 'map') fx.target.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }, [route]);

  // Arrow keys page through a chapter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const r = routeRef.current;
      if (r.view <= 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
      const cur = r.subs[r.view - 1], count = CHAPTERS[r.view - 1].pages.length + 1;
      if (e.key === 'ArrowRight' && cur < count - 1) { location.hash = '#ch' + r.view + ':' + (cur + 2); e.preventDefault(); }
      if (e.key === 'ArrowLeft' && cur > 0) { location.hash = '#ch' + r.view + ':' + cur; e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /** "Watch it on the map": go to the map, then play the chapter's flow. */
  const watch = (flow: string) => {
    location.hash = '#map';
    setTimeout(() => { document.getElementById('map')!.scrollIntoView({ block: 'start' }); map.current?.playFlow(flow); }, reduce ? 50 : 350);
  };

  const v = route.view;
  return (
    <Watch.Provider value={watch}>
      <header hidden={v > 0}>
        <h1>One shared understanding of payments, for people and agents.</h1>
        <p className="lede">The platform is a payments knowledge layer: an ontology, a graph, a search layer and agents working as one. Start with the map to watch it move, then follow the seven chapters below. Each one lights up its part of the map.</p>
      </header>
      <Toc here={here} done={done} onHere={setHere} />
      <div className="view" id="home" hidden={v > 0}>
        <MapView ref={map} />
        <PathView />
      </div>
      {CHAPTERS.map((def) => <ChapterView key={def.n} def={def} hidden={v >= 0 && v !== def.n} cur={route.subs[def.n - 1]} />)}
      <footer>
        A learning sketch of a payments knowledge layer, built from public documentation for Neptune, OpenSearch and Bedrock as of September 2026. Check the Neptune release notes before building around the openCypher full-text search gap, since AWS may close it.
      </footer>
    </Watch.Provider>
  );
}
