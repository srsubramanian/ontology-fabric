"""Test tools/check_ontology.py by planting mistakes and checking it names each one.

Each case copies the ontology, the checker and the explorer's scripts into a temporary
folder, plants one mistake (or none), runs the checker there and looks for the messages
and coverage numbers it should print. A check that stays quiet, or prints a misleading
message, fails its case. Each case also runs the checker's TypeScript port, which the
studio checks drafts with (web/src/explorer/check.ts), and fails if the two disagree on a
problem or a coverage number. Needs what check_ontology.py needs, including Node 22.6 or
later and `npm install` in web/.

Usage:
    python tools/test_checks.py
"""
import concurrent.futures
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from check_ontology import node_error  # noqa: E402


def cls(name):
    """An edit to one class in payments.yaml."""
    return lambda s, _: s["classes"][name]


def question(qid):
    return lambda _, q: next(x for x in q["questions"] if x["id"] == qid)


def plant_class_without_owner(s, q):
    del cls("Chargeback")(s, q)["annotations"]["owner"]


def plant_class_without_place(s, q):
    s["classes"]["PlantedThing"] = {
        "description": "A class planted by tools/test_checks.py.",
        "annotations": {"owner": "core", "lives_in": "graph", "id_rule": "pt:{id}", "no_standard": "Planted."}}


def plant_relationship_without_route(s, q):
    s["slots"]["planted_link"] = {"range": "Merchant", "description": "A relationship planted by tools/test_checks.py."}
    cls("Chargeback")(s, q).setdefault("slots", []).append("planted_link")


def plant_cypher_against_direction(s, q):
    cq = question("CQ-01")(s, q)
    cq["query"] = cq["query"].replace("(cb:Chargeback)-[:HAS_REASON]->(:ReasonCode {id: $reason})",
                                      "(:ReasonCode {id: $reason})-[:HAS_REASON]->(cb:Chargeback)")


def plant_query_without_limit(s, q):
    cq = question("CQ-01")(s, q)
    cq["query"] = cq["query"].replace("LIMIT 10", "")


def plant_marker_on_wrong_line(s, q):
    cq = question("CQ-35")(s, q)
    cq["query"] = (cq["query"]
                   .replace("-- Card.in_bin_range", "")
                   .replace("SELECT i.issuer_id, i.name,", "SELECT i.issuer_id, i.name,  -- Card.in_bin_range"))


def plant_question_without_walks(s, q):
    del question("CQ-02")(s, q)["walks"]


def plant_walk_on_an_attribute(s, q):
    question("CQ-01")(s, q)["walks"].append("Chargeback.amount")


def plant_undeclared_prefix(s, q):
    acquirer = cls("Acquirer")(s, q)
    del acquirer["annotations"]["no_standard"]
    acquirer["close_mappings"] = ["fibo-undeclared:Thing"]


def plant_class_without_mapping(s, q):
    del cls("Chargeback")(s, q)["close_mappings"]


def plant_mapping_without_release(s, q):
    del s["annotations"]["fibo_release"]


# Each case: what to plant, and what the checker must print. A case with no mistake must pass.
CASES = [
    ("round trip, no mistake", lambda s, q: None,
     ["112 of 120", "18 of 33", "0 layout problems"]),
    ("class without an owner", plant_class_without_owner,
     ["Chargeback: owner must be one of"]),
    ("class without a place on the map", plant_class_without_place,
     ["PlantedThing has no place on the map: add it to POS in web/src/explorer/layout.ts"]),
    ("relationship without a route on the map", plant_relationship_without_route,
     ["Chargeback.planted_link has no route on the map: add it to PORTS in web/src/explorer/layout.ts"]),
    ("Cypher against the relationship's direction", plant_cypher_against_direction,
     ["CQ-01: (ReasonCode)-[:HAS_REASON]->(Chargeback) runs against the schema's direction",
      "HAS_REASON runs from DisputeEvent to ReasonCode", "111 of 120"]),
    ("query without a LIMIT", plant_query_without_limit,
     ["CQ-01: every query part needs a LIMIT", "111 of 120"]),
    ("SQL marker on a line that doesn't walk the step", plant_marker_on_wrong_line,
     ["CQ-35: the line marked '-- Card.in_bin_range' names none of its classes", "111 of 120"]),
    ("question with neither walks nor a gap", plant_question_without_walks,
     ["CQ-02: needs walks, or a gap saying what the schema lacks", "111 of 120"]),
    ("walk on an attribute, which the explorer can't read", plant_walk_on_an_attribute,
     ["CQ-01: Chargeback.amount is an attribute, not a relationship",
      "explorer: can't read the schema: Error: CQ-01: Chargeback.amount is not a relationship",
      "class map: can't check the layout: Error: CQ-01", "111 of 120"]),
    ("mapping with an undeclared prefix", plant_undeclared_prefix,
     ["class Acquirer: fibo-undeclared:Thing uses an undeclared prefix", "18 of 33"]),
    ("class with no mapping and no reason", plant_class_without_mapping,
     ["Chargeback: map it to a standard, or say why none fits in no_standard", "17 of 33"]),
    ("mapping without its pinned release", plant_mapping_without_release,
     ["needs the release it was checked against, in the schema's fibo_release annotation"]),
]


