import { App } from './shell/App';

const ARROW = 'M0,1 L9,5 L0,9 z';

/** The platform overview: the arrowheads its diagrams share, then the map, your path and the seven chapters. */
export function PlatformPage() {
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false"><defs>
        <marker id="mg-good" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d={ARROW} style={{ fill: 'var(--graph)' }} /></marker>
        <marker id="mg-mut" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d={ARROW} style={{ fill: 'var(--muted)' }} /></marker>
        <marker id="mg-onto" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d={ARROW} style={{ fill: 'var(--onto)' }} /></marker>
        <marker id="mg-isa" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M1,1 L11,6 L1,11 z" style={{ fill: 'var(--raised)', stroke: 'var(--muted)', strokeWidth: 1.3 }} /></marker>
        <marker id="mg-line" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d={ARROW} style={{ fill: 'var(--line)' }} /></marker>
        <marker id="mg-graph8" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d={ARROW} style={{ fill: 'var(--graph)' }} /></marker>
      </defs></svg>
      <main className="wrap"><App /></main>
    </>
  );
}
