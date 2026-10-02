// The claude.ai capabilities the studio uses, typed narrowly: only the calls it makes. The platform's own type
// definitions are authoritative; these follow runtime contract 0.2.45, and the calls are the same in 0.2.66. Every capability may be absent (a local copy
// of the page, the smoke test, a viewer outside the organization), so the studio works without any of them: building
// and checking always work, keeping the draft in this browser; sharing, Claude and pull requests light up when their
// capability resolves.
import { useEffect, useState } from 'react';

export type DbError = { code: string; message: string };
export type DocSnap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
export type QuerySnap = { docs: DocSnap[] };
export type DocRef = {
  id: string;
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
  acquire(o: { holder: string; ttlMs?: number }): Promise<{ acquired: boolean; expiresAt?: string }>;
  onSnapshot(next: (s: DocSnap) => void, error?: (e: DbError) => void): () => void;
};
type Query = {
  orderBy(field: string, dir?: 'asc' | 'desc'): Query;
  limit(n: number): Query;
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: DbError) => void): () => void;
};
export type Db = { doc(path: string): DocRef; collection(path: string): Query & { doc(id?: string): DocRef } };

export type Profile = { id: string; name: string; avatarUrl: string; color: string; isMe: boolean };
export type User = {
  me(): Promise<{ id: string | null; name: string; isOwner: boolean; canEdit: boolean }>;
  profiles(ids: string[]): Promise<Record<string, Profile>>;
};

export type SampleError = { code: string; message: string; text?: string };
type SampleOptions = {
  onText?: (u: { text: string; delta: string }) => void; signal?: AbortSignal;
  modelTier?: 'default' | 'complex' | 'quick'; cache?: boolean;
};
export type Sample = ((input: string, options?: SampleOptions) => Promise<{ text: string; truncated: boolean }>)
  & { json<T = unknown>(input: string, options?: SampleOptions): Promise<T> };

export type McpError = { code: string; message: string; server?: string; retryable?: boolean };
export type Mcp = {
  callTool(server: string, tool: string, input?: unknown, options?: { cache?: false }): Promise<{ payload?: unknown }>;
};

type Use = { use(name: string): Promise<unknown> };
const claude = (): Use | undefined => (window as unknown as { claude?: Use }).claude;

export type Runtime = {
  /** False until every capability has answered: present, or null for absent. */
  ready: boolean;
  db: Db | null; user: User | null; sample: Sample | null; mcp: Mcp | null;
  me: { id: string | null; canEdit: boolean; isOwner: boolean };
};

const NONE: Runtime = { ready: false, db: null, user: null, sample: null, mcp: null, me: { id: null, canEdit: false, isOwner: false } };
let resolved: Promise<Runtime> | undefined;

/** Resolves every capability once for the page. Without window.claude, everything is absent at once. */
function resolve(): Promise<Runtime> {
  return (resolved ??= (async () => {
    const c = claude();
    if (!c?.use) return { ...NONE, ready: true };
    const get = (name: string) => c.use(name).catch(() => null);
    const [db, user, sample, mcp] = await Promise.all([get('db'), get('user'), get('sample'), get('mcp')]);
    const me = user ? await (user as User).me() : null;
    return {
      ready: true, db: db as Db | null, user: user as User | null, sample: sample as Sample | null, mcp: mcp as Mcp | null,
      me: { id: me?.id ?? null, canEdit: !!me?.canEdit, isOwner: !!me?.isOwner },
    };
  })());
}

export function useRuntime(): Runtime {
  const [rt, setRt] = useState<Runtime>(NONE);
  useEffect(() => {
    let live = true;
    resolve().then((r) => { if (live) setRt(r); });
    return () => { live = false; };
  }, []);
  return rt;
}

/** Display names for the people a view shows, resolved on every render as the user capability asks. */
export function useProfiles(user: User | null, ids: (string | null | undefined)[]): Record<string, Profile> {
  const key = [...new Set(ids.filter(Boolean) as string[])].sort().join(',');
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  useEffect(() => {
    if (!user || !key) return;
    let live = true;
    user.profiles(key.split(',')).then((p) => { if (live) setProfiles(p); });
    return () => { live = false; };
  }, [user, key]);
  return profiles;
}

/** What to tell the viewer when a connector call fails, by its code (the mcp capability's failure design). */
export function mcpAdvice(e: McpError, server: string): string {
  switch (e.code) {
    case 'needs_reauth': return `Reconnect ${server} in claude.ai Settings → Connectors, then try again.`;
    case 'server_not_connected': return `Add the ${server} connector in claude.ai Settings → Connectors, then try again.`;
    case 'selection_required': return `Choose which ${server} connector this page should use when claude.ai asks, then try again.`;
    case 'not_in_manifest': return `${server} is turned off for this page. Allow it for the page to open pull requests from here.`;
    case 'blocked_by_policy': return `Your organization doesn't allow this page to use ${server}.`;
    case 'approval_required': return `Your organization needs an approval for each ${server} call, which pages can't ask for yet.`;
    case 'tool_error': return `${server} refused: ${e.message}`;
    case 'server_unavailable': return `${server} didn't answer. It may still have run: check your sessions before trying again.`;
    case 'not_granted': case 'capability_disabled': case 'capability_removed':
      return 'Connectors aren\'t available in this view of the page.';
    default: return `${server} failed (${e.code}). It may still have run: check your sessions before trying again.`;
  }
}

/** What to tell the viewer when asking Claude fails, by its code (the sample capability's failure design). */
export function sampleAdvice(e: SampleError): string | null {
  switch (e.code) {
    case 'cancelled': return null;
    case 'not_granted': case 'sampling_disabled': case 'not_declared': case 'capability_disabled': case 'capability_removed':
      return 'Claude isn\'t available for this page. Build on the map; the checks still run.';
    case 'rate_limited': return 'Too many requests to Claude just now. Try again in a little while.';
    case 'session_expired': return 'Sign in to claude.ai again, then try again.';
    case 'refused': return 'Claude declined this request. Rephrase it, or build that part on the map.';
    case 'invalid_json': return 'Claude\'s answer didn\'t come back in a shape the studio can apply. Try again, or ask for less.';
    case 'prompt_too_large': return 'The request was too large for Claude. Ask for less at a time.';
    case 'empty_completion': return 'Claude wrote nothing back. Try again, or ask for less.';
    default: return 'Asking Claude failed. Try again.';
  }
}
