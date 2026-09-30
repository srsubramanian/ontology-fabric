import { inView } from 'motion/react';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { reduce } from '../../kit/motion';
import { rounded } from '../../kit/svg';
import { anim, dl, packet, wait } from '../shared/anim';
import { model } from '../../explorer/data';
import { linesHtml } from '../shared/lines';
import { Ownership } from './Ownership';
import { Keys, Stepper } from '../shared/Stepper';

// How version 1 gets made, standards first (decision 9): the overview map, one panel per step,
// then who owns it and how it's authored.

type NodeDef = { x: number; y: number; w: number; h: number; t: string; s: string; s2?: string; step: number; badge?: boolean };
const V1N: Record<string, NodeDef> = {
  n1: { x: 40, y: 62, w: 200, h: 64, t: 'Standards first', s: 'ISO 20022, FIBO, ISO codes', step: 1, badge: true },
  n2: { x: 290, y: 62, w: 200, h: 64, t: 'Competency questions', s: 'Coverage: questions answered', step: 2, badge: true },
  n3a: { x: 40, y: 224, w: 200, h: 64, t: 'Code, schemas, specs', s: 'Repos, ISO 8583, reason codes', step: 3, badge: true },
  n3b: { x: 290, y: 224, w: 200, h: 64, t: 'Term inventory', s: 'Coverage: terms mapped', step: 3 },
  n4: { x: 575, y: 142, w: 190, h: 52, t: 'Modeling patterns', s: 'Rules before names', step: 4, badge: true },
  n5: { x: 575, y: 208, w: 190, h: 52, t: 'Definitions + shapes', s: 'Meaning and constraints', step: 5, badge: true },
  n6: { x: 840, y: 138, w: 150, h: 82, t: 'Prove with data', s: 'Run every question', s2: 'as Cypher', step: 6, badge: true },
};
const V1E: Record<string, { p: [number, number][]; dash?: boolean }> = {
  tests: { p: [[465, 62], [465, 29], [915, 29], [915, 138]], dash: true },
  e1: { p: [[240, 94], [290, 94]] },
  e2: { p: [[240, 256], [290, 256]] },
  e3: { p: [[490, 94], [525, 94], [525, 150], [560, 150]] },
  e4: { p: [[490, 256], [525, 256], [525, 212], [560, 212]] },
  e6: { p: [[780, 179], [840, 179]] },
  e7: { p: [[990, 179], [1020, 179]] },
  loop: { p: [[915, 220], [915, 300], [670, 300], [670, 274]], dash: true },
};
const V1STEP: Record<number, { n: string[]; e: string[]; title: string; keys: string[] }> = {
  1: { n: ['n1'], e: ['e1'], title: 'Start from standards', keys: ['Draft the core from ISO 20022, FIBO and ISO code lists', 'Link with skos:closeMatch, never owl:imports', 'Pin the FIBO release you mapped against'] },
  2: { n: ['n2'], e: ['tests', 'e3'], title: 'Write competency questions', keys: ['30 to 50 real questions from the teams', 'Count how many the draft already answers', 'Each question becomes a test'] },
  3: { n: ['n3a', 'n3b'], e: ['e2', 'e4'], title: 'Mine the evidence', keys: ['One extraction run over repos and specs', 'Claude clusters names; a person decides', 'Count how many terms map to a standard'] },
  4: { n: ['n4'], e: [], title: 'Settle the patterns', keys: ['Decide the rules before naming classes', 'Five rules cover most choices', 'Pick a rule to compare'] },
  5: { n: ['n5'], e: [], title: 'Define and constrain', keys: ['Label, definition, example, owner, status', 'SHACL says what valid data looks like', 'People and Claude both read definitions'] },
  6: { n: ['n6', 'v10'], e: ['e6', 'e7', 'loop', 'tests'], title: 'Prove it with data', keys: ['Load a sample week, run every question', 'Can’t write it? Something is missing', 'Five-hop workaround? A pattern is wrong'] },
};
const STEPS = Object.keys(V1STEP).map(Number);

// Step 2: names the extraction run found, and where each belongs.
type Spot = 'pool' | 'cb' | 'rc' | 'other';
const CHIPS: { code: string; src: string; to: Exclude<Spot, 'pool'> }[] = [
  { code: 'TxnDsptRec', src: 'disputes-svc, JPA', to: 'cb' },
  { code: 'ReasonCd', src: 'cb-portal, Avro', to: 'rc' },
  { code: 'ChargebackCase', src: 'cb-portal, OpenAPI', to: 'cb' },
  { code: 'rtrvl_request', src: 'disputes-svc, enum', to: 'other' },
  { code: 'CB_REASON', src: 'reports, SQL', to: 'rc' },
  { code: 'dispute_record', src: 'ledger, DDL', to: 'cb' },
  { code: 'rsn_code', src: 'clearing files', to: 'rc' },
];
const POOL: Record<Spot, number[]> = { pool: CHIPS.map((_, i) => i), cb: [], rc: [], other: [] };
const CLUSTERS: { spot: Exclude<Spot, 'pool'>; head: string; who: string }[] = [
  { spot: 'cb', head: 'Chargeback? ', who: 'person decides' },
  { spot: 'rc', head: 'ReasonCode? ', who: 'person decides' },
  { spot: 'other', head: 'Looked similar, isn\'t ', who: 'new candidate' },
];

