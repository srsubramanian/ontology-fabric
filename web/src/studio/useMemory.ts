// Where the studio's memory lives. On the published page, the team's decisions are shared documents, one per month
// (memory/m-2026-10), and each person's setting and notes are theirs alone (data/users/<id>/studio), which nobody
// else, the page's owner included, can read. Anywhere else, both are kept in this browser.
import { useCallback, useEffect, useRef, useState } from 'react';
import { entriesOf, monthOf, trimMine, type Level, type Memory, type Prefs } from './memory';
import type { DocRef, Runtime } from './runtime';
import { dbAdvice } from './store';

export type MemoryStore = {
  team: [string, Memory][]; prefs: Prefs; level: Level;
  /** True when decisions are shared with the team; false when they're kept in this browser. */
  shared: boolean;
  remember(ms: [string, Memory][]): Promise<string | null>;
  forget(id: string, at: number): Promise<string | null>;
  setPrefs(p: Partial<Prefs>): Promise<string | null>;
};

const kept = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not kept */ } },
};
const isLevel = (v: unknown): v is Level => v === 'tutor' || v === 'copilot' || v === 'autopilot';

/** Merges into a document, creating it when it's missing. A short lease keeps two first writes from overwriting each other. */
async function upsert(ref: DocRef, data: Record<string, unknown>, holder: string) {
  try { await ref.update(data); return; } catch (e) { if ((e as { code?: string })?.code !== 'invalid_argument') throw e; }
  await ref.acquire({ holder, ttlMs: 5000 }).catch(() => null);
  const now = await ref.get();
  if (now.exists) await ref.update(data); else await ref.set(data);
}

export function useMemory(rt: Runtime): MemoryStore {
  const shared = !!(rt.db && rt.me.id);
  const [team, setTeam] = useState<[string, Memory][]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(() => ({ level: kept.get<Level>('studio:level', 'copilot') }));
  const [uid, setUid] = useState<string | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  // One write at a time to each document, in order.
  const chain = useRef(Promise.resolve<unknown>(null));
  const queue = useCallback(<T,>(f: () => Promise<T>) => { const p = chain.current.then(f, f); chain.current = p.catch(() => null); return p; }, []);

  // In this browser.
  useEffect(() => {
    if (!rt.ready || shared) return;
    setTeam(entriesOf([kept.get('studio:memory', { entries: {} })]));
    setPrefsState((p) => ({ ...p, ...kept.get<Prefs>('studio:prefs', {}) }));
  }, [rt.ready, shared]);

  // Shared: the last six months of the team's decisions, live.
  useEffect(() => {
    if (!shared || !rt.db) return;
    return rt.db.collection('memory').orderBy('month', 'desc').limit(6)
      .onSnapshot((s) => setTeam(entriesOf(s.docs.map((d) => (d.data() ?? {}) as { entries?: Record<string, Memory | null> }))), () => setTeam([]));
  }, [shared, rt.db]);

  // Private: this person's setting and notes. The store knows them by the user capability's id.
  useEffect(() => {
    if (!shared || !rt.user) return;
    let live = true;
    const id = (rt.user as { id?: () => Promise<string | null> }).id;
    (id ? id.call(rt.user) : Promise.resolve(rt.me.id)).then((v) => { if (live) setUid(v ?? null); }, () => { if (live) setUid(null); });
    return () => { live = false; };
  }, [shared, rt.user, rt.me.id]);
  useEffect(() => {
    if (!shared || !rt.db || !uid) return;
    return rt.db.doc(`data/users/${uid}/studio`).onSnapshot((s) => {
      const d = (s.data() ?? {}) as Prefs;
      setPrefsState((p) => ({ ...p, ...d, level: isLevel(d.level) ? d.level : p.level }));
    }, () => undefined);
  }, [shared, rt.db, uid]);

  const holder = rt.me.id ?? 'local';
  const remember = useCallback(async (ms: [string, Memory][]) => {
    if (!ms.length) return null;
    const add = Object.fromEntries(ms);
    if (!shared || !rt.db) {
      const all = kept.get<{ entries: Record<string, Memory> }>('studio:memory', { entries: {} });
      kept.set('studio:memory', { entries: { ...all.entries, ...add } });
      setTeam(entriesOf([{ entries: { ...all.entries, ...add } }]));
      const next = { ...prefsRef.current, mine: trimMine(prefsRef.current.mine, add) };
      kept.set('studio:prefs', next); setPrefsState(next);
      return null;
    }
    try {
      const month = monthOf(Date.now());
      await queue(() => upsert(rt.db!.doc(`memory/${month}`), { month, entries: add }, holder));
      if (uid) await queue(() => upsert(rt.db!.doc(`data/users/${uid}/studio`), { mine: trimMine(prefsRef.current.mine, add) }, holder));
      return null;
    } catch (e) { return dbAdvice(e); }
  }, [shared, rt.db, uid, holder, queue]);

  const forget = useCallback(async (id: string, at: number) => {
    if (!shared || !rt.db) {
      const all = kept.get<{ entries: Record<string, Memory | null> }>('studio:memory', { entries: {} });
      delete all.entries[id];
      kept.set('studio:memory', all); setTeam(entriesOf([all]));
      return null;
    }
    try { await queue(() => rt.db!.doc(`memory/${monthOf(at)}`).update({ entries: { [id]: null } })); return null; } catch (e) { return dbAdvice(e); }
  }, [shared, rt.db, queue]);

  const setPrefs = useCallback(async (p: Partial<Prefs>) => {
    if (p.level) kept.set('studio:level', p.level);
    setPrefsState((x) => ({ ...x, ...p }));
    if (!shared || !rt.db || !uid) { kept.set('studio:prefs', { ...prefsRef.current, ...p }); return null; }
    try { await queue(() => upsert(rt.db!.doc(`data/users/${uid}/studio`), p as Record<string, unknown>, holder)); return null; } catch (e) { return dbAdvice(e); }
  }, [shared, rt.db, uid, holder, queue]);

  return { team, prefs, level: isLevel(prefs.level) ? prefs.level : 'copilot', shared, remember, forget, setPrefs };
}
