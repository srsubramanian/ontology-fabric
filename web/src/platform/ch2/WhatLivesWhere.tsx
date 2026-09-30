import { inView } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { reduce } from '../../kit/motion';
import { anim, wait } from '../shared/anim';
import { Block } from '../shared/Block';

// What lives where: sort example records into Neptune, where they already sit, or search only.

type Bin = 'graph' | 'place' | 'search';
const CHIPS: { b: string; s: string; to: Bin }[] = [
  { b: 'Chargeback cb:1001', s: 'lineage walks through it', to: 'graph' },
  { b: 'Every authorization', s: 'billions a year, mostly counted', to: 'place' },
  { b: 'Merchant m:88213', s: 'many links to follow', to: 'graph' },
  { b: 'Visa rules, chapter 11', s: 'long text', to: 'search' },
  { b: 'Authorization auth:5521', s: 'disputed, so it joins the graph', to: 'graph' },
  { b: 'Daily settlement files', s: 'already in S3', to: 'place' },
  { b: 'Reason code 10.4', s: 'where rules and disputes meet', to: 'graph' },
  { b: 'Dispute runbook', s: 'long text', to: 'search' },
];
const BINS: { bin: Bin; c: string; title: string; sub: string }[] = [
  { bin: 'graph', c: 'var(--graph)', title: 'Materialize in Neptune', sub: 'you walk through it or reason over it' },
  { bin: 'place', c: 'var(--muted)', title: 'Read where it sits', sub: 'huge and mostly counted, linked by ID' },
  { bin: 'search', c: 'var(--search)', title: 'Search only', sub: 'long text, a small stub in Neptune' },
];
type Spots = Record<'pool' | Bin, number[]>;
const START: Spots = { pool: CHIPS.map((_, i) => i), graph: [], place: [], search: [] };

export function WhatLivesWhere() {
  const [spots, setSpots] = useState(START);
  const [empty, setEmpty] = useState(false);
  const root = useRef<HTMLElement>(null), note = useRef<HTMLParagraphElement>(null);
  const sorted = useRef(false), run = useRef(0);
  const chip = (i: number) => root.current!.querySelector<HTMLElement>(`.wchip[data-i="${i}"]`)!;
  const hideNote = () => { if (!reduce) note.current!.style.opacity = '0'; };

  /** Moves a chip into a bin, sliding it from where it was. */
  const flip = (i: number, to: Bin) => {
    const a = chip(i).getBoundingClientRect();
    flushSync(() => setSpots((s) => {
      const out = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.filter((x) => x !== i)])) as Spots;
      out[to] = [...out[to], i];
      return out;
    }));
    const b = chip(i).getBoundingClientRect();
    return anim(chip(i), { x: [a.left - b.left, 0], y: [a.top - b.top, 0] }, { duration: 0.55, ease: [0.22, 1, 0.36, 1] });
  };
  const reset = () => { run.current++; sorted.current = false; setEmpty(false); setSpots(START); hideNote(); };
  const sort = async () => {
    if (sorted.current) return;
    sorted.current = true;
    const my = ++run.current;
    for (let i = 0; i < CHIPS.length; i++) {
      if (my !== run.current) return;
      flip(i, CHIPS[i].to);
      await wait(230);
    }
    await wait(400); if (my !== run.current) return;
    flushSync(() => setEmpty(true));
    anim(note.current, { opacity: [0, 1], y: [8, 0] }, { duration: 0.4 });
  };

  useLayoutEffect(hideNote, []);
  useEffect(() => inView(root.current!, () => { if (!sorted.current) setTimeout(sort, 400); }, { amount: 0.3 }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const chips = (list: number[]) => list.map((i) => (
    <span key={i} className="wchip" data-to={CHIPS[i].to} data-i={i}><b>{CHIPS[i].b}</b><small>{CHIPS[i].s}</small></span>
  ));
  return (
    <Block className="block" id="where" aria-labelledby="whereh" ref={root}>
      <h3 className="sech" id="whereh">What lives where</h3>
      <p className="intro">Not every record belongs in the graph. Materialize what you walk through or reason over, leave high-volume data where it already sits and link to it by ID, and keep long text in search.</p>
      <div className="vbtns">
        <button type="button" className="vbtn go" id="wlSort" onClick={() => { reset(); requestAnimationFrame(() => sort()); }}>Sort the data</button>
        <button type="button" className="vbtn" id="wlReset" onClick={reset}>Reset</button>
      </div>
      <div className={'wlpool' + (empty ? ' empty' : '')} id="wlPool">{chips(spots.pool)}</div>
      <div className="wlbins">
        {BINS.map((b) => (
          <div key={b.bin} className="wlbin" style={{ '--c': b.c } as CSSProperties}>
            <header><b>{b.title}</b><small>{b.sub}</small></header>
            <div className="wldrop" data-bin={b.bin}>{chips(spots[b.bin])}</div>
          </div>
        ))}
      </div>
      <p className="note" id="wlNote" ref={note}>A record moves into Neptune when a question needs to walk through it, like an authorization that becomes part of a dispute. Neptune can also read S3 data from inside an openCypher query, so reference data can stay in S3. AWS’s own guidance takes the same line: materialize only what needs reasoning or cross-domain links.</p>
    </Block>
  );
}
