import { rounded } from '../../kit/svg';
import { EDGES, NODES, W } from './map-data';
import { CH } from './path-data';

/** The whole map in miniature, with a chapter's part of it lit in the chapter's colour. */
export function MiniMap({ n }: { n: number }) {
  const c = CH.find((x) => x.n === n)!;
  const on = new Set(c.nodes || NODES.map((x) => x.id));
  return (
    <>
      {EDGES.map((e) => {
        const hot = on.has(e.f) && on.has(e.t);
        return <path key={e.id} d={rounded(e.p, 14)} fill="none" style={{ stroke: hot ? c.c : 'var(--line)', strokeWidth: hot ? 7 : 3.5, opacity: hot ? 1 : 0.8 }} />;
      })}
      {NODES.map((x) => {
        const hot = on.has(x.id);
        return <rect key={x.id} x={x.x} y={x.y} width={W} height={x.h} rx="12" style={{ fill: hot ? c.c : 'var(--faint)', stroke: hot ? c.c : 'var(--line)', strokeWidth: 3, opacity: hot ? 0.9 : 1 }} />;
      })}
    </>
  );
}
