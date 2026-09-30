import { ChapterEnd, ChapterHead } from '../shared/Chapter';
import { BuildOrReuse } from './BuildOrReuse';
import { HybridSearch } from './HybridSearch';
import { OneQuestion } from './OneQuestion';

/** Chapter 4, Answer a question: search finds the entry points, the graph does the reasoning. */
export function Chapter4() {
  return (
    <>
      <ChapterHead n={4} title="Answer a question" idea="Search finds the entry points, the graph does the reasoning, and every answer cites its sources." flow="query">
        <a className="vbtn go" href="retrieval.html" target="_blank" rel="noopener">Open the retrieval deep dive</a>
      </ChapterHead>
      <HybridSearch />
      <OneQuestion />
      <BuildOrReuse />
      <ChapterEnd n={4} />
    </>
  );
}
