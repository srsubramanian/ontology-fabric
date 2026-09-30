import { createContext, useContext, type ReactNode } from 'react';
import { MiniMap } from '../shell/MiniMap';

/** What a chapter header needs from the page: playing a flow on the map. */
export const Watch = createContext<(flow: string) => void>(() => {});

/** A chapter's header: its number, title and idea, its actions, and its place on the mini map. */
export function ChapterHead({ n, title, idea, flow, children }: {
  n: number; title: string; idea: string;
  /** The flow the "Watch it on the map" button plays, if the chapter has one. */
  flow?: string;
  children?: ReactNode;
}) {
  const watch = useContext(Watch);
  return (
    <header className="chhead">
      <div className="chn" aria-hidden="true">{n}</div>
      <div>
        <h2 id={`ch${n}h`}>{title}</h2>
        <p className="chidea">{idea}</p>
        <div className="chacts">
          {flow && <button type="button" className="vbtn watch" data-flow={flow} onClick={() => watch(flow)}>Watch it on the map</button>}
          {children}
        </div>
      </div>
      <figure className="minibox"><svg className="mini" data-ch={n} viewBox="10 26 1070 464" role="img" aria-label={`Where chapter ${n} sits in the platform`}><MiniMap n={n} /></svg><figcaption>Where this sits in the platform</figcaption></figure>
    </header>
  );
}
