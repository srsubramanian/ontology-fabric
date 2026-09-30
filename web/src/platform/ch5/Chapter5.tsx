import { ChapterEnd, ChapterHead } from '../shared/Chapter';
import { FourWaysIn } from './FourWaysIn';
import { ToolCall } from './ToolCall';

/** Chapter 5, Who uses it: agents, analysts, engineers and other teams, through one access policy. */
export function Chapter5() {
  return (
    <>
      <ChapterHead n={5} title="Who uses it" idea="Agents, analysts, engineers and other teams each get their own way in, through one access policy." />
      <ToolCall />
      <FourWaysIn />
      <ChapterEnd n={5} />
    </>
  );
}