def run_case(name, plant, expected):
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        shutil.copytree(ROOT / "ontology", tmp / "ontology")
        shutil.copytree(ROOT / "tools", tmp / "tools", ignore=shutil.ignore_patterns("__pycache__"))
        shutil.copytree(ROOT / "web" / "src" / "explorer", tmp / "web" / "src" / "explorer")
        shutil.copytree(ROOT / "web" / "scripts", tmp / "web" / "scripts")
        shutil.copy(ROOT / "web" / "package.json", tmp / "web")
        (tmp / "web" / "node_modules").symlink_to(ROOT / "web" / "node_modules")

        schema_file, questions_file = tmp / "ontology" / "payments.yaml", tmp / "ontology" / "competency-questions.yaml"
        schema, questions = yaml.safe_load(schema_file.read_text()), yaml.safe_load(questions_file.read_text())
        plant(schema, questions)
        schema_file.write_text(yaml.safe_dump(schema, sort_keys=False, allow_unicode=True))
        questions_file.write_text(yaml.safe_dump(questions, sort_keys=False, allow_unicode=True))

        run = subprocess.run([sys.executable, str(tmp / "tools" / "check_ontology.py")], capture_output=True, text=True)
        output = run.stdout + run.stderr
        missing = [e for e in expected if e not in output]
        clean = name.startswith("round trip")
        if clean != (run.returncode == 0):
            missing.append("exit code 0" if clean else "a non-zero exit code")

        port = subprocess.run(["node", "--experimental-strip-types", "--no-warnings",
                               str(tmp / "web" / "scripts" / "check-ontology.ts")], capture_output=True, text=True)
        python, typescript = findings(run.stdout), findings(port.stdout)
        if port.returncode not in (0, 1) or not typescript:
            missing.append("the TypeScript checker to run: " + (port.stderr.strip().splitlines() or ["no output"])[-1])
        else:
            missing += [f"the TypeScript checker to print: {f}" for f in sorted(python - typescript)]
            missing += [f"the TypeScript checker not to print: {f}" for f in sorted(typescript - python)]
        return name, missing, output


def findings(stdout):
    """What both checkers print: the coverage lines and the problems. The explorer's own comparison with
    LinkML ("explorer: reads ... differently") only the Python checker can make."""
    out = set()
    for line in stdout.splitlines():
        if line.startswith("  problem: ") and not line.startswith("  problem: explorer: reads "):
            out.add(line.strip())
        elif re.match(r"\d+ classes, |competency questions the schema answers|concrete classes mapped", line):
            out.add(line)
    return out


def test_node_error():
    """node_error picks the line that says what went wrong, not Node's version line."""
    thrown = ("file:///web/src/explorer/model.ts:175\n"
              "      if (!relationship) throw new Error(`...`);\n                         ^\n\n"
              "Error: CQ-01: Chargeback.amount is not a relationship in the schema\n"
              "    at buildModel (file:///web/src/explorer/model.ts:175:32)\n\nNode.js v22.12.0\n")
    cases = [(thrown, "Error: CQ-01: Chargeback.amount is not a relationship in the schema"),
             ("SyntaxError: Unexpected token ':'\n\nNode.js v22.12.0\n", "SyntaxError: Unexpected token ':'"),
             ("node: bad option: --experimental-strip-types\n", "node: bad option: --experimental-strip-types"),
             ("\nNode.js v22.12.0\n", "failed with no message")]
    return [f"node_error({stderr!r}) gave {node_error(stderr)!r}, not {want!r}"
            for stderr, want in cases if node_error(stderr) != want]


def main():
    if not shutil.which("node") or not (ROOT / "web" / "node_modules" / "yaml").exists():
        sys.exit("needs Node 22.6 or later and `npm install` in web/")
    failed = 0
    with concurrent.futures.ThreadPoolExecutor() as pool:
        for name, missing, output in pool.map(lambda c: run_case(*c), CASES):
            print(("FAIL " if missing else "ok   ") + name)
            if missing:
                failed += 1
                print("".join(f"     expected: {m}\n" for m in missing) + "     the checker printed:")
                print("".join(f"       {line}\n" for line in output.splitlines()), end="")
    unit = test_node_error()
    print(("FAIL " if unit else "ok   ") + "node_error finds the error line")
    for problem in unit:
        print("     " + problem)
    total = len(CASES) + 1
    print(f"{total - failed - bool(unit)} of {total} checks behave")
    sys.exit(1 if failed or unit else 0)


if __name__ == "__main__":
    main()
