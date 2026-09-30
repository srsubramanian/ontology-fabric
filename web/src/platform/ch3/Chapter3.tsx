import { ChapterEnd, ChapterHead } from '../shared/Chapter';
import { Indexes } from './Indexes';
import { TwoStores } from './TwoStores';
import { WhoOwnsWhat } from './WhoOwnsWhat';

/** Chapter 3, Two stores, one join: Neptune holds what's true, OpenSearch finds where to start. */
export function Chapter3() {
  return (
    <>
      <ChapterHead n={3} title="Two stores, one join" idea="Neptune holds what is true about payments. OpenSearch finds where to start. One ID joins them." flow="sync" />
      <TwoStores />
      <WhoOwnsWhat />
      <Indexes />
      <ChapterEnd n={3} />
    </>
  );
}
