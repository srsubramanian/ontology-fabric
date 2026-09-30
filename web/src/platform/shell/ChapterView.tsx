import type { CSSProperties, ReactNode } from 'react';
import { PageShown } from '../shared/Block';
import { Check, ChapterNext } from './ChapterEnd';

/** A chapter: its header, and its sub-pages in order. A check always comes last. */
export type ChapterDef = { n: number; color: string; head: ReactNode; pages: { label: string; el: ReactNode }[] };

/** One chapter, showing sub-page `cur`, with tabs above and a pager below. */
export function ChapterView({ def, hidden, cur }: { def: ChapterDef; hidden: boolean; cur: number }) {
  const { n } = def, labels = [...def.pages.map((p) => p.label), 'Check yourself'], last = labels.length - 1;
  const prev = cur > 0 ? labels[cur - 1] : null, next = cur < last ? labels[cur + 1] : null;
  return (
    <section className="chapter" id={'ch' + n} data-ch={n} style={{ '--c': def.color } as CSSProperties} aria-labelledby={`ch${n}h`} hidden={hidden}>
      {def.head}
      <nav className="subtabs" aria-label="Pages in this chapter">
        {labels.map((l, i) => <a key={l} className={'subtab' + (i === cur ? ' on' : '')} href={`#ch${n}:${i + 1}`} aria-current={i === cur ? 'page' : undefined}><span className="num">{i + 1}</span>{l}</a>)}
      </nav>
      {def.pages.map((p, i) => <PageShown.Provider key={p.label} value={i === cur}>{p.el}</PageShown.Provider>)}
      <Check n={n} hidden={cur !== last} />
      <ChapterNext n={n} hidden={cur !== last} />
      <div className="pager" hidden={!prev && !next}>
        {prev ? <a className="vbtn" href={`#ch${n}:${cur}`}>Previous: {prev}</a> : <span></span>}
        {next && <a className="vbtn go" href={`#ch${n}:${cur + 2}`}>Next: {next}</a>}
      </div>
    </section>
  );
}
