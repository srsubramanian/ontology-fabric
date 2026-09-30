import { animate } from 'motion/react';
import { useEffect, useRef, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { vars } from '../kit/css';
import { EASE_OUT, reduce, tr } from '../kit/motion';
import { useHash } from '../kit/useHash';
import { LAST, STAGES } from './data';
import { RetrievalMap } from './Map';
import { S1Arrive } from './stages/S1Arrive';
import { S2Understand } from './stages/S2Understand';
import { S3EntryPoints } from './stages/S3EntryPoints';
import { S4WalkGraph } from './stages/S4WalkGraph';
import { S5CountGraph } from './stages/S5CountGraph';
import { S6Warehouse } from './stages/S6Warehouse';
import { S7FindText } from './stages/S7FindText';
import { S8Assemble } from './stages/S8Assemble';
import { S9Answer } from './stages/S9Answer';
import { S10Check } from './stages/S10Check';
import { S11Watch } from './stages/S11Watch';

const PAGES: ComponentType[] = [S1Arrive, S2Understand, S3EntryPoints, S4WalkGraph, S5CountGraph, S6Warehouse, S7FindText, S8Assemble, S9Answer, S10Check, S11Watch];

/** Stage number for a view id like 's4', or 0 for the map. */
const stageOf = (view: string) => (view === 'map' ? 0 : Number(view.slice(1)));
const toView = (hash: string) => (/^s([1-9]|1[01])$/.test(hash) ? hash : 'map');
const initialView = toView(location.hash.slice(1));

/** One view. Only the current view is visible; it slides in when the reader arrives from another view. */
function View({ id, current, className, label, style, children }: {
  id: string; current: boolean; className: string; label?: string; style?: CSSProperties; children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const loaded = useRef(false);
  useEffect(() => {
    if (current && loaded.current && ref.current) {
      animate(ref.current, { opacity: [0, 1], y: [14, 0] }, tr({ duration: 0.35, ease: EASE_OUT }));
    }
    loaded.current = true;
  }, [current]);
  return <section ref={ref} className={className} id={id} aria-label={label} style={style} hidden={!current}>{children}</section>;
}

function Toc({ view }: { view: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const toc = ref.current, here = toc?.querySelector<HTMLElement>('a.here');
    if (toc && here && toc.scrollWidth > toc.clientWidth) {
      toc.scrollTo({ left: here.offsetLeft - toc.clientWidth / 2 + here.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [view]);
  const links = [['map', 'Map'], ...STAGES.map((s, i) => ['s' + (i + 1), i + 1 + ' ' + s.title])];
  return (
    <nav className="toc" id="toc" aria-label="Stages" ref={ref}>
      {links.map(([id, text]) => <a key={id} href={'#' + id} className={id === view ? 'here' : undefined}>{text}</a>)}
    </nav>
  );
}

function Pager({ n }: { n: number }) {
  if (!n) return <div className="pager" id="pager" hidden />;
  return (
    <div className="pager" id="pager">
      {n > 1
        ? <a className="vbtn" href={'#s' + (n - 1)}>Previous: {STAGES[n - 2].title}</a>
        : <a className="vbtn" href="#map">Back to the map</a>}
      {n < LAST
        ? <a className="vbtn go" href={'#s' + (n + 1)}>Next: {STAGES[n].title}</a>
        : <a className="vbtn go" href="#map">Back to the map</a>}
    </div>
  );
}

export function App() {
  const view = toView(useHash());
  const n = stageOf(view);

  useEffect(() => {
    document.body.classList.toggle('inpage', n > 0);
    window.scrollTo(0, 0);
  }, [n]);

  // Arrow keys move between stages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!n || e.altKey || e.ctrlKey || e.metaKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '')) return;
      if (e.key === 'ArrowRight' && n < LAST) { location.hash = '#s' + (n + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft' && n > 1) { location.hash = '#s' + (n - 1); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [n]);

  return (
    <main className="wrap">
      <header id="hero" hidden={n > 0}>
        <h1>How a question becomes an answer.</h1>
        <p className="lede">The retrieval path of the payments knowledge layer, now with the warehouse in the loop: Neptune for how things connect, Snowflake for how much and how often, OpenSearch for what the text says. Pick a question to see its route, then open any stage.</p>
        <p style={{ margin: '-10px 0 24px' }}>
          <a className="vbtn" href="platform.html" target="_blank" rel="noopener">Open the platform overview</a>{' '}
          <a className="vbtn" href="ontology.html" target="_blank" rel="noopener">Open the class explorer</a>
        </p>
      </header>
      <Toc view={view} />

      {/* The map stays mounted so the chosen question survives a visit to a stage. */}
      <View id="map" className="view" label="Retrieval map" current={n === 0}>
        <RetrievalMap autoplay={initialView === 'map'} />
      </View>

      {/* A stage mounts when shown, which starts its animation. */}
      {PAGES.map((Page, i) => (
        <View key={i} id={'s' + (i + 1)} className="view page" current={n === i + 1} style={vars({ '--c': STAGES[i].color })}>
          {n === i + 1 && <Page />}
        </View>
      ))}

      <Pager n={n} />
      <footer>A learning sketch of the retrieval path in a payments knowledge layer, built from public documentation as of September 2026. VAMP thresholds reflect Visa’s April 2026 rules; merchant names, IDs, counts, scores and timings are illustrative. Part of the <a href="platform.html" target="_blank" rel="noopener">payments knowledge layer overview</a>.</footer>
    </main>
  );
}
