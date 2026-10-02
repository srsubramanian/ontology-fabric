"""Load every view of the page in light, dark and on a phone.

The page holds four apps: the overview, the retrieval walkthrough, the class explorer and
the design studio. Each pass visits all their views in one page load, so switching between apps gets tested
too. Fails on JavaScript errors, on any view that scrolls sideways, and on any view that
shows the wrong app. Saves a screenshot of every view in light and dark, so both themes
get looked at (docs/style-guide.md).

Usage:
    pip install -r tools/requirements.txt
    python -m playwright install chromium
    python tools/smoke_test.py            # every app
    python tools/smoke_test.py explorer   # one app: overview, retrieval, explorer or studio
"""
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = pathlib.Path(os.environ.get("SITE_DIR", ROOT / "site"))
SHOTS = ROOT / "screenshots"
IGNORE = ("fonts.googleapis.com", "fonts.gstatic.com", "ERR_FAILED")
APPS = ["overview", "retrieval", "explorer", "studio"]

# Each pass: a name, the viewport, the colour scheme, where screenshots go (None: no
# screenshots) and how long to let each view's animation run before looking.
PASSES = [
    ("light", {"width": 1280, "height": 900}, "light", "", 1200),
    ("dark", {"width": 1280, "height": 900}, "dark", "dark", 900),
    ("phone", {"width": 390, "height": 844}, "light", None, 600),
]


def views_for(page, url, app):
    """Discover the views an app offers, as (hash route, screenshot name) pairs."""
    if app == "overview":
        page.goto(url + "#map")
        routes = [("#map", "map")]
        for ch in page.evaluate("[...document.querySelectorAll('section.chapter')].map(s => s.id)"):
            tabs = page.evaluate(f"document.querySelectorAll('#{ch} .subtab').length")
            routes += [(f"#{ch}-{k}", f"{ch}-{k}") for k in range(1, tabs + 1)]
        return routes
    page.goto(url + "#" + app)
    page.wait_for_timeout(300)
    inside = f"[data-app={app}]"
    if app == "explorer":
        # The map, then each class and each competency question selected.
        views = page.evaluate(f"[...document.querySelectorAll('{inside} [data-class], {inside} [data-question]')]"
                              ".map(e => e.dataset.class || e.dataset.question)")
        views = ["map"] + list(dict.fromkeys(views))
    elif app == "studio":
        # The start, then a draft for each open question and the worked example. Without claude.ai's
        # capabilities, as here, the studio drafts and checks but doesn't save, review or ask Claude.
        views = ["map"] + page.evaluate(f"[...document.querySelectorAll('{inside} [data-view]')].map(e => e.dataset.view)")
    else:
        views = page.evaluate(f"[...document.querySelectorAll('{inside} .view')].map(v => v.id)")
    return [("#" + app if v == "map" else f"#{app}-{v}", v) for v in views]


def visit(pw, apps, label, viewport, scheme, shots, wait):
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

    url = (SITE / "index.html").as_uri()
    page.goto(url)
    page.wait_for_timeout(1500)
    for app in apps:
        if shots is not None:
            (SHOTS / app / shots).mkdir(parents=True, exist_ok=True)
        for route, name in views_for(page, url, app):
            page.goto(url + route)
            page.wait_for_timeout(wait)
            showing = page.evaluate("[...document.querySelectorAll('.fapp')].filter(a => !a.hidden).map(a => a.dataset.app)")
            if showing != [app]:
                errors.append(f"{label}: {route} shows {showing}, not {app}")
            width = page.evaluate("document.documentElement.scrollWidth")
            if width > viewport["width"]:
                errors.append(f"{label}: {route} scrolls sideways, {width}px wide")
            if shots is not None:
                page.screenshot(path=str(SHOTS / app / shots / (name + ".png")), full_page=True)
    browser.close()
    return errors


def main():
    apps = sys.argv[1:] or APPS
    unknown = [a for a in apps if a not in APPS]
    if unknown:
        sys.exit(f"Unknown app: {', '.join(unknown)}. Choose from {', '.join(APPS)}.")
    with sync_playwright() as pw:
        errors = [e for p in PASSES for e in visit(pw, apps, *p)]
    for app in apps:
        print(f"{app}: screenshots in screenshots/{app}/ (dark ones in dark/)")
    print("ok" if not errors else f"{len(errors)} problem(s)")
    for e in errors:
        print("   ", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
