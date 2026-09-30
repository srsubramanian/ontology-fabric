import { ChapterHead } from '../shared/Chapter';
import type { ChapterDef } from '../shell/ChapterView';
import { BuildOrder } from './BuildOrder';
import { DecideEarly } from './DecideEarly';
import { WatchList } from './WatchList';

/** Chapter 7, Build it: graph first, then search, then agents, with a few decisions settled early. */
export const chapter7: ChapterDef = {
  n: 7, color: 'var(--ink)',
  head: <ChapterHead n={7} title="Build it" idea="Graph first, then search, then agents, with a handful of decisions settled early." />,
  pages: [
    { label: 'Build order', el: <BuildOrder /> },
    { label: 'Decisions', el: <DecideEarly /> },
    { label: 'Watch list', el: <WatchList /> },
  ],
};
