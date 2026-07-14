import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5190")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 2048, "height": 1114})
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
    direct_input.fill("0500010211")
    direct_input.press("Enter")

    page.locator(".reader-loading").wait_for(state="hidden", timeout=60000)
    scene = page.locator(".scene-image")
    scene.wait_for(timeout=30000)
    page.wait_for_function(
        "document.querySelector('.scene-image')?.complete && "
        "document.querySelector('.scene-image')?.naturalWidth > 0",
        timeout=30000,
    )

    stage_box = page.locator(".reader-stage").bounding_box()
    assert stage_box is not None
    assert stage_box["x"] == 0 and stage_box["y"] == 0
    assert stage_box["width"] == 2048 and stage_box["height"] == 1114
    assert scene.evaluate("image => getComputedStyle(image).objectFit") == "contain"
    assert not page_errors, f"Page errors: {page_errors}"
    browser.close()
