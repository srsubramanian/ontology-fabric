import { ChapterEnd, ChapterHead } from '../shared/Chapter';
import { CodeToGraph } from './CodeToGraph';
import { TwoJobs } from './TwoJobs';
import { WhatLivesWhere } from './WhatLivesWhere';

/** Chapter 2, Fill the graph: how the pipeline turns code, events and documents into graph data. */
export function Chapter2() {
  return (
    <>
      <ChapterHead n={2} title="Fill the graph" idea="The pipeline follows the ontology to turn code, payment events and documents into graph data." flow="ingest" />
      <CodeToGraph />
      <WhatLivesWhere />
      <TwoJobs />
      <ChapterEnd n={2} />
    </>
  );
}
