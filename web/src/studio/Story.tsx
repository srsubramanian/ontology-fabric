// The story lens beside the map: a class, a relationship or a proposal read as plain sentences, for the business
// expert working next to the engineer. What it means is editable in words (what a thing is, what else it's called,
// whether there's one or many), and lands on the same draft fields the model lens edits.
import type { RawSchema } from '../explorer/model';
import type { Analysis } from './analysis';
import { slotKey, type ProposalEdit } from './draft';
import { Field, Section, type PanelProps } from './Inspector';
import type { Lens } from './presence';
import { classStory, holds, relSentence, words } from './story';

type Enums = Record<string, { values: { code: string; description?: string }[] }>;
/** The schema's enums, as the story lens reads them. */
export const enumsOf = (schema: RawSchema): Enums => Object.fromEntries(Object.entries(schema.enums ?? {}).map(([n, e]) => [n, {
  values: Object.entries(e.permissible_values ?? {}).map(([code, v]) => ({ code, description: (v as { description?: string } | null)?.description })),
}]));

export function LensToggle({ lens, setLens }: { lens: Lens; setLens(l: Lens): void }) {
  return (
    <div className="seg lens" role="group" aria-label="Read the ontology as">
      <button type="button" aria-pressed={lens === 'story'} onClick={() => setLens('story')} title="Plain sentences, for the business meaning">Story</button>
      <button type="button" aria-pressed={lens === 'model'} onClick={() => setLens('model')} title="Classes, fields and relationships, for the structure">Model</button>
    </div>
  );
}

/** A class as sentences. Its meaning, other names, and how many of each link are editable in words. */
export function StoryClass({ ctx, a, model, editable, edit, select, name }: PanelProps & { name: string }) {
  const c = model.classes[name];
  if (!c) return null;
  const e = ctx.draft.classes[name];
  const lines = classStory(c, model, enumsOf(a.schema));
  const set = (patch: Record<string, unknown>, label: string) => edit({ classes: { [name]: patch } }, label);
  return (
    <>
      <div className="ihead">
        <h2>{words(name).replace(/^./, (x) => x.toUpperCase())}</h2>
        <p className="badges"><span className={e?.added ? 'b new' : 'b'}>{e?.added ? 'new in this draft' : 'released'}</span><span className="b mono">{name}</span></p>
      </div>
      <Section title="What it is">
        {editable ? (
          <Field label="In one sentence" area value={e?.description ?? c.description ?? ''} placeholder={`What is ${words(name)}, in your own words?`}
            onSave={(v) => set({ description: v || null }, `say what ${name} is`)} />
        ) : <p className="story">{lines[0].text}</p>}
        {lines.filter((l) => ['kind', 'home', 'id'].includes(l.kind)).map((l) => <p key={l.kind} className="story">{l.text}</p>)}
        {editable ? (
          <Field label="Also called" value={(e?.aliases ?? c.aliases ?? []).join(', ')} placeholder="Other names people use, separated by commas"
            onSave={(v) => set({ aliases: v ? v.split(',').map((x) => x.trim()).filter(Boolean) : null }, `name ${name}'s aliases`)} />
        ) : c.aliases.length > 0 && <p className="story">Also called {c.aliases.join(', ')}.</p>}
      </Section>
      {lines.some((l) => l.kind === 'records') && <Section title="What it records">{lines.filter((l) => l.kind === 'records').map((l) => <p key="r" className="story">{l.text}</p>)}</Section>}
      <Section title="How it connects">
        <ul className="stories">
          {lines.filter((l) => l.kind === 'link' || l.kind === 'in').map((l) => {
            const r = model.relationships.find((x) => x.id === l.rel)!;
            const key = slotKey(r.from, r.slot);
            const mine = ctx.draft.slots[key];
            return (
              <li key={l.rel + l.kind}>
                <button type="button" className="story link" onClick={() => select({ kind: 'rel', id: r.id })}>{l.text}</button>
                {editable && mine && (
                  <button type="button" className="linkish small" onClick={() => edit({ slots: { [key]: { multivalued: !mine.multivalued } } }, `${r.id}: ${mine.multivalued ? 'just one' : 'one or more'}`)}>
                    {mine.multivalued ? 'Make it just one' : 'Make it one or more'}
                  </button>
                )}
              </li>
            );
          })}
          {!lines.some((l) => l.kind === 'link' || l.kind === 'in') && <li className="small muted">Nothing connects to it yet.</li>}
        </ul>
      </Section>
    </>
  );
}

