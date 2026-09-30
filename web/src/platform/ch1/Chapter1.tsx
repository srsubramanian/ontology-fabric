import './ch1.css';
import { ChapterEnd, ChapterHead } from '../shared/Chapter';
import { Authoring } from './Authoring';
import { BuildingBlocks } from './BuildingBlocks';
import { Version1 } from './Version1';

/**
 * Chapter 1, Design the ontology. The page's router still builds the sub-page tabs from the
 * `section.block` elements here, and fills the chapter's mini map, check and next link.
 */
export function Chapter1() {
  return (
    <>
      <ChapterHead n={1} title="Design the ontology" idea="The ontology is the product: one shared definition of payment concepts that everything else is generated from." flow="design">
        <a className="vbtn go" href="ontology.html" target="_blank" rel="noopener">Open the class explorer</a>
      </ChapterHead>
      <BuildingBlocks />
      <Version1 />
      <Authoring />
      <ChapterEnd n={1} />
    </>
  );
}
