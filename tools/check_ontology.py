"""Check the draft ontology beyond what linkml-lint covers, and print its coverage.

- Every competency question walks relationships the schema really has.
- Every competency question's query passes the checks decision 13 applies to generated
  queries: labels and relationship types the ontology has, each relationship in its one
  direction, read-only, and a LIMIT. In SQL, each walked step is marked on its line.
- Every concrete class has the annotations the class explorer reads.
- The class explorer (web/src/explorer/model.ts) reads every class the way LinkML's
  SchemaView does: the same label chain and the same inherited slots. Needs Node 22.6
  or later and `npm install` in web/; skipped, with a note, without them.
- Coverage, the two numbers from decision 9: questions the schema answers,
  and classes mapped to a standard concept.

Usage:
    pip install -r tools/requirements-ontology.txt
    linkml-lint --config ontology/.linkmllint.yaml ontology/payments.yaml
    python tools/check_ontology.py
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys

import yaml
from linkml_runtime.utils.schemaview import SchemaView

ROOT = pathlib.Path(__file__).resolve().parent.parent
OWNERS = {"core", "authorization", "settlement", "disputes", "risk"}
LIVES_IN = {"graph", "warehouse", "search"}
STORES = {"neptune", "snowflake"}


def annotation(cls, key):
    a = cls.annotations.get(key) if cls.annotations else None
    return a.value if a is not None else None


NODE = re.compile(r"(?<![\w.])\((\w*)(?::(\w+))?\s*(?:\{[^}]*\})?\)")
REL = re.compile(r"(<)?-\[\w*:(\w+)\]-(>)?")
WRITES = re.compile(r"\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|CALL|LOAD\s+CSV|INSERT|UPDATE|DROP|ALTER|TRUNCATE|COPY|GRANT)\b", re.I)


def relationships(sv):
    """Every relationship the schema declares: type, the class it starts from, the class it points to."""
    out = []
    for name in sv.all_classes():
        for slot in sv.get_class(name).slots or []:
            rng = sv.get_slot(slot).range
            if rng in sv.all_classes():
                out.append((slot.upper(), name, rng))
    return out


def check_cypher(sv, rels, qid, query, problems):
    """Labels, types and directions against the schema; one pass per UNION part."""
    classes = sv.all_classes()
    types = {t for t, _, _ in rels}
    for part in re.split(r"^\s*UNION(?:\s+ALL)?\s*$", query, flags=re.M | re.I):
        if not re.search(r"\bLIMIT\s+\d+", part, re.I):
            problems.append(f"{qid}: every query part needs a LIMIT")
        labels = {}
        tokens = sorted([("node", m) for m in NODE.finditer(part)] + [("rel", m) for m in REL.finditer(part)],
                        key=lambda t: t[1].start())
        for kind, m in tokens:
            if kind == "node" and m.group(2):
                if m.group(2) not in classes:
                    problems.append(f"{qid}: no class {m.group(2)}")
                if m.group(1):
                    labels[m.group(1)] = m.group(2)
        def label(m):
            # An unknown class is already reported above; don't also judge its direction.
            found = m.group(2) or labels.get(m.group(1))
            return found if found in classes else None
        for a, b, c in zip(tokens, tokens[1:], tokens[2:]):
            if not (a[0] == "node" and b[0] == "rel" and c[0] == "node"):
                continue
            if a[1].end() != b[1].start() or b[1].end() != c[1].start():
                continue
            back, rtype, fwd = b[1].groups()
            if rtype not in types:
                problems.append(f"{qid}: no relationship {rtype}")
                continue
            if bool(back) == bool(fwd):
                problems.append(f"{qid}: give {rtype} its one direction")
                continue
            src, dst = (label(c[1]), label(a[1])) if back else (label(a[1]), label(c[1]))
            ok = any(t == rtype and (src is None or f in sv.class_ancestors(src))
                     and (dst is None or to in sv.class_ancestors(dst)) for t, f, to in rels)
            if not ok:
                problems.append(f"{qid}: ({src})-[:{rtype}]->({dst}) runs against the schema's direction or classes")


def check_queries(sv, questions, problems):
    rels = relationships(sv)
    for q in questions:
        query = q.get("query", "")
        if not query.strip():
            problems.append(f"{q['id']}: needs a query")
            continue
        if WRITES.search(query):
            problems.append(f"{q['id']}: queries must be read-only")
        if q.get("answered_in") == "neptune":
            check_cypher(sv, rels, q["id"], query, problems)
            for step in q["walks"]:
                if f"[:{step.partition('.')[2].upper()}]" not in query:
                    problems.append(f"{q['id']}: the query doesn't walk {step}")
        else:
            if not re.match(r"\s*(SELECT|WITH)\b", query, re.I):
                problems.append(f"{q['id']}: SQL must start with SELECT or WITH")
            if not re.search(r"\bLIMIT\s+\d+", query, re.I):
                problems.append(f"{q['id']}: SQL needs a LIMIT")
            for step in q["walks"]:
                if f"-- {step}" not in query:
                    problems.append(f"{q['id']}: mark the line that walks {step} with '-- {step}'")


def check_explorer(sv, classes, problems):
    """Compare the explorer's TypeScript reading of the schema with LinkML's SchemaView."""
    if not shutil.which("node") or not (ROOT / "web" / "node_modules" / "yaml").exists():
        print("explorer check skipped: needs Node 22.6 or later and `npm install` in web/")
        return
    run = subprocess.run(
        ["node", "--experimental-strip-types", "--no-warnings", str(ROOT / "web" / "scripts" / "dump-model.ts")],
        capture_output=True, text=True)
    if run.returncode:
        problems.append("explorer: " + (run.stderr.strip().splitlines() or ["dump-model.ts failed"])[-1])
        return
    explorer = json.loads(run.stdout)
    agree = 0
    for name in classes:
        linkml = {"chain": sv.class_ancestors(name),
                  "slots": sorted([s.name, s.range, bool(s.required), bool(s.multivalued)]
                                  for s in sv.class_induced_slots(name))}
        seen = explorer.get(name)
        if seen and seen["chain"] == linkml["chain"] and sorted(seen["slots"]) == linkml["slots"]:
            agree += 1
        else:
            problems.append(f"explorer: reads {name} differently from LinkML")
    print(f"class explorer reads classes the way LinkML does: {agree} of {len(classes)}")


def main():
    sv = SchemaView(str(ROOT / "ontology" / "payments.yaml"))
    classes = sv.all_classes()
    problems = []

    for name, cls in classes.items():
        for key, allowed in (("owner", OWNERS), ("lives_in", LIVES_IN)):
            if annotation(cls, key) not in allowed:
                problems.append(f"{name}: {key} must be one of {sorted(allowed)}")
        if not cls.abstract and not annotation(cls, "id_rule"):
            problems.append(f"{name}: concrete class needs an id_rule")

    questions = yaml.safe_load((ROOT / "ontology" / "competency-questions.yaml").read_text())["questions"]
    failing = set()
    for q in questions:
        before = len(problems)
        if q.get("answered_in") not in STORES:
            problems.append(f"{q['id']}: answered_in must be one of {sorted(STORES)}")
        for step in q["walks"]:
            cls_name, _, slot_name = step.partition(".")
            if cls_name not in classes:
                problems.append(f"{q['id']}: no class {cls_name}")
                continue
            slots = {s.name: s for s in sv.class_induced_slots(cls_name)}
            if slot_name not in slots:
                problems.append(f"{q['id']}: {cls_name} has no slot {slot_name}")
            elif slots[slot_name].range not in classes:
                problems.append(f"{q['id']}: {step} is an attribute, not a relationship")
        if len(problems) > before:
            failing.add(q["id"])

    check_explorer(sv, classes, problems)
    check_queries(sv, questions, problems)
    concrete = [c for c in classes.values() if not c.abstract]
    mapped = [c for c in concrete if c.close_mappings]
    print(f"{len(classes)} classes, {len(concrete)} concrete")
    print(f"competency questions the schema can walk: {len(questions) - len(failing)} of {len(questions)}")
    print(f"concrete classes mapped to a standard: {len(mapped)} of {len(concrete)}")
    for p in problems:
        print("  problem:", p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
