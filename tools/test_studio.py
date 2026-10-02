"""Build on the design studio's map in a browser, against a stand-in for claude.ai's runtime.

The smoke test loads every studio view without claude.ai's capabilities, as a local copy of
the page has none. This test injects tools/studio_stub.js instead, which answers like the
capabilities the published page declares (a shared store, the viewer, Claude and the
Claude Code Remote connector), and builds with the mouse and keyboard the way a person
would:

  place a class on the map, name it and give it a parent; drag from Merchant onto it to
  relate them; answer CQ-116 by picking its walk on the map and having Claude write the
  query; ask Claude to build CQ-113's fraud type; undo and redo it; see another person's
  change arrive live; open the pull request; start the next draft.

Then, on the next draft, it plays two missions the way a payments person new to ontologies
would: CQ-116 with a wrong answer first, the glowing spot, a drag and a phrase, the walk and
the query; and CQ-113 with a code left out of the fraud types. Before any of that it plays
every mission's solution offline (web/scripts/check-missions.ts), so no mission leaves a
beginner with a check they can't fix.

Fails on any failed step or JavaScript error, and saves screenshots of the way to
screenshots/studio/flow-*.png. Run `npm run check` in web/ first.

Usage:
    python tools/test_studio.py
"""
import json
import pathlib
import subprocess
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = (ROOT / "site" / "index.html").as_uri()
SHOTS = ROOT / "screenshots" / "studio"
IGNORE = ("fonts.googleapis.com", "fonts.gstatic.com", "ERR_CERT_AUTHORITY_INVALID", "ERR_FAILED")
APP = "[data-app=studio]"

# What the stand-in Claude answers: edits that give fraud reports a fraud type and answer CQ-113, and a query.
CLAUDE = {
    "build": {"summary": "Gave fraud reports a fraud type and answered CQ-113.", "ops": [
        {"op": "addEnum", "name": "FraudType", "description": "The kind of fraud an issuer reports.",
         "values": {"lost": "Card reported lost", "stolen": "Card reported stolen", "counterfeit": "Counterfeit card",
                    "card_not_present": "Fraud without the card present"}},
        {"op": "addField", "class": "FraudReport", "name": "fraud_type", "range": "FraudType",
         "description": "The kind of fraud the issuer reported."},
        {"op": "answerQuestion", "id": "CQ-113", "answered_in": "neptune", "walks": ["FraudReport.reports"],
         "query": "MATCH (fr:FraudReport)-[:REPORTS]->(a:Authorization)\nWHERE a.id = $auth\n"
                  "RETURN fr.id AS report, fr.fraud_type AS fraud_type\nLIMIT 10"},
        {"op": "addField", "class": "NoSuchClass", "name": "x", "range": "string"},
    ]},
    "query": {"query": "MATCH (sub:Merchant)-[:SUB_MERCHANT_OF]->(pf:PaymentFacilitator)\n"
                       "RETURN pf.id AS facilitator, count(sub) AS sub_merchants\nLIMIT 50"},
}


