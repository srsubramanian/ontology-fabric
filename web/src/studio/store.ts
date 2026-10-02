// Where the working draft lives. On the published page it's one document in the page's shared store
// (drafts/<id>, pointed to by studio/current), so everyone in the organization builds on the same draft and sees
// each other's changes as they happen. Anywhere else, such as a local copy of the page, it's kept in this browser.
import { useCallback, useEffect, useState } from 'react';
import { emptyDraft, mergeDraft, type DraftDoc, type DraftUpdate } from './draft';
import type { DbError, Runtime } from './runtime';

export type DraftWrite = DraftUpdate & Partial<Pick<DraftDoc, 'status' | 'session'>>;
export type DraftStore = {
  draft: DraftDoc | null;
  /** True when the draft is shared through the page's store; false when it's kept in this browser. */
  shared: boolean;
  error: string | null;
  write(u: DraftWrite): Promise<string | null>;
  /** Starts a fresh draft, once this one's pull request is open. */
  startNext(): Promise<string | null>;
};

const newId = () => 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const LOCAL = 'studio:draft';
const local = {
  get(): DraftDoc | null { try { const s = localStorage.getItem(LOCAL); return s ? JSON.parse(s) : null; } catch { return null; } },
  set(d: DraftDoc) { try { localStorage.setItem(LOCAL, JSON.stringify(d)); } catch { /* not kept */ } },
};

/** What to tell the viewer when a write fails, by its code. */
export function dbAdvice(e: unknown): string {
  const code = (e as DbError)?.code;
  if (code === 'quota_exceeded') return 'The page\'s store is full.';
  if (code === 'resource_exhausted') return 'Too many changes at once. Wait a moment and try again.';
  if (code === 'revoked' || code === 'not_granted') return 'Saving isn\'t available in this view of the page.';
  return `Saving failed (${code ?? 'unknown'}). Try again.`;
}

/** Stamps every entry a write touches with who made it and when. */
function stamp(u: DraftWrite, by: string | null): Record<string, unknown> {
  const at = Date.now();
  const out: Record<string, unknown> = { ...u, updatedAt: at, updatedBy: by };
  for (const m of ['classes', 'slots', 'enums', 'answers'] as const) {
    if (!u[m]) continue;
    out[m] = Object.fromEntries(Object.entries(u[m]!).map(([k, v]) => [k, v === null ? null : { ...v, by, at }]));
  }
  return out;
}

export function useDraftStore(rt: Runtime, base: string): DraftStore {
  const shared = !!(rt.db && rt.me.id);
  const [draft, setDraft] = useState<DraftDoc | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // In this browser: load once the runtime has said there's no shared store.
  useEffect(() => {
    if (!rt.ready || shared) return;
    setDraft(local.get() ?? emptyDraft('local', base));
  }, [rt.ready, shared, base]);

  // Shared: follow studio/current to the draft, creating the first one if there's none.
  useEffect(() => {
    if (!shared) return;
    const db = rt.db!;
    const cur = db.doc('studio/current');
    return cur.onSnapshot(async (s) => {
      const id = s.exists ? (s.data()?.draftId as string | undefined) : undefined;
      if (id) { setDraftId(id); return; }
      try {
        const lease = await cur.acquire({ holder: rt.me.id!, ttlMs: 10000 });
        if (!lease.acquired) return;
        if ((await cur.get()).data()?.draftId) return;
        const fresh = newId();
        await db.doc(`drafts/${fresh}`).set(emptyDraft(fresh, base) as unknown as Record<string, unknown>);
        await cur.set({ draftId: fresh, at: Date.now() });
      } catch (e) { setError(dbAdvice(e)); }
    }, (e) => setError(`The working draft can't load (${e.code}).`));
  }, [shared, rt.db, rt.me.id, base]);

  useEffect(() => {
    if (!shared || !draftId) return;
    return rt.db!.doc(`drafts/${draftId}`).onSnapshot(
      (s) => { if (s.exists) setDraft({ ...emptyDraft(draftId, base), ...(s.data() as Partial<DraftDoc>), id: draftId }); },
      (e) => setError(`The working draft can't load (${e.code}).`),
    );
  }, [shared, draftId, rt.db, base]);

  const write = useCallback(async (u: DraftWrite): Promise<string | null> => {
    const body = stamp(u, rt.me.id);
    if (!shared) {
      setDraft((d) => { const next = mergeDraft(d ?? emptyDraft('local', base), body); local.set(next); return next; });
      return null;
    }
    if (!draftId) return 'The working draft is still loading.';
    try { await rt.db!.doc(`drafts/${draftId}`).update(body); return null; } catch (e) { return dbAdvice(e); }
  }, [shared, draftId, rt.db, rt.me.id, base]);

  const startNext = useCallback(async (): Promise<string | null> => {
    if (!shared) { const d = emptyDraft('local', base); local.set(d); setDraft(d); return null; }
    try {
      const fresh = newId();
      await rt.db!.doc(`drafts/${fresh}`).set(emptyDraft(fresh, base) as unknown as Record<string, unknown>);
      await rt.db!.doc('studio/current').set({ draftId: fresh, at: Date.now() });
      return null;
    } catch (e) { return dbAdvice(e); }
  }, [shared, rt.db, base]);

  return { draft, shared, error, write, startNext };
}
