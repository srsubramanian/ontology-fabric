# Starter prompt: a visual explainer in one HTML file

Paste everything below the line into a new Claude Code session, in an empty repository. Fill in the three blanks under **The project** first. It describes the tooling behind Ontology Fabric's page, without its content, so the new project starts from the same shape.

If the session can read `srsubramanian/ontology-fabric`, point it at `web/src/kit/`, `web/src/fabric/`, `web/vite.config.ts` and `tools/smoke_test.py` as the reference implementation. If it can't, everything it needs is below.

---

## The project

- **Name:** ______
- **What it explains, and to whom:** ______
- **The first two apps** (for example, an overview and a walkthrough): ______

Build a starter for a visual, interactive explainer. It's one self-contained HTML file with several apps in it, switched by a bar at the top. Each app is a set of views, one at a time, reached by hash links. Diagrams are hand-drawn SVG, animated with Motion. Code is highlighted with Prism. It builds from `web/` into `site/index.html`, can be published as a claude.ai artifact, and a smoke test loads every view in light, dark and on a phone.

Ask me one question at a time when something is mine to decide. Otherwise pick the conventional default, say so, and carry on.

## The stack

Pin exact versions (no `^` or `~`). These worked together in October 2026; check each is still current when you start, and upgrade on purpose, not by accident.

| Package | Version | Why |
|---|---|---|
| `react`, `react-dom` | 19.3.0 | Components and state |
| `motion` | 13.4.4 | Animation, from `motion/react` |
| `prismjs` | 1.30.0 | Code highlighting, in manual mode |
| `yaml` | 2.9.1 | Reads YAML data at build time |
| `vite` | 8.3.1 | Dev server and build |
| `@vitejs/plugin-react` | 6.1.1 | React in Vite |
| `vite-plugin-singlefile` | 2.3.3 | Inlines every script and style into one HTML file |
| `typescript` | 7.0.2 | Strict typecheck |
| `@types/react`, `@types/react-dom`, `@types/prismjs` | match the packages | Types |
| Python `playwright` | 1.56.0 | The smoke test |

Fonts come from Google Fonts, the only thing loaded from outside the file: **Schibsted Grotesk** for text, **JetBrains Mono** for code and IDs. Everything else is inlined.

Don't use Mermaid or ELK for diagrams; draw SVG by hand. Don't load libraries from a CDN.

## The layout

```
web/
  index.html            the shell: fonts, <div id="root">, /src/fabric/main.tsx
  vite.config.ts        single-file build into ../site
  package.json          scripts: dev, build, typecheck, check
  tsconfig.json         strict, bundler resolution, jsx react-jsx
  src/
    fabric/             the bar that switches apps (main.tsx, Fabric.tsx, apps.tsx, fabric.css)
    kit/                what every app shares (below)
    <app>/              one folder per app: App.tsx, its views, <app>.css
  scripts/              Node checks on the data, run with node --experimental-strip-types
site/index.html         the built page; commit it with its source; never edit it by hand
data/                   YAML the pages read at build time (optional)
tools/smoke_test.py     loads every view headlessly
docs/                   style guide, decisions, open questions, handoff
CLAUDE.md               what's in the repo, the working rules, about the owner
.github/workflows/checks.yml
```

`npm run check` runs `tsc --noEmit` and then `vite build`. Run it after every change.

## The build: `web/vite.config.ts`

```ts
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { parse } from 'yaml';

/** Imports a .yaml file as plain data at build time: pages read data, never hand-copied lists. */
const yaml: Plugin = {
  name: 'yaml',
  transform(source, id) {
    if (!id.endsWith('.yaml')) return null;
    return { code: 'export default ' + JSON.stringify(parse(source)) + ';', map: null };
  },
};

export default defineConfig({
  plugins: [react(), viteSingleFile(), yaml],
  server: { fs: { allow: ['..'] } },
  build: { outDir: '../site', emptyOutDir: false },
});
```

