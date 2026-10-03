// Who else is in the studio right now, through the page's room capability: each person shares where they are (the
// view, what they've selected, which lens they read in) and their pointer on the map, and sees everyone else's. It's
// display only: presence commands nothing, and the page works the same alone or without the capability.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point } from './draft';
import type { Room, RoomPeer } from './runtime';

export type Lens = 'story' | 'model';
/** Another person here: their pointer on the map, where they are, and a colour to tell them apart. */
export type Here = { peer: string; by: string | null; color: number; cursor: Point | null; view: string; sel: string | null; lens: Lens };

const COLORS = 4;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const point = (v: unknown): Point | null =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n)) ? [v[0], v[1]] : null;
const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.slice(0, max) : '');

/** What a peer's presence says, read defensively: it's whatever their page set. */
function read(p: RoomPeer): Here {
  const pr = p.presence ?? {};
  return {
    peer: p.peer, by: p.by, color: hash(p.peer) % COLORS, cursor: point(pr.cursor),
    view: str(pr.view), sel: str(pr.sel) || null, lens: pr.lens === 'story' ? 'story' : 'model',
  };
}

export function usePresence(room: Room | null, mine: { view: string; sel: string | null; lens: Lens }) {
  const [peers, setPeers] = useState<Here[]>([]);
  useEffect(() => {
    if (!room) return;
    const off = room.onPeers((c) => setPeers(c.peers.filter((p) => !p.sameTab && p.kind === 'viewer').map(read)), () => setPeers([]));
    return off;
  }, [room]);
  useEffect(() => { room?.presence({ view: mine.view, sel: mine.sel, lens: mine.lens }).catch(() => {}); }, [room, mine.view, mine.sel, mine.lens]);
  // The pointer, in map units, so it lands on the same spot whatever the other person's zoom.
  const last = useRef<string>('');
  const cursor = useCallback((pt: Point | null) => {
    const key = pt ? `${Math.round(pt[0])},${Math.round(pt[1])}` : '';
    if (!room || key === last.current) return;
    last.current = key;
    room.presence({ cursor: pt ? [Math.round(pt[0]), Math.round(pt[1])] : null }).catch(() => {});
  }, [room]);
  return { peers, cursor };
}
