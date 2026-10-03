"""Column lineage for the SQL in a data API's resolvers, with sqlglot, so the deep scan can check what Claude Code
found (decision 26). web/scripts/lineage-scan.ts runs it: it reads JSON on stdin, a list of statements, and writes
JSON: for each statement, the Snowflake columns each output column is built from, and every column it reads.

    echo '[{"sql": "SELECT a.AUTH_TS AS authorized_at FROM CORE.FCT_AUTHORIZATION a"}]' | python tools/lineage_sql.py
    [{"outputs": {"AUTHORIZED_AT": ["CORE.FCT_AUTHORIZATION.AUTH_TS"]}, "referenced": ["CORE.FCT_AUTHORIZATION.AUTH_TS"]}]

Bind parameters (:authId) are read as literals. Names come back upper case, as Snowflake folds them.
"""
import json
import re
import sys

import sqlglot
from sqlglot import exp
from sqlglot.lineage import lineage

DIALECT = "snowflake"


def table_name(t: exp.Table) -> str:
    return ".".join(p for p in (t.db, t.name) if p).upper()


def analyse(sql: str) -> dict:
    sql = re.sub(r":[A-Za-z_]\w*", "'?'", sql)
    tree = sqlglot.parse_one(sql, dialect=DIALECT)
    tables = {(t.alias_or_name or t.name).upper(): table_name(t) for t in tree.find_all(exp.Table)}
    referenced = set()
    for c in tree.find_all(exp.Column):
        if c.table and c.table.upper() in tables:
            referenced.add(f"{tables[c.table.upper()]}.{c.name.upper()}")
    outputs = {}
    for name in tree.named_selects:
        cols = set()
        for node in lineage(name, sql, dialect=DIALECT).walk():
            if node.downstream or not isinstance(node.source, exp.Table):
                continue
            cols.add(f"{table_name(node.source)}.{node.name.split('.')[-1].upper()}")
        outputs[name.upper()] = sorted(cols)
    return {"outputs": outputs, "referenced": sorted(referenced)}


def main() -> None:
    out = []
    for s in json.load(sys.stdin):
        try:
            out.append(analyse(s["sql"]))
        except Exception as e:  # a statement sqlglot can't read is reported, not fatal: the scan says so
            out.append({"error": f"{type(e).__name__}: {e}"})
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
