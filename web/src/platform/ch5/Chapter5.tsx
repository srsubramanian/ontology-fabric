import { ChapterHead } from '../shared/Chapter';
import type { ChapterDef } from '../shell/ChapterView';
import { FourWaysIn } from './FourWaysIn';
import { ToolCall } from './ToolCall';

/** Chapter 5, Who uses it: agents, analysts, engineers and other teams, through one access policy. */
export const chapter5: ChapterDef = {
  n: 5, color: 'var(--query)',
  head: <ChapterHead n={5} title="Who uses it" idea="Agents, analysts, engineers and other teams each get their own way in, through one access policy." />,
  pages: [
    { label: 'Tool calls', el: <ToolCall /> },
    { label: 'Four ways in', el: <FourWaysIn /> },
  ],
};