/** A relationship as a sentence, with what it means in words. */
export function StoryRel({ ctx, model, editable, edit, select, id }: PanelProps & { id: string }) {
  const r = model.relationships.find((x) => x.id === id);
  if (!r) return null;
  const key = slotKey(r.from, r.slot);
  const mine = ctx.draft.slots[key];
  return (
    <>
      <div className="ihead">
        <h2 className="qtext">{relSentence(r)}</h2>
        <p className="badges"><span className={mine ? 'b new' : 'b'}>{mine ? 'new in this draft' : 'released'}</span><span className="b mono">{r.type}</span></p>
      </div>
      <Section title="What it means">
        {editable && mine
          ? <Field label="In one sentence" area value={mine.description ?? ''} placeholder="Why the two are linked, in your own words" onSave={(v) => edit({ slots: { [key]: { description: v || null } } }, `say what ${id} means`)} />
          : <p className="story">{r.description || 'Nobody has said what this link means yet.'}</p>}
        {editable && mine && (
          <button type="button" className="vbtn tiny" onClick={() => edit({ slots: { [key]: { multivalued: !mine.multivalued } } }, `${id}: ${mine.multivalued ? 'just one' : 'one or more'}`)}>
            {mine.multivalued ? 'Make it just one' : 'Make it one or more'}
          </button>
        )}
        <p className="row small">
          <button type="button" className="linkish" onClick={() => select({ kind: 'class', id: r.from })}>About {words(r.from)}</button>
          {!r.open && <button type="button" className="linkish" onClick={() => select({ kind: 'class', id: r.to })}>About {words(r.to)}</button>}
        </p>
      </Section>
    </>
  );
}

/** A proposal as a sentence, built from the change it would make. */
export function proposalSentence(p: ProposalEdit, a: Analysis | null): string {
  const u = p.update;
  if (p.kind === 'class') {
    const e = u.classes?.[p.name];
    const w = words(p.name);
    return `Add ${/^[aeiou]/.test(w) ? 'an' : 'a'} ${w}${e?.is_a ? `, a kind of ${words(e.is_a)}` : ''}: ${(e?.description ?? '').replace(/\.$/, '') || 'not described yet'}.`;
  }
  if (p.kind === 'relationship' || p.kind === 'field') {
    const s = Object.values(u.slots ?? {})[0];
    if (!s?.class) return p.title;
    if (p.kind === 'relationship') return relSentence({ from: s.class, slot: s.name!, to: s.range!, multivalued: !!s.multivalued, open: false });
    return `Each ${words(s.class)} records ${s.name!.replace(/_/g, ' ')} (${holds(s.range!, a ? enumsOf(a.schema) : {})}).`;
  }
  if (p.kind === 'enum') {
    const e = u.enums?.[p.name];
    const vals = Object.entries(e?.values ?? {}).map(([k, v]) => (v || k.replace(/_/g, ' ')));
    return `A ${words(p.name)} is one of: ${vals.join(', ')}.`;
  }
  const ans = u.answers?.[p.name];
  return ans?.question ? `Keep “${ans.question}” as question ${p.name}, answered by following ${(ans.walks ?? []).length} links.`
    : `Answer ${p.name} by following ${(ans?.walks ?? []).length} links.`;
}
