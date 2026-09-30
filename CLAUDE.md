# Ontology Fabric

Ontology Fabric is the working name for a payments knowledge layer: an ontology-governed graph (Amazon Neptune, openCypher), search (Amazon OpenSearch), warehouse data (Snowflake) and agents (Claude on Amazon Bedrock, reached through MCP). So far this is a learning and design project built from public information. The next phase is a working prototype.

## What's in this repo

- `site/index.html`: the page. One self-contained file, built from `web/`: don't edit it by hand. A bar at the top switches between its three apps:
  - The platform overview (`#map`): a map of the whole system plus seven chapters, each split into sub-pages. Chapter 1 reads the ontology's coverage numbers, module owners and the Chargeback class from `ontology/` at build time.
  - The retrieval walkthrough (`#retrieval`), in 11 stages, covering Neptune, Snowflake and OpenSearch.
  - The class explorer (`#explorer`), with a question tracer. It reads the ontology from `ontology/` at build time.
- `web/`: the source for the page. `web/src/fabric/` holds the bar and switches between the apps. Each app has its own folder:
  - `web/src/platform/`: the overview, with its shell (the map, section nav, reading path with each chapter's check, and router) in `shell/`, its seven chapters in `ch1/` to `ch7/`, and what they share in `shared/`.
  - `web/src/retrieval/` and `web/src/explorer/`.
  - `web/src/kit/` holds what the apps share: colour tokens, page styles, routes, Motion helpers, Prism grammars and the code block.
- `ontology/`: an illustrative draft of the ontology in LinkML (`payments.yaml`) and the competency questions it must answer. It writes down what the pages already show; the real core replaces it in prototype step 1.
- `docs/`: decisions, style guide, 2026 research notes, open questions, and how the project got here.
- `tools/smoke_test.py`: loads every view of every app headlessly, fails on JavaScript errors and saves screenshots.
- `tools/check_ontology.py`: checks that every competency question walks real relationships and has a query that passes decision 13's checks, that every class has the annotations the explorer reads, and that the explorer reads each class the way LinkML does. It prints the two coverage numbers.

## Working rules

- After changing the page, run `npm run check` in `web/`: it typechecks and rebuilds the page into `site/`. Then run `python tools/smoke_test.py` and look at the screenshots it names. Commit the rebuilt file with its source.
- The page is one self-contained HTML file, with fonts from Google Fonts. It builds from `web/` and inlines everything at build time, from npm packages pinned to exact versions.
- Each app's stylesheet is in the page only while that app shows, so styles never leak between apps. Import an app's CSS in `web/src/fabric/apps.tsx` with `?inline`, never as a side effect from a component.
- The overview's stylesheet (`web/src/platform/platform.css`) is still the original, and every view depends on it. Make targeted edits there; don't rewrite it wholesale.
- After changing `ontology/`, run `linkml-lint --config ontology/.linkmllint.yaml ontology/payments.yaml` and `python tools/check_ontology.py`, then rebuild the page. Add a class's position to `web/src/explorer/layout.ts`, or the explorer fails to load.
- Check current facts before stating them. Standards, AWS services, the MCP spec and card network rules change often. Record sources in `docs/research-2026-09.md`.
- Label invented numbers, IDs and names as illustrative on the page.

## About the owner

An engineering manager with a deep payments background. Prefers visual explanations: diagrams and animation over long text, and short written explanations.

## Always follow

@docs/style-guide.md
@docs/decisions.md

## Read when relevant

- `docs/research-2026-09.md`: what changed in 2026, with sources.
- `docs/open-questions.md`: pending decisions and the next steps.
- `docs/handoff.md`: the story so far, and where each idea lives in the pages.
