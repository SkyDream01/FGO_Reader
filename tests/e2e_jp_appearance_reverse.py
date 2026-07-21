import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5190")
SCRIPT = """
[charaSet B 1098341100 16 オルガマリー]
[charaSet A 1098330800 7 マシュ]
[charaSet C 8001900 21 マシュ]
[charaSet E 1098341100 25 オルガマリー]
[charaFadein B 0.1 -200,-50]
[charaPut A 200,0]
[charaSpecialEffect A appearanceReverse 1 0.25]
[charaFadein C 0.5 250,-50]
[charaFadein E 0.5 -175,-115]
＠C：マシュ
突然の乱入、失礼します！
[k]
"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.route(
        "**/atlas-api/nice/JP/script/0400070210",
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

    page.locator(".region-select select").select_option("JP")
    direct_input = page.locator(".direct-script input")
    direct_input.fill("0400070210")
    direct_input.press("Enter")

    page.locator(".reader-loading").wait_for(state="hidden", timeout=60000)
    page.locator(".dialogue-box").wait_for(timeout=15000)

    slots = page.locator(".character-sprite").evaluate_all(
        "elements => elements.map(element => element.dataset.slot)"
    )
    assert slots == ["B", "C", "E"]
    assert page.locator('.character-sprite[data-slot="A"]').count() == 0
    assert page.locator('.character-sprite[data-slot="C"]').count() == 1
    assert not page_errors, f"Page errors: {page_errors}"

    browser.close()
