import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5191")
SCRIPT = """
[charaSet B 1098341100 1 Olga]
[charaSet D 1098341100 3 Olga]
[sceneSet J 269400 1]
[charaDepth D 6]
[charaDepth J 4]
[charaDepth B 2]
[charaFadein D 0.4 -250,0]
[charaFadein J 0.4 -150,-300]
[charaFadein B 0.1 1]
＠D：Olga
Foreground only.
[k]
[charaFadeout D 0.4]
[charaFadeout J 0.4]
＠B：Olga
Revealed after the scene layer exits.
[k]
"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.route(
        "**/atlas-api/nice/JP/script/0400070211",
        lambda route: route.fulfill(
            status=200,
            content_type="text/plain; charset=utf-8",
            body=SCRIPT,
        ),
    )

    page.goto(BASE_URL, wait_until="commit", timeout=60000)
    page.locator(".region-select select").wait_for(timeout=60000)
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeoutError:
        pass

    page.locator(".region-select select").select_option("JP")
    page.evaluate(
        "localStorage.setItem('fgo-reader-settings', JSON.stringify({reduceMotion: true}))"
    )
    direct_input = page.locator(".direct-script input")
    direct_input.fill("0400070211")
    direct_input.press("Enter")

    page.locator(".reader-loading").wait_for(state="hidden", timeout=60000)
    page.locator(".dialogue-box").wait_for(timeout=15000)
    assert page.locator('.character-sprite[data-slot="D"]').count() == 1
    assert page.locator('.character-sprite[data-slot="B"]').count() == 0

    page.keyboard.press("Space")
    page.locator('.character-sprite[data-slot="B"]').wait_for(timeout=5000)
    assert page.locator('.character-sprite[data-slot="D"]').count() == 0
    assert not page_errors, f"Page errors: {page_errors}"

    browser.close()
