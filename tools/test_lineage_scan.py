"""The deep scan (decision 26), on the made-up repositories in examples/lineage/.

It replays each screen's history. For transaction research, the deep scan reads the repositories as they stood at v1,
people's decisions go in, then v2, more decisions, then v3; the dispute workbench has one scan and its decisions. What
it writes must be the files committed in ontology/mappings/, byte for byte, so the illustrative lineage the studio shows
is exactly what the tool makes. Then it scans a change the repositories haven't had yet (transaction research v4): the
data API sends the device's own id, and the screen shows the card's network. Last, it plants mistakes in what Claude Code
reports, and checks that the scan names each one.

    python tools/test_lineage_scan.py            # check
    python tools/test_lineage_scan.py --update   # rewrite the committed versions from the made-up repositories
"""
import argparse
import difflib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EX = ROOT / "examples" / "lineage"
MAPPINGS = ROOT / "ontology" / "mappings"
SET = "transaction-research"
SETS = [SET, "dispute-workbench"]
TOOL = ["node", "--experimental-strip-types", "--no-warnings", str(ROOT / "web" / "scripts" / "lineage-scan.ts")]
# Each screen's scans: what each read (the made-up repositories' commits, and the day Snowflake's columns were exported),
# and the decisions people made after it.
SCANS = {
    SET: [
        ("v1", "2026-07-06", "ui=1a7e0c2,be=5d21f9a,api=c04b6e3,sf=2026-07-06", "after-v1"),
        ("v2", "2026-08-17", "ui=8b3f412,be=e9c7a10,api=2f8d5b7,sf=2026-08-17", "after-v2"),
        ("v3", "2026-10-02", "ui=3f9c2e1,be=a81d04b,api=77e2c90,sf=2026-10-02", None),
    ],
    "dispute-workbench": [
        ("v1", "2026-09-22", "ui=5e2a7d0,be=b3c91f4,api=9d4e6a2,sf=2026-09-22", "after-v1"),
    ],
}

failed = 0


def expect(ok, label, detail=""):
    global failed
    print(f"{'ok  ' if ok else 'FAIL'} {label}{f': {detail}' if detail else ''}")
    failed += 0 if ok else 1


def state(tmp: Path, name: str, set_: str = SET) -> Path:
    """The made-up repositories as they stood at a scan: today's files, with that scan's overlay. The overlays in
    earlier/ and changes/ are transaction research's history; the dispute workbench's one scan reads today's files."""
    d = tmp / f"state-{set_}-{name}"
    shutil.copytree(EX / "repos", d / "repos")
    shutil.copytree(EX / "snowflake", d / "snowflake")
    shutil.copytree(EX / "sources", d / "sources")
    over = EX / ("changes" if name == "v4" else "earlier") / name
    if set_ == SET and over.exists():
        shutil.copytree(over, d, dirs_exist_ok=True)
    return d


