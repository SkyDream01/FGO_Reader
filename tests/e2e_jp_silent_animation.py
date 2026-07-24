import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5190")
SCRIPT = """
[charaSet A 8001900 1 マシュ]
[charaSet F 1098154000 1 空想樹の種子]
[charaSet G 1098154000 1 空想樹の種子]
[charaFadein A 0.1 1]
[charaLayer F sub #A]
[charaLayer G sub #A]
[charaFadein F 0.1 -350,250]
[charaFadein G 0.1 150,250]
[subRenderFadein #A 0.3 -50,-360]
[wt 1.0]
[subRenderFadeout #A 0.4]
[wt 0.5]
＠A：マシュ
空想樹の種子を確認しました。
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
    animation_button = page.get_by_role("button", name="继续演出")
    animation_button.wait_for(timeout=15000)

    slots = page.locator(".character-sprite").evaluate_all(
        "elements => elements.map(element => element.dataset.slot)"
    )
    assert slots == ["A", "F", "G"]
    assert page.locator(
        '.character-sprite[data-slot="F"] canvas, .character-sprite[data-slot="F"] img'
    ).count() == 1
    assert page.locator(".dialogue-box").count() == 0

    animation_button.click()
    assert page.locator(".character-sprite").evaluate_all(
        "elements => elements.map(element => element.dataset.slot)"
    ) == ["A"]

    animation_button.click()
    page.locator(".dialogue-box").wait_for(timeout=5000)
    page.wait_for_function(
        '() => document.querySelector(".dialogue-text")?.textContent'
        ' === "空想樹の種子を確認しました。"',
        timeout=5000,
    )
    assert page.locator(".dialogue-text").text_content() == "空想樹の種子を確認しました。"
    assert not page_errors, f"Page errors: {page_errors}"

    browser.close()
