// The panel beside the map. It shows what's selected and lets people change it: a class's fields and relationships,
// a relationship's name and ends, or a question's walk and query. With nothing selected, it shows the working
// draft: what it changes, the questions still open, and the pull request.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ClassInfo, Model, Relationship } from '../explorer/model';
import type { Analysis } from './analysis';
import { live, slotKey, type DraftDoc, type DraftUpdate } from './draft';
import {
  addClass, addSlot, classExists, classNameProblem, FIELD_TYPES, isType, removeClass, removeSlot, renameClass, renameSlot,
  reroute, slotNameProblem, type Ctx,
} from './edits';
import type { Selection } from './Canvas';

export const OWNERS = ['core', 'authorization', 'settlement', 'disputes', 'risk'];
const LIVES = [['graph', 'Neptune'], ['warehouse', 'Snowflake or the lake'], ['search', 'OpenSearch']];
const snake = (s: string) => s.replace(/(?<!^)(?=[A-Z])/g, '_').toLowerCase();
const pascal = (s: string) => s.split(/[_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');

export type PanelProps = {
  ctx: Ctx; a: Analysis; model: Model; editable: boolean;
  edit: (u: DraftUpdate, label: string) => void;
  select: (s: Selection) => void;
};

/** A text input that saves when it loses focus or Enter is pressed, and says why a value can't be saved. */
export function Field({ label, value, onSave, check, area, mono, placeholder, autoFocus, disabled }: {
  label: string; value: string; onSave: (v: string) => void; check?: (v: string) => string | null;
  area?: boolean; mono?: boolean; placeholder?: string; autoFocus?: boolean; disabled?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const problem = v !== value && check ? check(v) : null;
  const save = () => { if (v !== value && !problem) onSave(v); };
  const props = {
    value: v, placeholder, disabled, autoFocus, spellCheck: !mono, className: mono ? 'mono' : undefined,
    onChange: (e: { target: { value: string } }) => setV(e.target.value), onBlur: save,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (!area || e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); (e.target as HTMLElement).blur(); }
      if (e.key === 'Escape') { setV(value); (e.target as HTMLElement).blur(); }
    },
    onFocus: autoFocus ? (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.target.select() : undefined,
  };
  return (
    <label className="fld">
      <span>{label}</span>
      {area ? <textarea rows={mono ? 7 : 3} {...props} /> : <input {...props} />}
      {problem && <em className="warn">{problem}</em>}
    </label>
  );
}

function Pick({ label, value, options, onSave, disabled }: { label: string; value: string; options: [string, string][]; onSave: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="fld">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onSave(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return <section className="isec"><h3>{title}{aside && <span className="aside">{aside}</span>}</h3>{children}</section>;
}

/** Problems that name this thing. */
const about = (problems: string[], name: string) => problems.filter((p) => new RegExp(`(^|[^A-Za-z0-9_.])${name.replace('.', '\\.')}([^A-Za-z0-9_]|$)`).test(p));

export function ClassPanel({ ctx, a, model, editable, edit, select, name, fresh }: PanelProps & { name: string; fresh: boolean }) {
  const c = model.classes[name];
  const e = ctx.draft.classes[name];
  const added = !!e?.added;
  const can = editable && added;
  if (!c) return null;
  const set = (patch: Record<string, unknown>, label: string) => edit({ classes: { [name]: patch } }, label);
  const parents: [string, string][] = [['', 'nothing: a class of its own'], ...Object.values(model.classes)
    .filter((x) => x.abstract && x.name !== name && !x.chain.includes(name)).map((x): [string, string] => [x.name, x.name])];
  const out = model.relationships.filter((r) => c.chain.includes(r.from));
  const inn = model.relationships.filter((r) => r.to === name);
  const fields = c.slots.filter((s) => !s.relationship);
  const problems = about(a.report.problems, name);

  return (
    <>
      <div className="ihead">
        {can
          ? <Field label="Class" value={name} autoFocus={fresh} check={(v) => classNameProblem(ctx, v, name)}
            onSave={(v) => { edit(renameClass(ctx, name, v), `rename ${name} to ${v}`); select({ kind: 'class', id: v }); }} />
          : <h2>{name}</h2>}
        <p className="badges">
          <span className={added ? 'b new' : 'b'}>{added ? 'new in this draft' : `released ${ctx.base.version ? 'v' + ctx.base.version : ''}`}</span>
          {c.abstract && <span className="b">abstract</span>}
          <span className="b">{c.chain.join(' → ')}</span>
        </p>
      </div>
      {problems.length > 0 && <ul className="iprob">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}

      {can ? (
        <Section title="About">
          <Pick label="Is a kind of" value={e?.is_a ?? ''} options={parents} onSave={(v) => set({ is_a: v || null }, `set ${name}'s parent`)} />
          <Field label="Description" area value={e?.description ?? ''} placeholder="What one of these is, in a sentence" onSave={(v) => set({ description: v || null }, `describe ${name}`)} />
          <div className="two">
            <Pick label="Owned by team" value={e?.owner ?? 'core'} options={OWNERS.map((o) => [o, o])} onSave={(v) => set({ owner: v }, `set ${name}'s owner`)} />
            <Pick label="Stored in" value={e?.lives_in ?? 'graph'} options={LIVES as [string, string][]} onSave={(v) => set({ lives_in: v }, `set where ${name} lives`)} />
          </div>
          <Field label="ID looks like" mono value={e?.id_rule ?? ''} placeholder="pf:{payfac_id}" onSave={(v) => set({ id_rule: v || null }, `set ${name}'s ID rule`)} />
          <Field label="Matches a standard" mono value={(e?.close_mappings ?? []).join(' ')} placeholder="fibo-be-fct-fct:FunctionalEntity"
            check={(v) => (v && !/^[a-z0-9-]+:\S+$/i.test(v) ? 'A CURIE whose prefix the schema declares, such as iso20022:cain.027.001.04' : null)}
            onSave={(v) => set({ close_mappings: v ? [v] : null, ...(v ? { no_standard: null } : {}) }, `map ${name} to a standard`)} />
          {!e?.close_mappings?.length && (
            <Field label="If none matches, why" area value={e?.no_standard ?? ''} placeholder="FIBO and ISO 20022 have no concept for…"
              onSave={(v) => set({ no_standard: v || null }, `say why ${name} has no standard`)} />
          )}
        </Section>
      ) : (
        <Section title="About">
          <p className="desc">{c.description || 'No description.'}</p>
          <p className="small muted">Owned by {c.owner} · stored in {c.livesIn === 'graph' ? 'Neptune' : c.livesIn === 'warehouse' ? 'Snowflake' : c.livesIn === 'search' ? 'OpenSearch' : c.livesIn} · IDs look like {c.idRule ?? 'nothing yet'}</p>
          {editable && <p className="small muted">Released classes stay as they are here; add fields and relationships to them, or change them through the change board (decision 10).</p>}
        </Section>
      )}

      {!c.abstract || added ? (
        <Section title={`Fields · ${fields.length}`}>
          <ul className="slots">
            {fields.map((s) => {
              const key = slotKey(name, s.name);
              const mine = ctx.draft.slots[key];
              return (
                <li key={s.name} className={mine ? 'mine' : ''}>
                  <code>{s.name}</code><span className="ty">{s.range}{s.multivalued ? '[]' : ''}{s.required ? ' · required' : ''}</span>
                  {s.declaredOn !== name && <span className="muted small">from {s.declaredOn}</span>}
                  {mine && editable && <button type="button" className="x" aria-label={`Remove ${s.name}`} onClick={() => edit(removeSlot(ctx, key), `remove ${name}.${s.name}`)}>×</button>}
                </li>
              );
            })}
          </ul>
          {editable && <AddField ctx={ctx} cls={name} edit={edit} />}
        </Section>
      ) : null}

      <Section title={`Links · ${out.length + inn.length}`}>
        <ul className="rels">
          {out.map((r) => <RelRow key={r.id} r={r} dir="out" ctx={ctx} editable={editable} edit={edit} select={select} />)}
          {inn.map((r) => <RelRow key={'in' + r.id} r={r} dir="in" ctx={ctx} editable={editable} edit={edit} select={select} />)}
        </ul>
        {editable && !c.abstract && <p className="hint">Drag the ⊕ on {name} onto another class to relate them.</p>}
      </Section>

      {can && (
        <button type="button" className="vbtn danger" onClick={() => { edit(removeClass(ctx, name), `remove ${name}`); select(null); }}>Remove {name}</button>
      )}
    </>
  );
}

function RelRow({ r, dir, ctx, editable, edit, select }: { r: Relationship; dir: 'in' | 'out'; ctx: Ctx; editable: boolean; edit: PanelProps['edit']; select: PanelProps['select'] }) {
  const key = slotKey(r.from, r.slot);
  const mine = !!ctx.draft.slots[key];
  return (
    <li className={mine ? 'mine' : ''}>
      <button type="button" className="rel" onClick={() => select({ kind: 'rel', id: r.id })}>
        {dir === 'out' ? <><code>{r.type}</code> → {r.open ? 'any entity' : r.to}</> : <>{r.from} → <code>{r.type}</code></>}
      </button>
      {mine && editable && <button type="button" className="x" aria-label={`Remove ${r.id}`} onClick={() => edit(removeSlot(ctx, key), `remove ${r.id}`)}>×</button>}
    </li>
  );
}

/** Adds a field: a name, and a type, an existing enum, or a new enum with its values. */
function AddField({ ctx, cls, edit }: { ctx: Ctx; cls: string; edit: PanelProps['edit'] }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('string');
  const [values, setValues] = useState('');
  const enums = [...Object.keys(ctx.base.enums ?? {}), ...live(ctx.draft.enums).map(([n]) => n)];
  const problem = name ? slotNameProblem(ctx, cls, name) : null;
  const newEnum = type === '+enum';
  const enumName = pascal(name || 'kind');
  const vals = values.split(',').map((v) => snake(v.trim()).replace(/[^a-z0-9_]/g, '_')).filter(Boolean);
  const add = () => {
    if (!name || problem || (newEnum && !vals.length)) return;
    const u: DraftUpdate = newEnum ? { enums: { [enumName]: { values: Object.fromEntries(vals.map((v) => [v, ''])) } } } : {};
    edit({ ...u, ...addSlot(ctx, cls, name, newEnum ? enumName : type) }, `add ${cls}.${name}`);
    setName(''); setValues(''); setType('string');
  };
  return (
    <div className="addf">
      <input value={name} placeholder="new_field" aria-label="New field name" className="mono"
        onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
      <select value={type} aria-label="Its type" onChange={(e) => setType(e.target.value)}>
        <optgroup label="Types">{FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
        <optgroup label="Enums">{enums.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
        <option value="+enum">New enum…</option>
      </select>
      <button type="button" className="vbtn" disabled={!name || !!problem || (newEnum && !vals.length)} onClick={add}>Add</button>
      {newEnum && (
        <input className="wide" value={values} placeholder={`${enumName} values: lost, stolen, counterfeit`} aria-label="Enum values, comma separated"
          onChange={(e) => setValues(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
      )}
      {problem && <em className="warn">{problem}</em>}
    </div>
  );
}

export function RelPanel({ ctx, a, model, editable, edit, select, id, fresh }: PanelProps & { id: string; fresh: boolean }) {
  const r = model.relationships.find((x) => x.id === id);
  if (!r) return null;
  const key = slotKey(r.from, r.slot);
  const s = ctx.draft.slots[key];
  const can = editable && !!s;
  const problems = about(a.report.problems, id);
  const targets = Object.values(model.classes).filter((c) => c.name !== r.from).map((c): [string, string] => [c.name, c.name]);
  return (
    <>
      <div className="ihead">
        {can
          ? <Field label="Relationship" mono value={r.slot} autoFocus={fresh} check={(v) => slotNameProblem(ctx, r.from, v, r.slot)}
            onSave={(v) => { edit(renameSlot(ctx, key, v), `rename ${id}`); select({ kind: 'rel', id: `${r.from}.${v}` }); }} />
          : <h2><code>{r.type}</code></h2>}
        <p className="badges"><span className={s ? 'b new' : 'b'}>{s ? 'new in this draft' : 'released'}</span>
          <span className="b">{r.from} → {r.open ? 'any entity' : r.to}</span><span className="b">Neptune type {r.type}</span></p>
      </div>
      {problems.length > 0 && <ul className="iprob">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      {can ? (
        <Section title="About">
          <Pick label="Points to" value={s!.range} options={targets} onSave={(v) => edit(addSlot(ctx, r.from, r.slot, v, { ...s!, port: null }), `point ${id} at ${v}`)} />
          <div className="two">
            <label className="chk"><input type="checkbox" checked={!!s!.multivalued} onChange={(e) => edit({ slots: { [key]: { multivalued: e.target.checked } } }, `${id}: many`)} />Many</label>
            <label className="chk"><input type="checkbox" checked={!!s!.required} onChange={(e) => edit({ slots: { [key]: { required: e.target.checked } } }, `${id}: required`)} />Required</label>
          </div>
          <Field label="Description" area value={s!.description ?? ''} placeholder="What it links, in a sentence" onSave={(v) => edit({ slots: { [key]: { description: v || null } } }, `describe ${id}`)} />
          <div className="row">
            <button type="button" className="vbtn" onClick={() => edit(reroute(ctx, {}, [key]), `reroute ${id}`)}>Find a clearer route</button>
            <button type="button" className="vbtn danger" onClick={() => { edit(removeSlot(ctx, key), `remove ${id}`); select(null); }}>Remove</button>
          </div>
        </Section>
      ) : (
        <Section title="About"><p className="desc">{r.description || 'No description.'}</p></Section>
      )}
    </>
  );
}

export function QuestionPanel({ ctx, a, editable, edit, id, walking, setWalking, writeQuery, busy, prove, proving, hasTest }: Omit<PanelProps, 'select' | 'model'> & {
  id: string; walking: boolean; setWalking: (on: boolean) => void;
  writeQuery?: () => void; busy: boolean;
  /** Runs the question's query on a made-up sample world, beside the map. */
  prove?: () => void; proving?: boolean; hasTest?: boolean;
}) {
  const base = ctx.questions.questions.find((q) => q.id === id)!;
  const ans = ctx.draft.answers[id];
  const now = a.questions.questions.find((q) => q.id === id)!;
  const problems = a.report.problems.filter((p) => p.startsWith(id + ':'));
  const walks = ans?.walks ?? now.walks ?? [];
  const set = (patch: Partial<NonNullable<DraftDoc['answers'][string]>>, label: string) =>
    edit({ answers: { [id]: { answered_in: (ans?.answered_in ?? base.answered_in) as 'neptune' | 'snowflake', walks, query: ans?.query ?? '', ...patch } } }, label);
  const state = !base.gap ? 'answered' : !ans ? 'gap' : problems.length ? 'failing' : 'answered';
  return (
    <>
      <div className="ihead">
        <p className="qmeta"><b>{id}</b> · {base.domain} · <span className={'qs ' + state}>{state === 'gap' ? 'not answered yet' : state === 'failing' ? `${problems.length} problem${problems.length === 1 ? '' : 's'}` : 'answered'}</span></p>
        <h2 className="qtext">{base.question}</h2>
        {base.gap && <p className="small muted">Lacked: {base.gap.trim()}</p>}
      </div>
      {!base.gap ? <p className="small">The released ontology answers this one already.</p> : (
        <>
          <Section title="Walk" aside={editable && (
            <button type="button" className={'vbtn tiny' + (walking ? ' on' : '')} aria-pressed={walking} onClick={() => setWalking(!walking)}>
              {walking ? 'Done picking' : 'Pick on the map'}
            </button>)}>
            {walking && <p className="hint">Click the relationships the question walks, in order.</p>}
            <ol className="swalk">
              {walks.map((w, i) => (
                <li key={w + i}><code>{w}</code>
                  {editable && <button type="button" className="x" aria-label={`Remove ${w}`} onClick={() => set({ walks: walks.filter((_, j) => j !== i) }, `edit ${id}'s walk`)}>×</button>}
                </li>
              ))}
              {!walks.length && <li className="muted small">No steps yet.</li>}
            </ol>
          </Section>
          <Section title="Query" aside={editable && (
            <span className="seg tiny" role="group" aria-label="Answered in">
              {(['neptune', 'snowflake'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={(ans?.answered_in ?? base.answered_in) === s} onClick={() => set({ answered_in: s }, `answer ${id} in ${s}`)}>
                  {s === 'neptune' ? 'Neptune' : 'Snowflake'}
                </button>
              ))}
            </span>)}>
            <Field label={(ans?.answered_in ?? base.answered_in) === 'snowflake' ? 'SQL' : 'openCypher'} area mono value={ans?.query ?? ''}
              disabled={!editable} placeholder={(ans?.answered_in ?? base.answered_in) === 'snowflake' ? 'SELECT …  -- Class.slot on each join\nLIMIT 50' : 'MATCH (a:Class)-[:TYPE]->(b:Other)\nRETURN …\nLIMIT 50'}
              onSave={(v) => set({ query: v }, `edit ${id}'s query`)} />
            {editable && writeQuery && (
              <button type="button" className="vbtn" disabled={busy || !walks.length} onClick={writeQuery}>{busy ? 'Claude is writing…' : 'Write it with Claude'}</button>
            )}
          </Section>
          {problems.length > 0 && <ul className="iprob">{problems.map((p) => <li key={p}>{p.slice(id.length + 2)}</li>)}</ul>}
          {ans && editable && <button type="button" className="vbtn danger" onClick={() => edit({ answers: { [id]: null } }, `clear ${id}'s answer`)}>Clear this answer</button>}
        </>
      )}
      {prove && (
        <Section title="Prove it">
          <p className="small">{(ans?.query ?? now.query) ? `Run its query on made-up sample data, in this page${hasTest ? ', with its test case planted' : ''}.` : 'Write its query first, then run it on made-up sample data.'}</p>
          <button type="button" className={'vbtn prove' + (proving ? ' on' : '')} disabled={!(ans?.query ?? now.query)} onClick={prove}>{proving ? 'Proving it beside the map' : 'Prove it with sample data'}</button>
        </Section>
      )}
    </>
  );
}

export { addClass, classExists };
export type { ClassInfo };

/** Focuses an element once, when it first appears. */
export function useFocusOnce<T extends HTMLElement>(on: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => { if (on) ref.current?.focus(); }, [on]);
  return ref;
}
