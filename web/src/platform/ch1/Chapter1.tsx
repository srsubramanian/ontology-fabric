import './ch1.css';
import { ChapterHead } from '../shared/Chapter';
import type { ChapterDef } from '../shell/ChapterView';
import { Authoring } from './Authoring';
import { BuildingBlocks } from './BuildingBlocks';
import { Version1 } from './Version1';

/** Chapter 1, Design the ontology: one shared definition of payment concepts, generated into everything else. */
export const chapter1: ChapterDef = {
  n: 1, color: 'var(--onto)',
  head: (
    <ChapterHead n={1} title="Design the ontology" idea="The ontology is the product: one shared definition of payment concepts that everything else is generated from." flow="design">
      <a className="vbtn go" href="ontology.html" target="_blank" rel="noopener">Open the class explorer</a>
    </ChapterHead>
  ),
  pages: [
    { label: 'Building blocks', el: <BuildingBlocks /> },
    { label: 'Version 1', el: <Version1 /> },
    { label: 'Turtle or LinkML', el: <Authoring /> },
  ],
};
