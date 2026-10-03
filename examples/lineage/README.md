# Made-up repositories for the lineage deep scan

Everything here is invented, shaped like a transaction research screen's stack: a React screen, a Java and Spring backend, a GraphQL data API whose resolvers hold the SQL, and Snowflake. The deep scan (decision 26) reads them and writes the illustrative mapping set the studio shows, `ontology/mappings/transaction-research.sssom.tsv`, with its earlier versions in `history/`.

```
repos/                            the three repositories as they are today (v3)
  transaction-research-ui/          the screen: TransactionLifecycle.tsx
  transaction-research-service/     the DTO, the MapStruct mapper, the service, the GraphQL query it sends
  transaction-data-api/             the GraphQL schema, and the resolver with its SQL
snowflake/PAYMENTS.columns.csv    an export of INFORMATION_SCHEMA.COLUMNS
earlier/v1/, earlier/v2/          the files that differed when the two earlier scans ran
changes/v4/                       a change still to come, for the test
scans/v1.json … v4.json           what Claude Code reported after reading each of them
decisions/after-v1.json, -v2      what people accepted in the studio between scans
sources.yaml                      what the deep scan reads
```

## The story the versions tell

| Scan | What changed in the code | What the scan does |
|---|---|---|
| v1 | The first scan | Claude maps every field; people accept most |
| v2 | A dispute section and refunds; the auth code dropped; the data API reads the name the cardholder sees | The merchant is built differently and gets a new meaning; people accept it |
| v3 | Partial captures added up; the settlement date falls back to the capture date; a hook added at the top of the screen | Both fields people had confirmed come back as re-checks; code that only moved keeps its decisions |
| v4 (test only) | The data API sends the device's own id; the screen shows the card's network | The device is re-mapped; the network is new |

## Try it

```sh
python tools/test_lineage_scan.py
```

It replays v1, v2 and v3 through `web/scripts/lineage-scan.ts`, with the decisions between them, and checks they match the committed files. Then it scans v4, and plants mistakes in what Claude Code reports for the scan to catch. On your own repositories, the `lineage-scan` skill (`.claude/skills/lineage-scan/SKILL.md`) walks Claude Code through the same steps.
