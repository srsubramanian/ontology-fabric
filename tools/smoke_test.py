"""Load every view of the learning pages in light, dark and on a phone.

Fails on JavaScript errors, and on any view that scrolls sideways. Saves a screenshot
of every view in light and dark, so both themes get looked at (docs/style-guide.md).

Usage:
    pip install -r tools/requirements.txt
    python -m playwright install chromium
    python tools/smoke_test.py            # all pages
    python tools/smoke_test.py ontology   # one page, by name
"""
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = pathlib.Path(os.environ.get("SITE_DIR", ROOT / "site"))
SHOTS = ROOT / "screenshots"
IGNORE = ("fonts.googleapis.com", "fonts.gstatic.com", "ERR_FAILED")

# Each pass: a name, the viewport, the colour scheme, where screenshots go (None: no
# screenshots) and how long to let each view's animation run before looking.
PASSES = [
    ("light", {"width": 1280, "height": 900}, "light", "", 1200),
    ("dark", {"width": 1280, "height": 900}, "dark", "dark", 900),
    ("phone", {"width": 390, "height": 844}, "light", None, 600),
]


def views_for(page, name):
    """Discover the hash routes a page offers."""
    if name == "platform":
        routes = ["#map"]
        chapters = page.evaluate("[...document.querySelectorAll('section.chapter')].map(s => s.id)")
        for ch in chapters:
            tabs = page.evaluate(f"document.querySelectorAll('#{ch} .subtab').length")
            routes += [f"#{ch}:{k}" for k in range(1, tabs + 1)]
        return routes
    if name == "ontology":
        # The class explorer: the map, then each class and each competency question selected.
        picks = page.evaluate("[...document.querySelectorAll('[data-class], [data-question]')]"
                              ".map(e => e.dataset.class || e.dataset.question)")
        return ["#map"] + ["#" + p for p in dict.fromkeys(picks)]
    return ["#" + v for v in page.evaluate("[...document.querySelectorAll('.view')].map(v => v.id)")]


def visit(pw, name, label, viewport, scheme, shots, wait):
    """Load every view once under one viewport and colour scheme; return the problems found."""
    errors = []
    browser = pw.chromium.launch()
    page = browser.new_page(viewport=viewport, color_scheme=scheme)
    page.on("pageerror", lambda e: errors.append(f"{label}: pageerror: {e}"))

    def on_console(m):
        where = (m.location or {}).get("url", "")
        if m.type == "error" and not any(s in m.text or s in where for s in IGNORE):
            errors.append(f"{label}: console: {m.text} {where}".strip())
    page.on("console", on_console)

    url = (SITE / f"{name}.html").as_uri()
    page.goto(url)
    page.wait_for_timeout(1500)
    if shots is not None:
        (SHOTS / name / shots).mkdir(parents=True, exist_ok=True)
    for route in views_for(page, name):
        page.goto(url + route)
        page.wait_for_timeout(wait)
        width = page.evaluate("document.documentElement.scrollWidth")
        if width > viewport["width"]:
            errors.append(f"{label}: {route} scrolls sideways, {width}px wide")
        if shots is not None:
            path = SHOTS / name / shots / (route.strip("#").replace(":", "_") + ".png")
            page.screenshot(path=str(path), full_page=True)
    browser.close()
    return errors


def main():
    names = sys.argv[1:] or ["platform", "retrieval", "ontology"]
    failed = False
    with sync_playwright() as pw:
        for name in names:
            errors = [e for p in PASSES for e in visit(pw, name, *p)]
            status = "ok" if not errors else f"{len(errors)} problem(s)"
            print(f"{name}: {status}, screenshots in screenshots/{name}/ (dark ones in dark/)")
            for e in errors:
                print("   ", e)
            failed = failed or bool(errors)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
