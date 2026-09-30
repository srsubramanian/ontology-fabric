import type { ReactNode } from 'react';
import { STAGES } from './data';
import { link } from './link';

type Props = { n: number; idea: string; keys: string[]; children: ReactNode };

/** A stage page's frame: number and title, the strip of all stages, key points, then the visual. */
export function Stage({ n, idea, keys, children }: Props) {
  return (
    <>
      <div className="phead">
        <div className="pnum">{n}</div>
        <div><h2>{STAGES[n - 1].title}</h2><p className="idea">{idea}</p></div>
      </div>
      <div className="strip">
        {STAGES.map((s, i) => (
          <a key={s.title} href={link('s' + (i + 1))} className={i + 1 === n ? 'on' : undefined}>{i + 1} {s.title}</a>
        ))}
      </div>
      <div className="grid2">
        <div className="keys"><ul>{keys.map((k) => <li key={k}>{k}</li>)}</ul></div>
        <div className="viz">{children}</div>
      </div>
    </>
  );
}
