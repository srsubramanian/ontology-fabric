import { ChapterEnd, ChapterHead } from '../shared/Chapter';
import { Loop } from './Loop';
import { Versions } from './Versions';

/** Chapter 6, Keep it current: machines detect, draft and release; people decide where meaning changes. */
export function Chapter6() {
  return (
    <>
      <ChapterHead n={6} title="Keep it current" idea="Machines detect, draft and release changes. People decide wherever meaning changes." />
      <Versions />
      <Loop />
      <ChapterEnd n={6} />
    </>
  );
}