def tool(*args):
    r = subprocess.run(TOOL + [str(a) for a in args], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def scan(tmp, mappings, name, date, read, answer=None, *more, set_=SET):
    code, out = tool("scan", "--sources", state(tmp, name, set_) / "sources" / f"{set_}.yaml", "--answer", answer or EX / "scans" / set_ / f"{name}.json",
                     "--mappings", mappings, "--date", date, "--read", read, "--require-sql-check", "--json", *more)
    try:
        return code, json.loads(out[out.index("{"):]) if "{" in out else {}, out
    except json.JSONDecodeError:
        return code, {}, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--update", action="store_true", help="rewrite the committed versions from the made-up repositories")
    update = ap.parse_args().update
    tmp = Path(tempfile.mkdtemp(prefix="lineage-scan-"))
    try:
        # 1. The history, replayed: scan, decide, scan, decide, scan.
        mappings = tmp / "mappings"
        mappings.mkdir()
        for set_, scans in SCANS.items():
            for i, (name, date, read, decisions) in enumerate(scans):
                code, s, out = scan(tmp / f"{set_}-{i}", mappings, name, date, read, set_=set_)
                expect(code == 0 and s.get("written") and s.get("version") == name, f"the deep scan writes {set_} {name} from the made-up repositories",
                       "; ".join(s.get("problems", [])) or out[-400:] if code else "")
                for w in s.get("warnings", []):
                    print(f"     note {w}")
                if decisions:
                    code, out = tool("decide", "--set", set_, "--decisions", EX / "decisions" / set_ / f"{decisions}.json", "--mappings", mappings)
                    expect(code == 0, f"people's decisions after {set_} {name} go into it", out.strip().splitlines()[-1])
        written = {p.relative_to(mappings): p.read_text() for p in mappings.rglob("*.tsv")}
        committed = {p.relative_to(MAPPINGS): p.read_text() for p in MAPPINGS.rglob("*.tsv") if any(p.name.startswith(x + ".") for x in SETS)}
        if update:
            for rel, text in written.items():
                (MAPPINGS / rel).parent.mkdir(parents=True, exist_ok=True)
                (MAPPINGS / rel).write_text(text)
            print(f"     rewrote {', '.join(str(r) for r in sorted(written))}")
        else:
            same = written == committed
            if not same:
                for rel in sorted(set(written) | set(committed), key=str):
                    a, b = committed.get(rel, ""), written.get(rel, "")
                    if a != b:
                        print(f"     {rel} differs:")
                        print("".join(list(difflib.unified_diff(a.splitlines(True), b.splitlines(True), "committed", "scanned", n=0))[:12]))
            expect(same, "the committed mapping sets and their history are exactly what the scans write (python tools/test_lineage_scan.py --update rewrites them)")

        # 2. The next change: the device's own id instead of the fingerprint, and a new field for the card's network.
        m4 = tmp / "m4"
        shutil.copytree(mappings, m4)
        for p in m4.rglob("dispute-workbench*.tsv"):
            p.unlink()
        code, s, out = scan(tmp / "v4", m4, "v4", "2026-10-20", "ui=6c1e9b4,be=d07f3a2,api=4b9e1c8,sf=2026-10-20")
        changed = {c["field"]: c["kinds"] for c in s.get("changes", []) if c["kinds"] != ["moved"]}
        expect(code == 0 and s.get("version") == "v4", "a change in the code makes v4", "; ".join(s.get("problems", [])) or out[-300:] if code else "")
        expect(changed == {"Network": ["added"], "Device": ["rebuilt", "remapped"]}, "v4 adds the network and re-maps the device, and nothing else", json.dumps(changed))
        rows = [l.split("\t") for l in (m4 / f"{SET}.sssom.tsv").read_text().splitlines() if not l.startswith("#")]
        head = rows[0]
        kept = [r for r in rows[1:] if r[0] == "ui:TransactionLifecycle.transactionId" and r[head.index("predicate_id")] != "prov:wasDerivedFrom"]
        expect(kept and kept[0][head.index("reviewer_id")] == "person:ana", "ana's decision on the transaction id holds, since its code didn't change")
        expect((m4 / "history" / f"{SET}.v3.sssom.tsv").read_text() == (mappings / f"{SET}.sssom.tsv").read_text(), "v3 is kept in history, as it was")
        old = tmp / "old-decision.json"
        old.write_text(json.dumps([{"key": "ui:TransactionLifecycle.card>Card.id", "state": "accepted", "by": "person:ana", "version": "v3"}]))
        code, out = tool("decide", "--set", SET, "--decisions", old, "--mappings", m4)
        expect(code == 0 and "skipped" in out, "a decision made on v3 isn't written into v4", out.strip().splitlines()[-1])

        # 3. Mistakes in what Claude Code reports, each named by the scan.
        base = json.loads((EX / "scans" / SET / "v3.json").read_text())
        before = tmp / "before"
        before.mkdir()
        (before / f"{SET}.sssom.tsv").write_text((mappings / "history" / f"{SET}.v2.sssom.tsv").read_text())

        def hop(a, field, layer):
            f = next(x for x in a["fields"] if x["field"].endswith("." + field))
            return f, next(h for h in f["hops"] if h["to"].startswith(layer + ":"))

        def plant(label, change, says):
            a = json.loads(json.dumps(base))
            change(a)
            p = tmp / "planted.json"
            p.write_text(json.dumps(a))
            code, s, out = scan(tmp / f"m{abs(hash(label))}", before, "v3", "2026-10-02", SCANS[SET][2][2], p, "--dry-run")
            hits = [x for x in s.get("problems", []) if says in x]
            expect(code != 0 and hits, f"it names {label}", hits[0] if hits else out[-300:])

        plant("code that isn't on the line", lambda a: hop(a, "authAmount", "be")[1].update(code="<Cell>{txn.amount}</Cell>"), "isn't on")
        plant("a hop pointing at the wrong line", lambda a: hop(a, "currency", "api")[1].update(at=hop(a, "currency", "api")[1]["at"].rsplit(":", 1)[0] + ":12"), "isn't on")
        plant("a column the SQL doesn't read", lambda a: hop(a, "authorizedAt", "sf")[1].update(to="sf:CORE.FCT_REFUND.REFUND_ID"), "doesn't read")
        plant("a column Snowflake doesn't have", lambda a: hop(a, "authorizedAt", "sf")[1].update(to="sf:CORE.FCT_AUTHORIZATION.AUTH_TIME"), "isn't in the Snowflake export")
        plant("a field the data API doesn't have", lambda a: hop(a, "response", "api")[1].update(to="api:Transaction.responseCd"), "isn't in the data API's schema")
        plant("a field the backend doesn't declare", lambda a: hop(a, "response", "be")[1].update(to="be:TransactionLifecycleDto.responseWords"), "doesn't declare")
        plant("a slot the ontology doesn't have", lambda a: hop(a, "currency", "be")[0]["means"].update(slot="Authorization.currency_code"), "isn't in the ontology")
        plant("a changed field with no meaning", lambda a: hop(a, "settledOn", "be")[0].pop("means"), "say what each means")
        plant("an unknown transform", lambda a: hop(a, "card", "be")[1].update(transform="mask"), "isn't a transform")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("ok" if not failed else f"{failed} problem(s)")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
