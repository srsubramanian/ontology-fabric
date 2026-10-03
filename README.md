# Ontology Fabric

A learning page and design decisions for Ontology Fabric, a payments knowledge layer: an ontology-governed graph (Neptune), search (OpenSearch), warehouse data (Snowflake) and agents (Claude through MCP).

## Look at the page

Open `site/index.html` in a browser. You need to be online for the fonts; everything else is inside the file. A bar at the top switches between its four apps:

- Overview (`#map`): the platform map and seven chapters
- Retrieval (`#retrieval`): how a question becomes an answer, across all three stores
- Explorer (`#explorer`): the class explorer, read from the draft ontology in `ontology/`
- Studio (`#studio`): build the ontology on its class map. Ask a question in your own words and Claude proposes the design on the map, as ghosts you accept or reject one by one; or add and drag classes, drag from one to another to relate them, and edit fields in the side panel. The checks and coverage update on every change. Read it as plain sentences in the story lens, or as classes and fields in the model lens, and see who else is building with you. Prove any question with sample data: its query runs on a made-up world in the page, and Claude plants a test case with the rows to expect. Set how much Claude does, from tutor to autopilot; the studio remembers what the team decided and why. New to ontologies? Worked examples walk you through answering one open question at a time, in payments words. On the published page the team shares one working draft live, and one click opens a pull request. A local copy builds and checks, keeping the draft in the browser.

## Change the page

The page is built from `web/`, so edit the source there (you need Node 22.12 or later):

```bash
cd web
npm install
npm run dev      # live preview at http://localhost:5173/
npm run check    # typecheck, then rebuild the page into site/
```

Commit the rebuilt page together with its source.

## Check the ontology after a change

You need Python 3.11, as CI uses, and Node with `npm install` in `web/` for the explorer and class map checks.

```bash
pip install -r tools/requirements-ontology.txt
linkml-lint --config ontology/.linkmllint.yaml ontology/payments.yaml
python tools/check_ontology.py
python tools/generate.py
```

The check fails if:
- a competency question walks a relationship the schema doesn't have, or neither walks one nor names its gap;
- a query breaks decision 13's rules (unknown labels, a relationship against its direction, a write, no LIMIT), or a SQL query marks a step on a line that doesn't join its classes;
- a concrete class neither maps to a standard nor says why none fits, or a mapping uses an undeclared prefix;
- the class explorer reads a class differently from LinkML;
- the class map leaves a class unplaced or a relationship unrouted, draws a line through a box or across another line, or puts a label on a box.

A question whose query fails counts as unanswered, so the coverage numbers drop with it. The same checks run in TypeScript (`web/src/explorer/check.ts`), so drafts can be checked in the browser. When you change either checker, change both and run `python tools/test_checks.py`: it plants each kind of mistake in a copy of the ontology, checks the checker names it, and fails if the two checkers disagree.

The generator rewrites `generated/`: OWL, SHACL, the extraction JSON Schema, Pydantic models, Neptune load headers and OpenSearch index mappings. Commit it with the change; CI runs `python tools/generate.py --check` and fails when it's stale. Rebuild the page afterwards, so the class explorer shows the change.

## Check the page after a change

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r tools/requirements.txt
python -m playwright install chromium
python tools/smoke_test.py
python tools/test_studio.py
```

The test loads every view of every app three times: on a desktop in light and in dark, and on a 390 px phone. Each time it visits all three apps in one page load, so switching between them is tested too. It fails on JavaScript errors, on any view that scrolls sideways or on a view that shows the wrong app, and saves screenshots of every view to `screenshots/<app>/`, with the dark ones in `dark/`.

## Where things are written down

- `CLAUDE.md`: what Claude Code reads at the start of every session
- `docs/decisions.md`: settled decisions
- `docs/style-guide.md`: how the page looks and is built
- `docs/research-2026-09.md`: what changed in 2026, with sources
- `docs/open-questions.md`: what's undecided, and the next steps
- `docs/handoff.md`: the story so far
