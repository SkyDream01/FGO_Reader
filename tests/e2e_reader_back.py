import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, expect, sync_playwright


BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5192")
SCRIPT = """
＠旁白
第一句。
[k]

？1：继续
＠旁白
分支句。
[k]
？！

＠旁白
最后一句。
[k]
"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.route(
        "**/atlas-api/nice/CN/script/0100009999",
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

    page.evaluate(
        "localStorage.setItem('fgo-reader-settings', JSON.stringify({reduceMotion: true}))"
    )
    direct_input = page.locator(".direct-script input")
    direct_input.fill("0100009999")
    direct_input.press("Enter")

    page.locator(".reader-loading").wait_for(state="hidden", timeout=60000)
    page.locator(".dialogue-box").wait_for(timeout=15000)
    back_button = page.get_by_role("button", name="后退")

    expect(page.locator(".dialogue-text")).to_have_text("第一句。")
    assert back_button.is_disabled()

    page.keyboard.press("Space")
    page.get_by_role("button", name="继续").click()
    expect(page.locator(".dialogue-text")).to_have_text("分支句。")

    back_button.click()
    page.locator(".choice-menu").wait_for(timeout=5000)
    page.get_by_role("button", name="继续").click()
    expect(page.locator(".dialogue-text")).to_have_text("分支句。")

    page.keyboard.press("ArrowLeft")
    page.locator(".choice-menu").wait_for(timeout=5000)
    page.keyboard.press("Space")
    expect(page.locator(".dialogue-text")).to_have_text("分支句。")

    page.keyboard.press("Space")
    expect(page.locator(".dialogue-text")).to_have_text("最后一句。")
    page.keyboard.press("ArrowLeft")
    expect(page.locator(".dialogue-text")).to_have_text("分支句。")

    page.keyboard.press("Space")
    expect(page.locator(".dialogue-text")).to_have_text("最后一句。")
    page.keyboard.press("Space")
    page.locator(".completion-panel").wait_for(timeout=5000)
    page.get_by_role("button", name="返回最后一句").click()
    page.locator(".completion-panel").wait_for(state="hidden", timeout=5000)
    expect(page.locator(".dialogue-text")).to_have_text("最后一句。")
    assert not page_errors, f"Page errors: {page_errors}"

    browser.close()