// Step 1: the top level, and which standard each category maps to.
type Std = 'fibo' | 'iso' | 'codes';
const CATS: [name: string, holds: string, std: Std | null][] = [
  ['Party', 'Cardholder, Merchant, Issuer, Acquirer', 'fibo'],
  ['Agreement', 'MerchantAgreement', 'fibo'],
  ['PaymentInstrument', 'Card, NetworkToken', 'iso'],
  ['PaymentEvent', 'Authorization, Capture, Settlement, Refund, Chargeback', 'iso'],
  ['Code', 'MCC, ReasonCode, ResponseCode', 'codes'],
  ['Network', 'CardNetwork, MethodOfPayment', null],
];
const MAPS = (() => {
  const next: Record<Std, number> = { fibo: 42, iso: 132, codes: 230 };
  return CATS.flatMap(([, , std], i) => {
    if (!std) return [];
    const cy = 34 + i * 48, ty = next[std];
    next[std] += 24;
    return ['M510,' + cy + ' C545,' + cy + ' 545,' + ty + ' 580,' + ty];
  });
})();
const STANDARDS: { y: number; t: string; s: string; s2: string }[] = [
  { y: 18, t: 'FIBO', s: 'Parties, agreements', s2: 'pin a quarterly release' },
  { y: 108, t: 'ISO 20022', s: 'Card messages', s2: 'cain, caad, cafm families' },
  { y: 198, t: 'ISO code lists', s: 'MCC, currency, country', s2: 'ISO 18245, 4217, 3166' },
];
/** A seeded random sequence, so the imported classes land in the same places every time. */
const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// Steps 2 and 3: the two coverage numbers. The story's are illustrative; the draft's are read
// from its LinkML source at build time.
const concrete = Object.values(model.classes).filter((c) => !c.abstract);
const DRAFT = { questions: model.questions.length, classes: concrete.length, mapped: concrete.filter((c) => c.mappings.length).length };

// Step 5: the class in Turtle.
const TTL = `pay:Chargeback a owl:Class ;
    rdfs:subClassOf pay:DisputeEvent ;
    skos:prefLabel "Chargeback"@en ;
    skos:definition """A dispute event in which the issuer, through the card network,
      reverses all or part of a captured transaction for the cardholder."""@en ;
    skos:example "A Visa 10.4 chargeback on a card-absent capture"@en ;
    pay:owner "disputes" ;
    pay:status "approved" .

pay:ChargebackShape a sh:NodeShape ;
    sh:targetClass pay:Chargeback ;
    sh:property [ sh:path pay:disputes ; sh:class pay:Capture ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path pay:hasReason ; sh:class pay:ReasonCode ; sh:minCount 1 ] ;
    sh:property [ sh:path pay:openedAt ; sh:datatype xsd:dateTime ; sh:minCount 1 ] .`;

// Step 6: three illustrative rounds of running the questions.
type Note = [kind: 'bad' | 'awk' | 'pass', question: string, why: string, fix: string];
const ROUNDS: { bad: number[]; awk: number[]; label: string; notes: Note[] }[] = [
  { bad: [5, 17, 29, 38], awk: [2, 9, 13, 21, 26, 33, 35, 40], label: 'Round 1: 30 pass, 8 awkward, 4 can’t be written',
    notes: [['bad', 'Which captures haven’t settled after 3 days?', 'Capture has no link to Settlement', 'Add SETTLES'],
            ['bad', 'Which merchants share devices with a flagged one?', 'No Device class', 'Add Device'],
            ['awk', 'Show the full lifecycle of this authorization', 'Five hops through a generic Transaction node', 'Link the events directly']] },
  { bad: [17], awk: [9, 26, 35], label: 'Round 2: 38 pass, 3 awkward, 1 can’t be written',
    notes: [['bad', 'What evidence did we send for this chargeback?', 'Evidence is a free-text field', 'Add Representment and Document'],
            ['awk', 'Which response codes spiked for this BIN range?', 'BIN range is a string property', 'Make BinRange a node']] },
  { bad: [], awk: [], label: 'Round 3: all 42 pass',
    notes: [['pass', 'Every question now runs as a Cypher test in CI', 'Nothing missing, nothing awkward', 'Tag 1.0']] },
];
const QUESTIONS = 42;
const STRIP = ['Generate schema', 'Load a sample week', 'Run 42 questions as Cypher', 'Fix the model'];

const onKey = (fn: () => void) => (ev: KeyboardEvent) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fn(); } };

