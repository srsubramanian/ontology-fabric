import './ch1.css';
import { Authoring } from './Authoring';
import { BuildingBlocks } from './BuildingBlocks';
import { Version1 } from './Version1';

/**
 * Chapter 1, Design the ontology. The page's router still builds the sub-page tabs from the
 * `section.block` elements here, and fills the chapter's mini map, checks and next link.
 */
export function Chapter1() {
  return (
    <>
      <header className="chhead">
        <div className="chn" aria-hidden="true">1</div>
        <div>
          <h2 id="ch1h">Design the ontology</h2>
          <p className="chidea">The ontology is the product: one shared definition of payment concepts that everything else is generated from.</p>
          <div className="chacts">
            <button type="button" className="vbtn watch" data-flow="design">Watch it on the map</button>
            <a className="vbtn go" href="ontology.html" target="_blank" rel="noopener">Open the class explorer</a>
          </div>
        </div>
        <figure className="minibox"><svg className="mini" data-ch="1" viewBox="10 26 1070 464" role="img" aria-label="Where chapter 1 sits in the platform"></svg><figcaption>Where this sits in the platform</figcaption></figure>
      </header>
      <BuildingBlocks />
      <Version1 />
      <Authoring />
      <div className="check" data-ch="1"></div>
      <div className="chnext" data-ch="1"></div>
    </>
  );
}