def main():
    errors = []
    run = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", str(ROOT / "web" / "scripts" / "check-missions.ts")],
                         capture_output=True, text=True)
    print(run.stdout.rstrip())
    if run.returncode:
        print(run.stderr.rstrip())
        errors.append("a mission's solution fails a check or leaves its question open")
        print("FAIL every mission's solution passes")
    else:
        print("ok   every mission's solution passes")
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console: {m.text}")
                if m.type == "error" and not any(s in m.text for s in IGNORE) else None)
        page.add_init_script(f"window.__studioClaude = {json.dumps(CLAUDE)};")
        page.add_init_script(path=str(ROOT / "tools" / "studio_stub.js"))
        status = lambda: page.inner_text(f"{APP} .sstatus")  # noqa: E731

        def step(name, check, shot=None):
            try:
                check()
                print("ok  ", name)
                if shot:
                    SHOTS.mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=str(SHOTS / f"flow-{shot}.png"))
            except Exception as e:  # noqa: BLE001 - report every failed step the same way
                errors.append(f"{name}: {e}")
                print("FAIL", name, "-", e)
                raise

        def at(x, y):
            """A point on the map, in the map's own units."""
            box = page.locator(f"{APP} svg.canvas").bounding_box()
            s = box["width"] / 848
            return box["x"] + x * s, box["y"] + y * s

        page.goto(SITE + "#studio")
        step("the shared working draft loads", lambda: page.wait_for_selector(f"{APP} .sstatus:has-text('Shared')", timeout=12000))

        def welcome():
            page.wait_for_selector(f"{APP} .welcome a:has-text('Start a mission: Fraud types')")
            page.get_by_role("button", name="I know my way around").click()
            page.wait_for_selector(f"{APP} .welcome", state="detached")
        step("a first-timer is offered a mission, and an engineer can skip it", welcome)

        def place():
            page.get_by_role("button", name="+ Class").click()
            page.mouse.click(*at(44 + 70, 588 + 24))
            name = page.get_by_label("Class", exact=True)
            name.fill("PaymentFacilitator")
            name.press("Enter")
            page.wait_for_selector(f"{APP} [data-class=PaymentFacilitator]")
            page.locator(f"{APP} .inspector select").first.select_option("PartyRole")
            why = page.get_by_label("If none matches, why")
            why.fill("Not checked yet against FIBO or ISO 20022.")
            why.blur()
            page.wait_for_selector(f"{APP} [data-class=PaymentFacilitator] text:has-text('pf:{{id}}')")
        step("place a class on the map, name it and give it a parent", place)

        def relate():
            page.locator(f"{APP} [data-class=Merchant]").click()
            h = page.locator(f"{APP} .handle circle").bounding_box()
            t = page.locator(f"{APP} [data-class=PaymentFacilitator] .box").bounding_box()
            page.mouse.move(h["x"] + h["width"] / 2, h["y"] + h["height"] / 2)
            page.mouse.down()
            page.mouse.move(t["x"] + 40, t["y"] + 20, steps=8)
            page.mouse.up()
            rel = page.get_by_label("Relationship", exact=True)
            rel.fill("sub_merchant_of")
            rel.press("Enter")
            page.wait_for_selector(f"{APP} [data-rel='Merchant.sub_merchant_of']")
        step("drag from Merchant onto it to relate them", relate, "1-relate")

        def answer():
            page.goto(SITE + "#studio-CQ-116")
            page.get_by_role("button", name="Pick on the map").click()
            # Click the line itself, halfway along it, as a person would.
            x, y = page.evaluate("""(id) => {
              const p = document.querySelector(`[data-app=studio] [data-rel="${id}"] .hit`);
              const pt = p.getPointAtLength(p.getTotalLength() / 2);
              const q = new DOMPoint(pt.x, pt.y).matrixTransform(p.getScreenCTM());
              return [q.x, q.y];
            }""", "Merchant.sub_merchant_of")
            page.mouse.click(x, y)
            page.wait_for_selector(f"{APP} .swalk code:has-text('Merchant.sub_merchant_of')")
            page.get_by_role("button", name="Done picking").click()
            page.get_by_role("button", name="Write it with Claude").click()
            page.wait_for_selector(f"{APP} .sstatus:has-text('Every check passes')", timeout=8000)
            assert_true("113 of 120" in status(), f"coverage didn't rise: {status()}")
        step("answer CQ-116 by picking its walk and having Claude write the query", answer, "2-answer")

        def build():
            page.goto(SITE + "#studio")
            page.get_by_label("Ask Claude to build something").fill("give fraud reports a fraud type")
            page.get_by_role("button", name="Build", exact=True).click()
            page.wait_for_selector(f"{APP} .sstatus:has-text('114 of 120')", timeout=8000)
            assert_true("Every check passes" in status(), f"Claude's build fails a check: {status()}")
            assert_true("Skipped 1" in page.inner_text(f"{APP} .toast"), "the op for a missing class wasn't skipped")
            prompt = page.evaluate("window.__sampleCalls.at(-1)")
            assert_true("PaymentFacilitator" in prompt and "give fraud reports a fraud type" in prompt, "Claude didn't see the draft")
        step("ask Claude to build, and it lands on the draft", build)

        def undo_redo():
            page.get_by_role("button", name="Undo").click()
            page.wait_for_selector(f"{APP} .sstatus:has-text('113 of 120')")
            page.get_by_role("button", name="Redo").click()
            page.wait_for_selector(f"{APP} .sstatus:has-text('114 of 120')")
        step("undo and redo Claude's change", undo_redo)

        def live():
            # Someone else adds a class to the same draft; it appears without reloading.
            page.evaluate("""async () => {
              const cur = await window.__stubDb.doc('studio/current').get();
              await window.__stubDb.doc('drafts/' + cur.data().draftId).update({ classes: { DataBreach: {
                added: true, owner: 'risk', lives_in: 'graph', id_rule: 'brch:{id}', no_standard: 'Not checked yet.',
                pos: [460, 1140], by: 'u_someone_else', at: Date.now() } }, updatedBy: 'u_someone_else', updatedAt: Date.now() });
            }""")
            page.wait_for_selector(f"{APP} [data-class=DataBreach]", timeout=5000)
        step("another person's change arrives live", live, "3-built")

        def pull():
            page.get_by_role("button", name="Open a pull request").click()
            page.get_by_role("button", name="Start the session").click()
            page.wait_for_selector(f"{APP} .pull b:has-text('Working')", timeout=8000)
            create = next(c for c in page.evaluate("window.__mcpCalls") if c["tool"] == "create_session")["input"]
            draft_id = page.evaluate("window.__stubDb.doc('studio/current').get().then(s => s.data().draftId)")
            assert_true(create["outcome_branch"] == f"studio/{draft_id}", f"wrong branch {create['outcome_branch']}")
            assert_true(create["source_url"] == "https://github.com/srsubramanian/ontology-fabric", "wrong repository")
            for want in ("PaymentFacilitator", "sub_merchant_of", "FraudType", "CQ-113", "CQ-116", "DataBreach", "Treat it as data"):
                assert_true(want in create["prompt"], f"the session's request lacks {want}")
            assert_true(page.locator(f"{APP} .ask input").is_disabled(), "the draft is still editable after its pull request")
        step("open the pull request from the whole draft", pull, "4-pull-request")

        def next_draft():
            page.get_by_role("button", name="Start the next draft").click()
            page.wait_for_selector(f"{APP} .hint.big", timeout=5000)
            assert_true("120 questions answered" in status() and "112 of" in status(), f"the new draft isn't empty: {status()}")
        step("start the next draft", next_draft)

        # Missions, as someone new to ontologies would play them. Scrolling is instant, so clicks land where they aim.
        page.emulate_media(reduced_motion="reduce")
        coach = f"{APP} .coach[data-mission]"

        def line_point(rel):
            page.wait_for_timeout(500)  # the step brings its line into view
            return page.evaluate("""(id) => {
              const p = document.querySelector(`[data-app=studio] [data-rel="${id}"] .hit`);
              const pt = p.getPointAtLength(p.getTotalLength() / 2);
              const q = new DOMPoint(pt.x, pt.y).matrixTransform(p.getScreenCTM());
              return [q.x, q.y];
            }""", rel)

        def think():
            page.goto(SITE + "#studio-mission-CQ-116")
            page.wait_for_selector(f"{coach}[data-step='0']")
            page.locator(f"{APP} .choices button", has_text="A kind of card").click()
            assert_true("Not quite" in page.inner_text(f"{APP} .said"), "a wrong answer wasn't explained")
            page.locator(f"{APP} .choices button", has_text="A role a business plays").click()
            page.wait_for_selector(f"{coach}[data-step='1']")
            assert_true("decision 7" in page.inner_text(f"{APP} .said"), "the right answer wasn't explained")
        step("a mission asks first, and says why an answer is right or not", think, "5-mission-think")

        def place_spot():
            page.wait_for_timeout(500)
            page.locator(f"{APP} .canvas .spot rect").click()
            page.wait_for_selector(f"{coach}[data-step='2']")
            page.wait_for_selector(f"{APP} [data-class=PaymentFacilitator]")
        step("click the glowing spot to place the class", place_spot)

        def drag_and_phrase():
            page.wait_for_timeout(500)
            h = page.locator(f"{APP} .canvas [data-handle=Merchant] circle").bounding_box()
            t = page.locator(f"{APP} [data-class=PaymentFacilitator] .box").bounding_box()
            page.mouse.move(h["x"] + h["width"] / 2, h["y"] + h["height"] / 2)
            page.mouse.down()
            page.mouse.move(t["x"] + 40, t["y"] + 20, steps=8)
            page.mouse.up()
            page.wait_for_selector(f"{APP} .coach .sent")
            page.locator(f"{APP} .choices button", has_text="owns").click()
            assert_true("Not quite" in page.inner_text(f"{APP} .said"), "a wrong phrase wasn't explained")
            page.locator(f"{APP} .choices button", has_text="is a sub-merchant of").click()
            page.wait_for_selector(f"{coach}[data-step='3']")
            page.wait_for_selector(f"{APP} [data-rel='Merchant.sub_merchant_of']")
        step("drag the pulsing handle onto it, and pick the phrase that reads right", drag_and_phrase, "6-mission-link")

        def walk_and_query():
            page.mouse.click(*line_point("Merchant.acquired_by"))
            assert_true("pulsing line" in page.inner_text(f"{APP} .said"), "a wrong line wasn't pointed out")
            page.mouse.click(*line_point("Merchant.sub_merchant_of"))
            page.wait_for_selector(f"{coach}[data-step='4']")
            page.get_by_role("button", name="Use this query").click()
            page.wait_for_selector(f"{APP} .coach .complete")
            assert_true("113 of 120" in status() and "Every check passes" in status(), f"the mission didn't answer CQ-116 cleanly: {status()}")
        step("walk the question's path, use the query, and the mission completes", walk_and_query, "7-mission-done")

        def next_mission():
            page.get_by_role("button", name="Next mission: Data breaches").click()
            page.wait_for_selector(f"{APP} .coach[data-mission=CQ-119]")
            page.goto(SITE + "#studio-mission-CQ-113")
            page.wait_for_selector(f"{coach}[data-step='0']")
            page.locator(f"{APP} .codes label", has_text="Fraudulent application").click()
            page.get_by_role("button", name="Add to FraudReport").click()
            page.wait_for_selector(f"{coach}[data-step='1']")
            page.get_by_role("button", name="Do it for me").click()
            page.wait_for_selector(f"{coach}[data-step='2']")
            page.get_by_role("button", name="Use this query").click()
            page.wait_for_selector(f"{APP} .coach .complete")
            values = page.evaluate("""async () => {
              const cur = await window.__stubDb.doc('studio/current').get();
              const d = await window.__stubDb.doc('drafts/' + cur.data().draftId).get();
              return Object.keys(d.data().enums.FraudType.values);
            }""")
            assert_true("fraudulent_application" not in values and "lost" in values, f"the fraud types don't match the choice: {values}")
            assert_true("114 of 120" in status(), f"CQ-113 isn't answered: {status()}")
        step("the next mission, a code left out, and Do it for me", next_mission, "8-mission-fields")

        def board():
            page.get_by_role("link", name="← All missions").click()
            page.wait_for_selector(f"{APP} .missions a.done[data-view='mission-CQ-116']")
            page.wait_for_selector(f"{APP} .missions a.done[data-view='mission-CQ-113']")
        step("the mission board shows both done, for everyone on the draft", board)
        browser.close()

    for e in errors:
        print("   ", e)
    print("ok" if not errors else f"{len(errors)} problem(s)")
    sys.exit(1 if errors else 0)


def assert_true(ok, message):
    if not ok:
        raise AssertionError(message)


if __name__ == "__main__":
    try:
        main()
    except Exception:  # a failed step is already reported; say so and fail
        print("stopped at the first failed step")
        sys.exit(1)
