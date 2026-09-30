import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

/** A chapter's header: its number, title and idea, its actions, and its place on the mini map. */
export function ChapterHead({ n, title, idea, flow, children }: {
  n: number; title: string; idea: string;
  /** The flow the "Watch it on the map" button plays, if the chapter has one. */
  flow?: string;
  children?: ReactNode;
}) {
  return (
    <header className="chhead">
      <div className="chn" aria-hidden="true">{n}</div>
      <div>
        <h2 id={`ch${n}h`}>{title}</h2>
        <p className="chidea">{idea}</p>
        <div className="chacts">
          {flow && <button type="button" className="vbtn watch" data-flow={flow}>Watch it on the map</button>}
          {children}
        </div>
      </div>
      <figure className="minibox"><svg className="mini" data-ch={n} viewBox="10 26 1070 464" role="img" aria-label={`Where chapter ${n} sits in the platform`}></svg><figcaption>Where this sits in the platform</figcaption></figure>
    </header>
  );
}

/** Where the page's scripts put the chapter's check and its link to the next chapter. */
export function ChapterEnd({ n }: { n: number }) {
  return <><div className="check" data-ch={n}></div><div className="chnext" data-ch={n}></div></>;
}

/**
 * Renders a chapter into its section at once, before the page's remaining scripts run: they
 * find its sub-pages, mini map, check and watch button in the DOM.
 */
export function mountChapter(n: number, chapter: ReactNode) {
  const root = createRoot(document.getElementById(`ch${n}`)!);
  flushSync(() => root.render(chapter));
}