Add a `src/yaml.d.ts` that declares `*.yaml` modules. If the page ever needs binary, such as WebAssembly, add a small `?base64` loader plugin that inlines the file as a base64 string, so it still ships in the one file.

## The kit: `web/src/kit/`

Build these first; every app uses them.

**`tokens.css`: colour as meaning.** Every colour is a token, with a light and a dark value, and nothing outside the tokens is hard-coded. Define the light values on `:root`, the dark ones under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and the dark ones again under `:root[data-theme="dark"]`. Use neutral tokens (`--paper`, `--raised`, `--ink`, `--muted`, `--line`, `--faint`, code panel colours, `--bad`), plus one token per concept the explainer has. Each colour means one thing everywhere, and the style guide's table says what.

**`reset.css`, `page.css`:** type scale, `.wrap`, `.vbtn` buttons, `.legend`, `.code` panels with Prism token colours, `.xwrap { overflow-x: auto }` for anything wide.

**`route.ts`: hash routes.** Routes use only letters, digits and hyphens, so a shared link opens any view.

```ts
export type AppId = '' | 'second' | 'third';        // '' is the first app, whose views have bare names
export const appOf = (hash: string): AppId => ...;  // which app a hash belongs to
export const viewOf = (app: AppId, hash: string): string | null => ...;
export const hashFor = (app: AppId, view: string) =>
  '#' + (!app ? view : view && view !== 'map' ? app + '-' + view : app);
export function useHash(app: AppId): string { ... }  // the app's view, kept current; holds still while another app shows
```

**`motion.ts`: one way to animate.**

```ts
export const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export function tr(t: Transition = {}): Transition { return reduce ? { ...t, duration: 0, delay: 0 } : t; }
/** Motion props for an element that sits in `from` and plays `to` once `on` is true. Use keyframes in `to`. */
export function play(on: boolean, from: Variant | false, to: Variant, t?: Transition) {
  return { variants: { from: from || {}, to }, initial: from === false ? (false as const) : 'from', animate: on ? 'to' : 'from', transition: tr(t) };
}
```

**`useTimeline.ts`:** `useTimeline(delays)` returns step 0, 1, 2, … as each delay passes (the last step at once under reduced motion). `useReplay()` returns `[key, replay]`; remounting the animated part with a new key replays it.

**`ReplayButton.tsx`:** every animated view has one.

**`prism.ts`, `prism-manual.ts`, `CodeBlock.tsx`:** set `globalThis.Prism = { manual: true }` in a file imported before `prismjs`, so Prism never highlights the page on its own. Import only the languages you use. Add custom grammars with `Prism.languages.extend` and `insertBefore` rather than new libraries. `CodeBlock` renders a dark panel from `highlight(code, lang)`, on a `motion.pre` so it can animate.

**`svg.ts`, `css.ts`:** `rounded(points, r)` draws an SVG path through points with rounded corners, for hand-drawn connector lines; `vars({ '--c': 'var(--accent)' })` sets CSS custom properties from React without type errors.

## The fabric: one page, several apps

- `apps.tsx` lists the apps: id, label, start route, tab colour, whether it's wide, its CSS, and its element. **Import each app's CSS with `?inline`**, never as a side effect, and join it with the kit's CSS.
- `Fabric.tsx` keeps one `<style>` element and swaps its text to the showing app's CSS, so styles never leak between apps.
- It listens to `hashchange` before any app does, works out the app with `appOf`, and re-renders with `flushSync`, so the new app shows its routed view on the first frame.
- An app mounts the first time it shows and stays mounted, `hidden`, after that, so it keeps its place. Each tab returns to where the reader last was in that app.
- `main.tsx` renders inside `flushSync`, so the first paint already shows the routed view.

## Page conventions

