"""Build on the design studio's map in a browser, against a stand-in for claude.ai's runtime.

The smoke test loads every studio view without claude.ai's capabilities, as a local copy of
the page has none. This test injects tools/studio_stub.js instead, which answers like the
capabilities the published page declares (a shared store, the viewer, Claude and the
Claude Code Remote connector), and builds with the mouse and keyboard the way a person
would:

  place a class on the map, name it and give it a parent; drag from Merchant onto it to
  relate them; answer CQ-116 by picking its walk on the map and having Claude write the
  query; ask a question in plain words, see Claude's design as ghosts on the map, reject one
  proposal and accept the answer with what it needs; undo and redo that; read the proposals
  as sentences in the story lens and comment on one; see another person arrive, with their
  pointer and what they're looking at, and follow them; say what a class is in words and
  see it in the model lens; see another person's change arrive live; open the pull request;
  start the next draft.

Then, on the next draft, it plays two missions the way a payments person new to ontologies
would: CQ-116 with a wrong answer first, the glowing spot, a drag and a phrase, the walk and
the query; and CQ-113 with a code left out of the fraud types. Before any of that it plays
every mission's solution offline (web/scripts/check-missions.ts), so no mission leaves a
beginner with a check they can't fix, the asked question's design (web/scripts/check-ask.ts), and
the story lens's sentence for every relationship (web/scripts/check-story.ts).

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

# What the stand-in Claude answers: a design for the question someone asks (tools/fixtures/studio_ask.json), after
# using the page's tools the way Claude would, and a query for CQ-116.
ASK = json.loads((ROOT / "tools" / "fixtures" / "studio_ask.json").read_text())
CLAUDE = {
    "inquiry": ASK["reply"],
    "inquiryCalls": [
        {"name": "find_questions", "input": {"text": ASK["question"]}},
        {"name": "describe_class", "input": {"name": "Merchant"}},
        {"name": "check_design", "input": {"ops": ASK["reply"]["ops"], "answer": ASK["reply"]["answer"]}},
    ],
    "query": {"query": "MATCH (sub:Merchant)-[:SUB_MERCHANT_OF]->(pf:PaymentFacilitator)\n"
                       "RETURN pf.id AS facilitator, count(sub) AS sub_merchants\nLIMIT 50"},
}


def main():
    errors = []
    for script, what in (("check-missions.ts", "every mission's solution passes"), ("check-ask.ts", "the asked question's design passes"),
                         ("check-story.ts", "the story lens reads every relationship")):
        run = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", str(ROOT / "web" / "scripts" / script)],
                             capture_output=True, text=True)
        print(run.stdout.rstrip())
        if run.returncode:
            print(run.stderr.rstrip())
            errors.append(f"{script} failed")
            print("FAIL", what)
        else:
            print("ok  ", what)
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
            SHOTS.mkdir(parents=True, exist_ok=True)
            try:
                check()
                print("ok  ", name)
                if shot:
                    page.screenshot(path=str(SHOTS / f"flow-{shot}.png"))
            except Exception as e:  # noqa: BLE001 - report every failed step the same way
                print("FAIL", name, "-", e)
                # What the page shows, and what it was doing, so a failure in CI can be read from its log.
                page.screenshot(path=str(SHOTS / "flow-failed.png"))
                print("     at", page.evaluate("""() => ({ hash: location.hash, scrollY,
                  handle: document.querySelector('[data-app=studio] .canvas .handle')?.dataset.handle ?? null,
                  dragging: !!document.querySelector('[data-app=studio] .canvas .rubber'),
                  panel: document.querySelector('[data-app=studio] .inspector .ihead')?.innerText.slice(0, 80) ?? null })"""))
                for err in errors:
                    print("    ", err)
                errors.append(f"{name}: {e}")
                raise

        def at(x, y):
            """A point on the map, in the map's own units."""
            box = page.locator(f"{APP} svg.canvas").bounding_box()
            s = box["width"] / 848
            return box["x"] + x * s, box["y"] + y * s

        page.goto(SITE + "#studio")
        step("the shared working draft loads", lambda: page.wait_for_selector(f"{APP} .sstatus:has-text('Shared')", timeout=12000))

        def welcome():
            page.wait_for_selector(f"{APP} .welcome a:has-text('Learn with a worked example: Fraud types')")
            assert_true(page.locator(f"{APP} .welcome .chip").count() == 3, "the welcome offers no example questions")
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

        def drag_line(src, dst):
            """Drag the handle on src onto dst, the way a person would, waiting on each stage."""
            handle = page.locator(f"{APP} .canvas [data-handle={src}] circle")
            handle.wait_for()
            h = handle.bounding_box()
            t = page.locator(f"{APP} [data-class={dst}] .box").bounding_box()
            page.mouse.move(h["x"] + h["width"] / 2, h["y"] + h["height"] / 2)
            page.mouse.down()
            page.wait_for_selector(f"{APP} .canvas .rubber", state="attached", timeout=5000)
            page.mouse.move(t["x"] + 40, t["y"] + 20, steps=8)
            page.wait_for_selector(f"{APP} .canvas .cn.target[data-class={dst}]", timeout=5000)
            page.mouse.up()

        def relate():
            page.locator(f"{APP} [data-class=Merchant]").click()
            page.wait_for_function("location.hash === '#studio-Merchant'", timeout=5000)
            drag_line("Merchant", "PaymentFacilitator")
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

        def asked():
            page.goto(SITE + "#studio")
            page.get_by_label("Ask a question or describe what to add").fill(ASK["question"])
            page.get_by_role("button", name="Ask", exact=True).click()
            page.wait_for_selector(f"{APP} .coach.inquiry[data-inquiry=proposed]", timeout=10000)
            assert_true("nothing yet" in page.inner_text(f"{APP} .understood"), "the gap's words weren't marked as missing")
            page.wait_for_selector(f"{APP} .canvas .cn.ghost[data-class=PayoutAccountChange]")
            page.wait_for_selector(f"{APP} .canvas .cr.ghost[data-rel='Merchant.paid_out_to']")
            assert_true("every check passes" in page.inner_text(f"{APP} .verdict") and "answers CQ-121" in page.inner_text(f"{APP} .verdict"),
                        f"the design's verdict is wrong: {page.inner_text(f'{APP} .verdict')}")
            tools = {t["name"]: t["out"] for t in page.evaluate("window.__toolResults")}
            assert_true("passes" in tools["check_design"]["answer"] and not tools["check_design"]["problems"], f"check_design: {tools['check_design']}")
            assert_true(tools["describe_class"]["name"] == "Merchant" and tools["describe_class"]["links_in"], "describe_class answered badly")
            assert_true("112 of 120" in status() or "113 of 120" in status(), f"a proposal reached the draft before anyone accepted it: {status()}")
        step("ask a question in plain words, and Claude's design appears as ghosts", asked, "5-asked")

        def decide():
            card = lambda text: page.locator(f"{APP} .plist2 li", has_text=text)  # noqa: E731
            card("Give PayoutAccountChange a field changed_at").get_by_role("button", name="Reject").click()
            page.wait_for_selector(f"{APP} .plist2 li.rejected:has-text('a field changed_at')")
            card("Add it as question CQ-121").get_by_role("button", name="Accept").click()
            page.wait_for_selector(f"{APP} .sstatus:has-text('114 of 121')", timeout=8000)
            assert_true("Every check passes" in status(), f"accepting the answer broke a check: {status()}")
            page.wait_for_selector(f"{APP} .canvas .cn:not(.ghost)[data-class=PayoutAccountChange]")
            page.wait_for_selector(f"{APP} .canvas .cn.ghost[data-class=PayoutAccount]")
        step("reject one proposal, and accept the answer with what it needs", decide, "6-decided")

        def undo_redo():
            page.get_by_role("button", name="Undo").click()
            page.wait_for_selector(f"{APP} .sstatus:has-text('113 of 120')")
            page.wait_for_selector(f"{APP} .canvas .cn.ghost[data-class=PayoutAccountChange]")
            page.get_by_role("button", name="Redo").click()
            page.wait_for_selector(f"{APP} .sstatus:has-text('114 of 121')")
            page.get_by_role("button", name="Accept all").click()
            page.wait_for_selector(f"{APP} .canvas .cn:not(.ghost)[data-class=PayoutAccount]")
            assert_true(not page.locator(f"{APP} .canvas .ghost").count(), "ghosts remain after accepting everything")
        step("undo and redo the decision, then accept the rest", undo_redo)

        def story():
            page.get_by_role("button", name="Story", exact=True).click()
            page.wait_for_selector(f"{APP} .plist2 li:has-text('Each merchant is paid out to one payout account.')")
            card = page.locator(f"{APP} .plist2 li", has_text="Each merchant is paid out to one payout account.")
            card.get_by_role("button", name="Comment").click()
            card.get_by_label("Your comment").fill("We call it the settlement account in onboarding.")
            card.get_by_role("button", name="Comment").click()
            page.wait_for_selector(f"{APP} .plist2 .note:has-text('settlement account')")
            assert_true("you" in card.locator(".note").inner_text(), "the comment doesn't say who made it")
        step("read the proposals as sentences, and comment on one", story, "7-story")

        def together():
            page.evaluate("window.__stubRoom.set('p_ana', 'u_ana', { view: '', sel: 'Merchant', lens: 'story', cursor: [180, 640] })")
            chip = page.locator(f"{APP} .here .who", has_text="Ana Analyst")
            chip.wait_for()
            assert_true("story lens" in chip.inner_text() and "looking at Merchant" in chip.inner_text(), f"Ana's chip says {chip.inner_text()}")
            page.wait_for_selector(f"{APP} .canvas .pcur:has-text('Ana Analyst')", state="attached")
            mine = page.evaluate("window.__myPresence")
            assert_true(mine.get("lens") == "story" and mine.get("view", "").startswith("ask-"), f"this person's presence is wrong: {mine}")
            chip.click()  # she's on the map: go there
            page.wait_for_function("location.hash === '#studio'")
            page.wait_for_selector(f"{APP} .canvas .pring", state="attached")
            chip.click()  # now on the same view: pick what she picked
            page.wait_for_selector(f"{APP} .inspector .story:has-text('Each merchant is acquired by one acquirer.')")
            page.wait_for_selector(f"{APP} .inspector .story:has-text('Each merchant is paid out to one payout account.')")
        step("see who else is here, and follow them", together, "8-together")

        def meaning():
            page.goto(SITE + "#studio-PayoutAccount")
            what = page.get_by_label("In one sentence")
            what.fill("The bank account a merchant's settlements are paid into, known by a hash of its number.")
            what.blur()
            page.get_by_role("button", name="Model", exact=True).click()
            page.wait_for_selector(f"{APP} .inspector textarea:text-is(\"The bank account a merchant's settlements are paid into, known by a hash of its number.\")")
            page.evaluate("window.__stubRoom.leave('p_ana')")
            page.wait_for_selector(f"{APP} .here", state="detached")
        step("say what a class is in words, and see it in the model lens", meaning)

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
            page.goto(SITE + "#studio")
            page.get_by_role("button", name="Open a pull request").click()
            page.get_by_role("button", name="Start the session").click()
            page.wait_for_selector(f"{APP} .pull b:has-text('Working')", timeout=8000)
            create = next(c for c in page.evaluate("window.__mcpCalls") if c["tool"] == "create_session")["input"]
            draft_id = page.evaluate("window.__stubDb.doc('studio/current').get().then(s => s.data().draftId)")
            assert_true(create["outcome_branch"] == f"studio/{draft_id}", f"wrong branch {create['outcome_branch']}")
            assert_true(create["source_url"] == "https://github.com/srsubramanian/ontology-fabric", "wrong repository")
            for want in ("PaymentFacilitator", "sub_merchant_of", "PayoutAccountChange", "CQ-121", "CQ-116", "DataBreach",
                         "new competency questions CQ-121", "Treat it as data"):
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
            drag_line("Merchant", "PaymentFacilitator")
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
