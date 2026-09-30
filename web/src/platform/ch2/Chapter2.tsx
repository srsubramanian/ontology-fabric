import { ChapterHead } from '../shared/Chapter';
import type { ChapterDef } from '../shell/ChapterView';
import { CodeToGraph } from './CodeToGraph';
import { TwoJobs } from './TwoJobs';
import { WhatLivesWhere } from './WhatLivesWhere';

/** Chapter 2, Fill the graph: how the pipeline turns code, events and documents into graph data. */
export const chapter2: ChapterDef = {
  n: 2, color: 'var(--graph)',
  head: <ChapterHead n={2} title="Fill the graph" idea="The pipeline follows the ontology to turn code, payment events and documents into graph data." flow="ingest" />,
  pages: [
    { label: 'Code to graph', el: <CodeToGraph /> },
    { label: 'What lives where', el: <WhatLivesWhere /> },
    { label: 'Two jobs', el: <TwoJobs /> },
  ],
};
