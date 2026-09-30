# Ontology Fabric

Ontology Fabric is the working name for a payments knowledge layer: an ontology-governed graph (Amazon Neptune, openCypher), search (Amazon OpenSearch), warehouse data (Snowflake) and agents (Claude on Amazon Bedrock, reached through MCP). So far this is a learning and design project built from public information. The next phase is a working prototype.

## What's in this repo

- `site/platform.html`: the platform overview. A map of the whole system plus seven chapters, each split into sub-pages. One self-contained HTML file.
- `site/retrieval.html`: the retrieval walkthrough, in 11 stages, covering Neptune, Snowflake and OpenSearch. Also self-contained, but built from `web/`: don't edit it by hand.
- `site/ontology.html`: the class explorer. It reads the ontology from `ontology/` at build time. Built from `web/`: don't edit it by hand.
- `web/`: the React source for the built pages (retrieval and the class explorer). `web/src/kit/` holds what pages share: colour tokens, page styles, Motion helpers, Prism grammars and the code block.
- `ontology/`: an illustrative draft of the ontology in LinkML (`payments.yaml`) and the competency questions it must answer. It writes down what the pages already show; the real core replaces it in prototype step 1.
- `docs/`: decisions, style guide, 2026 research notes, open questions, and how the project got here.
- `tools/smoke_test.py`: loads every view of every page headlessly, fails on JavaScript errors and saves screenshots.
- `tools/check_ontology.py`: checks that every competency question walks real relationships and every class has the annotations the explorer reads, and prints the two coverage numbers.

## Working rules

- After changing a page, run `python tools/smoke_test.py` and look at the screenshots it names. For a page in `web/`, run `npm run check` in `web/` first: it typechecks and rebuilds the page into `site/`. Commit the rebuilt file with its source.
- Each page is one self-contained HTML file, with fonts from Google Fonts. Pages in `web/` inline everything at build time, from npm packages pinned to exact versions. `site/platform.html` is still hand-written, with inline CSS and JS and libraries from `cdn.jsdelivr.net` at pinned versions, until it's ported.
- `site/platform.html` is about 360 KB. Make targeted edits and don't rewrite it wholesale.
- After changing `ontology/`, run `linkml-lint --config ontology/.linkmllint.yaml ontology/payments.yaml` and `python tools/check_ontology.py`, then rebuild the pages. Add a class's position to `web/src/explorer/layout.ts`, or the explorer fails to load.
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
