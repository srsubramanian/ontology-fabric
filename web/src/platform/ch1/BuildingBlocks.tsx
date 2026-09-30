import { inView } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { reduce } from '../../kit/motion';
import { anim, dl, drawIn, hideAll, wait } from './anim';
import payments from '../../../../ontology/payments.yaml?raw';
import { linesHtml } from './lines';
import { Keys, Stepper } from './Stepper';

// Deep dive: the building blocks, followed through one payment (Maya's order at Harbor Grill).

const STEPS = [
  { t: 'The story', keys: ['A real card-not-present payment, and its dispute', 'These are instances: things that happened', 'The ontology defines what kinds of things they are'] },
  { t: 'OWL', keys: ['OWL, the Web Ontology Language, defines classes and relationships', 'Classes form a hierarchy: a Chargeback is a DisputeEvent', 'It describes meaning, not individual payments'] },
  { t: 'Turtle', keys: ['Turtle is a plain-text way to write OWL', 'Each statement is a sentence: subject, predicate, object', 'Prefixes are short names for full web addresses'] },
  { t: 'Git', keys: ['People write LinkML; CI generates the Turtle', 'Every change is a pull request its owner reviews', 'Tags mark releases that other teams can pin'] },
  { t: 'SHACL', keys: ['SHACL, the Shapes Constraint Language, checks data', 'A shape lists what a valid Chargeback must have', 'Data that fails never reaches Neptune'] },
  { t: 'OWL vs SHACL', keys: ['OWL: missing information is unknown', 'SHACL: missing information is an error', 'You need both: meaning to share, rules to enforce'] },
  { t: 'Four forms', keys: ['People write the Chargeback once, in LinkML', 'Generators write the OWL and SHACL we publish', 'They also write the Neptune and OpenSearch shapes we load'] },
];

const TTL = [
  '@prefix pay:  <https://ontology.example.com/payments/> .',
  '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
  '@prefix owl:  <http://www.w3.org/2002/07/owl#> .',
  '',
  'pay:Chargeback  a                owl:Class .',
  'pay:Chargeback  rdfs:subClassOf  pay:DisputeEvent .',
  'pay:Chargeback  rdfs:label       "Chargeback"@en .',
  '',
  'pay:disputes    a                owl:ObjectProperty ;',
  '                rdfs:domain      pay:Chargeback ;',
  '                rdfs:range       pay:Capture .',
].join('\n');

/** Each sentence of the Turtle: its lines, its three parts and how to read it. */
const TS: { a: number; z: number; p: string[]; labels?: string[]; r: string }[] = [
  { a: 0, z: 2, p: ['pay:', 'stands for', 'https://ontology.example.com/payments/'], labels: ['Prefix', '', 'Full address (IRI)'], r: 'Prefixes are short names. pay: stands for your ontology’s web address, its IRI.' },
  { a: 4, z: 4, p: ['pay:Chargeback', 'a', 'owl:Class'], r: 'Chargeback is a class: a kind of thing.' },
  { a: 5, z: 5, p: ['pay:Chargeback', 'rdfs:subClassOf', 'pay:DisputeEvent'], r: 'Every Chargeback is also a DisputeEvent.' },
  { a: 6, z: 6, p: ['pay:Chargeback', 'rdfs:label', '"Chargeback"@en'], r: 'Its name for people, in English.' },
  { a: 8, z: 8, p: ['pay:disputes', 'a', 'owl:ObjectProperty'], r: 'disputes is a relationship between two things.' },
  { a: 9, z: 9, p: ['pay:disputes', 'rdfs:domain', 'pay:Chargeback'], r: 'The semicolon reuses the subject. The relationship starts at a Chargeback…' },
  { a: 10, z: 10, p: ['pay:disputes', 'rdfs:range', 'pay:Capture'], r: '…and points to a Capture. That is the DISPUTES arrow from the OWL step.' },
];
const PART_COLORS = ['var(--onto)', 'var(--graph)', 'var(--search)'];

const REPORT = [
  '# validation report',
  'conforms     false',
  'focus node   pay:cb991',
  'path         pay:disputes',
  'message      A Chargeback must dispute exactly one Capture',
].join('\n');
const SHAPE = [
  'pay:ChargebackShape  a  sh:NodeShape ;',
  '    sh:targetClass  pay:Chargeback ;',
  '    sh:property [',
  '        sh:path      pay:disputes ;',
  '        sh:class     pay:Capture ;',
  '        sh:minCount  1 ;  sh:maxCount  1 ;',
  '        sh:message   "A Chargeback must dispute exactly one Capture" ] ;',
  '    sh:property [ sh:path pay:hasReason ; sh:class pay:ReasonCode ; sh:minCount 1 ] ;',
  '    sh:property [ sh:path pay:openedAt ; sh:datatype xsd:dateTime ; sh:minCount 1 ] .',
].join('\n');
/** Which rule each record passes: cb:1001 passes all three, cb:991 has no capture. */
const RESULTS = { a: [true, true, true], b: [false, true, true] };
const RULES = ['Disputes exactly 1 Capture', 'Has at least 1 ReasonCode', 'opened_at is a date-time'];

