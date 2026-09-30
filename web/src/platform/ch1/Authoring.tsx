import { inView } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { reduce } from '../../kit/motion';
import { anim, dl, wait } from '../shared/anim';
import { linesHtml } from '../shared/lines';
import { Stepper } from '../shared/Stepper';

// Turtle or LinkML, side by side: the same slice of the ontology written both ways.

type Range = [first: number, last: number];
type Step = {
  t: string; capT?: string; capL?: string; langT?: string; langL?: string; T?: string; L?: string;
  /** What to compare, with the lines it covers on the Turtle side, then on the LinkML side. */
  pairs?: [label: string, turtle: Range, linkml: Range][];
  extra?: { title: string; lang: string; code: string };
  note?: string; verdict?: boolean;
};
const J = (a: string[]) => a.join('\n');

const STEPS: Step[] = [
  { t: 'Repository', capT: 'the repository', capL: 'the repository', langT: 'tree', langL: 'tree',
    T: J(['ontology-repo/', '├── ontology/', '│   ├── payments.ttl          classes, relationships', '│   └── codes/visa.ttl        reason code lists', '├── shapes/', '│   └── chargeback.ttl        SHACL rules, by hand', '├── generator/                all of our code generation', '├── competency-questions/     Cypher tests', '└── CHANGELOG.md']),
    L: J(['ontology-repo/', '├── schema/', '│   ├── payments.yaml         classes, slots and rules', '│   └── codes.yaml            reason code enums', '├── generated/                OWL, SHACL, Pydantic, JSON Schema', '│                             written by CI, never by hand', '├── generator/                only Neptune and OpenSearch', '├── competency-questions/     Cypher tests', '└── CHANGELOG.md']),
    pairs: [['Classes and relationships', [2, 2], [2, 2]], ['Code lists', [3, 3], [3, 3]], ['Rules', [4, 5], [2, 2]], ['Generated files', [6, 6], [4, 5]], ['Our own generator', [6, 6], [6, 6]], ['Tests', [7, 7], [7, 7]]],
    note: 'The Turtle side has more hand-written files. The LinkML side has one schema and a folder CI fills in.' },
  { t: 'A class', capT: 'ontology/payments.ttl', capL: 'schema/payments.yaml', langT: 'turtle', langL: 'yaml',
    T: J(['@prefix pay:  <https://ontology.example.com/payments/> .', '@prefix owl:  <http://www.w3.org/2002/07/owl#> .', '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .', '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .', '', 'pay:Chargeback  a  owl:Class ;', '    rdfs:subClassOf  pay:DisputeEvent ;', '    skos:prefLabel   "Chargeback"@en ;', '    skos:altLabel    "CB"@en , "chargeback case"@en ;', '    skos:definition  """A dispute event in which the issuer, through the', '      card network, reverses all or part of a captured transaction', '      for the cardholder."""@en ;', '    pay:owner        "disputes" .']),
    L: J(['id: https://ontology.example.com/payments', 'name: payments', 'prefixes:', '  pay: https://ontology.example.com/payments/', 'default_prefix: pay', '', 'classes:', '  Chargeback:', '    is_a: DisputeEvent', '    title: Chargeback', '    aliases: [CB, chargeback case]', '    description: >-', '      A dispute event in which the issuer, through the card network,', '      reverses all or part of a captured transaction for the cardholder.', '    annotations:', '      owner: disputes']),
    pairs: [['Namespace', [0, 3], [0, 4]], ['The class', [5, 5], [7, 7]], ['Parent class', [6, 6], [8, 8]], ['Names people use', [7, 8], [9, 10]], ['Definition', [9, 11], [11, 13]], ['Owner', [12, 12], [14, 15]]],
    note: 'Same meaning, two notations. Turtle writes triples; LinkML writes YAML that reads like configuration.' },
  { t: 'Relationships', capT: 'ontology/payments.ttl', capL: 'schema/payments.yaml', langT: 'turtle', langL: 'yaml',
    T: J(['pay:disputes  a  owl:ObjectProperty ;', '    rdfs:domain      pay:DisputeEvent ;', '    rdfs:range       pay:Capture ;', '    skos:definition  "Links a dispute event to the capture it contests."@en .', '', 'pay:openedAt  a  owl:DatatypeProperty ;', '    rdfs:domain  pay:DisputeEvent ;', '    rdfs:range   xsd:dateTime .']),
    L: J(['slots:', '  disputes:', '    slot_uri: pay:disputes', '    domain: DisputeEvent', '    range: Capture', '    description: Links a dispute event to the capture it contests.', '  opened_at:', '    slot_uri: pay:openedAt', '    range: datetime']),
    pairs: [['A relationship', [0, 0], [1, 2]], ['Where it starts', [1, 1], [3, 3]], ['Where it points', [2, 2], [4, 4]], ['Definition', [3, 3], [5, 5]], ['A date property', [5, 7], [6, 8]]],
    note: 'OWL calls these properties; LinkML calls them slots. Both end up as the DISPUTES relationship in Neptune.' },
  { t: 'Rules', capT: 'shapes/chargeback.ttl, by hand', capL: 'schema/payments.yaml', langT: 'turtle', langL: 'yaml',
    T: J(['@prefix sh: <http://www.w3.org/ns/shacl#> .', '', 'pay:ChargebackShape  a  sh:NodeShape ;', '    sh:targetClass  pay:Chargeback ;', '    sh:property [ sh:path pay:disputes ;  sh:class pay:Capture ;', '                  sh:minCount 1 ;  sh:maxCount 1 ] ;', '    sh:property [ sh:path pay:hasReason ;  sh:class pay:ReasonCode ;', '                  sh:minCount 1 ] ;', '    sh:property [ sh:path pay:openedAt ;  sh:datatype xsd:dateTime ;', '                  sh:minCount 1 ] .']),
    L: J(['classes:', '  Chargeback:', '    is_a: DisputeEvent', '    slots: [disputes, has_reason, opened_at]', '    slot_usage:', '      disputes:', '        required: true', '      has_reason:', '        required: true', '        multivalued: true', '      opened_at:', '        required: true']),
    pairs: [['Which class', [2, 3], [1, 1]], ['Exactly one capture', [4, 5], [5, 6]], ['At least one reason', [6, 7], [7, 9]], ['A required date', [8, 9], [10, 11]]],
    extra: { title: 'What gen-shacl writes for the LinkML side (trimmed)', lang: 'turtle', code: J(['pay:Chargeback  a  sh:NodeShape ;', '    sh:targetClass  pay:Chargeback ;', '    sh:closed  true ;', '    sh:property [ sh:path pay:disputes ; sh:class pay:Capture ;', '                  sh:minCount 1 ; sh:maxCount 1 ] ;', '    sh:property [ sh:path pay:hasReason ; sh:class pay:ReasonCode ;', '                  sh:minCount 1 ] .']) },
    note: 'In LinkML, a slot is single-valued unless you say multivalued, so disputes becomes exactly one. Its generated shapes are also closed by default: an unexpected property fails validation.' },
  { t: 'A code list', capT: 'ontology/codes/visa.ttl', capL: 'schema/codes.yaml', langT: 'turtle', langL: 'yaml',
    T: J(['pay:VisaReasonCodes  a  skos:ConceptScheme ;', '    skos:prefLabel  "Visa dispute reason codes"@en .', '', 'pay:visa-10.4  a  skos:Concept ;', '    skos:inScheme   pay:VisaReasonCodes ;', '    skos:notation   "10.4" ;', '    skos:prefLabel  "Other Fraud: Card-Absent Environment"@en .', '', 'pay:visa-13.1  a  skos:Concept ;', '    skos:inScheme   pay:VisaReasonCodes ;', '    skos:notation   "13.1" ;', '    skos:prefLabel  "Merchandise/Services Not Received"@en .']),
    L: J(['enums:', '  VisaReasonCode:', '    description: Visa dispute reason codes', '    permissible_values:', '      "10.4":', '        description: "Other Fraud: Card-Absent Environment"', '        meaning: pay:visa-10.4', '      "13.1":', '        description: "Merchandise/Services Not Received"', '        meaning: pay:visa-13.1']),
    pairs: [['The list', [0, 1], [1, 2]], ['Code 10.4', [3, 6], [4, 6]], ['Code 13.1', [8, 11], [7, 9]]],
    note: 'Either way, each code is loaded into Neptune as a ReasonCode node, so documents and chargebacks can link to it. Adding a code is a patch release.' },
  { t: 'A change', capT: 'pull request diff', capL: 'pull request diff', langT: 'diffx', langL: 'diffx',
    T: J(['  pay:DisputeEvent  a  owl:Class .', '+ pay:PreArbitration  a  owl:Class ;', '+     rdfs:subClassOf  pay:DisputeEvent ;', "+     skos:definition  \"Issuer challenges the merchant's", '+       response before arbitration."@en ;', '+     pay:owner  "disputes" .']),
    L: J(['  classes:', '+   PreArbitration:', '+     is_a: DisputeEvent', '+     description: >-', "+       Issuer challenges the merchant's response before arbitration.", '+     annotations:', '+       owner: disputes']),
    pairs: [['New class', [1, 1], [1, 1]], ['Parent', [2, 2], [2, 2]], ['Definition', [3, 4], [3, 4]], ['Owner', [5, 5], [5, 6]]],
    note: 'Reviewers read the LinkML diff like any configuration change. The Turtle diff needs a little RDF literacy.' },
  { t: 'CI', capT: 'the pipeline', capL: 'the pipeline', langT: 'cli', langL: 'cli',
    T: J(['# 1. Check the ontology', 'robot reason --reasoner ELK --input ontology/payments.ttl', 'robot report --input ontology/payments.ttl --output qc-report.tsv', '# 2. Check sample data against the rules', 'pyshacl -s shapes/chargeback.ttl sample-week.ttl', '# 3. Our generator writes everything else', 'python generator/generate.py --out build/']),
    L: J(['# 1. Check the schema', 'linkml-lint schema/payments.yaml', '# 2. Built-in generators', 'gen-owl schema/payments.yaml > generated/payments.owl.ttl', 'gen-shacl schema/payments.yaml > generated/shapes.ttl', 'gen-pydantic schema/payments.yaml > generated/models.py', 'gen-json-schema schema/payments.yaml > generated/payments.schema.json', 'gen-doc schema/payments.yaml -d docs/', '# 3. Our generator writes the rest', 'python generator/generate.py --out build/']),
    pairs: [['Check the source', [1, 2], [1, 1]], ['SHACL rules', [4, 4], [4, 4]], ['Code and docs', [6, 6], [5, 7]], ['Our generator', [6, 6], [9, 9]]],
    note: 'On the Turtle side, our generator produces everything. On the LinkML side, built-in generators cover most of it.' },
  { t: 'Our generator', capT: 'generator/generate.py, rdflib', capL: 'generator/generate.py, SchemaView', langT: 'python', langL: 'python',
    T: J(['from rdflib import Graph, OWL, RDF, RDFS', '', 'g = Graph().parse("ontology/payments.ttl")', 'for cls in g.subjects(RDF.type, OWL.Class):', '    if is_abstract(g, cls):', '        continue', '    chain = g.transitive_objects(cls, RDFS.subClassOf)', '    labels = ";".join(local_name(c) for c in chain)', '    write_node_header(cls, labels)']),
    L: J(['from linkml_runtime.utils.schemaview import SchemaView', '', 'sv = SchemaView("schema/payments.yaml")', 'for name, cls in sv.all_classes().items():', '    if cls.abstract:', '        continue', '    labels = ";".join(sv.class_ancestors(name))', '    slots = sv.class_induced_slots(name)', '    write_node_header(name, labels, slots)']),
    pairs: [['Load the ontology', [2, 2], [2, 2]], ['Every class', [3, 3], [3, 3]], ['Skip abstract classes', [4, 5], [4, 5]], ['Label chain', [6, 7], [6, 6]], ['Write the header', [8, 8], [7, 8]]],
    extra: { title: 'Both produce the same Neptune loader file', lang: 'csvx', code: J(['# build/neptune/chargeback_nodes.csv', ':ID,:LABEL,opened_at:DateTime,ontology_version:String', 'cb:1001,Chargeback;DisputeEvent;PaymentEvent,2026-08-19T14:05:00Z,1.6.0']) },
    note: 'On the Turtle side, is_abstract and local_name are small helpers you write yourself. LinkML has an abstract flag and the class chain built in.' },
  { t: 'Verdict', verdict: true },
];

