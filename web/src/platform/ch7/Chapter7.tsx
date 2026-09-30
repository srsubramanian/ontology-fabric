import { ChapterEnd, ChapterHead } from '../shared/Chapter';
import { BuildOrder } from './BuildOrder';
import { DecideEarly } from './DecideEarly';
import { WatchList } from './WatchList';

/** Chapter 7, Build it: graph first, then search, then agents, with a few decisions settled early. */
export function Chapter7() {
  return (
    <>
      <ChapterHead n={7} title="Build it" idea="Graph first, then search, then agents, with a handful of decisions settled early." />
      <BuildOrder />
      <DecideEarly />
      <WatchList />
      <ChapterEnd n={7} />
    </>
  );
}
