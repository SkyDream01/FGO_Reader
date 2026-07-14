from pathlib import Path
import os
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "screenshots"
SCREENSHOTS.mkdir(exist_ok=True)
BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5187")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
    console_errors = []
    page_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeoutError:
        # Atlas uses several independent CDN requests; key UI/resource waits below
        # are the authoritative readiness checks when a connection stays open.
        pass
    page.get_by_text("观测目录", exact=True).wait_for(timeout=15000)
    page.locator(".quest-row").first.wait_for(timeout=60000)
    assert page.locator(".war-row").count() > 5
    assert page.locator(".quest-row").count() > 0
    page.screenshot(path=str(SCREENSHOTS / "library.png"), full_page=True)

    launch = page.get_by_role("button", name="开始观测")
    assert launch.is_enabled()
    launch.click()
    page.locator(".reader-loading").wait_for(state="hidden", timeout=60000)
    page.locator(".dialogue-box").wait_for(timeout=15000)
    page.screenshot(path=str(SCREENSHOTS / "reader.png"), full_page=True)

    before = page.locator(".dialogue-meta span").first.text_content()
    page.keyboard.press("Space")
    page.wait_for_timeout(120)
    first_text = page.locator(".dialogue-text").text_content() or ""
    assert first_text.strip()
    page.keyboard.press("Space")
    page.wait_for_timeout(320)
    after = page.locator(".dialogue-meta span").first.text_content()
    assert before != after

    page.keyboard.press("KeyL")
    page.locator(".log-panel").wait_for(timeout=5000)
    assert page.get_by_text("历史记录", exact=True).is_visible()
    page.keyboard.press("Escape")
    page.locator(".log-panel").wait_for(state="hidden", timeout=5000)

    page.keyboard.press("Shift+/")
    page.locator(".shortcuts-panel").wait_for(timeout=5000)
    assert page.get_by_text("PC 快捷键", exact=True).is_visible()
    page.keyboard.press("Escape")

    page.keyboard.press("KeyH")
    page.locator(".restore-ui").wait_for(timeout=5000)
    page.keyboard.press("KeyH")
    page.locator(".dialogue-wrap").wait_for(timeout=5000)

    page.keyboard.press("KeyB")
    page.get_by_text("已保存当前位置", exact=True).wait_for(timeout=5000)

    page.locator(".reader-title-block .round-tool").click()
    page.get_by_text("观测目录", exact=True).wait_for(timeout=10000)
    page.evaluate("localStorage.setItem('fgo-reader-progress:9406491510', '2')")
    direct_input = page.locator(".direct-script input")
    direct_input.fill("9406491510")
    direct_input.press("Enter")
    page.locator(".reader-loading").wait_for(state="hidden", timeout=60000)
    page.locator(".dialogue-box").wait_for(timeout=15000)
    assert page.locator(".load-note").count() == 0
    page.locator(".scene-image").wait_for(timeout=15000)
    page.wait_for_function(
        "document.querySelector('.scene-image')?.complete && document.querySelector('.scene-image')?.naturalWidth > 0",
        timeout=30000,
    )
    page.screenshot(path=str(SCREENSHOTS / "reader-direct.png"), full_page=True)

    assert not page_errors, f"Page errors: {page_errors}"
    unexpected_console_errors = [
        message
        for message in console_errors
        if "Failed to load resource" not in message
        and "net::ERR_" not in message
    ]
    assert not unexpected_console_errors, f"Console errors: {unexpected_console_errors}"
    browser.close()