/** Our read of the two, as bar widths out of 100: Turtle first, then LinkML. */
const VERDICT: [string, number, number][] = [
  ['Easy for every team to read and review', 40, 80],
  ['Full OWL expressiveness', 100, 60],
  ['Code and docs generated for free', 20, 80],
  ['Semantic-web tools: Protégé, ROBOT, reasoners', 100, 60],
];

export function Authoring() {
  const [sel, setSel] = useState({ i: 0, n: 1 });
  const [on, setOn] = useState(-1);
  const curRef = useRef(0), run = useRef(0);
  const root = useRef<HTMLElement>(null);
  const boxT = useRef<HTMLDivElement>(null), boxL = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLDivElement>(null), extra = useRef<HTMLDivElement>(null), verdict = useRef<HTMLDivElement>(null);
  const s = STEPS[sel.i];

  const html = useMemo(() => STEPS.map((x) => x.verdict ? null : {
    T: linesHtml(x.T!, x.langT!), L: linesHtml(x.L!, x.langL!), extra: x.extra && linesHtml(x.extra.code, x.extra.lang),
  }), []);

  const show = (i: number) => { curRef.current = i; run.current++; setOn(-1); setSel((p) => ({ i, n: p.n + 1 })); };

  /** Moves a box's band over lines r[0] to r[1]. */
  const band = (box: HTMLDivElement, r: Range) => {
    const L = box.querySelectorAll('pre .ln');
    if (!L[r[0]] || !L[r[1]]) return;
    const base = box.getBoundingClientRect().top - box.scrollTop;
    const top = L[r[0]].getBoundingClientRect().top - base, h = L[r[1]].getBoundingClientRect().bottom - L[r[0]].getBoundingClientRect().top;
    anim(box.querySelector('.ddband'), { top: top + 'px', height: h + 'px', opacity: 1 }, { duration: 0.4, ease: [0.22, 1, 0.36, 1] });
  };
  const pick = (k: number) => {
    const p = STEPS[curRef.current].pairs![k];
    setOn(k);
    band(boxT.current!, p[1]); band(boxL.current!, p[2]);
  };
  const cycle = async (my: number) => {
    const pairs = STEPS[curRef.current].pairs!;
    for (let k = 0; k < pairs.length; k++) { if (my !== run.current) return; pick(k); await wait(2400); }
  };

  // Each step fades its code in, then lights each pair of matching lines in turn.
  useEffect(() => {
    const my = run.current;
    if (s.verdict) {
      verdict.current!.querySelectorAll<HTMLElement>('.vbar i').forEach((b, k) => {
        if (reduce) { b.style.width = b.dataset.w + '%'; return; }
        b.style.width = '0%';
        anim(b, { width: ['0%', b.dataset.w + '%'] }, { duration: 0.7, delay: 0.1 + k * 0.06, ease: [0.22, 1, 0.36, 1] });
      });
      anim(verdict.current!.children, { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, delay: dl(0, 0.08) });
      return;
    }
    [boxT.current!, boxL.current!].forEach((b) => anim(b.querySelector('.ddband'), { opacity: 0 }, { duration: 0 }));
    anim([boxT.current!, boxL.current!], { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, delay: dl(0, 0.08) });
    anim(chips.current!.children, { opacity: [0, 1] }, { duration: 0.25, delay: dl(0.1, 0.04) });
    if (s.extra) anim(extra.current, { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, delay: 0.3 });
    requestAnimationFrame(() => { if (my === run.current) cycle(my); });
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrolling to the comparison the first time starts its cycle again from the top.
  useEffect(() => inView(root.current!, () => {
    if (!STEPS[curRef.current].verdict) cycle(++run.current);
  }, { amount: 0.25 }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const h = html[sel.i];
  return (
    <section className="block" id="authoring" aria-labelledby="authh" ref={root}>
      <h3 className="sech" id="authh">Turtle or LinkML, side by side</h3>
      <p className="intro">The same slice of the payments ontology, written both ways. Pick a step, then watch the matching lines light up on both sides.</p>
      <Stepper id="cmpSteps" label="Comparison steps" titles={STEPS.map((x) => x.t)} cur={sel.i + 1} onPick={(n) => show(n - 1)} />
      <div className="cmpchips" id="cmpChips" aria-label="What to compare" hidden={s.verdict} ref={chips}>
        {s.pairs?.map(([label], k) => <button key={sel.n + label} type="button" className={'cchip' + (k === on ? ' on' : '')} onClick={() => { run.current++; pick(k); }}>{label}</button>)}
      </div>
      <div className="cmpgrid" id="cmpGrid" hidden={s.verdict}>
        <div className="cmpcol"><div className="cmphead" style={{ '--c': 'var(--onto)' } as CSSProperties}><b>Turtle in Git</b><span id="cmpTcap">{s.capT}</span></div><div className="ddcode" id="cmpTbox" ref={boxT}><div className="ddband"></div><pre id="cmpT" dangerouslySetInnerHTML={{ __html: h?.T ?? '' }} /></div></div>
        <div className="cmpcol"><div className="cmphead" style={{ '--c': 'var(--query)' } as CSSProperties}><b>LinkML</b><span id="cmpLcap">{s.capL}</span></div><div className="ddcode" id="cmpLbox" ref={boxL}><div className="ddband"></div><pre id="cmpL" dangerouslySetInnerHTML={{ __html: h?.L ?? '' }} /></div></div>
      </div>
      <div className="cmpextra" id="cmpExtra" hidden={!s.extra} ref={extra}>
        {s.extra && <><p className="vcap">{s.extra.title}</p><div className="ddcode"><pre dangerouslySetInnerHTML={{ __html: h!.extra! }} /></div></>}
      </div>
      <p className="reading" id="cmpNote" aria-live="polite" hidden={s.verdict}>{s.note ?? ''}</p>
      <div className="cmpverdict" id="cmpVerdict" hidden={!s.verdict} ref={verdict}>
        <div className="vlegend"><span><i className="t"></i>Turtle in Git</span><span><i className="l"></i>LinkML</span><span className="vcap" style={{ margin: '0' }}>our read, not a benchmark</span></div>
        {VERDICT.map(([what, t, l]) => (
          <div key={what} className="vrow"><span>{what}</span><div className="vbars"><div className="vbar t"><i data-w={t}></i></div><div className="vbar l"><i data-w={l}></i></div></div></div>
        ))}
        <div className="vnote"><b>Either way,</b> we still write a small generator for the Neptune loader files and OpenSearch mappings.</div>
        <div className="vrec"><b>Our suggestion</b><span>Start in LinkML and publish the generated OWL as the product. If you need OWL axioms LinkML can’t express, keep a small hand-written Turtle file and merge it in CI with robot merge.</span></div>
      </div>
    </section>
  );
}