export function Version1() {
  const [sel, setSel] = useState({ step: 1, n: 1 });
  const curRef = useRef(1);
  const root = useRef<HTMLElement>(null);
  const mapSvg = useRef<SVGSVGElement>(null);
  const nodeEls = useRef<Record<string, SVGGElement>>({});
  const edgeEls = useRef<Record<string, SVGPathElement>>({});
  const pkLayer = useRef<SVGGElement>(null);
  const keys = useRef<HTMLDivElement>(null);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const panel = (n: number) => panels.current[n - 1];
  const st = V1STEP[sel.step];

  const select = (step: number) => { curRef.current = step; setSel((s) => ({ step, n: s.n + 1 })); };

  // Step 2
  const [spots, setSpots] = useState(POOL);
  const clustered = useRef(false), clusterRun = useRef(0);
  const invBody = useRef<HTMLTableSectionElement>(null);
  // Step 3
  const [mode, setMode] = useState<'align' | 'import'>('align');
  const modeRef = useRef(mode);
  const catsG = useRef<SVGGElement>(null), mapsG = useRef<SVGGElement>(null), dotsG = useRef<SVGGElement>(null), ovl = useRef<SVGGElement>(null);
  // Step 4
  const [rule, setRule] = useState('a');
  // Step 5
  const [ttlOpen, setTtlOpen] = useState(false);
  const rejRun = useRef(0);
  // Step 6
  const [round, setRound] = useState(-1);
  const [tagged, setTagged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stripNow, setStripNow] = useState(-1);
  const tag10 = useRef<HTMLDivElement>(null);
  // How it's authored
  const authoring = useRef<HTMLDivElement>(null);

  const ttlHtml = useMemo(() => linesHtml(TTL, 'turtle'), []);

  // ---------- The overview ----------
  const intro = async () => {
    const c = 'var(--onto)', pk = pkLayer.current!, e = edgeEls.current, n = nodeEls.current;
    Object.values(n).forEach((g) => anim(g, { opacity: 1 }, { duration: 0.2 }));
    packet(pk, e.tests, c, 2.4);
    await Promise.all([packet(pk, e.e1, c, 0.6), packet(pk, e.e2, c, 0.6)]);
    await Promise.all([packet(pk, e.e3, c, 0.8), packet(pk, e.e4, c, 0.8)]);
    anim([n.n4, n.n5], { opacity: [0.4, 1] }, { duration: 0.4 });
    await packet(pk, e.e6, c, 0.6);
    for (let i = 0; i < 2; i++) { await packet(pk, e.loop, c, 1.1); await packet(pk, e.e6, c, 0.5); }
    await packet(pk, e.e7, c, 0.4);
    await anim(n.v10, { scale: [1, 1.3, 1] }, { duration: 0.6, ease: 'easeOut' });
    select(curRef.current || 1);
  };

  useEffect(() => {
    let seen = false;
    return inView(mapSvg.current!, () => { if (!seen) { seen = true; intro(); } }, { amount: 0.45 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Selecting a step dims the other nodes, and plays the step's panel.
  useEffect(() => {
    Object.entries(nodeEls.current).forEach(([k, g]) => anim(g, { opacity: st.n.includes(k) ? 1 : 0.4 }, { duration: 0.3 }));
    anim(keys.current, { opacity: [0, 1], x: [-8, 0] }, { duration: 0.3 });
    anim(panel(sel.step), { opacity: [0, 1] }, { duration: 0.25 });
    ({ 1: p1, 2: p2, 3: p3, 4: p4, 5: p5 } as Record<number, () => void>)[sel.step]?.();
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Coverage meters ----------
  /** Fills a panel's coverage bar from empty. */
  const fillMeter = (p: HTMLElement, delay: number) => {
    const bar = p.querySelector<HTMLElement>('.covbar i');
    if (bar) anim(bar, { width: ['0%', bar.dataset.w + '%'] }, { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] });
  };

  // ---------- Step 1: align with standards, or import them ----------
  const setMode3 = (m: 'align' | 'import') => {
    modeRef.current = m;
    setMode(m);
    const cats = catsG.current!.children, maps = mapsG.current!.children as HTMLCollectionOf<SVGPathElement>, dots = dotsG.current!;
    if (m === 'import') {
      anim(cats, { opacity: 0.3 }, { duration: 0.3 });
      anim(maps, { opacity: 0 }, { duration: 0.2 });
      dots.replaceChildren();
      const r = rnd(7);
      for (let i = 0; i < 520; i++) {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', (r() * 750 + 5).toFixed(1)); c.setAttribute('cy', (r() * 296 + 5).toFixed(1));
        c.setAttribute('r', '1.9'); c.setAttribute('opacity', '0');
        dots.appendChild(c);
      }
      anim(dots.children, { opacity: [0, 0.55], scale: [0, 1] }, { duration: 0.3, delay: (i) => (i / 520) * 1.2 });
      anim(ovl.current, { opacity: [0, 1] }, { duration: 0.3, delay: 1.1 });
    } else {
      anim(ovl.current, { opacity: 0 }, { duration: 0.2 });
      if (dots.children.length) anim(dots.children, { opacity: 0 }, { duration: 0.3 }).then(() => { if (modeRef.current === 'align') dots.replaceChildren(); });
      anim(cats, { opacity: [0, 1], x: [-10, 0] }, { duration: 0.35, delay: dl(0, 0.06) });
      Array.from(maps).forEach((m, i) => {
        const len = m.getTotalLength();
        m.style.opacity = '1'; m.style.strokeDasharray = String(len);
        anim(m, { strokeDashoffset: [len, 0] }, { duration: 0.6, delay: 0.4 + i * 0.12 }).then(() => { m.style.strokeDasharray = ''; m.style.strokeDashoffset = ''; });
      });
    }
  };
  const p1 = () => setMode3('align');

  // ---------- Step 2: questions set the scope, and test the draft ----------
  const p2 = () => {
    const p = panel(2)!;
    anim(p.querySelectorAll('.qcard'), { opacity: [0, 1], y: [14, 0] }, { duration: 0.45, delay: dl(0, 0.07), ease: [0.22, 1, 0.36, 1] });
    anim(p.querySelector('.scope'), { opacity: [0, 1], scaleX: [0, 1] }, { duration: 0.5, delay: 0.5 });
    anim(p.querySelectorAll('.outs span'), { opacity: [0, 1], y: [-16, 0] }, { duration: 0.4, delay: dl(0.8, 0.08) });
    fillMeter(p, 1.1);
  };

  // ---------- Step 3: cluster the names, and map them to standards ----------
  const chip = (i: number) => panel(3)!.querySelector(`.chip[data-i="${i}"]`)!;
  const invRows = () => invBody.current!.querySelectorAll('tr');
  const hideRows = () => invRows().forEach((r) => { r.style.opacity = '0'; });
  useLayoutEffect(hideRows, []);
  /** Moves a chip to another group, sliding it from where it was. */
  const flip = (i: number, to: Spot) => {
    const a = chip(i).getBoundingClientRect();
    flushSync(() => setSpots((s) => {
      const out = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.filter((x) => x !== i)])) as Record<Spot, number[]>;
      out[to] = [...out[to], i];
      return out;
    }));
    const b = chip(i).getBoundingClientRect();
    return anim(chip(i), { x: [a.left - b.left, 0], y: [a.top - b.top, 0] }, { duration: 0.55, ease: [0.22, 1, 0.36, 1] });
  };
  const resetCluster = () => {
    clusterRun.current++; clustered.current = false;
    setSpots(POOL);
    hideRows();
  };
  const cluster = async () => {
    if (clustered.current) return;
    clustered.current = true;
    const my = ++clusterRun.current;
    for (let i = 0; i < CHIPS.length; i++) {
      if (my !== clusterRun.current) return;
      flip(i, CHIPS[i].to === 'other' ? 'cb' : CHIPS[i].to);
      await wait(200);
    }
    await wait(800); if (my !== clusterRun.current) return;
    const odd = CHIPS.findIndex((c) => c.to === 'other');
    await flip(odd, 'other');
    anim(chip(odd), { rotate: [0, -5, 5, 0] }, { duration: 0.4 });
    await wait(300); if (my !== clusterRun.current) return;
    anim(panel(3)!.querySelectorAll('.cl .who'), { scale: [1, 1.15, 1] }, { duration: 0.4, delay: dl(0, 0.1) });
    anim(invRows(), { opacity: [0, 1], x: [-10, 0] }, { duration: 0.35, delay: dl(0.2, 0.12) });
  };
  const p3 = () => {
    fillMeter(panel(3)!, 0.3);
    if (clustered.current) return;
    resetCluster();
    setTimeout(() => { if (curRef.current === 3) cluster(); }, reduce ? 0 : 500);
  };

  // ---------- Step 4: modeling rules ----------
  const playRule = (r: string) => {
    const cur = panel(4)!.querySelector(`.rule[data-r="${r}"]`)!;
    anim(cur.querySelector('.avoid'), { opacity: [0, 1], x: [-10, 0] }, { duration: 0.35 });
    anim(cur.querySelectorAll('.do .mn, .do .ml, .do .el, .do code'), { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, delay: dl(0.35, 0.09) });
  };
  const pickRule = (r: string) => { flushSync(() => setRule(r)); playRule(r); };
  const p4 = () => playRule(rule);

  // ---------- Step 5: definition and shape ----------
  const p5 = async () => {
    const my = ++rejRun.current, p = panel(5)!;
    anim(p.querySelectorAll('#ccard .row'), { opacity: [0, 1], x: [-10, 0] }, { duration: 0.35, delay: dl(0.05, 0.1) });
    anim(p.querySelectorAll('#readers span'), { opacity: [0, 1], scale: [0.9, 1] }, { duration: 0.3, delay: dl(0.7, 0.12) });
    p.querySelectorAll<SVGLineElement>('#shapesvg .sh-e').forEach((ln, i) => {
      const len = Math.hypot(ln.x2.baseVal.value - ln.x1.baseVal.value, ln.y2.baseVal.value - ln.y1.baseVal.value);
      ln.style.strokeDasharray = String(len);
      anim(ln, { strokeDashoffset: [len, 0] }, { duration: 0.5, delay: 0.2 + i * 0.15 }).then(() => { ln.style.strokeDasharray = ''; ln.style.strokeDashoffset = ''; });
    });
    anim(p.querySelectorAll('#shapesvg .cbadge'), { opacity: [0, 1] }, { duration: 0.3, delay: dl(0.6, 0.15) });
    const ghost = p.querySelector<SVGGElement>('#ghost')!, rej = p.querySelector<SVGTextElement>('#rej')!;
    ghost.setAttribute('opacity', '0'); rej.setAttribute('opacity', '0'); ghost.style.opacity = ''; rej.style.opacity = '';
    await wait(1400); if (my !== rejRun.current) return;
    await anim(ghost, { opacity: [0, 1], x: [-30, 0] }, { duration: 0.45 });
    await wait(300); if (my !== rejRun.current) return;
    anim(rej, { opacity: [0, 1] }, { duration: 0.25 });
    await anim(ghost, { x: [0, -7, 7, -5, 5, 0] }, { duration: 0.45 });
    anim(ghost, { opacity: 0.4 }, { duration: 0.4 });
  };
  const toggleTtl = () => {
    const open = !ttlOpen;
    flushSync(() => setTtlOpen(open));
    if (open) anim(panel(5)!.querySelector('#ttl'), { opacity: [0, 1], y: [6, 0] }, { duration: 0.3 });
  };

  // ---------- Step 6: run the questions, fix the model, rerun ----------
  const sqClass = (i: number) => {
    if (round < 0) return 'sq';
    const R = ROUNDS[round];
    return 'sq ' + (R.bad.includes(i) ? 'bad' : R.awk.includes(i) ? 'awk' : 'pass');
  };
  const highlightStrip = async (list: number[]) => {
    const sts = panel(6)!.querySelectorAll('#strip .st');
    for (const i of list) {
      flushSync(() => setStripNow(i));
      anim(sts[i], { scale: [0.94, 1] }, { duration: 0.25 });
      await wait(380);
    }
    flushSync(() => setStripNow(-1));
  };
  const run = async () => {
    const p = panel(6)!;
    if (tagged) { setRound(-1); setTagged(false); setStripNow(-1); return; }
    if (round === 2) {
      flushSync(() => setTagged(true));
      anim(tag10.current, { scale: [0, 1.15, 1], opacity: [0, 1] }, { duration: 0.6 });
      return;
    }
    flushSync(() => setBusy(true));
    const next = round + 1;
    await highlightStrip(next === 0 ? [0, 1, 2] : [3, 0, 1, 2]);
    flushSync(() => { setRound(next); setBusy(false); });
    anim(p.querySelectorAll('#board .sq'), { scale: [0.3, 1] }, { duration: 0.3, delay: dl(0, 0.018) });
    anim(p.querySelector('#rnotes')!.children, { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, delay: dl(0.5, 0.1) });
  };
  const runLabel = tagged ? 'Start over' : round < 0 ? 'Run the questions' : round < 2 ? 'Fix the model and rerun' : 'Tag 1.0';

  // ---------- How it's authored ----------
  useEffect(() => inView(authoring.current!, () => {
    anim(authoring.current!.querySelectorAll('.trow .tk'), { opacity: [0, 1], y: [6, 0] }, { duration: 0.3, delay: dl(0.2, 0.04) });
  }, { amount: 0.4 }), []);

  const vpanel = (n: number, children: ReactNode) => (
    <div className="vpanel" data-v={n} hidden={sel.step !== n} ref={(el) => { panels.current[n - 1] = el; }}>{children}</div>
  );

  return (
    <section className="block" id="v1" aria-labelledby="v1h" ref={root}>
      <h3 className="sech" id="v1h">How version 1 gets made</h3>
      <p className="intro">Questions and standards from the top, evidence from the code below. They meet in a small core that you prove with real data before tagging 1.0.</p>
      <div className="diagram-wrap">
        <svg id="v1map" className="v1map" viewBox="0 0 1100 322" role="img" aria-label="Competency questions and standards from the business, and a term inventory from code, converge into a core ontology that is proved with data before tagging 1.0" ref={mapSvg}>
          <text className="lane" x="58" y="52">From standards and the business</text>
          <text className="lane" x="58" y="214">From the evidence</text>
          <rect className="corebox" x="560" y="84" width="220" height="190" rx="14" />
          <text className="coret" x="576" y="110">Core v1</text>
          <text className="cores" x="576" y="128">15 to 25 classes</text>
          <g id="v1edges">
            {Object.entries(V1E).map(([k, e]) => {
              const on = st.e.includes(k);
              return <path key={k} d={rounded(e.p)} className={'v1e' + (e.dash ? ' dash' : '') + (on ? ' on' : '')} markerEnd={on ? 'url(#mg-onto)' : 'url(#mg-line)'}
                ref={(el) => { if (el) edgeEls.current[k] = el; }} />;
            })}
          </g>
          <rect className="lblbg" x="593" y="20" width="194" height="18" />
          <text className="elbl" x="690" y="33" textAnchor="middle">each question becomes a test</text>
          <text className="elbl" x="792" y="317" textAnchor="middle">fix the model, regenerate</text>
          <g id="v1nodes">
            {Object.entries(V1N).map(([k, n]) => {
              const tall = n.h > 70, tx = n.x + 20;
              return (
                <g key={k} className={'v1n' + (st.n.includes(k) ? ' on' : '')} tabIndex={0} role="button" aria-label={'Step ' + n.step + ': ' + n.t}
                  onClick={() => select(n.step)} onKeyDown={onKey(() => select(n.step))} ref={(el) => { if (el) nodeEls.current[k] = el; }}>
                  <rect className="box" x={n.x} y={n.y} width={n.w} height={n.h} rx="9" />
                  <text className="n-title" x={tx} y={n.y + (tall ? 30 : 27)}>{n.t}</text>
                  <text className="n-sub" x={tx} y={n.y + (tall ? 49 : 45)}>{n.s}</text>
                  {n.s2 && <text className="n-sub" x={tx} y={n.y + 65}>{n.s2}</text>}
                  {n.badge && <><circle className="badge" cx={n.x} cy={n.y} r="11" /><text className="bnum" x={n.x} y={n.y + 4}>{n.step}</text></>}
                </g>
              );
            })}
            <g className={'v1n v10' + (st.n.includes('v10') ? ' on' : '')} tabIndex={0} role="button" aria-label="Tag version 1.0"
              onClick={() => select(6)} onKeyDown={onKey(() => select(6))} ref={(el) => { if (el) nodeEls.current.v10 = el; }}>
              <circle cx="1052" cy="179" r="32" />
              <text x="1052" y="185">1.0</text>
            </g>
          </g>
          <g id="v1pk" aria-hidden="true" ref={pkLayer}></g>
        </svg>
      </div>
      <Stepper id="v1steps" label="Steps to build version 1" titles={STEPS.map((k) => V1STEP[k].title)} cur={sel.step} onPick={select}>
        <button type="button" className="vbtn replay" onClick={intro}>Play the overview</button>
      </Stepper>
      <div className="sdetail">
        <Keys id="v1keys" ref={keys} title={st.title} keys={st.keys} />
        <div className="sviz">

          {vpanel(1, <>
            <div className="vbtns">
              <button type="button" className="vbtn" id="modeAlign" aria-pressed={mode === 'align'} onClick={() => setMode3('align')}>Align with mappings</button>
              <button type="button" className="vbtn" id="modeImport" aria-pressed={mode === 'import'} onClick={() => setMode3('import')}>Import everything</button>
            </div>
            <div className="xwrap"><svg id="topsvg" viewBox="0 0 760 306" style={{ display: 'block', width: '100%', minWidth: '560px', height: 'auto' }} role="img" aria-label="Six top-level categories linked to FIBO, ISO 20022 and ISO code lists by mapping annotations">
              <g id="maps" ref={mapsG}>{MAPS.map((d) => <path key={d} className="mapl" d={d} />)}</g>
              <g id="cats" ref={catsG}>
                {CATS.map(([name, holds], i) => {
                  const y = 14 + i * 48, cy = y + 20;
                  return <g key={name} className="cat"><rect className="box" x="20" y={y} width="490" height="40" rx="8" /><text className="t" x="36" y={cy + 5}>{name}</text><text className="s" x="198" y={cy + 4}>{holds}</text></g>;
                })}
              </g>
              {STANDARDS.map((d) => (
                <g key={d.t} className="std"><rect className="box" x="580" y={d.y} width="170" height="70" rx="10" /><text className="t" x="596" y={d.y + 24}>{d.t}</text><text className="s" x="596" y={d.y + 43}>{d.s}</text><text className="s" x="596" y={d.y + 59}>{d.s2}</text></g>
              ))}
              <text className="elbl" x="665" y="292" textAnchor="middle">linked by skos:closeMatch</text>
              <g className="dots" id="dots" ref={dotsG}></g>
              <g className="ovl" id="ovl" opacity="0" ref={ovl}><rect x="150" y="132" width="460" height="42" rx="21" /><text x="380" y="158">owl:imports FIBO 2026 Q2: 2,228 classes, most unused</text></g>
            </svg></div>
          </>)}

          {vpanel(2, <>
            <p className="vcap">A question needs it: in v1</p>
            <div className="qgrid">
              <div className="qcard"><span className="team">Disputes</span>Which merchants had the most 10.4 chargebacks last month?<br /><span className="cq">test CQ-01</span></div>
              <div className="qcard"><span className="team">Disputes</span>What evidence did we send for this chargeback, and when?<br /><span className="cq">test CQ-02</span></div>
              <div className="qcard"><span className="team">Authorization</span>Show the full lifecycle of this authorization.<br /><span className="cq">test CQ-03</span></div>
              <div className="qcard"><span className="team">Authorization</span>Which response codes spiked for this BIN range today?<br /><span className="cq">test CQ-04</span></div>
              <div className="qcard"><span className="team">Settlement</span>Which captures haven't settled after 3 days?<br /><span className="cq">test CQ-05</span></div>
              <div className="qcard"><span className="team">Risk</span>Which merchants share devices or acquirers with a flagged one?<br /><span className="cq">test CQ-06</span></div>
            </div>
            <div className="scope"><span>Scope line</span></div>
            <p className="vcap">No question needs it: out of v1</p>
            <div className="outs"><span>General ledger postings</span><span>Merchant onboarding paperwork</span><span>Card manufacturing</span><span>Marketing segments</span></div>
            <Meter label="Coverage 1: questions the standards draft answers" n={17} of={42} notes={[
              'Illustrative. Modeling, then proving it with data, takes it to 42 of 42.',
              `This repo's draft, read from its LinkML source: ${DRAFT.questions} of ${DRAFT.questions} questions walk real relationships.`,
            ]} />
          </>)}

          {vpanel(3, <>
            <div className="vbtns">
              <button type="button" className="vbtn go" id="clusterBtn" onClick={() => { resetCluster(); requestAnimationFrame(() => cluster()); }}>Cluster the names</button>
              <button type="button" className="vbtn" id="clusterReset" onClick={resetCluster}>Reset</button>
            </div>
            <div className="mine">
              <div>
                <p className="vcap">Names the one-time extraction run found</p>
                <div className="pool" id="pool">{spots.pool.map((i) => <Chip key={i} i={i} />)}</div>
              </div>
              <div className="clusters">
                {CLUSTERS.map((c) => (
                  <div key={c.spot} className={'cl' + (c.spot === 'other' ? ' other' : '')}>
                    <header>{c.head}<span className="who">{c.who}</span></header>
                    <div className="drop" data-drop={c.spot}>{spots[c.spot].map((i) => <Chip key={i} i={i} />)}</div>
                  </div>
                ))}
              </div>
            </div>
            <table className="inv" id="inv">
              <thead><tr><th>Candidate class</th><th>Names</th><th>Systems</th><th>Status</th></tr></thead>
              <tbody ref={invBody}>
                <tr><td>Chargeback</td><td>3</td><td>disputes-svc, cb-portal, ledger</td><td><span className="pill">owner sign-off</span></td></tr>
                <tr><td>ReasonCode</td><td>3</td><td>cb-portal, reports, clearing</td><td><span className="pill">owner sign-off</span></td></tr>
                <tr><td>RetrievalRequest</td><td>1</td><td>disputes-svc</td><td><span className="pill">new candidate</span></td></tr>
              </tbody>
            </table>
            <p className="note">The output is a term inventory, not ontology code. People turn it into the ontology.</p>
            <Meter label="Coverage 2: mined terms that map to a standard concept" n={61} of={140} notes={[
              'Illustrative. Terms with no standard match become our own classes.',
              `This repo's draft: ${DRAFT.mapped} of ${DRAFT.classes} concrete classes map to a standard so far.`,
            ]} />
          </>)}

          {vpanel(4, <>
            <div className="vbtns" id="ruleTabs">
              {RULE_TABS.map(([r, label]) => <button key={r} type="button" className="vbtn" data-r={r} aria-pressed={rule === r} onClick={() => pickRule(r)}>{label}</button>)}
            </div>
            <Rules rule={rule} />
          </>)}

          {vpanel(5, <>
            <div className="anat">
              <div>
                <div className="ccard" id="ccard">
                  <div className="ct"><strong>Chargeback</strong><code>:DisputeEvent</code><code>:PaymentEvent</code></div>
                  <div className="row"><b>Definition</b><span>A dispute event in which the issuer, through the card network, reverses all or part of a captured transaction for the cardholder.</span></div>
                  <div className="row"><b>Example</b><span>A Visa 10.4 chargeback on a card-absent capture</span></div>
                  <div className="row"><b>Owner</b><span>Disputes team</span></div>
                  <div className="row"><b>Status</b><span><span className="pill">approved</span></span></div>
                  <div className="row"><b>Matches</b><span>ISO 20022 and FIBO concepts, via skos:closeMatch</span></div>
                </div>
                <div className="readers" id="readers"><span>Read by people on the docs site</span><span>Read by Claude to write Cypher</span></div>
              </div>
              <figure className="shape">
                <figcaption>SHACL shape: what valid data looks like</figcaption>
                <svg viewBox="0 0 380 282" id="shapesvg">
                  <line className="ml onto sh-e" x1="140" y1="120" x2="249" y2="40" markerEnd="url(#mg-onto)" />
                  <text className="el" x="170" y="66" textAnchor="middle">DISPUTES</text>
                  <g className="cbadge"><rect x="140" y="72" width="62" height="16" rx="8" /><text x="171" y="84">exactly 1</text></g>
                  <line className="ml onto sh-e" x1="140" y1="130" x2="249" y2="130" markerEnd="url(#mg-onto)" />
                  <text className="el" x="195" y="122" textAnchor="middle">HAS_REASON</text>
                  <g className="cbadge"><rect x="164" y="138" width="62" height="16" rx="8" /><text x="195" y="150">1 or more</text></g>
                  <line className="ml onto sh-e" x1="140" y1="140" x2="249" y2="218" markerEnd="url(#mg-onto)" />
                  <g className="cbadge"><rect x="150" y="186" width="58" height="16" rx="8" /><text x="179" y="198">required</text></g>
                  <g className="mn onto"><rect x="10" y="108" width="130" height="44" rx="8" /><text className="t" x="26" y="127">Chargeback</text><text className="s" x="26" y="143">every node checked</text></g>
                  <g className="mn good"><rect x="250" y="22" width="120" height="36" rx="8" /><text className="t" x="266" y="45">Capture</text></g>
                  <g className="mn good"><rect x="250" y="112" width="120" height="36" rx="8" /><text className="t" x="266" y="135">ReasonCode</text></g>
                  <g className="mn"><rect x="250" y="202" width="124" height="32" rx="16" /><text className="s" x="312" y="223" textAnchor="middle">opened_at: dateTime</text></g>
                  <g className="mn ghost" id="ghost" opacity="0"><rect x="10" y="222" width="160" height="44" rx="8" /><text className="t" x="24" y="241">Chargeback cb:991</text><text className="s" x="24" y="258">no capture linked</text></g>
                  <text className="rej" id="rej" x="178" y="264" opacity="0">rejected at load</text>
                </svg>
              </figure>
            </div>
            <div className="ttl">
              <button type="button" className="vbtn" id="ttlBtn" aria-expanded={ttlOpen} onClick={toggleTtl}>{ttlOpen ? 'Hide the Turtle' : 'Show the Turtle'}</button>
              <pre id="ttl" hidden={!ttlOpen} dangerouslySetInnerHTML={{ __html: ttlHtml }} />
            </div>
          </>)}

          {vpanel(6, <>
            <div className="strip" id="strip">
              {STRIP.map((s, i) => (
                <Fragment key={s}>
                  {i > 0 && <span className="ar">{i === 3 ? '↺' : '→'}</span>}
                  <span className={'st' + (stripNow === i ? ' now' : '')}>{s}</span>
                </Fragment>
              ))}
            </div>
            <div className="vbtns"><button type="button" className="vbtn go" id="runBtn" disabled={busy} onClick={run}>{runLabel}</button></div>
            <div className="boardrow">
              <div className="board" id="board" aria-label="Competency question results">{Array.from({ length: QUESTIONS }, (_, i) => <div key={i} className={sqClass(i)}></div>)}</div>
              <div className="tag10" id="tag10" ref={tag10} style={tagged ? { display: 'flex' } : undefined}>1.0<small>tagged</small></div>
            </div>
            <div className="blegend"><span><i className="sq pass"></i>Passes</span><span><i className="sq awk"></i>Awkward query</span><span><i className="sq bad"></i>Can't be written</span><span><i className="sq"></i>Not run yet</span></div>
            <p className="rcount" id="rcount">{round < 0 ? 'Illustrative run with 42 competency questions.' : ROUNDS[round].label}</p>
            <ul className="rnotes" id="rnotes">
              {round >= 0 && ROUNDS[round].notes.map(([kind, q, why, fix]) => (
                <li key={round + q}><i className={'sq ' + kind}></i><div><b>{q}</b><br /><span className="rwhy">{why}.</span> <span className="rfix">{fix}</span></div></li>
              ))}
            </ul>
          </>)}

        </div>
      </div>

      <div className="twocol">
        <div className="tc">
          <h3>Who owns it</h3>
          <Ownership />
          <div className="scopechips"><span><b>15 to 25</b> classes in v1</span><span><b>Weeks</b>, not quarters</span></div>
        </div>
        <div className="tc" ref={authoring}>
          <h3>Authoring: Turtle or LinkML</h3>
          <div className="tool"><p className="tname">Turtle in Git</p>
            <div className="trow"><span className="tk hand">OWL classes</span><span className="tk hand">SHACL shapes</span><span className="ar">→</span><span className="tk mid">Your generator</span><span className="ar">→</span><span className="tk you">Pydantic</span><span className="tk you">Extraction schema</span><span className="tk you">Docs site</span><span className="tk you">Neptune CSV headers</span><span className="tk you">OpenSearch mappings</span></div></div>
          <div className="tool"><p className="tname">LinkML</p>
            <div className="trow"><span className="tk hand">LinkML YAML</span><span className="ar">→</span><span className="tk built">OWL</span><span className="tk built">SHACL</span><span className="tk built">Pydantic</span><span className="tk built">JSON Schema</span><span className="tk built">Docs site</span><span className="tk you">Neptune CSV headers</span><span className="tk you">OpenSearch mappings</span></div></div>
          <div className="tlegend"><span><i className="hand"></i>You author</span><span><i className="built"></i>Built-in generator</span><span><i className="you"></i>Code you write</span></div>
          <p className="note">Either way the published product is OWL. Try LinkML on five classes before committing.</p>
          <a className="chlink" href="#authh">See both side by side</a>
        </div>
      </div>
    </section>
  );
}

/** One coverage number, as a bar and a count, with notes on where it comes from. */
function Meter({ label, n, of, notes }: { label: string; n: number; of: number; notes: string[] }) {
  const w = Math.round((n / of) * 100);
  return (
    <div className="cov">
      <div className="covh"><b>{label}</b><span className="covn">{n} of {of}</span></div>
      <div className="covbar"><i data-w={w} style={{ width: w + '%' }}></i></div>
      {notes.map((x) => <p key={x} className="covnote">{x}</p>)}
    </div>
  );
}

function Chip({ i }: { i: number }) {
  const c = CHIPS[i];
  return <span className="chip" data-to={c.to} data-i={i}><code>{c.code}</code><small>{c.src}</small></span>;
}

const RULE_TABS: [string, string][] = [
  ['a', 'Events, not status fields'], ['b', 'Codes as nodes'], ['c', 'One direction'], ['d', 'Shallow hierarchy'], ['e', 'Roles'],
];

/** Five modeling rules, each as a pair: what to avoid, and what to do. */
function Rules({ rule }: { rule: string }) {
  return (
    <>
      <div className="rule" data-r="a" hidden={rule !== 'a'}><div className="pair">
        <figure className="avoid"><figcaption><span className="x">Avoid</span>One node, a status that keeps being overwritten</figcaption>
          <svg viewBox="0 0 300 200"><g className="mn bad"><rect x="50" y="26" width="200" height="140" rx="8" /><text className="t" x="66" y="52">Transaction</text><text className="s" x="66" y="80">status = 'charged_back'</text><text className="s" x="66" y="102">captured_at</text><text className="s" x="66" y="124">disputed_at</text><text className="s" x="66" y="146">refunded_at</text></g></svg></figure>
        <figure className="do"><figcaption><span className="ok">Do</span>Each step is its own event with its own time</figcaption>
          <svg viewBox="0 0 300 200">
            <g className="mn good"><rect x="75" y="6" width="150" height="44" rx="8" /><text className="t" x="91" y="25">Chargeback</text><text className="s" x="91" y="42">opened_at</text></g>
            <line className="ml good" x1="150" y1="50" x2="150" y2="77" markerEnd="url(#mg-good)" /><text className="el good" x="160" y="68">DISPUTES</text>
            <g className="mn good"><rect x="75" y="78" width="150" height="44" rx="8" /><text className="t" x="91" y="97">Capture</text><text className="s" x="91" y="114">captured_at</text></g>
            <line className="ml good" x1="150" y1="122" x2="150" y2="149" markerEnd="url(#mg-good)" /><text className="el good" x="160" y="140">CAPTURES</text>
            <g className="mn good"><rect x="75" y="150" width="150" height="44" rx="8" /><text className="t" x="91" y="169">Authorization</text><text className="s" x="91" y="186">authorized_at</text></g>
          </svg></figure>
      </div></div>
      <div className="rule" data-r="b" hidden={rule !== 'b'}><div className="pair">
        <figure className="avoid"><figcaption><span className="x">Avoid</span>The code is buried in two unrelated properties</figcaption>
          <svg viewBox="0 0 300 200"><g className="mn bad"><rect x="4" y="66" width="130" height="56" rx="8" /><text className="t" x="16" y="88">Chargeback</text><text className="s" x="16" y="108">reason_code = '10.4'</text></g><text className="big" x="150" y="104">?</text><g className="mn bad"><rect x="166" y="66" width="130" height="56" rx="8" /><text className="t" x="178" y="88">Chunk</text><text className="s" x="178" y="108">text: '… 10.4 …'</text></g><text className="el" x="150" y="150" textAnchor="middle">no link between them</text></svg></figure>
        <figure className="do"><figcaption><span className="ok">Do</span>Documents and chargebacks meet at one node</figcaption>
          <svg viewBox="0 0 300 200">
            <g className="mn good"><rect x="10" y="12" width="120" height="38" rx="8" /><text className="t" x="24" y="36">Chargeback</text></g>
            <g className="mn good"><rect x="170" y="12" width="120" height="38" rx="8" /><text className="t" x="184" y="36">Chunk</text></g>
            <line className="ml good" x1="70" y1="50" x2="128" y2="139" markerEnd="url(#mg-good)" /><text className="el good" x="94" y="100" textAnchor="end">HAS_REASON</text>
            <line className="ml good" x1="230" y1="50" x2="172" y2="139" markerEnd="url(#mg-good)" /><text className="el good" x="206" y="100">MENTIONS</text>
            <g className="mn good"><rect x="85" y="140" width="130" height="46" rx="8" /><text className="t" x="99" y="160">ReasonCode</text><text className="s" x="99" y="177">10.4</text></g>
          </svg></figure>
      </div></div>
      <div className="rule" data-r="c" hidden={rule !== 'c'}><div className="pair">
        <figure className="avoid"><figcaption><span className="x">Avoid</span>Both directions stored, so they drift apart</figcaption>
          <svg viewBox="0 0 300 200"><g className="mn bad"><rect x="10" y="80" width="110" height="38" rx="8" /><text className="t" x="24" y="104">Chargeback</text></g><g className="mn bad"><rect x="180" y="80" width="110" height="38" rx="8" /><text className="t" x="194" y="104">Capture</text></g>
            <line className="ml" x1="120" y1="90" x2="179" y2="90" markerEnd="url(#mg-mut)" /><text className="el" x="150" y="72" textAnchor="middle">DISPUTES</text>
            <line className="ml" x1="180" y1="108" x2="121" y2="108" markerEnd="url(#mg-mut)" /><text className="el" x="150" y="138" textAnchor="middle">DISPUTED_BY</text></svg></figure>
        <figure className="do"><figcaption><span className="ok">Do</span>Store one direction; Cypher walks either way</figcaption>
          <svg viewBox="0 0 300 200">
            <g className="mn good"><rect x="10" y="80" width="110" height="38" rx="8" /><text className="t" x="24" y="104">Chargeback</text></g>
            <line className="ml good" x1="120" y1="99" x2="179" y2="99" markerEnd="url(#mg-good)" /><text className="el good" x="150" y="72" textAnchor="middle">DISPUTES</text>
            <g className="mn good"><rect x="180" y="80" width="110" height="38" rx="8" /><text className="t" x="194" y="104">Capture</text></g>
            <text className="el good" x="150" y="160" textAnchor="middle">(cap)&lt;-[:DISPUTES]-(cb)</text><text className="el" x="150" y="180" textAnchor="middle">walks it backwards</text>
          </svg></figure>
      </div></div>
      <div className="rule" data-r="d" hidden={rule !== 'd'}><div className="pair">
        <figure className="avoid"><figcaption><span className="x">Avoid</span>Six labels stamped on every node</figcaption>
          <div className="chain"><code>:Chargeback</code><code>:NetworkDispute</code><code>:DisputeEvent</code><code>:PostSettlementEvent</code><code>:PaymentEvent</code><code>:BusinessEvent</code></div></figure>
        <figure className="do"><figcaption><span className="ok">Do</span>Three or four levels at most</figcaption>
          <div className="chain"><code>:Chargeback</code><code>:DisputeEvent</code><code>:PaymentEvent</code></div></figure>
      </div></div>
      <div className="rule" data-r="e" hidden={rule !== 'e'}><div className="pair">
        <figure className="avoid"><figcaption><span className="x">Avoid</span>The same bank appears as two nodes</figcaption>
          <svg viewBox="0 0 300 200"><g className="mn bad"><rect x="14" y="70" width="126" height="52" rx="8" /><text className="t" x="28" y="92">Issuer</text><text className="s" x="28" y="110">First Bay Bank</text></g><g className="mn bad"><rect x="160" y="70" width="126" height="52" rx="8" /><text className="t" x="174" y="92">Acquirer</text><text className="s" x="174" y="110">First Bay Bank</text></g><text className="el" x="150" y="156" textAnchor="middle">one company, two identities</text></svg></figure>
        <figure className="do"><figcaption><span className="ok">Do</span>One entity, two roles</figcaption>
          <svg viewBox="0 0 300 200">
            <g className="mn good"><rect x="85" y="12" width="130" height="48" rx="8" /><text className="t" x="99" y="32">Organization</text><text className="s" x="99" y="50">First Bay Bank</text></g>
            <line className="ml good" x1="118" y1="60" x2="78" y2="139" markerEnd="url(#mg-good)" /><text className="el good" x="90" y="104" textAnchor="end">ACTS_AS</text>
            <line className="ml good" x1="182" y1="60" x2="222" y2="139" markerEnd="url(#mg-good)" /><text className="el good" x="210" y="104">ACTS_AS</text>
            <g className="mn good"><rect x="10" y="140" width="126" height="52" rx="8" /><text className="t" x="24" y="162">Issuer</text><text className="s" x="24" y="180">:PartyRole</text></g>
            <g className="mn good"><rect x="164" y="140" width="126" height="52" rx="8" /><text className="t" x="178" y="162">Acquirer</text><text className="s" x="178" y="180">:PartyRole</text></g>
          </svg></figure>
      </div></div>
    </>
  );
}
