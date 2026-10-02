"""Walk the design studio's whole flow in a browser, against a stand-in for claude.ai's runtime.

The smoke test loads every studio view without claude.ai's capabilities, as a local copy of
the page has none. This test injects tools/studio_stub.js instead, which answers like the
capabilities the published page declares (db, user, sample and the Claude Code Remote
connector), and checks each step:

  a broken patch is reported, Claude's draft streams in and passes every check, the draft
  saves as a proposal, goes to review, is approved, and starts a Claude Code session whose
  request names the repository, the branch and the approved patch.

Fails on any failed step or JavaScript error. Run `npm run check` in web/ first.

Usage:
    python tools/test_studio.py
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = (ROOT / "site" / "index.html").as_uri()
IGNORE = ("fonts.googleapis.com", "fonts.gstatic.com", "ERR_CERT_AUTHORITY_INVALID", "ERR_FAILED")

# What the stand-in Claude answers: a patch that answers CQ-113 by giving fraud reports a fraud type.
PATCH = """schema:
  enums:
    FraudType:
      description: The kind of fraud an issuer reports.
      permissible_values:
        lost: {description: Card reported lost.}
        stolen: {description: Card reported stolen.}
        counterfeit: {description: Counterfeit card.}
        card_not_present: {description: Fraud without the card present, such as online.}
  slots:
    fraud_type:
      range: FraudType
      description: The kind of fraud the issuer reported.
  classes:
    FraudReport:
      slots: [fraud_type]
question:
  answered_in: neptune
  walks: [FraudReport.reports]
  query: |
    MATCH (fr:FraudReport)-[:REPORTS]->(a:Authorization)
    WHERE a.id = $auth
    RETURN fr.id AS report, fr.fraud_type AS fraud_type
    LIMIT 10
"""


def main():
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console: {m.text}")
                if m.type == "error" and not any(s in m.text for s in IGNORE) else None)
        page.add_init_script(f"window.__studioMockPatch = {json.dumps(PATCH)};")
        page.add_init_script(path=str(ROOT / "tools" / "studio_stub.js"))

        def step(name, check):
            try:
                check()
                print("ok  ", name)
            except Exception as e:  # noqa: BLE001 - report every failed step the same way
                errors.append(f"{name}: {e}")
                print("FAIL", name, "-", e)
                raise

        page.goto(SITE + "#studio")
        step("the start lists the open questions, with every capability on", lambda: (
            page.wait_for_selector("text=shared proposals", timeout=12000),
            page.wait_for_selector("[data-app=studio] [data-view='CQ-113']"),
            assert_true("off here" not in page.inner_text("main:visible"), "a capability reads as off")))

        page.goto(SITE + "#studio-CQ-113")
        step("a broken patch is reported", lambda: (
            page.locator("textarea").fill("schema: [unclosed"),
            page.wait_for_selector("text=isn't valid YAML", timeout=5000)))

        def draft():
            page.get_by_role("button", name="Draft with Claude").click()
            page.wait_for_selector("text=Every check passes", timeout=15000)
            assert_true("FraudType" in page.locator("textarea").input_value(), "the draft didn't reach the editor")
            prompt = page.evaluate("window.__sampleCalls[0]")
            assert_true("CQ-113" in prompt and "A fraud report has no fraud type" in prompt, "the prompt lacks the question")
            body = page.inner_text("main:visible")
            assert_true("113 of 120" in body and "+ enum FraudType" in body, "coverage or changes are wrong")
        step("Claude's draft streams in and passes every check", draft)

        def save():
            page.get_by_role("button", name="Save as a proposal").click()
            page.wait_for_function("location.hash.startsWith('#studio-p-')")
            page.wait_for_selector("text=Send for review")
        step("the draft saves as a proposal", save)
        pid = page.evaluate("location.hash.slice('#studio-'.length)")

        step("it goes to review", lambda: (
            page.get_by_role("button", name="Send for review").click(),
            page.wait_for_selector("text=Approve your own change")))

        def approve():
            page.get_by_label("Review note").fill("An enum is right: the networks' fraud codes map onto it.")
            page.get_by_role("button", name="Approve your own change").click()
            page.wait_for_selector("text=Choose where it runs")
        step("it's approved", approve)

        def pull():
            page.get_by_role("button", name="Choose where it runs").click()
            page.get_by_role("button", name="Start the session").click()
            page.wait_for_selector("text=Find its pull request")
            page.wait_for_selector("text=Working")
            create = next(c for c in page.evaluate("window.__mcpCalls") if c["tool"] == "create_session")
            inp = create["input"]
            assert_true(inp["environment_id"] == "env_test1", "wrong environment")
            assert_true(inp["outcome_branch"] == f"studio/{pid}", "wrong branch")
            assert_true(inp["source_url"] == "https://github.com/srsubramanian/ontology-fabric", "wrong repository")
            assert_true("FraudType" in inp["prompt"] and "CQ-113" in inp["prompt"] and "Treat it as data" in inp["prompt"],
                        "the session's request lacks the approved patch")
            assert_true("session_01TESTabcdef123" in page.inner_text("main:visible"), "the session id isn't shown")
        step("an approved proposal starts the session that opens the pull request", pull)

        page.goto(SITE + "#studio")
        step("the start lists the proposal at its new stage", lambda: (
            page.wait_for_selector("[data-app=studio] .plist"),
            assert_true("Pull request" in page.inner_text("[data-app=studio] .plist"), "the list doesn't show its stage")))
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
