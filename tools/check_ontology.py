"""Check the draft ontology beyond what linkml-lint covers, and print its coverage.

- Every competency question walks relationships the schema really has, or says what the
  schema lacks (gap). A gap question has no walks or query, and counts as unanswered.
- Every competency question's query passes the checks decision 13 applies to generated
  queries: labels and relationship types the ontology has, each relationship in its one
  direction, read-only, and a LIMIT. In SQL, each walked step is marked on the line that
  walks it: a line naming one of the step's classes. A question whose query fails counts as
  unanswered.
- Every concrete class has the annotations the class explorer reads.
- Every concrete class maps to a standard concept, or says why none fits (no_standard).
  Every mapping, on a class, slot, enum or enum value, uses a declared standard prefix,
  and the schema records the FIBO and OMG Commons releases the mappings were checked
  against (decision 9).
- The class explorer (web/src/explorer/model.ts) reads every class the way LinkML's
  SchemaView does: the same label chain and the same inherited slots. Needs Node 22.6
  or later and `npm install` in web/; skipped, with a note, without them.
- The class map's layout (web/src/explorer/layout.ts) places every class, and draws every
  relationship without passing through a box or crossing another line
  (web/scripts/check-layout.ts). Same requirements as the explorer check.
- Each question has a unique ID and a domain owned by a team.
- Coverage, the two numbers from decision 9: questions the schema answers, by domain,
  and classes mapped to a standard concept, by standard. Only a mapping whose prefix is
  declared and belongs to a standard counts.

web/src/explorer/check.ts runs the same checks in TypeScript, with the same messages, for
drafts in the browser. Change both together: tools/test_checks.py fails when they disagree.

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
DOMAINS = OWNERS - {"core"}
LIVES_IN = {"graph", "warehouse", "search"}
STORES = {"neptune", "snowflake"}
# The standards the ontology aligns with, by the start of their prefix, and the
# schema annotation that pins the release checked against (None: pinned in the name).
STANDARDS = {"fibo-": ("FIBO", "fibo_release"), "cmns-": ("OMG Commons", "commons_release"),
             "iso20022": ("ISO 20022", None)}


def standard(curie):
    prefix = curie.partition(":")[0]
    return next((name for start, (name, _) in STANDARDS.items() if prefix.startswith(start)), None)


def annotation(cls, key):
    a = cls.annotations.get(key) if cls.annotations else None
    return a.value if a is not None else None


NODE = re.compile(r"(?<![\w.])\((\w*)(?::(\w+))?\s*(?:\{[^}]*\})?\)")
REL = re.compile(r"(<)?-\[\w*:(\w+)\]-(>)?")
WRITES = re.compile(r"\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|CALL|LOAD\s+CSV|INSERT|UPDATE|DROP|ALTER|TRUNCATE|COPY|GRANT)\b", re.I)


def open_classes(sv):
    """Classes that stand for any class (class_uri linkml:Any): never nodes, and never checked as classes."""
    return {n for n, c in sv.all_classes().items() if c.class_uri == "linkml:Any"}


def relationships(sv):
    """Every relationship the schema declares: type, the class it starts from, the class it points to."""
    out = []
    for name in sv.all_classes():
        for slot in sv.get_class(name).slots or []:
            rng = sv.get_slot(slot).range
            if rng in sv.all_classes():
                out.append((slot.upper(), name, rng))
    return out


def snake(name):
    """A class name as warehouse tables and columns spell it: BinRange -> bin_range."""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def node_error(stderr):
    """The line of a Node failure that says what went wrong, rather than its last line (the Node version)."""
    lines = [l.strip() for l in stderr.splitlines() if l.strip()]
    found = next((l for l in lines if re.match(r"^\w*(Error|Exception)\b.*:", l)), None)
    return found or next((l for l in lines if not l.startswith("Node.js v")), "failed with no message")


def check_cypher(sv, rels, qid, query, problems):
    """Labels, types and directions against the schema; one pass per UNION part."""
    classes = sv.all_classes()
    anything = open_classes(sv)
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
                     and (dst is None or to in anything or to in sv.class_ancestors(dst)) for t, f, to in rels)
            if not ok:
                allowed = " or ".join(f"from {f} to {to}" for t, f, to in rels if t == rtype)
                problems.append(f"{qid}: ({src})-[:{rtype}]->({dst}) runs against the schema's direction or classes;"
                                f" {rtype} runs {allowed}")


def step_names(sv, step):
    """The table and column names a SQL line that walks a step mentions: the step's classes, snake-cased,
    with the source's parents (where the slot is declared) and the target's subclasses."""
    cls_name, _, slot_name = step.partition(".")
    if cls_name not in sv.all_classes() or slot_name not in sv.all_slots():
        return set()
    target = sv.induced_slot(slot_name, cls_name).range
    names = set(sv.class_ancestors(cls_name))
    if target in sv.all_classes():
        names |= set(sv.class_descendants(target))
    return {snake(n) for n in names}


def check_queries(sv, questions, problems, failing):
    """Each question's query; a question whose query fails joins `failing`, so it counts as unanswered."""
    rels = relationships(sv)
    for q in questions:
        if q.get("gap"):
            continue
        before = len(problems)
        check_query(sv, rels, q, problems)
        if len(problems) > before:
            failing.add(q["id"])


