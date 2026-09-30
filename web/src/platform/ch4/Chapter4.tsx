import { ChapterHead } from '../shared/Chapter';
import type { ChapterDef } from '../shell/ChapterView';
import { BuildOrReuse } from './BuildOrReuse';
import { HybridSearch } from './HybridSearch';
import { OneQuestion } from './OneQuestion';

/** Chapter 4, Answer a question: search finds the entry points, the graph does the reasoning. */
export const chapter4: ChapterDef = {
  n: 4, color: 'var(--query)',
  head: (
    <ChapterHead n={4} title="Answer a question" idea="Search finds the entry points, the graph does the reasoning, and every answer cites its sources." flow="query">
      <a className="vbtn go" href="#retrieval">Open the retrieval deep dive</a>
    </ChapterHead>
  ),
  pages: [
    { label: 'Hybrid search', el: <HybridSearch /> },
    { label: 'One question', el: <OneQuestion /> },
    { label: 'Build or reuse', el: <BuildOrReuse /> },
  ],
};
