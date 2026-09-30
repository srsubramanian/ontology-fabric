# Style guide for the pages

## Visual

- **Diagrams are custom, hand-drawn SVG, animated with Motion 13.4.4.** Pages in `web/` use `motion/react` from npm; the platform page's original scripts get the same npm build as `window.Motion` (`web/src/platform/globals.ts`). Don't use Mermaid or ELK layouts; the owner tried and rejected both.
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

- **One view at a time**, switched by hash routes:
  - Platform page: `#map`, `#chN` and `#chN:K`.
  - Retrieval page: `#map` and `#s1` to `#s11`.
  - Class explorer: `#map`, `#<ClassName>` (such as `#Chargeback`) and `#CQ-NN` for a competency question.
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
  - Platform page: Maya's online order at Harbor Grill, chargeback `cb:1001`, reason code 10.4, capture `cap:7731`, authorization `auth:5521`, merchant `m:88213`.
  - Retrieval page: Sunset Tickets `m:10442` and its August VAMP ratio of 1.65% against a 1.5% threshold.
  - Class explorer: the examples in `ontology/payments.yaml` come from the two pages above, so they stay consistent with them.
