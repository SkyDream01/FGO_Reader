from __future__ import annotations

from base64 import b64decode
from pathlib import Path
import time

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5192"
SCREENSHOT = Path(__file__).resolve().parents[1] / "screenshots" / "story-preload.png"
PIXEL_PNG = b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/"
    "P7L5WQAAAABJRU5ErkJggg=="
)

BASIC_WARS = [
    {
        "id": 1,
        "age": "AD.2026",
        "name": "预载测试",
        "longName": "剧情资源预载测试",
        "flags": ["mainScenario"],
        "eventId": 0,
        "eventName": "",
    }
]

QUEST = {
    "id": 101,
    "name": "资源准备记录",
    "type": "main",
    "spotName": "测试地点",
    "warId": 1,
    "warLongName": "剧情资源预载测试",
    "chapterId": 1,
    "chapterSubId": 0,
    "chapterSubStr": "",
    "phases": [1],
    "phaseScripts": [
        {
            "phase": 1,
            "scripts": [
                {
                    "scriptId": "1000000001",
                    "script": "https://example.test/preload-story.txt",
                }
            ],
        }
    ],
    "priority": 1,
}

WAR_DETAIL = {
    **BASIC_WARS[0],
    "spots": [{"id": 1, "name": "测试地点", "quests": [QUEST]}],
}

SCRIPT = """
[scene 42]
[charaSet A 1001 0 预载角色]
[charaPut A 1]
＠A：预载角色
资源准备完成后才会看到这句话。
[k]
""".strip()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    page_errors: list[str] = []
    completed_assets: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.add_init_script(
        "localStorage.clear();"
        "localStorage.setItem('fgo-reader-settings', JSON.stringify({reduceMotion:true}));"
    )

    page.route(
        "https://api.atlasacademy.io/export/CN/basic_war.json",
        lambda route: route.fulfill(
            json=BASIC_WARS,
            headers={"access-control-allow-origin": "*"},
        ),
    )
    page.route(
        "**/atlas-api/nice/CN/war/1",
        lambda route: route.fulfill(json=WAR_DETAIL),
    )
    page.route(
        "https://example.test/preload-story.txt",
        lambda route: route.fulfill(
            body=SCRIPT,
            content_type="text/plain; charset=utf-8",
            headers={"access-control-allow-origin": "*"},
        ),
    )
    page.route(
        "**/atlas-api/raw/CN/svtScript?charaId=1001",
        lambda route: route.fulfill(json=[]),
    )

    def fulfill_asset(route):
        time.sleep(0.3)
        completed_assets.append(route.request.url)
        route.fulfill(
            body=PIXEL_PNG,
            content_type="image/png",
            headers={"access-control-allow-origin": "*"},
        )

    page.route("https://static.atlasacademy.io/CN/Back/back42.png", fulfill_asset)
    page.route(
        "https://static.atlasacademy.io/CN/CharaFigure/1001/1001_merged.png",
        fulfill_asset,
    )
    page.route(
        "https://static.atlasacademy.io/CN/CharaFigure/1001/1001.png",
        fulfill_asset,
    )

    page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
    page.get_by_role("button", name="开始观测").click()
    page.locator(".reader-loading").wait_for(timeout=5000)
    assert page.locator(".dialogue-box").count() == 0
    SCREENSHOT.parent.mkdir(exist_ok=True)
    page.screenshot(path=SCREENSHOT, full_page=True)

    page.locator(".reader-loading").wait_for(state="hidden", timeout=15000)
    page.get_by_text("资源准备完成后才会看到这句话。", exact=True).wait_for(
        timeout=5000
    )

    assert any("/Back/back42.png" in url for url in completed_assets)
    assert any("1001_merged.png" in url for url in completed_assets)
    assert any("/1001.png" in url for url in completed_assets)
    assert not page_errors, f"Page errors: {page_errors}"
    browser.close()
