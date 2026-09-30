import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { CodeBlock } from '../kit/CodeBlock';
import { vars } from '../kit/css';
import { tr } from '../kit/motion';
import { STORE } from './ClassMap';
import type { ClassInfo, Model, Question, Slot, Store } from './model';

const LIVES_TEXT = {
  graph: 'Materialized in Neptune, because questions walk through it.',
  warehouse: 'Stays in the lake or Snowflake, linked by ID. A record joins Neptune when a question walks through it, such as a disputed authorization.',
  search: 'Text and embeddings live in OpenSearch; Neptune keeps a small stub with the ID.',
};

const ANSWERED: Record<Store, { name: string; color: string; why: string }> = {
  neptune: { name: 'Neptune', color: 'var(--graph)', why: 'It walks or counts along relationships, so the graph answers it.' },
  snowflake: { name: 'Snowflake', color: 'var(--wh)', why: 'It counts over big tables and time, so the warehouse answers it, using the classes and relationships the ontology names.' },
};

/** Column types in Neptune's openCypher load format. Anything else loads as a String. */
const NEPTUNE_TYPE: Record<string, string> = { datetime: 'DateTime', decimal: 'Double', float: 'Double', double: 'Double', integer: 'Int', boolean: 'Bool' };

const howMany = (s: Pick<Slot, 'required' | 'multivalued'>) =>
  s.multivalued ? (s.required ? 'one or more' : 'any number') : (s.required ? 'exactly one' : 'at most one');

/** The node file header our generator writes for a class: attributes become columns, relationships become edges. */
function loaderHeader(c: ClassInfo) {
  const columns = c.slots
    .filter((s) => !s.relationship && !s.identifier)
    .map((s) => `${s.name}:${NEPTUNE_TYPE[s.range] ?? 'String'}${s.multivalued ? '[]' : ''}`);
  return [':ID', ':LABEL', ...columns, 'ontology_version:String'].join(',');
}

type Nav = { onPick: (name: string) => void; onQuestion: (id: string) => void; onHome: () => void };

function ClassLink({ name, onPick }: { name: string; onPick: (name: string) => void }) {
  return <button type="button" className="clink" onClick={() => onPick(name)}>{name}</button>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="dsec"><h3>{title}</h3>{children}</section>;
}

function QuestionList({ questions, onQuestion }: { questions: Question[]; onQuestion: (id: string) => void }) {
  if (!questions.length) return <p className="muted">No competency question uses it yet.</p>;
  return (
    <div className="qlist">
      {questions.map((q) => (
        <button key={q.id} type="button" className="qitem" data-question={q.id} onClick={() => onQuestion(q.id)}>
          <span className="qmeta">{q.id} · {q.domain}<i style={vars({ '--c': ANSWERED[q.answeredIn].color })}>{ANSWERED[q.answeredIn].name}</i></span>
          {q.question}
        </button>
      ))}
    </div>
  );
}

function Start({ model, onQuestion }: { model: Model } & Nav) {
  const concrete = Object.values(model.classes).filter((c) => !c.abstract);
  const mapped = concrete.filter((c) => c.mappings.length).length;
  return (
    <>
      <h2 className="dtitle">Explore the draft</h2>
      <p className="muted">Pick a class on the map, or a question the ontology must answer. Search finds a class by name or alias.</p>
      <Section title="Coverage, measured (decision 9)">
        <div className="cover">
          <div><b>{model.questions.length} of {model.questions.length}</b><span>competency questions walk the schema</span></div>
          <div><b>{mapped} of {concrete.length}</b><span>classes mapped to a standard</span></div>
        </div>
      </Section>
      <Section title="Competency questions">
        <QuestionList questions={model.questions} onQuestion={onQuestion} />
      </Section>
    </>
  );
}

