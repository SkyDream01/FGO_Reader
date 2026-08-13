from pathlib import Path
import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "screenshots"
SCREENSHOTS.mkdir(exist_ok=True)
BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5189")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 2048, "height": 1152})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PlaywrightTimeoutError:
        pass

    page.locator(".region-select select").select_option("JP")
    page.evaluate(
        "localStorage.setItem('fgo-reader-settings', JSON.stringify({reduceMotion: true}))"
    )
    direct_input = page.locator(".direct-script input")
    direct_input.fill("0500010010")
    direct_input.press("Enter")

    page.locator(".reader-loading").wait_for(state="hidden", timeout=60000)
    page.locator(".dialogue-box").wait_for(timeout=15000)
    sprite_container = page.locator(".character-sprite")
    sprite = sprite_container.locator("img, canvas")
    for _ in range(80):
        speaker = page.locator(".speaker-plate strong")
        if sprite_container.count() == 1 and speaker.count() == 1 and speaker.text_content() == "マシュ":
            break
        choice = page.locator(".choice-menu button").first
        if choice.count() == 1 and choice.is_visible():
            choice.click()
        else:
            page.keyboard.press("Space")
        page.wait_for_timeout(30)
    sprite.wait_for(timeout=30000)
    page.wait_for_function(
        """(() => {
          const figure = document.querySelector('.character-sprite img, .character-sprite canvas');
          return figure instanceof HTMLCanvasElement
            ? figure.classList.contains('ready')
            : Boolean(figure?.complete && figure.naturalWidth > 0);
        })()""",
        timeout=30000,
    )
    page.wait_for_timeout(50)

    assert page.locator(".speaker-plate strong").text_content() == "マシュ"
    assert sprite_container.count() == 1
    stage_box = page.locator(".reader-stage").bounding_box()
    sprite_box = sprite_container.bounding_box()
    assert stage_box is not None and sprite_box is not None
    expected_size = stage_box["height"] * 1024 / 576 * 0.9
    assert abs(sprite_box["width"] - expected_size) < 0.5
    assert abs(sprite_box["height"] - expected_size) < 0.5
    expected_top = stage_box["height"] - expected_size * 0.75
    assert abs(sprite_box["y"] - expected_top) < 0.5
    assert sprite.evaluate("element => getComputedStyle(element).objectFit") == "contain"

    page.screenshot(path=str(SCREENSHOTS / "jp-prologue-fixed.png"), full_page=True)
    assert not page_errors, f"Page errors: {page_errors}"
    browser.close()
