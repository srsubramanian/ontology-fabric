// Proposals, kept in the page's shared store (the db capability) so a team can review them: one document each,
// at proposals/<id>. People are stored by their opaque user id, never by name. Writes are last-writer-wins; the
// flow is short and each step names who took it, which is enough for a prototype. The real gate stays the pull
// request: its review and CI decide what merges.
import { useEffect, useState } from 'react';
import type { Db, DbError } from './runtime';

export type Status = 'draft' | 'review' | 'changes' | 'approved' | 'pr';
export type Review = { by: string; verdict: 'approve' | 'changes'; note: string; at: number };
export type Proposal = {
  id: string; question: string; title: string; patch: string; status: Status;
  author: string; createdAt: number; updatedAt: number;
  /** What the checks said when it was last saved, for the list. */
  summary: { answered: number; problems: number; lane: string; owners: string[] };
  reviews: Review[];
  /** The patch as approved, with the layout the studio worked out: what the pull request applies. */
  approved?: { patch: string; layout: string; by: string; at: number };
  /** The Claude Code session that applies it and opens the pull request. */
  session?: { id: string | null; by: string; at: number; environment: string; branch: string; note?: string };
};

export const STATUS: Record<Status, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--muted)' },
  review: { label: 'In review', color: 'var(--search)' },
  changes: { label: 'Changes asked', color: 'var(--bad)' },
  approved: { label: 'Approved', color: 'var(--query)' },
  pr: { label: 'Pull request', color: 'var(--graph)' },
};

/** A new proposal id: letters and digits only, so it can sit in a route (#studio-p-…). */
export const newId = () => 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const asProposal = (id: string, d: Record<string, unknown> | undefined): Proposal | null =>
  d && typeof d.patch === 'string' && typeof d.question === 'string' ? ({ reviews: [], ...d, id } as unknown as Proposal) : null;

/** Every proposal, newest first, live. Undefined until the first answer; an error is shown, not thrown. */
export function useProposals(db: Db | null): { list?: Proposal[]; error?: string } {
  const [state, setState] = useState<{ list?: Proposal[]; error?: string }>({});
  useEffect(() => {
    if (!db) return;
    return db.collection('proposals').orderBy('updatedAt', 'desc').limit(200).onSnapshot(
      (s) => setState({ list: s.docs.map((d) => asProposal(d.id, d.data())).filter((p): p is Proposal => !!p) }),
      (e: DbError) => setState({ error: e.code === 'revoked' ? 'Proposals are no longer available in this view.' : `Proposals can't load (${e.code}).` }),
    );
  }, [db]);
  return state;
}

/** One proposal, live: undefined while loading, null when there's no such proposal. */
export function useProposal(db: Db | null, id: string | undefined): Proposal | null | undefined {
  const [p, setP] = useState<Proposal | null | undefined>(undefined);
  useEffect(() => {
    setP(undefined);
    if (!db || !id) return;
    return db.doc(`proposals/${id}`).onSnapshot((s) => setP(s.exists ? asProposal(s.id, s.data()) : null), () => setP(null));
  }, [db, id]);
  return p;
}

/** What to tell the viewer when a write fails, by its code. */
export function dbAdvice(e: unknown): string {
  const code = (e as DbError)?.code;
  if (code === 'quota_exceeded') return 'The page\'s store is full. Ask its owner to clear out old proposals.';
  if (code === 'resource_exhausted') return 'Too many saves at once. Wait a moment and try again.';
  if (code === 'revoked' || code === 'not_granted') return 'Saving isn\'t available in this view of the page.';
  return `Saving failed (${code ?? 'unknown'}). Try again.`;
}

/** Local drafts: kept in this browser until saved as a proposal. Storage can be missing, so every call is guarded. */
export const local = {
  get(key: string): string | null { try { return localStorage.getItem('studio:' + key); } catch { return null; } },
  set(key: string, v: string) { try { localStorage.setItem('studio:' + key, v); } catch { /* not kept */ } },
  drop(key: string) { try { localStorage.removeItem('studio:' + key); } catch { /* nothing to drop */ } },
};
