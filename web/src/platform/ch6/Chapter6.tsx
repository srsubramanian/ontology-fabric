import { ChapterHead } from '../shared/Chapter';
import type { ChapterDef } from '../shell/ChapterView';
import { Loop } from './Loop';
import { Versions } from './Versions';

/** Chapter 6, Keep it current: machines detect, draft and release; people decide where meaning changes. */
export const chapter6: ChapterDef = {
  n: 6, color: 'var(--onto)',
  head: <ChapterHead n={6} title="Keep it current" idea="Machines detect, draft and release changes. People decide wherever meaning changes." />,
  pages: [
    { label: 'Versions', el: <Versions /> },
    { label: 'The loop', el: <Loop /> },
  ],
};
