import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

// The four apps share one page and one hash. The overview's views have bare names (map,
// ch3, ch3-2, or any element's id); the others sit under their app's name (retrieval-s4,
// explorer-Chargeback), so a shared link can open any view. Hashes use only letters, digits
// and hyphens, so a link to the published page keeps them intact. The studio's views are
// studio-CQ-116 for a draft and studio-p-… for a saved proposal.

/** An app: '' for the overview, or the name its views sit under. */
export type AppId = '' | 'retrieval' | 'explorer' | 'studio';
const NAMED: AppId[] = ['retrieval', 'explorer', 'studio'];

const bare = (hash: string) => {
  const h = hash.replace(/^#/, '');
  try { return decodeURIComponent(h); } catch { return h; }
};

/** The app a hash belongs to. */
export const appOf = (hash: string): AppId => {
  const h = bare(hash);
  return NAMED.find((a) => h === a || h.startsWith(a + '-')) ?? '';
};

/** The app's own view in a hash ('' for its start), or null when the hash belongs to another app. */
export const viewOf = (app: AppId, hash: string): string | null => {
  const h = bare(hash);
  if (appOf(h) !== app) return null;
  return app ? h.slice(app.length + 1) : h;
};

/** The hash for one of an app's views, where 'map' or '' is the app's start. */
export const hashFor = (app: AppId, view: string) =>
  '#' + (!app ? view : view && view !== 'map' ? app + '-' + view : app);

/** Whether the app is the one showing. */
export const isShowing = (app: AppId) => appOf(location.hash) === app;

/**
 * The app's view in the hash, kept current as the reader navigates. It holds still while another
 * app shows, and renders at once when it changes, so an app coming back never shows its old view.
 */
export function useHash(app: AppId): string {
  const [view, setView] = useState(() => viewOf(app, location.hash) ?? '');
  useEffect(() => {
    const onChange = () => { const v = viewOf(app, location.hash); if (v !== null) flushSync(() => setView(v)); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [app]);
  return view;
}