const WORLD_TEXT = {
  owl: 'OWL: a capture probably exists; we just haven’t been told about it. Nothing is wrong, the knowledge is incomplete.',
  shacl: 'SHACL: the required DISPUTES link is missing, so cb:991 is invalid and is stopped at the load gate.',
};

/** The Chargeback class as it's written in the LinkML source, read from the file at build time. */
const SOURCE = (() => {
  const lines = payments.split('\n'), a = lines.indexOf('  Chargeback:');
  const z = lines.findIndex((l, i) => i > a && !l.trim());
  return lines.slice(a, z).map((l) => l.slice(2)).join('\n');
})();

/** What the generators write from it, trimmed: OWL, SHACL, a Neptune load and an OpenSearch document. */
const FORMS: [lang: string, code: string][] = [
  ['turtle', 'pay:Chargeback  a  owl:Class ;\n    rdfs:label  "Chargeback" ;\n    rdfs:subClassOf  pay:DisputeEvent ;\n    skos:altLabel  "CB", "chargeback case" .'],
  ['turtle', 'pay:Chargeback  a  sh:NodeShape ;\n    sh:closed  true ;\n    sh:property [ sh:path pay:disputes ;\n        sh:class pay:Capture ;\n        sh:minCount 1 ; sh:maxCount 1 ] ;\n    sh:targetClass  pay:Chargeback .'],
  ['cypher', "MERGE (cb:Chargeback:DisputeEvent:PaymentEvent\n       {id: 'cb:1001'})\nSET cb.opened_at =\n      datetime('2026-08-19T14:05:00Z'),\n    cb.ontology_version = '1.6.0'\nMERGE (cap:Capture:PaymentEvent {id:'cap:7731'})\nMERGE (cb)-[:DISPUTES]->(cap)"],
  ['json', '{\n  "neptune_id": "cb:1001",\n  "labels": ["Chargeback", "DisputeEvent",\n             "PaymentEvent"],\n  "codes": ["10.4"],\n  "summary": "Chargeback, Harbor Grill order",\n  "ontology_version": "1.6.0"\n}'],
];

const SVG_STYLE = (min: number): CSSProperties => ({ display: 'block', width: '100%', minWidth: min + 'px', height: 'auto' });

type Mark = 'ok' | 'no' | null;
type World = 'owl' | 'shacl';

