# Style guide for the pages

## Visual

- **Diagrams are custom, hand-drawn SVG, animated with Motion 13.4.4.** Pages in `web/` use `motion/react` from npm. Don't use Mermaid or ELK layouts; the owner tried and rejected both.
- **Code uses Prism 1.30.0 components** in manual mode: from npm through `web/src/kit/prism.ts`. Custom grammars already defined there include `opensearch`, `mcphttp`, `walktext`, `tsq`, `tree`, `cli`, `cedar`, `diffx` and `csvx`. Reuse them before writing new ones.
- **Fonts:** Schibsted Grotesk for text, JetBrains Mono for code and IDs.
- **Colours carry meaning.** Keep them consistent:

  | Token | Means |
  |---|---|
  | `--onto` (violet) | Ontology |
  | `--graph` (blue) | Neptune |
  | `--search` (amber) | OpenSearch |
  | `--query` (green) | Retrieval service and Claude |
  | `--wh` (cyan, retrieval page) | Snowflake |
  | `--bad` (red) | Failures |

- **Every colour has light and dark values.** Define both, test both, and never hard-code a colour outside the tokens. Shared tokens live in `web/src/kit/tokens.css`.

## Page structure

- **One page, four apps:** the platform overview, the retrieval walkthrough, the class explorer and the design studio, switched by the bar at the top (`web/src/fabric/`). Only the showing app's styles are in the page.
- **One view at a time**, switched by hash routes. Routes use only letters, digits and hyphens, so a link to the published page can open any view:
  - Overview: `#map`, `#chN` and `#chN-K` (`#chN:K` still works), or any element's id.
  - Retrieval: `#retrieval` for its map, then `#retrieval-s1` to `#retrieval-s11`.
  - Class explorer: `#explorer` for its map, `#explorer-<ClassName>` (such as `#explorer-Chargeback`) and `#explorer-CQ-NN` for a competency question.
  - Design studio: `#studio` for its map and working draft, `#studio-<ClassName>` with that class selected, `#studio-CQ-NN` to answer a question, `#studio-mission-CQ-NN` for that question's mission, `#studio-ask-<id>` for a question someone asked, `#studio-lineage` for lineage's front page (start from a meaning, or a screen), `#studio-lineage-<screen>` for a screen's lineage, such as `#studio-lineage-dispute-workbench`, with `#studio-lineage-<screen>-<field>` for one of its fields and `#studio-lineage-<screen>-changes` for what its latest scan changed, `#studio-meaning-<Class>-<slot>` for every screen field that means one slot, such as `#studio-meaning-Settlement-settled-at`, and `#studio-column-<SCHEMA>-<TABLE>-<COLUMN>` for everything built from one Snowflake column, such as `#studio-column-CORE-FCT-CHARGEBACK-CB-ID`. Without a screen, `#studio-lineage-<field>` and `#studio-lineage-changes` still mean transaction research's.
  - Links between apps are hash links too, such as `#explorer` from chapter 1. Build an app's routes with `hashFor` in `web/src/kit/route.ts`.
- **Chapters split into sub-pages**, with underlined tabs and Previous/Next buttons. Arrow keys move between sub-pages.
- **A view's animation runs when it's shown** (or when it scrolls into view with Motion's `inView`), and always has a replay button. In `web/`, a view mounts when shown, which starts its `useTimeline` steps; the replay button remounts the animated part with a new key from `useReplay`.
- **No horizontal page scroll on a 390 px phone.** Wide SVGs sit inside an `overflow-x: auto` wrapper.

## Motion gotchas

- **Don't set `style.opacity` directly and then animate to a single target value.** Motion caches values, so the animation silently does nothing. Reset with `animate(el, { opacity: 0 }, { duration: 0 })`, or animate with keyframe arrays like `{ opacity: [0, 1] }`.
- **Convert `HTMLCollection` with `Array.from`** before passing it to `animate`. The helper wrappers already do this.
- **Respect `prefers-reduced-motion`.** The helpers set duration to 0.
- **In `web/`, animate declaratively with the kit's `play()` helper** (variants with keyframes) rather than calling `animate` on elements. It avoids the caching problem above, and applies reduced motion through `tr()`.

## Writing

- **Short, visual-first copy.** One idea per sentence, sentence case, plain words.
- **Invented figures are illustrative, and the page says so.** Figures from real rules, such as Visa's VAMP thresholds, must match their current source.
- **Keep the running examples consistent:**
  - Overview: Maya's online order at Harbor Grill, chargeback `cb:1001`, reason code 10.4, capture `cap:7731`, authorization `auth:5521`, merchant `m:88213`.
  - Retrieval: Sunset Tickets `m:10442` and its August VAMP ratio of 1.65% against a 1.5% threshold.
  - Class explorer: the examples in `ontology/payments.yaml` come from the two apps above, so they stay consistent with them.
