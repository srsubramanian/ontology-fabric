# Ontology Fabric

Ontology Fabric is the working name for a payments knowledge layer: an ontology-governed graph (Amazon Neptune, openCypher), search (Amazon OpenSearch), warehouse data (Snowflake) and agents (Claude on Amazon Bedrock, reached through MCP). So far this is a learning and design project built from public information. The next phase is a working prototype.

## What's in this repo

- `site/platform.html`: the platform overview. A map of the whole system plus seven chapters, each split into sub-pages. One self-contained HTML file.
- `site/retrieval.html`: the retrieval walkthrough, in 11 stages, covering Neptune, Snowflake and OpenSearch. Also self-contained.
- `docs/`: decisions, style guide, 2026 research notes, open questions, and how the project got here.
- `tools/smoke_test.py`: loads every view of both pages headlessly, fails on JavaScript errors and saves screenshots.

## Working rules

- After changing a page, run `python tools/smoke_test.py` and look at the screenshots it names.
- Pages stay self-contained. Inline CSS and JS, libraries only from `cdn.jsdelivr.net` at pinned versions, fonts from Google Fonts.
- `site/platform.html` is about 360 KB. Make targeted edits and don't rewrite it wholesale.
- Check current facts before stating them. Standards, AWS services, the MCP spec and card network rules change often. Record sources in `docs/research-2026-09.md`.
- Label invented numbers, IDs and names as illustrative on the page.

## About the owner

Subra leads 13 application development teams in a regulated fintech. He has deep payments knowledge (authorization lifecycle, Visa and Mastercard, chargebacks, routing) and works with AWS, LangGraph and Python. He learns visually, so prefer diagrams and animation over long text, and keep written explanations short.

## Always follow

@docs/style-guide.md
@docs/decisions.md

## Read when relevant

- `docs/research-2026-09.md`: what changed in 2026, with sources.
- `docs/open-questions.md`: pending decisions and the next steps.
- `docs/handoff.md`: the story so far, and where each idea lives in the pages.
