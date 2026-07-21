import base64
import os

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5191")
SCRIPT = """
[scene 10201]
[fadein black 0.5]
[scene 10202]
＠旁白
第二张图片有正文。
[k]
"""
PIXEL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.route(
        "**/atlas-api/nice/JP/script/0400000000",
        lambda route: route.fulfill(
            status=200,
            content_type="text/plain; charset=utf-8",
            body=SCRIPT,
        ),
    )
    page.route(
        "https://static.atlasacademy.io/JP/Back/back*.png",
        lambda route: route.fulfill(status=200, content_type="image/png", body=PIXEL),
    )

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
    direct_input.fill("0400000000")
    direct_input.press("Enter")

    page.locator(".reader-loading").wait_for(state="hidden", timeout=60000)
    page.locator(".dialogue-box").wait_for(timeout=15000)

    assert page.locator(".speaker-plate strong").text_content() == "旁白"
    assert page.locator(".dialogue-text").text_content() == ""
    assert page.locator(".advance-indicator").count() == 1
    assert page.locator(".scene-image").get_attribute("src").endswith("back10201.png")

    page.locator(".reader-stage").click(position={"x": 800, "y": 500})
    page.wait_for_function(
        "document.querySelector('.dialogue-text')?.textContent === '第二张图片有正文。'"
    )
    assert page.locator(".scene-image").get_attribute("src").endswith("back10202.png")
    assert not page_errors, f"Page errors: {page_errors}"

    browser.close()
