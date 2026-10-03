---
name: lineage-scan
description: Deep-scan a screen's code (a React screen, a Java and Spring backend, a GraphQL data API with SQL in its resolvers, and Snowflake's columns) and write the next version of its lineage mapping set in ontology/mappings/ (decision 26). Use when asked to scan, rescan or refresh a screen's lineage from its repositories, on a machine that has them cloned.
---

# Lineage deep scan

You read the code; `web/scripts/lineage-scan.ts` checks what you report against it and writes the next version of `ontology/mappings/<set>.sssom.tsv`, keeping the one before in `history/`. People's decisions carry forward while a field is built the same way. Try it first on the made-up repositories in `examples/lineage/` (see the end).

## Before you start

1. **This repository must be private.** The mapping set carries lines of code and column names. Ask the person to confirm it before you scan real code, and stop if it isn't.
2. **The sources file.** Copy `examples/lineage/sources.yaml` beside the clones and point it at them: the set's name, each repository's path (the branch to scan, pulled), the data API's GraphQL schema, and the Snowflake export.
3. **The Snowflake export.** Ask the person to run this and save it as CSV, then set `exported:` to the day:
   ```sql
   SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, COMMENT
     FROM <DATABASE>.INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA <> 'INFORMATION_SCHEMA'
    ORDER BY 1, 2, 3;
   ```
4. **Tools.** `npm ci --prefix web` and `pip install -r tools/requirements.txt` (sqlglot reads the SQL).

## Read the code

1. Read the current set and its history, if there is one. Reuse its ids, labels and notes for fields that haven't changed.
2. Start at the screen's component. Every value it shows is a field, with its label.
3. Follow each field back one layer at a time: the screen, the backend's DTO (its mapper and service), the data API's field (the GraphQL schema), the resolver's SQL, then Snowflake's columns.
4. For each hop, write down:
   - the **transform**: `pass`, `rename`, `format`, `convert`, `lookup`, `derive`, `aggregate`, `join` or `filter`;
   - a **note** in plain words, such as "Minor units divided by 100";
   - **where**: `path:line`, the path relative to that layer's repository;
   - the **code** on that line (part of the line is fine).
5. Say what each field and each Snowflake column means in the ontology (`ontology/payments.yaml`):
   - a slot as `Class.slot`, or `null` when nothing holds it;
   - a predicate: `skos:exactMatch` or `skos:closeMatch`, or `skos:relatedMatch` for a value derived on purpose, such as a status built from events (decision 7);
   - a confidence from 0 to 1, where under 0.9 waits for a person (decision 19);
   - a short comment where the meaning isn't obvious.

## The answer file

Write `scan.json` outside the repository. `examples/lineage/scans/v3.json` is a full example; a set's first scan also carries `metadata`, as in `scans/v1.json`.

```json
{
  "set": "transaction-research",
  "fields": [
    {
      "field": "ui:TransactionLifecycle.authorizedAt", "label": "Authorized",
      "hops": [
        { "to": "be:TransactionLifecycleDto.authTime", "label": "authTime", "transform": "format", "note": "UTC to the analyst's time zone",
          "at": "src/features/transaction-research/TransactionLifecycle.tsx:27", "code": "<Cell>{formatInZone(txn.authTime, user.timeZone)}</Cell>" },
        { "to": "api:Transaction.authorizedAt", "label": "authorizedAt", "transform": "rename", "note": "Renamed from authorizedAt",
          "at": "src/main/java/com/example/research/TransactionLifecycleMapper.java:11", "code": "@Mapping(target = \"authTime\", source = \"authorizedAt\")" },
        { "to": "sf:CORE.FCT_AUTHORIZATION.AUTH_TS", "label": "AUTH_TS", "transform": "pass", "note": "Passed through, in UTC",
          "at": "src/main/java/com/example/dataapi/TransactionResolver.java:17", "code": "a.AUTH_TS AS authorized_at" }
      ],
      "means": { "slot": "Authorization.authorized_at", "predicate": "skos:exactMatch", "confidence": 0.96 }
    }
  ],
  "columns": [
    { "column": "sf:CORE.FCT_AUTHORIZATION.AUTH_TS", "label": "AUTH_TS", "slot": "Authorization.authorized_at", "predicate": "skos:exactMatch", "confidence": 0.96 }
  ]
}
```

- **Ids:** `ui:<Component>.<field>`, `be:<DtoClass>.<field>`, `api:<Type>.<path>` (the schema's path from the root type, such as `Transaction.card.last4`), and `sf:<SCHEMA>.<TABLE>.<COLUMN>`.
- **Where a hop comes from:** the field itself, or the last hop that reached the layer before. Name `from` only when it's another one.
- **Give every field and column a meaning**, even unchanged ones. The tool keeps a person's decision wherever the field is built the same way, and uses yours only where it's new or changed.

## Check, then write

```sh
node --experimental-strip-types web/scripts/lineage-scan.ts scan --sources <sources.yaml> --answer <scan.json> --dry-run
```

- **FAIL** lines are hops that don't match the code: a line without that code, a column the SQL doesn't read, an id the schema or the export doesn't have, or a slot the ontology doesn't have. Fix your answer, not the check.
- **note** lines are sqlglot's reading of the SQL, such as a column feeding a value that no hop names. Look at each one.

Then run it without `--dry-run`, and:

1. `node --experimental-strip-types web/scripts/check-lineage.ts`.
2. `npm run check` in `web/`; the studio builds the set into the page.
3. Commit `ontology/mappings/` and `site/`, not the answer or sources files. Open a pull request whose description is the tool's summary: what changed since the last version, and what waits for a person in the studio.

## Decisions

People accept and reject mappings in the studio. Its pull request applies them with `lineage-scan.ts decide --set <set> --decisions <file>`, which skips a decision made on an older version. Run the same command when someone sends decisions by hand.

## Try it on the made-up repositories

`python tools/test_lineage_scan.py` replays the illustrative history. It scans `examples/lineage/` as it stood at v1, applies people's decisions, then does the same for v2 and v3, and checks the files match `ontology/mappings/`. It then scans a v4 change and plants mistakes for the tool to catch. To practise the whole flow, scan `examples/lineage/sources.yaml` yourself with `--mappings` pointing at a scratch folder.
