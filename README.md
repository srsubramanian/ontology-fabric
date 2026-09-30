# Ontology Fabric

Learning pages and design decisions for Ontology Fabric, a payments knowledge layer: an ontology-governed graph (Neptune), search (OpenSearch), warehouse data (Snowflake) and agents (Claude through MCP).

## Look at the pages

Open these in a browser. You need to be online for the fonts, and for the platform page's libraries, which load from a CDN.

- `site/platform.html`: the platform map and seven chapters
- `site/retrieval.html`: how a question becomes an answer, across all three stores
- `site/ontology.html`: the class explorer, read from the draft ontology in `ontology/`

## Change a React page

`site/retrieval.html` and `site/ontology.html` are built from `web/`, so edit the source there (you need Node 20.19 or later):

```bash
cd web
npm install
npm run dev      # live preview at http://localhost:5173/retrieval.html or /ontology.html
npm run check    # typecheck, then rebuild both pages into site/
```

Commit the rebuilt pages together with their source.

## Check the ontology after a change

```bash
pip install -r tools/requirements-ontology.txt
linkml-lint --config ontology/.linkmllint.yaml ontology/payments.yaml
python tools/check_ontology.py
```

The check fails if a competency question walks a relationship the schema doesn't have. Rebuild the pages afterwards, so the class explorer shows the change.

## Check the pages after a change

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r tools/requirements.txt
python -m playwright install chromium
python tools/smoke_test.py
```

The test visits every view, fails on JavaScript errors or sideways scrolling on a phone, and saves screenshots to `screenshots/`.

## Where things are written down

- `CLAUDE.md`: what Claude Code reads at the start of every session
- `docs/decisions.md`: settled decisions
- `docs/style-guide.md`: how the pages look and are built
- `docs/research-2026-09.md`: what changed in 2026, with sources
- `docs/open-questions.md`: what's undecided, and the next steps
- `docs/handoff.md`: the story so far