function ClassDetails({ model, c, onPick, onQuestion, onHome }: { model: Model; c: ClassInfo } & Nav) {
  const attributes = c.slots.filter((s) => !s.relationship);
  const outgoing = c.slots.filter((s) => s.relationship);
  const incoming = model.relationships.filter((r) => c.chain.includes(r.to));
  const questions = model.questions.filter((q) => q.classes.includes(c.name) || q.steps.some((s) => s.relationship.from === c.name));
  return (
    <>
      <button type="button" className="back" onClick={onHome}>All questions</button>
      <h2 className="dtitle">{c.name}{c.abstract && <span className="badge">abstract</span>}</h2>
      <p className="curie">{c.curie}</p>
      <p>{c.description}</p>
      {c.aliases.length > 0 && <p className="muted">Also called {c.aliases.map((a, i) => <span key={a}>{i > 0 && ', '}<b>{a}</b></span>)}</p>}

      <Section title="Labels in Neptune">
        <div className="chain">
          {c.chain.map((name, i) => (
            <span key={name}>{i > 0 && <i>›</i>}<ClassLink name={name} onPick={onPick} /></span>
          ))}
        </div>
        <p className="muted">
          {c.abstract
            ? 'Abstract: never a node on its own. Its label goes on every subclass.'
            : <>Each node carries all of them: <code>:{c.chain.join(':')}</code></>}
        </p>
        {c.children.length > 0 && <p className="muted">Subclasses: {c.children.map((k, i) => <span key={k}>{i > 0 && ', '}<ClassLink name={k} onPick={onPick} /></span>)}</p>}
      </Section>

      {!c.abstract && (
        <Section title="ID in every store">
          <p><code className="idrule">{c.idRule}</code>{c.example && <span className="muted"> · for example {c.example}</span>}</p>
        </Section>
      )}

      <Section title="Where it lives">
        <p><span className="store" style={vars({ '--c': STORE[c.livesIn].color })}>{STORE[c.livesIn].label}</span> {LIVES_TEXT[c.livesIn]}</p>
      </Section>

      <Section title="Owner">
        <p><b>{c.owner}</b> team{c.owner === 'core' ? ', which owns the shared core' : ', which owns this domain module'}.</p>
      </Section>

      {attributes.length > 0 && (
        <Section title="Properties">
          <table className="props"><tbody>
            {attributes.map((s) => (
              <tr key={s.name}>
                <td><code>{s.name}</code></td>
                <td>{s.range}{s.identifier ? ', the ID' : s.required ? ', required' : ''}</td>
                <td className="muted">{s.declaredOn !== c.name && <>from <ClassLink name={s.declaredOn} onPick={onPick} /></>}</td>
              </tr>
            ))}
          </tbody></table>
        </Section>
      )}

      {(outgoing.length > 0 || incoming.length > 0) && (
        <Section title="Relationships">
          <ul className="rels">
            {outgoing.map((s) => (
              <li key={'o' + s.name}>
                <code>{s.name.toUpperCase()}</code> → <ClassLink name={s.range} onPick={onPick} />
                <span className="muted"> · {howMany(s)}{s.declaredOn !== c.name && <>, from {s.declaredOn}</>}</span>
              </li>
            ))}
            {incoming.map((r) => (
              <li key={'i' + r.id}>
                <ClassLink name={r.from} onPick={onPick} /> <code>{r.type}</code> → {r.to === c.name ? 'this' : r.to}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {c.codeList && (
        <Section title={`Code list: ${c.codeList.name}`}>
          <ul className="rels">
            {c.codeList.values.map((v) => <li key={v.code}><code>{v.code}</code> {v.description}</li>)}
          </ul>
          <p className="muted">Each value loads as a {c.name} node, so disputes and documents meet at it.</p>
        </Section>
      )}

      <Section title="Standards">
        {c.mappings.length
          ? c.mappings.map((m) => (
            <p key={m.curie}><code>skos:closeMatch</code> {m.iri ? <a href={m.iri} target="_blank" rel="noopener">{m.curie}</a> : m.curie}</p>
          ))
          : <p className="muted">Not mapped to a standard yet.</p>}
      </Section>

      <Section title="Competency questions">
        <QuestionList questions={questions} onQuestion={onQuestion} />
      </Section>

      {!c.abstract && (
        <Section title="Generated for Neptune">
          <CodeBlock code={loaderHeader(c)} lang="none" />
          <p className="muted">The node file header our generator writes. Relationships become edges, not columns.</p>
        </Section>
      )}
    </>
  );
}

function QuestionDetails({ q, onPick, onHome }: { q: Question } & Nav) {
  const store = ANSWERED[q.answeredIn];
  return (
    <>
      <button type="button" className="back" onClick={onHome}>All questions</button>
      <p className="qmeta">{q.id} · {q.domain}</p>
      <h2 className="dtitle q">{q.question}</h2>
      <Section title="Answered in">
        <p><span className="store" style={vars({ '--c': store.color })}>{store.name}</span> {store.why}</p>
      </Section>
      <Section title="The walk">
        <ol className="walk">
          {q.steps.map(({ named, relationship: r }) => (
            <li key={named + r.id}>
              <ClassLink name={named} onPick={onPick} /> <code>{r.type}</code> → <ClassLink name={r.to} onPick={onPick} />
              {r.from !== named && <span className="muted"> (from {r.from})</span>}
            </li>
          ))}
        </ol>
        <p className="muted">Each question becomes a test: <code>tools/check_ontology.py</code> fails if the schema can't walk it.</p>
      </Section>
    </>
  );
}

type PanelProps = Nav & { model: Model; selected?: ClassInfo; question?: Question };

/** The side panel: where to start, one class, or one question. */
export function Panel({ model, selected, question, ...nav }: PanelProps) {
  const key = selected ? 'c:' + selected.name : question ? 'q:' + question.id : 'start';
  return (
    <motion.div key={key} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={tr({ duration: 0.3 })}>
      {selected ? <ClassDetails model={model} c={selected} {...nav} />
        : question ? <QuestionDetails q={question} {...nav} />
        : <Start model={model} {...nav} />}
    </motion.div>
  );
}
