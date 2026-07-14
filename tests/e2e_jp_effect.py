from pathlib import Path
import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "screenshots"
SCREENSHOTS.mkdir(exist_ok=True)
BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5188")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeoutError:
        pass

    page.locator(".region-select select").select_option("JP")
    direct_input = page.locator(".direct-script input")
    direct_input.fill("0400069110")
    direct_input.press("Enter")

    page.locator(".reader-loading").wait_for(state="hidden", timeout=60000)
    page.locator(".dialogue-box").wait_for(timeout=15000)

    assert page.locator(".speaker-plate strong").text_content() == "伯爵"
    assert page.locator(".character-sprite").count() == 0
    assert not page_errors, f"Page errors: {page_errors}"

    page.screenshot(path=str(SCREENSHOTS / "jp-effect-fixed.png"), full_page=True)
    browser.close()
