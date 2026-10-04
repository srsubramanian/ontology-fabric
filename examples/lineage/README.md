# Made-up repositories for the lineage deep scan

Everything here is invented, shaped like the owner's stack: a React application, a Java and Spring backend, a GraphQL data API whose resolvers hold the SQL, and Snowflake. Two screens are built on it, and the deep scan (decision 26) reads each and writes its illustrative mapping set: `ontology/mappings/transaction-research.sssom.tsv`, with its earlier versions in `history/`, and `ontology/mappings/dispute-workbench.sssom.tsv`. The studio gathers both under what each field means (`#studio-lineage`, "start from a meaning").

```
repos/                                     the three repositories as they are today
  transaction-research-ui/                   the screens: TransactionLifecycle.tsx, and disputes/DisputeWorkbench.tsx
  transaction-research-service/              DTOs, MapStruct mappers, services, the GraphQL queries they send
  transaction-data-api/                      the GraphQL schema (one file per type), and the resolvers with their SQL
snowflake/PAYMENTS.columns.csv             an export of INFORMATION_SCHEMA.COLUMNS
sources/<screen>.yaml                      what the deep scan reads for each screen
scans/<screen>/v1.json …                   what Claude Code reported after reading each version
decisions/<screen>/after-v1.json …         what people accepted in the studio between scans
earlier/v1/, earlier/v2/                   transaction research's files that differed when its two earlier scans ran
changes/v4/                                a change still to come to transaction research, for the test
```

## The screens

- **Transaction research** shows one transaction's whole life (CQ-03), in three scans.
- **Dispute workbench** shows one chargeback, in one scan (22 September). It shares meanings with transaction research, and that's the point: its "Settled on" reads only the settlement date, where transaction research falls back to the capture date; its "Merchant" is the merchant's legal name, where transaction research's is the name the cardholder sees; and it calls a dispute's reason "Reason", where transaction research says "Chargeback reason". Starting from a meaning shows each of these side by side, and starting from a column shows that four columns feed both screens.

## The story transaction research's versions tell

| Scan | What changed in the code | What the scan does |
|---|---|---|
| v1 | The first scan | Claude maps every field; people accept most |
| v2 | A dispute section and refunds; the auth code dropped; the data API reads the name the cardholder sees | The merchant is built differently and gets a new meaning; people accept it |
| v3 | Partial captures added up; the settlement date falls back to the capture date; a hook added at the top of the screen | Both fields people had confirmed come back as re-checks; code that only moved keeps its decisions |
| v4 (test only) | The data API sends the device's own id; the screen shows the card's network | The device is re-mapped; the network is new |

The dispute workbench's files are all new, so transaction research's scans read the same lines as before.

## Try it

```sh
python tools/test_lineage_scan.py
```

It replays each screen's scans through `web/scripts/lineage-scan.ts`, with the decisions between them, and checks they match the committed files. Then it scans transaction research's v4, and plants mistakes in what Claude Code reports for the scan to catch. On your own repositories, the `lineage-scan` skill (`.claude/skills/lineage-scan/SKILL.md`) walks Claude Code through the same steps.
