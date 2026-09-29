"""Load every view of the learning pages, fail on JavaScript errors, save screenshots.

Usage:
    pip install -r tools/requirements.txt
    python -m playwright install chromium
    python tools/smoke_test.py            # all pages
    python tools/smoke_test.py retrieval  # one page, by name
"""
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = pathlib.Path(os.environ.get("SITE_DIR", ROOT / "site"))
SHOTS = ROOT / "screenshots"
IGNORE = ("fonts.googleapis.com", "fonts.gstatic.com", "ERR_FAILED")


def views_for(page, name):
    """Discover the hash routes a page offers."""
    if name == "platform":
        routes = ["#map"]
        chapters = page.evaluate("[...document.querySelectorAll('section.chapter')].map(s => s.id)")
        for ch in chapters:
            tabs = page.evaluate(f"document.querySelectorAll('#{ch} .subtab').length")
            routes += [f"#{ch}:{k}" for k in range(1, tabs + 1)]
        return routes
    return ["#" + v for v in page.evaluate("[...document.querySelectorAll('.view')].map(v => v.id)")]


def check(name, pw):
    errors, shots = [], SHOTS / name
    shots.mkdir(parents=True, exist_ok=True)
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    def on_console(m):
        where = (m.location or {}).get("url", "")
        if m.type == "error" and not any(s in m.text or s in where for s in IGNORE):
            errors.append(f"console: {m.text} {where}".strip())
    page.on("console", on_console)
    url = (SITE / f"{name}.html").as_uri()
    page.goto(url)
    page.wait_for_timeout(1500)
    for route in views_for(page, name):
        page.goto(url + route)
        page.wait_for_timeout(1200)
        page.screenshot(path=str(shots / (route.strip("#").replace(":", "_") + ".png")), full_page=True)
    browser.close()

    browser = pw.chromium.launch()
    phone = browser.new_page(viewport={"width": 390, "height": 844})
    phone.goto(url)
    phone.wait_for_timeout(1200)
    width = phone.evaluate("document.documentElement.scrollWidth")
    browser.close()
    if width > 390:
        errors.append(f"phone layout scrolls sideways: {width}px wide")
    return errors


def main():
    names = sys.argv[1:] or ["platform", "retrieval"]
    failed = False
    with sync_playwright() as pw:
        for name in names:
            errors = check(name, pw)
            status = "ok" if not errors else f"{len(errors)} problem(s)"
            print(f"{name}: {status}, screenshots in screenshots/{name}/")
            for e in errors:
                print("   ", e)
            failed = failed or bool(errors)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
