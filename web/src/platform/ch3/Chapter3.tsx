import { ChapterHead } from '../shared/Chapter';
import type { ChapterDef } from '../shell/ChapterView';
import { Indexes } from './Indexes';
import { TwoStores } from './TwoStores';
import { WhoOwnsWhat } from './WhoOwnsWhat';

/** Chapter 3, Two stores, one join: Neptune holds what's true, OpenSearch finds where to start. */
export const chapter3: ChapterDef = {
  n: 3, color: 'var(--search)',
  head: <ChapterHead n={3} title="Two stores, one join" idea="Neptune holds what is true about payments. OpenSearch finds where to start. One ID joins them." flow="sync" />,
  pages: [
    { label: 'Two stores', el: <TwoStores /> },
    { label: 'Who owns what', el: <WhoOwnsWhat /> },
    { label: 'Indexes', el: <Indexes /> },
  ],
};
