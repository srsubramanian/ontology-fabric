import { Fragment, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { anim, dl, hideAll, tween, wait } from '../shared/anim';
import { DeepDive, XPanel, useDeepDive, type DDStep } from '../shared/DeepDive';
import { linesHtml } from '../shared/lines';

// Deep dive: how a version number tells every consumer what changed, and how OpenSearch switches
// to a rebuilt index without anyone noticing.

const STEPS: DDStep[] = [
  { t: 'Version numbers', k: ['Three numbers: major, minor, patch', 'The kind of change picks which one moves', 'Anything short of major is safe to take'] },
  { t: 'Who pins what', k: ['Each consumer pins a version or a range', 'Minor and patch releases flow in automatically', 'A major release needs a migration window'] },
  { t: 'Alias swap', k: ['Queries use the alias, never the index name', 'The new index is built and tested alongside', 'One atomic call moves the alias'] },
  { t: 'Release runbook', k: ['Snapshot first, swap last', 'Keep the old indexes until the new ones prove out', 'Rollback is the same call in reverse'] },
];

/** Changes to try: which number moves (0 major, 1 minor, 2 patch), and why. */
const CHANGES: [label: string, k: number, why: string][] = [
  ['Fix a typo in a definition', 2, 'A typo fixed in a definition changes no structure: patch.'],
  ['Add an alias', 2, 'An alias only helps search find a class: patch.'],
  ['Add a class', 1, 'A new class adds meaning without breaking anyone: minor.'],
  ['Add a relationship', 1, 'A new relationship is additive, so existing queries still work: minor.'],
  ['Rename a class', 0, 'Renaming breaks every query and mapping that used the old name: major.'],
  ['Split Merchant', 0, 'Splitting Merchant changes what existing nodes mean: major.'],
];
const PARTS = ['major', 'minor', 'patch'];

const JSWAP = 'POST /_aliases\n{\n  "actions": [\n    { "remove": { "index": "entities_v1_6", "alias": "entities" } },\n    { "add":    { "index": "entities_v1_7", "alias": "entities" } }\n  ]\n}';
const JBACK = 'POST /_aliases\n{\n  "actions": [\n    { "remove": { "index": "entities_v1_7", "alias": "entities" } },\n    { "add":    { "index": "entities_v1_6", "alias": "entities" } }\n  ]\n}';

type Btn = { disabled: boolean; go: boolean };
const START = { build: { disabled: false, go: true }, swap: { disabled: true, go: false }, back: { disabled: true, go: false } };

export function Versions() {
  const api = useDeepDive();
  const q = (sel: string) => api.root!.querySelector<HTMLElement>(sel)!;
  const html = useMemo(() => ({ swap: linesHtml(JSWAP, 'opensearch'), back: linesHtml(JBACK, 'opensearch') }), []);

  // ---------- Step 1: which number moves ----------
  const verRef = useRef([1, 6, 0]);
  const [digits, setDigits] = useState([1, 6, 0]);
  const [hot, setHot] = useState(-1);
  const [why, setWhy] = useState('');
  const bump = async (k: number, text: string) => {
    const ver = verRef.current;
    ver[k]++;
    for (let j = k + 1; j < 3; j++) ver[j] = 0;
    const moved = Array.from(api.root!.querySelectorAll('#x6ver .vd b')).slice(k);
    await anim(moved, { y: [0, -14], opacity: [1, 0] }, { duration: 0.18 });
    flushSync(() => setDigits([...ver]));
    anim(moved, { y: [14, 0], opacity: [0, 1] }, { duration: 0.25 });
    anim(moved[0].parentElement, { scale: [1, 1.12, 1] }, { duration: 0.4 });
    flushSync(() => { setHot(k); setWhy(text); });
    anim(q('#x6why'), { opacity: [0, 1] }, { duration: 0.3 });
  };

  // ---------- Step 2: a major release needs a migration ----------
  const release = async () => {
    const mj = q('#x6major'), m1 = q('#x6mig1'), m2 = q('#x6mig2');
    mj.style.opacity = '0'; m1.style.opacity = '0'; m2.style.opacity = '0';
    await wait(300);
    await anim(mj, { opacity: [0, 1], scale: [0.4, 1.2, 1] }, { duration: 0.5 });
    anim(m1, { opacity: [0, 1], x: [-10, 0] }, { duration: 0.35, delay: 0.2 });
    anim(m2, { opacity: [0, 1], x: [-10, 0] }, { duration: 0.35, delay: 0.4 });
  };

  // ---------- Step 3: build, swap, roll back ----------
  const [btn, setBtn] = useState<{ build: Btn; swap: Btn; back: Btn }>(START);
  const [startOver, setStartOver] = useState(false);
  const [st, setSt] = useState({ a: 'live', b: 'not built yet' });
  const [json, setJson] = useState<'swap' | 'back'>('swap');
  const btnRef = useRef(btn);
  btnRef.current = btn;
  const set = (b: Partial<typeof btn>) => flushSync(() => setBtn((x) => ({ ...x, ...b })));
  const resetAlias = () => {
    q('#x6arA').style.opacity = '1'; q('#x6arB').style.opacity = '0'; q('#x6ixA').style.opacity = '1'; q('#x6ixB').style.opacity = '0.35';
    q('#x6fill').setAttribute('width', '0');
    setSt({ a: 'live', b: 'not built yet' }); setBtn(START); setJson('swap');
  };
  const build = async () => {
    if (startOver) { setStartOver(false); resetAlias(); return; }
    set({ build: { disabled: true, go: false } });
    anim(q('#x6ixB'), { opacity: [0.35, 1] }, { duration: 0.3 });
    setSt((s) => ({ ...s, b: 'backfilling from Neptune' }));
    const fill = q('#x6fill');
    await tween({ duration: 1.6, onUpdate: (v) => fill.setAttribute('width', (100 * v).toFixed(1)) });
    setSt((s) => ({ ...s, b: 'built, competency questions pass' }));
    set({ swap: { disabled: false, go: true } });
  };
  const swap = async () => {
    set({ swap: { disabled: true, go: false } });
    flushSync(() => setJson('swap')); anim(q('#x6json'), { opacity: [0.3, 1] }, { duration: 0.3 });
    anim(q('#x6pill'), { scale: [1, 1.08, 1] }, { duration: 0.4 });
    anim(q('#x6arA'), { opacity: 0 }, { duration: 0.3 }); await anim(q('#x6arB'), { opacity: [0, 1] }, { duration: 0.4 });
    setSt({ a: 'standby, kept for rollback', b: 'live' }); anim(q('#x6ixA'), { opacity: 0.55 }, { duration: 0.3 });
    set({ back: { disabled: false, go: true } });
  };
  const back = async () => {
    set({ back: { disabled: true, go: false } });
    flushSync(() => setJson('back')); anim(q('#x6json'), { opacity: [0.3, 1] }, { duration: 0.3 });
    anim(q('#x6arB'), { opacity: 0 }, { duration: 0.3 }); await anim(q('#x6arA'), { opacity: [0, 1] }, { duration: 0.4 });
    anim(q('#x6ixA'), { opacity: 1 }, { duration: 0.3 });
    setSt({ a: 'live again', b: 'standby, investigate' });
    setTimeout(() => { set({ build: { disabled: false, go: true } }); setStartOver(true); }, 400);
  };
  const cls = (b: Btn) => 'vbtn' + (b.go ? ' go' : '');

  const run = {
    1: () => { anim(api.root!.querySelectorAll('#x6ver .vd'), { opacity: [0, 1], y: [10, 0] }, { duration: 0.35, delay: dl(0, 0.12) }); },
    2: () => { release(); },
    3: () => { const b = btnRef.current; if (b.build.disabled && b.swap.disabled && b.back.disabled) resetAlias(); },
    4: () => {
      const li = api.root!.querySelectorAll('#x6run li'), rb = q('#x6rb');
      hideAll(li); rb.style.opacity = '0';
      anim(li, { opacity: [0, 1], x: [-10, 0] }, { duration: 0.35, delay: dl(0.1, 0.3) });
      anim(rb, { opacity: [0, 1], y: [8, 0] }, { duration: 0.4, delay: 1.8 });
    },
  };

  return (
    <DeepDive api={api} id="dd6" title="Deep dive: versions and alias swaps" steps={STEPS} run={run}
      intro="How a version number tells every consumer what changed, and how OpenSearch switches to a rebuilt index without anyone noticing."
      next={{ href: '#loop', label: 'Next: the continuous loop' }}>
      <XPanel n={1}>
        <div className="verbig" id="x6ver">
          {PARTS.map((part, i) => (
            <Fragment key={part}>
              {i > 0 && <span className="vdot">.</span>}
              <div className={'vd' + (hot === i ? ' hot' : '')} data-i={i}><b>{digits[i]}</b><small>{part}</small></div>
            </Fragment>
          ))}
        </div>
        <p className="vcap" style={{ textAlign: 'center' }}>Pick a change to see which number moves</p>
        <div className="vbtns chg" id="x6chg">
          {CHANGES.map(([label, k, text]) => <button key={label} type="button" className="vbtn" data-k={k} data-t={text} onClick={() => bump(k, text)}>{label}</button>)}
        </div>
        <p className="reading" id="x6why" style={{ textAlign: 'center' }}>{why}</p>
      </XPanel>
      <XPanel n={2}>
        <div className="xwrap"><svg id="x6pins" className="xsvg" viewBox="0 0 760 266" role="img" aria-label="Release timeline with three consumers pinning different version ranges">
          <path className="gmain" d="M40,50 L730,50" />
          <g className="rel6"><circle cx="90" cy="50" r="8" /><text x="90" y="30">1.5.0</text></g>
          <g className="rel6"><circle cx="230" cy="50" r="8" /><text x="230" y="30">1.6.0</text></g>
          <g className="rel6"><circle cx="370" cy="50" r="8" /><text x="370" y="30">1.6.1</text></g>
          <g className="rel6"><circle cx="510" cy="50" r="8" /><text x="510" y="30">1.7.0</text></g>
          <g className="rel6 major" id="x6major"><circle cx="660" cy="50" r="10" /><text x="660" y="30">2.0.0</text></g>
          <g className="pin"><text className="evt" x="40" y="110">Analyst UI</text><text className="evs mono" x="40" y="128">^1.6, any 1.x from 1.6</text><path className="bracket" d="M230,118 L590,118" /><circle className="pinend" cx="230" cy="118" r="5" /><circle className="pinend" cx="590" cy="118" r="5" /></g>
          <g className="pin"><text className="evt" x="40" y="170">Partner bank</text><text className="evs mono" x="40" y="188">=1.6.0, exact</text><circle className="pinend" cx="230" cy="178" r="7" /></g>
          <g className="pin"><text className="evt" x="40" y="230">Retrieval service</text><text className="evs mono" x="40" y="248">follows the latest</text><path className="bracket follow" d="M230,238 L700,238" /><circle className="pinend" cx="230" cy="238" r="5" /></g>
          <g className="mig" id="x6mig1" opacity="0"><rect x="600" y="106" width="130" height="24" rx="12" /><text x="665" y="122">migration needed</text></g>
          <g className="mig" id="x6mig2" opacity="0"><rect x="600" y="166" width="130" height="24" rx="12" /><text x="665" y="182">migration needed</text></g>
        </svg></div>
        <div className="vbtns"><button type="button" className="vbtn go" id="x6rel" onClick={release}>Release 2.0.0</button></div>
      </XPanel>
      <XPanel n={3}>
        <div className="xwrap"><svg id="x6alias" className="xsvg" viewBox="0 0 760 230" role="img" aria-label="Queries use the alias entities, which points to one versioned index at a time">
          <g><rect className="evbox" x="20" y="80" width="140" height="52" rx="10" /><text className="evt" x="90" y="104" textAnchor="middle">Queries</text><text className="evs" x="90" y="121" textAnchor="middle">agents, analysts</text></g>
          <path className="rel" d="M160,106 L239,106" markerEnd="url(#mg-onto)" />
          <g id="x6pill"><rect className="aliaspill" x="240" y="84" width="150" height="44" rx="22" /><text className="evt mono" x="315" y="111" textAnchor="middle">entities</text></g>
          <path id="x6arA" className="aliasarr" d="M390,106 C440,106 440,52 499,52" markerEnd="url(#mg-onto)" />
          <path id="x6arB" className="aliasarr" d="M390,106 C440,106 440,166 499,166" markerEnd="url(#mg-onto)" opacity="0" />
          <g id="x6ixA"><rect className="evbox" x="500" y="24" width="240" height="56" rx="10" /><rect x="508" y="36" width="3" height="32" rx="1.5" style={{ fill: 'var(--search)' }} /><text className="evt mono" x="522" y="48">entities_v1_6</text><text className="evs" id="x6stA" x="522" y="68">{st.a}</text></g>
          <g id="x6ixB" opacity="0.35"><rect className="evbox" x="500" y="138" width="240" height="56" rx="10" /><rect x="508" y="150" width="3" height="32" rx="1.5" style={{ fill: 'var(--search)' }} /><text className="evt mono" x="522" y="162">entities_v1_7</text><text className="evs" id="x6stB" x="522" y="182">{st.b}</text><rect className="pbar" x="620" y="175" width="100" height="8" rx="4" /><rect className="pfill" id="x6fill" x="620" y="175" width="0" height="8" rx="4" /></g>
        </svg></div>
        <div className="vbtns">
          <button type="button" className={cls(btn.build)} id="x6build" disabled={btn.build.disabled} onClick={build}>{startOver ? 'Start over' : '1. Build v1.7'}</button>
          <button type="button" className={cls(btn.swap)} id="x6swap" disabled={btn.swap.disabled} onClick={swap}>2. Swap the alias</button>
          <button type="button" className={cls(btn.back)} id="x6back" disabled={btn.back.disabled} onClick={back}>3. Roll back</button>
        </div>
        <div className="ddcode"><pre id="x6json" dangerouslySetInnerHTML={{ __html: html[json] }} /></div>
      </XPanel>
      <XPanel n={4}>
        <ol className="runbook" id="x6run">
          <li><b>Snapshot Neptune</b><span>A manual cluster snapshot, taken before anything changes</span></li>
          <li><b>Build the new indexes</b><span>entities, chunks and ontology, suffixed _v1_7, backfilled from Neptune</span></li>
          <li><b>Run the competency questions</b><span>Against the new indexes, before any traffic sees them</span></li>
          <li><b>Swap the three aliases together</b><span>One atomic _aliases call</span></li>
          <li><b>Watch, then clean up</b><span>Keep the v1_6 indexes until the new ones have proved themselves</span></li>
        </ol>
        <div className="rollback" id="x6rb"><b>If something goes wrong</b><span>Move the aliases back in one call. For graph data, restore the snapshot; Neptune restores to a new cluster, so the cutover is a switch too.</span></div>
      </XPanel>
    </DeepDive>
  );
}