def check_query(sv, rels, q, problems):
    """One question's query: decision 13's checks, and each walked step on its line."""
    query = q.get("query", "")
    if not query.strip():
        problems.append(f"{q['id']}: needs a query")
        return
    if WRITES.search(query):
        problems.append(f"{q['id']}: queries must be read-only")
    if q.get("answered_in") == "neptune":
        check_cypher(sv, rels, q["id"], query, problems)
        for step in q.get("walks") or []:
            # [:TYPE] or [r:TYPE], the way the explorer's tracer finds the line.
            if not re.search(rf"\[\w*:{step.partition('.')[2].upper()}\]", query):
                problems.append(f"{q['id']}: the query doesn't walk {step}")
    else:
        if not re.match(r"\s*(SELECT|WITH)\b", query, re.I):
            problems.append(f"{q['id']}: SQL must start with SELECT or WITH")
        if not re.search(r"\bLIMIT\s+\d+", query, re.I):
            problems.append(f"{q['id']}: SQL needs a LIMIT")
        for step in q.get("walks") or []:
            marked = [line.split("--")[0].lower() for line in query.splitlines() if f"-- {step}" in line]
            if not marked:
                problems.append(f"{q['id']}: mark the line that walks {step} with '-- {step}'")
            elif not any(name in code for code in marked for name in step_names(sv, step)):
                problems.append(f"{q['id']}: the line marked '-- {step}' names none of its classes;"
                                f" mark the line that joins them")


def check_explorer(sv, classes, problems):
    """Compare the explorer's TypeScript reading of the schema with LinkML's SchemaView."""
    if not shutil.which("node") or not (ROOT / "web" / "node_modules" / "yaml").exists():
        print("explorer check skipped: needs Node 22.6 or later and `npm install` in web/")
        return
    run = subprocess.run(
        ["node", "--experimental-strip-types", "--no-warnings", str(ROOT / "web" / "scripts" / "dump-model.ts")],
        capture_output=True, text=True)
    if run.returncode:
        problems.append("explorer: can't read the schema: " + node_error(run.stderr))
    else:
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

    # The class map's layout: every class placed, no line through a box, no two lines crossing.
    run = subprocess.run(
        ["node", "--experimental-strip-types", "--no-warnings", str(ROOT / "web" / "scripts" / "check-layout.ts")],
        capture_output=True, text=True)
    if run.returncode and not run.stdout.strip():
        problems.append("class map: can't check the layout: " + node_error(run.stderr))
        return
    lines = run.stdout.strip().splitlines()
    if run.returncode:
        problems.extend("class map: " + line for line in lines[:-1])
    print(lines[-1])


