import { useSyncExternalStore, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { appOf, type AppId } from '../kit/route';
import { APPS } from './apps';

// One page, three apps: the overview, the retrieval walkthrough and the class explorer.
// The hash says which app shows. An app mounts the first time it shows and stays mounted,
// hidden, after that, so it keeps its place. Only the showing app's stylesheet is in the
// page, so each app looks exactly as it did as a page of its own.

let showing = appOf(location.hash);
const seen = new Set<AppId>([showing]);
/** Where the reader last was in each app, so its tab takes them back there. */
const last = new Map<AppId, string>([[showing, location.hash || APPS.find((a) => a.id === showing)!.start]]);
const listeners = new Set<() => void>();

const style = document.head.appendChild(document.createElement('style'));
const applyStyle = () => { style.textContent = APPS.find((a) => a.id === showing)!.css; };
applyStyle();

// Added before any app's own listener, so the next app is showing by the time it reads the hash.
window.addEventListener('hashchange', () => {
  const next = appOf(location.hash);
  last.set(next, location.hash);
  if (next === showing) return;
  showing = next; seen.add(next);
  // The browser jumps to an element named by the hash at its next layout. Let that happen
  // now, while the next app is still hidden, so the app's own router decides where to scroll.
  void document.documentElement.scrollTop;
  applyStyle();
  window.scrollTo(0, 0);
  flushSync(() => listeners.forEach((f) => f()));
});

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export function Fabric() {
  const now = useSyncExternalStore(subscribe, () => showing);
  const app = APPS.find((a) => a.id === now)!;
  return (
    <>
      <div className="fbar" data-wide={app.wide ? '' : undefined}>
        <div className="fbar-in">
          <span className="fbar-brand"><Mark /><span className="fbar-name">Ontology Fabric</span></span>
          <nav className="fbar-tabs" aria-label="Pages">
            {APPS.map((a) => (
              <a key={a.id} className="fbar-tab" href={a.id === now ? a.start : last.get(a.id) ?? a.start}
                aria-current={a.id === now ? 'page' : undefined} style={{ '--c': a.color } as CSSProperties}>{a.label}</a>
            ))}
          </nav>
        </div>
      </div>
      {APPS.filter((a) => seen.has(a.id)).map((a) => (
        <div key={a.id} className="fapp" data-app={a.id || 'overview'} hidden={a.id !== now}>{a.el}</div>
      ))}
    </>
  );
}

/** Three stores held together: the ontology, the graph and search. */
function Mark() {
  return (
    <svg className="fbar-mark" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10,4 L4,15.5 L16,15.5 Z" fill="none" style={{ stroke: 'var(--line)' }} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="10" cy="4" r="3" style={{ fill: 'var(--onto)' }} />
      <circle cx="4" cy="15.5" r="3" style={{ fill: 'var(--graph)' }} />
      <circle cx="16" cy="15.5" r="3" style={{ fill: 'var(--search)' }} />
    </svg>
  );
}
