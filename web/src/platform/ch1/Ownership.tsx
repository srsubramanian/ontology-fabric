import { inView } from 'motion/react';
import { useEffect, useRef } from 'react';
import { model } from '../../explorer/data';
import { anim, dl, hideAll, packet, wait } from './anim';

// Who owns it (decision 9): the core team owns the core, owning teams own their domain modules
// through CODEOWNERS, and any team adds extensions and promotes them when they're shared.
// The modules and their class counts are read from the LinkML draft's owner annotations.

const concrete = Object.values(model.classes).filter((c) => !c.abstract);
const count = (owner: string) => concrete.filter((c) => c.owner === owner).length;
const MODULES = [...new Set(concrete.map((c) => c.owner))]
  .filter((o) => o !== 'core')
  .map((o) => ({ owner: o, name: o[0].toUpperCase() + o.slice(1), n: count(o) }))
  .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
const CORE = count('core');

const MOD_X = (i: number) => 22 + i * 96;
const PROMOTE = `M382,48 C382,92 ${MOD_X(MODULES.length - 1) + 44},92 ${MOD_X(MODULES.length - 1) + 44},126`;

/** A change to a domain module, day by day: when each event shows, in seconds, and where. */
const DAYS = [0, 1, 2, 3, 4].map((i) => 30 + i * 90);
const WINDOW = 2.4;

export function Ownership() {
  const layers = useRef<SVGSVGElement>(null);
  const review = useRef<SVGSVGElement>(null);
  const pk = useRef<SVGGElement>(null);
  const promote = useRef<SVGPathElement>(null);
  const run = useRef(0);

  const play = async () => {
    const my = ++run.current, s = layers.current!, r = review.current!;
    const core = s.querySelector('.olcore'), dom = s.querySelector('.oldom'), ext = s.querySelector('.olext');
    const mods = s.querySelectorAll('.mod'), chips = s.querySelectorAll('.xchip'), prom = s.querySelectorAll('.prom, .promt');
    hideAll([core!, dom!, ext!, ...mods, ...chips, ...prom]);
    const events = r.querySelectorAll<SVGGElement>('.rwe'), merged = r.querySelector('.rwm')!;
    hideAll([...events, merged]);
    const fill = r.querySelector<SVGLineElement>('.rwf')!;
    fill.style.strokeDasharray = '360'; fill.style.strokeDashoffset = '360';

    anim(core, { opacity: [0, 1], y: [12, 0] }, { duration: 0.4 });
    anim(dom, { opacity: [0, 1], y: [12, 0] }, { duration: 0.4, delay: 0.3 });
    anim(mods, { opacity: [0, 1], scale: [0.8, 1] }, { duration: 0.3, delay: dl(0.5, 0.08) });
    anim(ext, { opacity: [0, 1], y: [12, 0] }, { duration: 0.4, delay: 0.9 });
    anim(chips, { opacity: [0, 1], scale: [0.6, 1] }, { duration: 0.3, delay: dl(1.1, 0.1) });
    await wait(1600); if (my !== run.current) return;
    anim(prom, { opacity: [0, 1] }, { duration: 0.3 });
    await packet(pk.current!, promote.current!, 'var(--onto)', 0.9); if (my !== run.current) return;
    anim(mods[mods.length - 1], { scale: [1, 1.08, 1] }, { duration: 0.4 });

    // The review window: a week passes, the owner stays silent, and the core team merges.
    anim(fill, { strokeDashoffset: [360, 0] }, { duration: WINDOW, ease: 'linear' });
    events.forEach((e) => anim(e, { opacity: [0, 1], y: [4, 0] }, { duration: 0.3, delay: Number(e.dataset.at) * WINDOW }));
    anim(merged, { opacity: [0, 1], scale: [0.4, 1.2, 1] }, { duration: 0.45, delay: WINDOW });
  };

  useEffect(() => inView(layers.current!, () => { play(); }, { amount: 0.35 }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="own">
      <svg viewBox="0 0 420 262" ref={layers} role="img"
        aria-label={`Three layers of ownership: the core, owned by the core team; domain modules (${MODULES.map((m) => m.name).join(', ')}) owned by their teams through CODEOWNERS; and team extensions, which any team adds and promotes when shared`}>
        <g className="olext">
          <rect className="ol ext" x="10" y="10" width="400" height="62" rx="12" />
          <text className="olt" x="26" y="35">Team extensions</text>
          <text className="ols" x="26" y="53">Any team adds its own, freely</text>
        </g>
        {[262, 312, 362].map((x) => <rect key={x} className="xchip" x={x} y="30" width="40" height="18" rx="9" />)}
        <g className="oldom">
          <rect className="ol dom" x="10" y="96" width="400" height="76" rx="12" />
          <text className="olt" x="26" y="117">Domain modules</text>
          <text className="ols" x="152" y="117">owned through CODEOWNERS</text>
        </g>
        {MODULES.map((m, i) => (
          <g key={m.owner} className="mod">
            <rect x={MOD_X(i)} y="128" width="88" height="34" rx="8" />
            <text className="mt" x={MOD_X(i) + 10} y="143">{m.name}</text>
            <text className="mc" x={MOD_X(i) + 10} y="156">{m.n} {m.n === 1 ? 'class' : 'classes'}</text>
          </g>
        ))}
        <g className="olcore">
          <rect className="ol core" x="10" y="186" width="400" height="66" rx="12" />
          <text className="olt" x="26" y="212">Core</text>
          <text className="ols" x="26" y="232">{CORE} classes, owned by the core team</text>
        </g>
        <path className="prom" d={PROMOTE} markerEnd="url(#mg-onto)" ref={promote} />
        <text className="promt" x="362" y="88">promote when shared</text>
        <g ref={pk} aria-hidden="true"></g>
      </svg>
      <p className="vcap">Review windows: silence isn't a veto</p>
      <svg viewBox="0 0 420 96" ref={review} role="img" aria-label="A pull request to a domain module opens on day 1, gets a comment on day 2, the owner stays silent on days 3 and 4, and the core team merges on day 5">
        <line className="rwt" x1="30" y1="52" x2="390" y2="52" />
        <line className="rwf" x1="30" y1="52" x2="390" y2="52" />
        {DAYS.map((x, i) => (
          <g key={x}><circle className="rwd" cx={x} cy="52" r="4.5" /><text className="rwl" x={x} y="78">Day {i + 1}</text></g>
        ))}
        <g className="rwe" data-at="0"><text className="rwt1 l" x={DAYS[0] - 14} y="34">PR opened</text></g>
        <g className="rwe" data-at="0.25"><text className="rwt1" x={DAYS[1] + 6} y="34">comment</text></g>
        <g className="rwe quiet" data-at="0.6">
          <path className="rwb" d={`M${DAYS[2]},40 L${DAYS[2]},36 L${DAYS[3]},36 L${DAYS[3]},40`} />
          <text className="rwt1" x={(DAYS[2] + DAYS[3]) / 2} y="28">owner silent</text>
        </g>
        <g className="rwe" data-at="1"><text className="rwt1 go r" x={DAYS[4] + 20} y="34">core merges</text></g>
        <g className="rwm"><circle cx={DAYS[4]} cy="52" r="9" /><text x={DAYS[4]} y="56">✓</text></g>
      </svg>
      <div className="vbtns"><button type="button" className="vbtn" onClick={play}>Replay</button></div>
    </div>
  );
}