def main():
    sv = SchemaView(str(ROOT / "ontology" / "payments.yaml"))
    anything = open_classes(sv)
    classes = {n: c for n, c in sv.all_classes().items() if n not in anything}
    problems = []

    for name, cls in classes.items():
        for key, allowed in (("owner", OWNERS), ("lives_in", LIVES_IN)):
            if annotation(cls, key) not in allowed:
                problems.append(f"{name}: {key} must be one of {sorted(allowed)}")
        if annotation(cls, "graph_load") not in (None, "never"):
            problems.append(f"{name}: graph_load can only be never")
        if annotation(cls, "graph_load") and annotation(cls, "lives_in") != "warehouse":
            problems.append(f"{name}: only a warehouse class can never load into Neptune")
        if not cls.abstract and not annotation(cls, "id_rule"):
            problems.append(f"{name}: concrete class needs an id_rule")
        if not cls.abstract and not cls.close_mappings and not annotation(cls, "no_standard"):
            problems.append(f"{name}: map it to a standard, or say why none fits in no_standard")
        if cls.close_mappings and annotation(cls, "no_standard"):
            problems.append(f"{name}: has close_mappings, so drop no_standard")

    schema = sv.schema
    pins = {k: v.value for k, v in (schema.annotations or {}).items()}
    values = {f"{e}.{v}": pv for e, enum in sv.all_enums().items() for v, pv in (enum.permissible_values or {}).items()}
    for kind, elements in (("class", sv.all_classes()), ("slot", sv.all_slots()), ("enum", sv.all_enums()),
                           ("value", values)):
        for name, el in elements.items():
            for curie in el.close_mappings or []:
                prefix = curie.partition(":")[0]
                if prefix not in schema.prefixes:
                    problems.append(f"{kind} {name}: {curie} uses an undeclared prefix")
                elif not standard(curie):
                    problems.append(f"{kind} {name}: {curie} isn't one of the standards (FIBO, OMG Commons, ISO 20022)")
                else:
                    pin = next(p for start, (_, p) in STANDARDS.items() if prefix.startswith(start))
                    if pin and not pins.get(pin):
                        problems.append(f"{kind} {name}: {curie} needs the release it was checked against, in the schema's {pin} annotation")

    questions = yaml.safe_load((ROOT / "ontology" / "competency-questions.yaml").read_text())["questions"]
    failing, gaps, seen = set(), set(), set()
    for q in questions:
        before = len(problems)
        if q["id"] in seen:
            problems.append(f"{q['id']}: used by more than one question")
        seen.add(q["id"])
        if q.get("domain") not in DOMAINS:
            problems.append(f"{q['id']}: domain must be one of {sorted(DOMAINS)}")
        if q.get("answered_in") not in STORES:
            problems.append(f"{q['id']}: answered_in must be one of {sorted(STORES)}")
        if q.get("gap"):
            gaps.add(q["id"])
            if q.get("walks") or q.get("query"):
                problems.append(f"{q['id']}: a gap question has no walks or query; say what the schema lacks instead")
            continue
        if not q.get("walks"):
            problems.append(f"{q['id']}: needs walks, or a gap saying what the schema lacks")
        for step in q.get("walks") or []:
            cls_name, _, slot_name = step.partition(".")
            if cls_name not in classes:
                problems.append(f"{q['id']}: no class {cls_name}")
                continue
            slots = {s.name: s for s in sv.class_induced_slots(cls_name)}
            if slot_name not in slots:
                problems.append(f"{q['id']}: {cls_name} has no slot {slot_name}")
            elif slots[slot_name].range not in classes and slots[slot_name].range not in anything:
                problems.append(f"{q['id']}: {step} is an attribute, not a relationship")
        if len(problems) > before:
            failing.add(q["id"])

    check_explorer(sv, classes, problems)
    check_queries(sv, questions, problems, failing)
    concrete = [c for c in classes.values() if not c.abstract]
    # Only mappings to one of the standards count, through a prefix the schema declares.
    counts = lambda curie: standard(curie) and curie.partition(":")[0] in schema.prefixes
    mapped = [c for c in concrete if any(counts(m) for m in c.close_mappings or [])]
    by_standard = {}
    for c in mapped:
        for curie in c.close_mappings:
            if counts(curie):
                by_standard.setdefault(standard(curie), set()).add(c.name)
    print(f"{len(classes)} classes, {len(concrete)} concrete")
    answered = [q for q in questions if q["id"] not in failing | gaps]
    by_domain = ", ".join(f"{d} {sum(q.get('domain') == d for q in answered)} of {sum(q.get('domain') == d for q in questions)}"
                          for d in sorted(DOMAINS) if any(q.get("domain") == d for q in questions))
    print(f"competency questions the schema answers: {len(answered)} of {len(questions)} ({by_domain}); {len(gaps)} gaps")
    print(f"concrete classes mapped to a standard: {len(mapped)} of {len(concrete)}"
          f" ({', '.join(f'{k} {len(v)}' for k, v in sorted(by_standard.items()))})")
    for p in problems:
        print("  problem:", p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
