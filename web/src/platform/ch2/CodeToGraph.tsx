import { useMemo, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { reduce } from '../../kit/motion';
import { anim, dl, drawIn, hideAll } from '../shared/anim';
import { DeepDive, XPanel, useDeepDive, useTour, type DDStep } from '../shared/DeepDive';
import { linesHtml } from '../shared/lines';

// Deep dive: one Java class from the disputes service, followed from source code to loader
// rules and one ontology proposal.

const STEPS: DDStep[] = [
  { t: 'The code', k: ['Real code from the disputes service', 'Names like TxnDsptRec hide the meaning', 'The pipeline reads structure, not just text'] },
  { t: 'Syntax tree', k: ['tree-sitter turns source code into a tree', 'A query picks out classes, fields and annotations', 'The same approach works across languages'] },
  { t: 'Facts', k: ['Structure is extracted exactly, with no LLM', 'Links come from annotations like @ManyToOne', 'Enums become candidate states or code lists'] },
  { t: 'Mapping', k: ['Claude reads the facts and the ontology', 'Every mapping carries a confidence and evidence', 'Low confidence waits for a person'] },
  { t: 'Two outputs', k: ['Reviewed mappings drive the loaders', 'Gaps become ontology pull requests', 'Neither changes meaning on its own'] },
];

const JAVA = [
  '@Entity',
  '@Table(name = "dispute_record")',
  'public class TxnDsptRec {',
  '    @Id private String disputeId;',
  '    @ManyToOne private CaptureRec capture;',
  '    private String reasonCd;',
  '    @Enumerated(EnumType.STRING)',
  '    private DisputeState state;',
  '}',
  '',
  'public enum DisputeState {',
  '    OPEN, REPRESENTED, PRE_ARBITRATION, CLOSED',
  '}',
].join('\n');
const TSQ = [
  '(class_declaration',
  '  (modifiers (marker_annotation',
  '    name: (identifier) @ann (#eq? @ann "Entity")))',
  '  name: (identifier) @entity.name)',
].join('\n');
const YAML = [
  'TxnDsptRec:',
  '  class: Chargeback',
  '  id: "cb:{disputeId}"',
  '  links:',
  '    capture: DISPUTES',
  '  fields:',
  '    reasonCd: HAS_REASON',
].join('\n');

const TOUR: [number, number, string][] = [
  [0, 1, '@Entity and @Table: this class is stored in the dispute_record table.'],
  [4, 4, '@ManyToOne: each dispute points at exactly one capture.'],
  [5, 5, 'A plain string field. The name hints at a reason code, nothing more.'],
  [6, 7, 'The state field only accepts values from an enum.'],
  [10, 12, 'The enum lists four dispute states. One of them is new to the ontology.'],
];

export function CodeToGraph() {
  const api = useDeepDive();
  const tour = useTour(api, TOUR);
  const [hit, setHit] = useState(false);
  const html = useMemo(() => ({ java: linesHtml(JAVA, 'java'), tsq: linesHtml(TSQ, 'tsq'), yaml: linesHtml(YAML, 'yaml') }), []);
  const q = (sel: string) => api.root!.querySelectorAll(sel);

  const run = {
    1: () => { tour.play(); },
    2: () => {
      const tn = q('#x2tree .tn');
      hideAll(tn);
      setHit(false);
      [0, 1, 2].forEach((lv) => anim(q(`#x2tree .tn[data-lv="${lv}"]`), { opacity: [0, 1], y: [-8, 0] }, { duration: 0.35, delay: dl(0.1 + lv * 0.6, 0.08) }));
      drawIn(q('#x2tree .tl'), 0.35);
      setTimeout(() => {
        if (api.cur !== 2) return;
        flushSync(() => setHit(true));
        anim(q('#x2tree .hitme'), { scale: [1, 1.05, 1] }, { duration: 0.5 });
      }, reduce ? 0 : 2200);
    },
    3: () => { const rows = q('#x2facts tbody tr'); hideAll(rows); anim(rows, { opacity: [0, 1], x: [-12, 0] }, { duration: 0.35, delay: dl(0.1, 0.25) }); },
    4: () => {
      hideAll(q('#x2map .mapn, #x2map .mapo, #x2map .mbadge'));
      anim(q('#x2map .mapn'), { opacity: [0, 1], x: [-10, 0] }, { duration: 0.3, delay: dl(0, 0.1) });
      anim(q('#x2map .mapo'), { opacity: [0, 1], x: [10, 0] }, { duration: 0.3, delay: dl(0.4, 0.1) });
      drawIn(q('#x2map .mline'), 0.9);
      anim(q('#x2map .mbadge'), { opacity: [0, 1], scale: [0.5, 1] }, { duration: 0.3, delay: dl(1.3, 0.15) });
    },
    5: () => { const c = q('.ocard'); hideAll(c); anim(c, { opacity: [0, 1], y: [12, 0] }, { duration: 0.4, delay: dl(0.1, 0.3) }); },
  };
  const tn = (extra = '') => 'tn' + extra + (extra && hit ? ' hit' : '');

  return (
    <DeepDive api={api} id="dd2" title="Deep dive: how code becomes graph data" steps={STEPS} run={run}
      intro="Follow one Java class from the disputes service through parsing, fact extraction and mapping, until it becomes loader rules and one ontology proposal."
      next={{ href: '#evh', label: 'Next: one pipeline, two jobs' }}>
      <XPanel n={1}>
        <div className="ddcode" id="x2box" ref={tour.box}><div className="ddband"></div><pre id="x2code" dangerouslySetInnerHTML={{ __html: html.java }} /></div>
        <p className="reading" id="x2cap" ref={tour.capEl}>{tour.cap}</p>
        <div className="vbtns"><button type="button" className="vbtn go" id="x2play" onClick={tour.play}>Play the tour</button></div>
      </XPanel>
      <XPanel n={2}>
        <div className="xwrap"><svg id="x2tree" className="xsvg" viewBox="0 0 760 290" role="img" aria-label="Syntax tree of the TxnDsptRec class: modifiers, name and a class body with four fields">
          <path className="tl" d="M345,60 C345,84 110,80 110,104" /><path className="tl" d="M345,60 C345,84 290,80 290,104" /><path className="tl" d="M345,60 C345,84 515,80 515,104" />
          <path className="tl" d="M515,152 C515,184 300,178 300,210" /><path className="tl" d="M515,152 C515,184 425,178 425,210" /><path className="tl" d="M515,152 C515,184 550,178 550,210" /><path className="tl" d="M515,152 C515,184 675,178 675,210" />
          <g className={tn()} data-lv="0"><rect className="evbox" x="250" y="16" width="190" height="44" rx="10" /><text className="evt mono" x="345" y="43" textAnchor="middle">class_declaration</text></g>
          <g className={tn(' hitme')} data-lv="1"><rect className="evbox" x="20" y="104" width="180" height="48" rx="10" /><text className="evt mono" x="110" y="124" textAnchor="middle">modifiers</text><text className="evs" x="110" y="142" textAnchor="middle">@Entity, @Table</text></g>
          <g className={tn(' hitme')} data-lv="1"><rect className="evbox" x="220" y="104" width="140" height="48" rx="10" /><text className="evt mono" x="290" y="124" textAnchor="middle">name</text><text className="evs" x="290" y="142" textAnchor="middle">TxnDsptRec</text></g>
          <g className={tn()} data-lv="1"><rect className="evbox" x="430" y="104" width="170" height="48" rx="10" /><text className="evt mono" x="515" y="124" textAnchor="middle">class_body</text><text className="evs" x="515" y="142" textAnchor="middle">4 fields</text></g>
          <g className={tn()} data-lv="2"><rect className="evbox" x="242" y="210" width="116" height="64" rx="10" /><text className="evt mono" x="300" y="231" textAnchor="middle">disputeId</text><text className="evs" x="300" y="248" textAnchor="middle">String</text><text className="evs" x="300" y="264" textAnchor="middle">@Id</text></g>
          <g className={tn()} data-lv="2"><rect className="evbox" x="367" y="210" width="116" height="64" rx="10" /><text className="evt mono" x="425" y="231" textAnchor="middle">capture</text><text className="evs" x="425" y="248" textAnchor="middle">CaptureRec</text><text className="evs" x="425" y="264" textAnchor="middle">@ManyToOne</text></g>
          <g className={tn()} data-lv="2"><rect className="evbox" x="492" y="210" width="116" height="64" rx="10" /><text className="evt mono" x="550" y="231" textAnchor="middle">reasonCd</text><text className="evs" x="550" y="248" textAnchor="middle">String</text><text className="evs" x="550" y="264" textAnchor="middle">no annotation</text></g>
          <g className={tn()} data-lv="2"><rect className="evbox" x="617" y="210" width="116" height="64" rx="10" /><text className="evt mono" x="675" y="231" textAnchor="middle">state</text><text className="evs" x="675" y="248" textAnchor="middle">DisputeState</text><text className="evs" x="675" y="264" textAnchor="middle">@Enumerated</text></g>
        </svg></div>
        <p className="vcap" style={{ marginTop: '12px' }}>A tree-sitter query that finds every @Entity class and its name</p>
        <div className="ddcode"><pre id="x2q" dangerouslySetInnerHTML={{ __html: html.tsq }} /></div>
      </XPanel>
      <XPanel n={3}>
        <table className="facts" id="x2facts">
          <thead><tr><th>Fact</th><th>Name</th><th>Detail</th></tr></thead>
          <tbody>
            <tr><td><span className="fkind">entity</span></td><td><code>TxnDsptRec</code></td><td>stored in the dispute_record table</td></tr>
            <tr><td><span className="fkind">link</span></td><td><code>capture</code></td><td>many-to-one, points to CaptureRec</td></tr>
            <tr><td><span className="fkind">field</span></td><td><code>reasonCd</code></td><td>a string</td></tr>
            <tr><td><span className="fkind">enum</span></td><td><code>DisputeState</code></td><td>OPEN, REPRESENTED, PRE_ARBITRATION, CLOSED</td></tr>
          </tbody>
        </table>
        <p className="note">Same code in, same facts out, every time. No LLM has been involved yet.</p>
      </XPanel>
      <XPanel n={4}>
        <div className="xwrap"><svg id="x2map" className="xsvg" viewBox="0 0 760 290" role="img" aria-label="Claude maps code facts to ontology terms with confidence scores; one value has no match">
          <path className="mline" d="M240,42 L519,42" /><path className="mline" d="M240,112 L519,112" /><path className="mline" d="M240,182 L519,182" /><path className="mline gap" d="M240,252 L519,252" />
          <g className="mapn"><rect className="evbox" x="20" y="16" width="220" height="52" rx="10" /><text className="evt mono" x="36" y="38">TxnDsptRec</text><text className="evs" x="36" y="57">entity, dispute_record table</text></g>
          <g className="mapn"><rect className="evbox" x="20" y="86" width="220" height="52" rx="10" /><text className="evt mono" x="36" y="108">capture</text><text className="evs" x="36" y="127">@ManyToOne to CaptureRec</text></g>
          <g className="mapn"><rect className="evbox" x="20" y="156" width="220" height="52" rx="10" /><text className="evt mono" x="36" y="178">reasonCd</text><text className="evs" x="36" y="197">string field</text></g>
          <g className="mapn"><rect className="evbox" x="20" y="226" width="220" height="52" rx="10" /><text className="evt mono" x="36" y="248">PRE_ARBITRATION</text><text className="evs" x="36" y="267">value of DisputeState</text></g>
          <g className="mapo"><rect className="evbox" x="520" y="16" width="220" height="52" rx="10" /><rect x="528" y="26" width="3" height="32" rx="1.5" style={{ fill: 'var(--onto)' }} /><text className="evt" x="542" y="38">Chargeback</text><text className="evs" x="542" y="57">class</text></g>
          <g className="mapo"><rect className="evbox" x="520" y="86" width="220" height="52" rx="10" /><rect x="528" y="96" width="3" height="32" rx="1.5" style={{ fill: 'var(--onto)' }} /><text className="evt mono" x="542" y="108">DISPUTES</text><text className="evs" x="542" y="127">relationship to Capture</text></g>
          <g className="mapo"><rect className="evbox" x="520" y="156" width="220" height="52" rx="10" /><rect x="528" y="166" width="3" height="32" rx="1.5" style={{ fill: 'var(--onto)' }} /><text className="evt mono" x="542" y="178">HAS_REASON</text><text className="evs" x="542" y="197">relationship to ReasonCode</text></g>
          <g className="mapo miss"><rect className="evbox" x="520" y="226" width="220" height="52" rx="10" /><text className="evt" x="536" y="248">No match</text><text className="evs" x="536" y="267">not in the ontology yet</text></g>
          <g className="mbadge ok"><rect x="350" y="31" width="60" height="22" rx="11" /><text x="380" y="46">0.93</text></g>
          <g className="mbadge ok"><rect x="350" y="101" width="60" height="22" rx="11" /><text x="380" y="116">0.97</text></g>
          <g className="mbadge warn"><rect x="342" y="171" width="76" height="22" rx="11" /><text x="380" y="186">0.84 review</text></g>
          <g className="mbadge bad"><rect x="350" y="241" width="60" height="22" rx="11" /><text x="380" y="256">gap</text></g>
        </svg></div>
        <p className="note">Why Chargeback? The class links to one capture, carries a reason code and lives in a table called dispute_record. Anything under 0.9 waits for a person, and a gap becomes a proposal. Reviews can take days, so the pipeline has to survive restarts while it waits.</p>
      </XPanel>
      <XPanel n={5}>
        <div className="split2">
          <div className="ocard"><div className="fh"><b>To the loader</b><span className="fk gen">mapping, reviewed once</span></div><div className="ddcode"><pre id="x2yaml" dangerouslySetInnerHTML={{ __html: html.yaml }} /></div><p className="note">Every run applies this mapping. The disputes team approved it once.</p></div>
          <div className="ocard"><div className="fh"><b>To a pull request</b><span className="fk hand">needs a person</span></div>
            <div className="prbox"><div className="prhead"><span className="prnum">PR #212</span><span className="tier" style={{ '--c': 'var(--onto)' } as CSSProperties}>minor</span></div><h4>Add PreArbitration as a kind of DisputeEvent</h4>
              <dl className="prf"><dt>Evidence</dt><dd>PRE_ARBITRATION in the DisputeState enum, disputes-svc</dd><dt>Status</dt><dd>Waiting for the disputes owner</dd></dl></div>
            <p className="note">The same pull request you saw merge as v1.6.0 in chapter 1.</p></div>
        </div>
      </XPanel>
    </DeepDive>
  );
}
