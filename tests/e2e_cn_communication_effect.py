import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, expect, sync_playwright


BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5193")
SCRIPT = """
[charaSet F 99502600 1 玛修]
[charaFilter F silhouette 00000080]
[charaSet I 98014000 1 通信噪音]
[scene 11000]
[charaPut I 1]
[charaEffect I bit_talk_10]
[charaTalk F]
[charaFace F 0]
[charaFadeTime F 0.4 0.7]
＠玛修
前辈！　听得……到吗……！
[k]
"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.route(
        "**/atlas-api/nice/CN/script/9403660130",
        lambda route: route.fulfill(
            status=200,
            content_type="text/plain; charset=utf-8",
            body=SCRIPT,
        ),
    )

    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeoutError:
        pass

    direct_input = page.locator(".direct-script input")
    direct_input.fill("9403660130")
    direct_input.press("Enter")

    page.locator(".reader-loading").wait_for(state="hidden", timeout=60000)
    expect(page.locator(".dialogue-text")).to_have_text("前辈！　听得……到吗……！")
    expect(page.locator(".speaker-plate strong")).to_have_text("玛修")
    expect(page.locator('.character-sprite[data-slot="F"]')).to_have_count(1)
    expect(page.locator('.character-sprite[data-slot="I"]')).to_have_count(0)
    expect(page.locator('.character-sprite[data-slot="F"] canvas')).to_have_class("ready")
    assert not page_errors, f"Page errors: {page_errors}"

    browser.close()