- **One view at a time**, switched by hash. Each app has a start view (a map, an index), then its views. Longer topics split into sub-pages with underlined tabs, Previous and Next buttons, and arrow keys.
- **A view's animation runs when it's shown**, or when it scrolls into view with Motion's `inView`, and always has a replay button.
- **Respect reduced motion** through `tr()`.
- **No horizontal page scroll on a 390 px phone.** Wide SVGs and tables sit inside `.xwrap`.
- **Pages read their data from its source** (YAML in `data/`), never from a hand-copied list.
- **Label invented numbers, IDs and names as illustrative**, on the page.

## Motion gotchas

- Don't set `style.opacity` directly and then animate to a single target: Motion caches the value and the animation does nothing. Animate with keyframe arrays, `{ opacity: [0, 1] }`, or use `play()`.
- Convert an `HTMLCollection` with `Array.from` before passing it to `animate`.
- Prefer `play()` with variants to calling `animate()` on elements.

## Other gotchas

- Don't put two files whose names differ only in case side by side, such as `story.ts` and `Story.tsx`. On a case-insensitive disk (macOS, Windows), an extensionless import can resolve to the wrong one.
- Node scripts in `web/scripts/` import TypeScript with the `.ts` extension (`allowImportingTsExtensions`), since `node --experimental-strip-types` won't guess it.
- The built `site/index.html` is committed, and CI fails when it differs from a fresh build.

## The smoke test: `tools/smoke_test.py`

Playwright, Chromium, one page load per pass:

- **Three passes:** desktop 1280×900 light, desktop dark, and a 390×844 phone.
- **It discovers the views** rather than listing them: each app's start view exposes its views, for example as `[data-view]` links or `.view` sections.
- **It visits every route,** waits for the animation, and fails on any JavaScript error (ignore Google Fonts' network noise), any view wider than the viewport, and any view that shows the wrong app.
- **It saves a screenshot of every view** to `screenshots/<app>/`, with the dark ones in `dark/`. Look at them after each change. `screenshots/` is git-ignored.

## CI: `.github/workflows/checks.yml`

On every push, Ubuntu with Python 3.11 and Node 22:

1. `pip install -r tools/requirements.txt`, then `python -m playwright install --with-deps chromium`, then `npm ci --prefix web`.
2. Run `npm run check --prefix web`.
3. Run `git diff --exit-code -- site/`, failing with "site/ is out of date" if the build changed it.
4. Run `python tools/smoke_test.py`.
5. Add the Node data checks from `web/scripts/` as the project grows.

## The docs

- **`CLAUDE.md`:** what's in the repo, file by file; the working rules (run `npm run check`, then the smoke test, and commit the rebuilt site with its source); a short "about the owner"; and `@docs/style-guide.md` and `@docs/decisions.md` under "Always follow".
- **`docs/style-guide.md`:** the visual rules above, the colour table, the route scheme, the Motion gotchas, and the writing rules.
- **`docs/decisions.md`:** numbered, settled decisions, newest at the bottom of each section.
- **`docs/open-questions.md`:** what's pending, and the next steps.
- **`docs/handoff.md`:** the story so far, for the next session.

Writing on the page and in the docs: short, plain sentences, one idea each, sentence case. Visuals before long text.

## Publishing (optional)

The built `site/index.html` can be published as a claude.ai artifact from Claude Code: copy it to a scratch folder and publish it. Publishing the same file again keeps the same link. A runtime capability, such as a shared store or Claude on the viewer's account, makes the published page organization-internal; add one only when a feature needs it.

## First milestone

1. Scaffold `web/` with the stack, the Vite config, `tsconfig.json`, the kit and the fabric.
2. Build two apps from **The project** above. Each gets a start view and two views. One view has an animated, hand-drawn SVG diagram with a replay button; another has a `CodeBlock` and a small YAML-driven list.
3. Add the smoke test, the CI workflow, `CLAUDE.md` and the four docs.
4. **Done when:** `npm run check` passes, the smoke test passes in all three passes with no sideways scroll, the screenshots look right in both themes, and CI is green.
