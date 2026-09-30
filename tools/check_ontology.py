"""Check the draft ontology beyond what linkml-lint covers, and print its coverage.

- Every competency question walks relationships the schema really has.
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
