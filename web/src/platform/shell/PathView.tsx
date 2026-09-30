import type { CSSProperties } from 'react';
import { CH } from './path-data';
import { nextUp, useProgress } from './progress';

/** Your path through the platform: each chapter's state, and a button to carry on. */
export function PathView() {
  const { done, resume } = useProgress();
  const nu = nextUp(done);
  const all = done.length === CH.length;
  return (
    <section className="pathsec" id="path" aria-labelledby="pathh">
      <div className="pathhead"><div><h2 id="pathh">Your path through the platform</h2><p className="intro">Seven chapters, one part of the platform each. Your progress is saved in this browser.</p></div>
        <button type="button" className="vbtn go" id="resume" onClick={resume}>{all ? 'All chapters done. Start again' : done.length ? 'Continue with chapter ' + nu : 'Start chapter 1'}</button></div>
      <ol className="pathlist" id="pathlist">
        {CH.map((c) => {
          const d = done.includes(c.n);
          return (
            <li key={c.n}><a className={'pcard' + (d ? ' done' : '') + (c.n === nu ? ' next' : '')} href={'#ch' + c.n} style={{ '--c': c.c } as CSSProperties}>
              <span className="pn">{c.n}</span><b>{c.title}</b><span className="ps">{d ? '✓ Done' : c.n === nu ? 'Up next' : 'Not started'}</span>
            </a></li>
          );
        })}
      </ol>
    </section>
  );
}