export function BuildingBlocks() {
  const [cur, setCur] = useState(1);
  const [played, setPlayed] = useState({ step: 0, n: 0 });
  const curRef = useRef(1);
  const root = useRef<HTMLElement>(null);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const keys = useRef<HTMLDivElement>(null);

  // Step 3: the Turtle reader.
  const [ti, setTi] = useState(0);
  const ttlRun = useRef(0);
  const ttlBox = useRef<HTMLDivElement>(null);
  const ttlPre = useRef<HTMLPreElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const triple = useRef<HTMLDivElement>(null);
  const reading = useRef<HTMLParagraphElement>(null);
  const [tiShown, setTiShown] = useState<number | null>(null);

  // Step 4: Git checks.
  const [gitOk, setGitOk] = useState(0);
  // Step 5: SHACL validation.
  const [marks, setMarks] = useState<{ a: Mark[]; b: Mark[] }>({ a: [null, null, null], b: [null, null, null] });
  const [recs, setRecs] = useState<'idle' | 'done'>('idle');
  const [report, setReport] = useState(true);
  const [shapeOpen, setShapeOpen] = useState(false);
  const vRun = useRef(0);
  // Step 6: OWL's view or SHACL's.
  const [world, setWorld] = useState<World>('owl');
  const [worldText, setWorldText] = useState('');
  const wRun = useRef(0);

  const html = useMemo(() => ({
    ttl: linesHtml(TTL, 'turtle'),
    report: linesHtml(REPORT, 'walktext'),
    shape: linesHtml(SHAPE, 'turtle'),
    source: linesHtml(SOURCE, 'yaml'),
    forms: FORMS.map(([lang, code]) => linesHtml(code, lang)),
  }), []);

  const panel = (n: number) => panels.current[n - 1];

  /** Shows step n, and plays its animation unless `play` is false. */
  const show = (n: number, play = true) => {
    curRef.current = n;
    ttlRun.current++;
    setCur(n);
    if (play) setPlayed((p) => ({ step: n, n: p.n + 1 }));
  };

  // The keys and the panel fade in whenever the step changes.
  useEffect(() => {
    anim(keys.current, { opacity: [0, 1], x: [-8, 0] }, { duration: 0.3 });
    anim(panel(cur), { opacity: [0, 1] }, { duration: 0.25 });
  }, [cur]);

  // The first time the deep dive scrolls into view on step 1, the story plays.
  useEffect(() => {
    let seen = false;
    return inView(root.current!, () => { if (!seen && curRef.current === 1) { seen = true; setPlayed((p) => ({ step: 1, n: p.n + 1 })); } }, { amount: 0.3 });
  }, []);

  // ---------- Step animations ----------
  useEffect(() => {
    if (!played.n) return;
    const p = panel(played.step);
    if (!p) return;
    const steps: Record<number, () => void> = {
      1: () => {
        const svg = p.querySelector('svg')!;
        anim(svg.querySelectorAll('.sc'), { opacity: [0, 1], y: [8, 0] }, { duration: 0.4, delay: dl(0, 0.08) });
        const ev = svg.querySelectorAll('.se'), ar = svg.querySelectorAll('.sa');
        hideAll(ev);
        anim(ev[0], { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, delay: 0.5 });
        drawIn([ar[0]], 1.0);
        anim(ev[1], { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, delay: 1.4 });
        drawIn([ar[1]], 1.9);
        anim(ev[2], { opacity: [0, 1], y: [10, 0], scale: [0.96, 1] }, { duration: 0.45, delay: 2.3 });
      },
      2: () => {
        const svg = p.querySelector('svg')!;
        const cls = svg.querySelectorAll('.cls'); hideAll(cls);
        anim(cls, { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, delay: dl(0, 0.1) });
        drawIn(svg.querySelectorAll('.isa'), 0.8);
        drawIn(svg.querySelectorAll('.rel'), 1.4);
        const rl = svg.querySelectorAll('.rl'); hideAll(rl);
        anim(rl, { opacity: [0, 1] }, { duration: 0.3, delay: dl(1.8, 0.12) });
      },
      3: () => { requestAnimationFrame(() => setT(0)); },
      4: () => { playGit(p); },
      6: () => { ++wRun.current; showWorld('owl'); },
      7: () => {
        const src = p.querySelector('.form.src')!, forms = p.querySelectorAll('.form:not(.src)'), gen = p.querySelector('.genbar')!;
        hideAll([src, gen, ...forms]);
        anim(src, { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, delay: 0.1 });
        anim(gen, { opacity: [0, 1], scaleX: [0.2, 1] }, { duration: 0.5, delay: 0.7 });
        anim(forms, { opacity: [0, 1], y: [-10, 0] }, { duration: 0.4, delay: dl(1.3, 0.15) });
      },
    };
    steps[played.step]?.();
    // Steps 5 and 6 then wait before they go on; the waits are timers so a step change can cancel them.
    if (played.step === 5) {
      const t = setTimeout(() => { if (curRef.current === 5) validate(); }, reduce ? 0 : 500);
      return () => clearTimeout(t);
    }
    if (played.step === 6) {
      const my = wRun.current;
      const t = setTimeout(() => { if (my === wRun.current && curRef.current === 6) showWorld('shacl'); }, reduce ? 0 : 2600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played]);

  // ---------- Step 3: read the Turtle one sentence at a time ----------
  const setT = (i: number) => { flushSync(() => { setTi(i); setTiShown(i); }); placeBand(i); };
  const placeBand = (i: number) => {
    const s = TS[i], box = ttlBox.current, lines = ttlPre.current?.querySelectorAll('.ln');
    if (!box || !lines) return;
    const base = box.getBoundingClientRect().top - box.scrollTop;
    const top = lines[s.a].getBoundingClientRect().top - base;
    const h = lines[s.z].getBoundingClientRect().bottom - lines[s.a].getBoundingClientRect().top;
    anim(band.current, { top: top + 'px', height: h + 'px', opacity: 1 }, { duration: 0.4, ease: [0.22, 1, 0.36, 1] });
    anim(triple.current?.querySelectorAll('.part'), { opacity: [0, 1], y: [6, 0] }, { duration: 0.3, delay: dl(0, 0.08) });
    anim(reading.current, { opacity: [0, 1] }, { duration: 0.3, delay: 0.2 });
  };
  const playTtl = async () => {
    const my = ++ttlRun.current;
    for (let i = 0; i < TS.length; i++) {
      if (my !== ttlRun.current) return;
      setT(i);
      await wait(2600);
    }
  };
  const onTtlClick = (e: React.MouseEvent) => {
    const ln = (e.target as Element).closest('.ln');
    if (!ln || !ttlPre.current) return;
    const i = Array.from(ttlPre.current.children).indexOf(ln);
    const k = TS.findIndex((s) => i >= s.a && i <= s.z);
    if (k >= 0) { ttlRun.current++; setT(k); }
  };

  // ---------- Step 4: a pull request merges ----------
  const playGit = async (p: HTMLDivElement) => {
    const svg = p.querySelector('svg')!;
    drawIn([svg.querySelector('.gmain')!], 0);
    const main = svg.querySelectorAll('.gc:not(.br):not(.mg)'), tags = svg.querySelectorAll('.gtag:not(.new)');
    hideAll(svg.querySelectorAll('.gc, .gtag'));
    anim(main, { opacity: [0, 1], scale: [0.4, 1] }, { duration: 0.3, delay: dl(0.3, 0.15) });
    anim(tags, { opacity: [0, 1], y: [-6, 0] }, { duration: 0.3, delay: dl(0.4, 0.15) });
    drawIn([svg.querySelector('.gbranch')!], 0.9);
    anim(svg.querySelectorAll('.gc.br'), { opacity: [0, 1], scale: [0.4, 1] }, { duration: 0.3, delay: dl(1.3, 0.25) });
    setGitOk(0);
    const merge = p.querySelector<HTMLElement>('.gmerge')!;
    merge.style.opacity = '0';
    await wait(1900);
    const items = p.querySelectorAll('.gck li');
    for (let i = 0; i < items.length; i++) {
      if (curRef.current !== 4) return;
      flushSync(() => setGitOk(i + 1));
      anim(items[i].querySelector('i'), { scale: [0.4, 1] }, { duration: 0.25 });
      await wait(420);
    }
    anim(svg.querySelector('.gc.mg'), { opacity: [0, 1], scale: [0.3, 1.2, 1] }, { duration: 0.45 });
    anim(svg.querySelector('.gtag.new'), { opacity: [0, 1], y: [-8, 0] }, { duration: 0.35, delay: 0.2 });
    anim(merge, { opacity: [0, 1], x: [-6, 0] }, { duration: 0.3, delay: 0.3 });
  };

  // ---------- Step 5: SHACL checks two chargebacks ----------
  const validate = async () => {
    const my = ++vRun.current;
    const p = panel(5)!;
    flushSync(() => { setMarks({ a: [null, null, null], b: [null, null, null] }); setRecs('idle'); setReport(false); });
    const rows = p.querySelectorAll('.rrow:not(.rh)');
    for (let r = 0; r < RULES.length; r++) {
      if (my !== vRun.current) return;
      anim(rows[r], { backgroundColor: ['rgba(175,169,236,0.25)', 'rgba(175,169,236,0)'] }, { duration: 0.8 });
      for (const c of ['a', 'b'] as const) {
        await wait(260);
        if (my !== vRun.current) return;
        flushSync(() => setMarks((m) => ({ ...m, [c]: m[c].map((v, k) => (k === r ? (RESULTS[c][r] ? 'ok' : 'no') : v)) })));
        anim(p.querySelector(`.mk[data-r="${r}"][data-c="${c}"]`), { scale: [0.3, 1] }, { duration: 0.25 });
      }
    }
    await wait(300);
    if (my !== vRun.current) return;
    flushSync(() => { setRecs('done'); setReport(true); });
    anim(p.querySelector('#recB'), { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.45 });
    anim(p.querySelector('#ddReport'), { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, delay: 0.2 });
  };
  const toggleShape = () => {
    const open = !shapeOpen;
    flushSync(() => setShapeOpen(open));
    if (open) anim(panel(5)?.querySelector('#ddShapeBox'), { opacity: [0, 1], y: [6, 0] }, { duration: 0.3 });
  };

  // ---------- Step 6: open world, closed world ----------
  const showWorld = (w: World) => {
    const p = panel(6)!;
    const owl = w === 'owl';
    flushSync(() => { setWorld(w); setWorldText(WORLD_TEXT[w]); });
    anim(p.querySelector('#wGhost'), { opacity: owl ? 1 : 0.12 }, { duration: 0.4 });
    anim(p.querySelector('#wX'), { opacity: owl ? 0 : 1, scale: owl ? 0.6 : [0.4, 1] }, { duration: 0.35 });
    anim(p.querySelector('#ddWorldText'), { opacity: [0, 1] }, { duration: 0.3 });
  };

  // The band stays over the current sentence if the panel is shown again.
  useLayoutEffect(() => { if (cur === 3 && tiShown !== null) placeBand(ti); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = TS[ti];
  const labels = s.labels ?? ['Subject', 'Predicate', 'Object'];
  const mark = (c: 'a' | 'b', r: number) => {
    const m = marks[c][r];
    return <span className={'mk' + (m ? ' ' + m : '')} data-r={r} data-c={c}>{m === 'ok' ? '✓' : m === 'no' ? '✕' : ''}</span>;
  };

  return (
    <section className="block dd" id="dd1" aria-labelledby="dd1h" ref={root}>
      <h3 className="sech" id="dd1h">Deep dive: the building blocks, through one payment</h3>
      <p className="intro">One small story, followed through each tool in the ontology toolkit: what OWL, Turtle, Git and SHACL each do, and how the same idea turns up in Neptune and OpenSearch.</p>
      <Stepper id="ddsteps" label="Deep dive steps" titles={STEPS.map((x) => x.t)} cur={cur} onPick={(n) => show(n)} />
      <div className="sdetail">
        <Keys id="ddkeys" ref={keys} title={STEPS[cur - 1].t} keys={STEPS[cur - 1].keys}
          next={cur < STEPS.length ? { label: 'Next: ' + STEPS[cur].t, onClick: () => show(cur + 1) } : { label: 'Next: how version 1 gets made', href: '#v1h' }} />
        <div className="sviz">

          <div className="dpanel" data-d="1" hidden={cur !== 1} ref={(el) => { panels.current[0] = el; }}>
            <div className="xwrap"><svg id="ddStory" viewBox="0 0 760 250" style={SVG_STYLE(600)} role="img" aria-label="Maya orders dinner online from Harbor Grill; the payment is authorized, captured, and later charged back with reason 10.4">
              <g className="sc"><rect className="evbox" x="20" y="16" width="165" height="56" rx="10" /><text className="evt" x="36" y="40">Maya</text><text className="evs" x="36" y="60">Cardholder</text></g>
              <g className="sc"><rect className="evbox" x="205" y="16" width="165" height="56" rx="10" /><text className="evt" x="221" y="40">Harbor Grill</text><text className="evs" x="221" y="60">Merchant, MCC 5812</text></g>
              <g className="sc"><rect className="evbox" x="390" y="16" width="165" height="56" rx="10" /><text className="evt" x="406" y="40">First Bay Bank</text><text className="evs" x="406" y="60">Issuer</text></g>
              <g className="sc"><rect className="evbox" x="575" y="16" width="165" height="56" rx="10" /><text className="evt" x="591" y="40">Coastal Acquiring</text><text className="evs" x="591" y="60">Acquirer</text></g>
              <path className="le" d="M30,160 L730,160" style={{ opacity: '.5' }} />
              <g className="se"><rect className="evbox" x="30" y="125" width="190" height="72" rx="10" /><rect x="38" y="137" width="3" height="48" rx="1.5" style={{ fill: 'var(--graph)' }} /><text className="evt" x="52" y="148">Authorization</text><text className="evs" x="52" y="167">Aug 3, $42.50 approved</text><text className="evs" x="52" y="185">card not present</text></g>
              <path className="le sa" d="M220,160 L284,160" markerEnd="url(#mg-line)" />
              <g className="se"><rect className="evbox" x="285" y="125" width="190" height="72" rx="10" /><rect x="293" y="137" width="3" height="48" rx="1.5" style={{ fill: 'var(--graph)' }} /><text className="evt" x="307" y="148">Capture</text><text className="evs" x="307" y="167">Aug 4, $42.50 captured</text><text className="evs" x="307" y="185">merchant claims funds</text></g>
              <path className="le sa" d="M475,160 L539,160" markerEnd="url(#mg-line)" />
              <g className="se"><rect className="evbox" x="540" y="125" width="190" height="72" rx="10" /><rect x="548" y="137" width="3" height="48" rx="1.5" style={{ fill: 'var(--bad)' }} /><text className="evt" x="562" y="148">Chargeback</text><text className="evs" x="562" y="167">Aug 19, reason 10.4</text><text className="evs" x="562" y="185">Maya: not my order</text></g>
              <text className="evs" x="380" y="236" textAnchor="middle">Things that happened: in ontology terms, these are instances.</text>
            </svg></div>
          </div>

          <div className="dpanel" data-d="2" hidden={cur !== 2} ref={(el) => { panels.current[1] = el; }}>
            <div className="xwrap"><svg id="ddOwl" viewBox="0 0 760 300" style={SVG_STYLE(600)} role="img" aria-label="Class diagram: Authorization, Capture and DisputeEvent are kinds of PaymentEvent; Chargeback is a kind of DisputeEvent; Capture captures an Authorization; Chargeback disputes a Capture and has a ReasonCode; Authorization is at a Merchant">
              <path className="isa" d="M120,110 L120,90 L330,90 L330,75" markerEnd="url(#mg-isa)" />
              <path className="isa" d="M380,110 L380,75" markerEnd="url(#mg-isa)" />
              <path className="isa" d="M640,110 L640,90 L430,90 L430,75" markerEnd="url(#mg-isa)" />
              <path className="isa" d="M640,210 L640,165" markerEnd="url(#mg-isa)" />
              <path className="rel" d="M300,137 L202,137" markerEnd="url(#mg-onto)" />
              <path className="rel" d="M560,225 L500,225 L500,137 L462,137" markerEnd="url(#mg-onto)" />
              <path className="rel" d="M560,250 L462,250" markerEnd="url(#mg-onto)" />
              <path className="rel" d="M120,164 L120,208" markerEnd="url(#mg-onto)" />
              <g className="cls"><rect className="evbox" x="300" y="20" width="160" height="54" rx="10" /><text className="evt" x="380" y="43" textAnchor="middle">PaymentEvent</text><text className="evs" x="380" y="61" textAnchor="middle">class</text></g>
              <g className="cls"><rect className="evbox" x="40" y="110" width="160" height="54" rx="10" /><text className="evt" x="120" y="133" textAnchor="middle">Authorization</text><text className="evs" x="120" y="151" textAnchor="middle">class</text></g>
              <g className="cls"><rect className="evbox" x="300" y="110" width="160" height="54" rx="10" /><text className="evt" x="380" y="133" textAnchor="middle">Capture</text><text className="evs" x="380" y="151" textAnchor="middle">class</text></g>
              <g className="cls"><rect className="evbox" x="560" y="110" width="160" height="54" rx="10" /><text className="evt" x="640" y="133" textAnchor="middle">DisputeEvent</text><text className="evs" x="640" y="151" textAnchor="middle">class</text></g>
              <g className="cls"><rect className="evbox" x="40" y="210" width="160" height="54" rx="10" /><text className="evt" x="120" y="233" textAnchor="middle">Merchant</text><text className="evs" x="120" y="251" textAnchor="middle">class</text></g>
              <g className="cls"><rect className="evbox" x="300" y="210" width="160" height="54" rx="10" /><text className="evt" x="380" y="233" textAnchor="middle">ReasonCode</text><text className="evs" x="380" y="251" textAnchor="middle">class</text></g>
              <g className="cls hot"><rect className="evbox" x="560" y="210" width="160" height="54" rx="10" /><text className="evt" x="640" y="233" textAnchor="middle">Chargeback</text><text className="evs" x="640" y="251" textAnchor="middle">class</text></g>
              <text className="rl" x="251" y="128" textAnchor="middle">CAPTURES</text>
              <text className="rl" x="507" y="184">DISPUTES</text>
              <text className="rl" x="511" y="242" textAnchor="middle">HAS_REASON</text>
              <text className="rl" x="128" y="192">AT_MERCHANT</text>
            </svg></div>
            <div className="ddlegend"><span><i className="lrel"></i>Relationship between classes</span><span><i className="lisa"></i>Is a kind of (subclass)</span></div>
            <p className="note">Maya's dinner isn't here. OWL describes kinds of things and the rules for connecting them; the payments themselves live in Neptune.</p>
          </div>

          <div className="dpanel" data-d="3" hidden={cur !== 3} ref={(el) => { panels.current[2] = el; }}>
            <div className="ttlgrid">
              <div className="ddcode" id="ddTtlBox" ref={ttlBox}><div className="ddband" id="ddTtlBand" ref={band}></div><pre id="ddTtl" ref={ttlPre} onClick={onTtlClick} dangerouslySetInnerHTML={{ __html: html.ttl }} /></div>
              <div>
                <p className="vcap">Every Turtle line is one sentence with three parts</p>
                <div className="triple" id="ddTriple" ref={triple}>
                  {tiShown !== null && s.p.map((x, k) => (
                    <TriplePart key={k} k={k} label={labels[k]} text={x} last={k === 2} />
                  ))}
                </div>
                <p className="reading" id="ddReading" ref={reading}>{tiShown !== null ? s.r : ''}</p>
                <div className="vbtns" style={{ marginTop: '14px' }}>
                  <button type="button" className="vbtn" id="ddTtlPrev" onClick={() => { ttlRun.current++; setT((ti - 1 + TS.length) % TS.length); }}>Previous</button>
                  <button type="button" className="vbtn go" id="ddTtlNext" onClick={() => { ttlRun.current++; setT((ti + 1) % TS.length); }}>Next line</button>
                  <button type="button" className="vbtn" id="ddTtlPlay" onClick={playTtl}>Play all</button>
                </div>
                <p className="note">Tip: click any line on the left to read it.</p>
              </div>
            </div>
          </div>

          <div className="dpanel" data-d="4" hidden={cur !== 4} ref={(el) => { panels.current[3] = el; }}>
            <div className="xwrap"><svg id="ddGit" viewBox="0 0 760 150" style={SVG_STYLE(560)} role="img" aria-label="Git history: main branch with version tags; a branch adds PreArbitration to the LinkML source and merges back as version 1.6.0">
              <path className="gmain" d="M30,56 L730,56" />
              <path className="gbranch" d="M290,56 C315,56 315,112 345,112 L525,112 C555,112 555,56 580,56" />
              <g className="gc"><circle cx="70" cy="56" r="8" /></g><g className="gc"><circle cx="190" cy="56" r="8" /></g><g className="gc"><circle cx="290" cy="56" r="8" /></g>
              <g className="gc br"><circle cx="390" cy="112" r="8" /></g><g className="gc br"><circle cx="470" cy="112" r="8" /></g>
              <g className="gc mg"><circle cx="580" cy="56" r="10" /></g>
              <g className="gtag"><rect x="42" y="14" width="56" height="20" rx="10" /><text x="70" y="28">v1.4.0</text></g>
              <g className="gtag"><rect x="162" y="14" width="56" height="20" rx="10" /><text x="190" y="28">v1.5.0</text></g>
              <g className="gtag new"><rect x="552" y="14" width="56" height="20" rx="10" /><text x="580" y="28">v1.6.0</text></g>
              <text className="gl" x="360" y="140">branch: add-prearbitration</text>
              <text className="gl" x="640" y="80">main</text>
            </svg></div>
            <div className="gitgrid">
              <pre className="ftree">{`ontology-repo/
├── payments.yaml       `}<span>LinkML source</span>{`
├── generated/          `}<span>OWL, SHACL, by CI</span>{`
├── CODEOWNERS          `}<span>module owners</span>{`
├── competency-questions/
│   └── cq-01.cypher    `}<span>tests</span>{`
└── CHANGELOG.md        `}<span>releases</span></pre>
              <div className="prbox">
                <div className="prhead"><span className="prnum">PR #212</span><span className="tier" style={{ '--c': 'var(--onto)' } as CSSProperties}>minor</span></div>
                <h4>Add PreArbitration as a kind of DisputeEvent</h4>
                <div className="diff"><div className="ctx">  classes:</div><div className="add">+   PreArbitration:</div><div className="add">+     is_a: DisputeEvent</div><div className="add">+     description: Issuer challenges the</div><div className="add">+       merchant's response.</div></div>
                <ul className="gck" id="ddGck">
                  {['Schema lint passes', 'Generators produced all artifacts', 'Competency questions pass', 'Disputes owner approved'].map((t, i) => (
                    <li key={t} className={i < gitOk ? 'ok' : undefined}><i></i>{t}</li>
                  ))}
                </ul>
                <p className="gmerge" id="ddMerge">Merged and tagged v1.6.0</p>
              </div>
            </div>
          </div>

          <div className="dpanel" data-d="5" hidden={cur !== 5} ref={(el) => { panels.current[4] = el; }}>
            <div className="vbtns"><button type="button" className="vbtn go" id="ddValidate" onClick={validate}>Validate</button><button type="button" className="vbtn" id="ddShapeBtn" aria-expanded={shapeOpen} onClick={toggleShape}>{shapeOpen ? 'Hide the shape' : 'Show the shape in SHACL'}</button></div>
            <div className="recs">
              <div className={'rec' + (recs === 'done' ? ' pass' : '')} id="recA"><b>cb:1001</b><span className="rt">Chargeback</span><ul><li><code>DISPUTES</code> cap:7731</li><li><code>HAS_REASON</code> rc:visa:10.4</li><li><code>opened_at</code> 2026-08-19</li></ul></div>
              <div className={'rec' + (recs === 'done' ? ' fail' : '')} id="recB"><b>cb:991</b><span className="rt">Chargeback</span><ul><li className="missing"><code>DISPUTES</code> nothing</li><li><code>HAS_REASON</code> rc:visa:10.4</li><li><code>opened_at</code> 2026-08-21</li></ul></div>
            </div>
            <div className="rules">
              <div className="rrow rh"><span>The shape's rules</span><span>cb:1001</span><span>cb:991</span></div>
              {RULES.map((rule, r) => <div key={rule} className="rrow"><span>{rule}</span>{mark('a', r)}{mark('b', r)}</div>)}
            </div>
            <div className="ddcode report" id="ddReport" hidden={!report}><pre id="ddReportPre" dangerouslySetInnerHTML={{ __html: html.report }} /></div>
            <div className="ddcode" id="ddShapeBox" hidden={!shapeOpen}><pre id="ddShape" dangerouslySetInnerHTML={{ __html: html.shape }} /></div>
          </div>

          <div className="dpanel" data-d="6" hidden={cur !== 6} ref={(el) => { panels.current[5] = el; }}>
            <div className="vbtns" id="ddWorlds">
              <button type="button" className="vbtn" data-w="owl" aria-pressed={world === 'owl'} onClick={() => { wRun.current++; showWorld('owl'); }}>OWL's view</button>
              <button type="button" className="vbtn" data-w="shacl" aria-pressed={world === 'shacl'} onClick={() => { wRun.current++; showWorld('shacl'); }}>SHACL's view</button>
            </div>
            <div className="xwrap"><svg id="ddWorld" viewBox="0 0 760 220" style={SVG_STYLE(560)} role="img" aria-label="Chargeback cb:991 has a reason code but no capture link; OWL treats the capture as unknown, SHACL treats it as missing">
              <path className="rel" d="M240,150 L519,172" markerEnd="url(#mg-onto)" />
              <text className="rl" x="380" y="186" textAnchor="middle">HAS_REASON</text>
              <path id="wEdge" className={'wedge' + (world === 'shacl' ? ' bad' : '')} d="M240,100 L519,50" />
              <text className="rl" id="wEdgeL" x="380" y="50" textAnchor="middle">DISPUTES</text>
              <g className={'cls' + (world === 'shacl' ? ' badn' : '')} id="wNode"><rect className="evbox" x="40" y="96" width="200" height="60" rx="10" /><text className="evt" x="60" y="121">cb:991</text><text className="evs" x="60" y="141">Chargeback</text></g>
              <g className="cls"><rect className="evbox" x="520" y="148" width="200" height="54" rx="10" /><text className="evt" x="540" y="171">rc:visa:10.4</text><text className="evs" x="540" y="189">ReasonCode</text></g>
              <g id="wGhost"><rect className="ghostbox" x="520" y="22" width="200" height="54" rx="10" /><text className="evt" x="540" y="45">Capture ?</text><text className="evs" x="540" y="63">exists, not yet known</text></g>
              <g id="wX" opacity="0"><circle cx="380" cy="75" r="13" style={{ fill: 'var(--bad)' }} /><text x="380" y="80" style={{ fill: 'var(--paper)', fontSize: '14px', fontWeight: '800', textAnchor: 'middle' }}>✕</text></g>
            </svg></div>
            <p className="reading" id="ddWorldText">{worldText}</p>
          </div>

          <div className="dpanel" data-d="7" hidden={cur !== 7} ref={(el) => { panels.current[6] = el; }}>
            <div className="forms">
              <div className="form src"><div className="fh"><b>Source</b><span className="fk hand">LinkML, written by people</span><code className="fpath">ontology/payments.yaml</code></div><div className="ddcode"><pre id="ddSrc" dangerouslySetInnerHTML={{ __html: html.source }} /></div></div>
              <div className="genbar" id="ddGen">Generators: OWL, SHACL, label chains, loader headers, index mappings</div>
              <div className="form" data-f="0"><div className="fh"><b>Ontology</b><span className="fk gen">OWL in Turtle, generated</span></div><div className="ddcode"><pre id="ddF0" dangerouslySetInnerHTML={{ __html: html.forms[0] }} /></div></div>
              <div className="form" data-f="1"><div className="fh"><b>Rule</b><span className="fk gen">SHACL, generated</span></div><div className="ddcode"><pre id="ddF1" dangerouslySetInnerHTML={{ __html: html.forms[1] }} /></div></div>
              <div className="form" data-f="2"><div className="fh"><b>Neptune</b><span className="fk gen">openCypher, shape generated</span></div><div className="ddcode"><pre id="ddF2" dangerouslySetInnerHTML={{ __html: html.forms[2] }} /></div></div>
              <div className="form" data-f="3"><div className="fh"><b>OpenSearch</b><span className="fk gen">entities index, generated</span></div><div className="ddcode"><pre id="ddF3" dangerouslySetInnerHTML={{ __html: html.forms[3] }} /></div></div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/** One part of a Turtle sentence, then an arrow unless it's the last. */
function TriplePart({ k, label, text, last }: { k: number; label: string; text: string; last: boolean }) {
  return (
    <>
      <div className="part" style={{ '--c': PART_COLORS[k] } as CSSProperties}><small>{label || '\u00a0'}</small><code>{text}</code></div>
      {!last && <span className="tar">→</span>}
    </>
  );
}
