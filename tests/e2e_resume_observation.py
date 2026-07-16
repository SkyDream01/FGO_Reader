from pathlib import Path
import os
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "screenshots"
SCREENSHOTS.mkdir(exist_ok=True)
BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5192")

BASIC_WARS = [
    {
        "id": 1,
        "age": "AD.2026",
        "name": "测试章节",
        "longName": "继续观测测试",
        "flags": ["mainScenario"],
        "eventId": 0,
        "eventName": "",
    }
]

QUEST = {
    "id": 101,
    "name": "连续观测记录",
    "type": "main",
    "spotName": "测试地点",
    "warId": 1,
    "warLongName": "继续观测测试",
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
                    "script": "https://example.test/1000000001.txt",
                },
                {
                    "scriptId": "1000000002",
                    "script": "https://example.test/1000000002.txt",
                },
            ],
        }
    ],
    "priority": 1,
}

WAR_DETAIL = {
    **BASIC_WARS[0],
    "spots": [{"id": 1, "name": "测试地点", "quests": [QUEST]}],
}


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1180, "height": 900})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.add_init_script(
        "if (!sessionStorage.getItem('resume-e2e-initialized')) {"
        "  localStorage.clear();"
        "  localStorage.setItem('fgo-reader-settings', JSON.stringify({reduceMotion: true}));"
        "  sessionStorage.setItem('resume-e2e-initialized', '1');"
        "}"
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
        "https://example.test/1000000001.txt",
        lambda route: route.fulfill(
            body="＠测试终端\n第一条记录。[k]\n＠测试终端\n第二条记录。[k]",
            content_type="text/plain; charset=utf-8",
            headers={"access-control-allow-origin": "*"},
        ),
    )
    page.route(
        "https://example.test/1000000002.txt",
        lambda route: route.fulfill(
            body="＠测试终端\n下一段记录。[k]",
            content_type="text/plain; charset=utf-8",
            headers={"access-control-allow-origin": "*"},
        ),
    )

    page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
    page.get_by_text("暂无可继续的记录", exact=True).wait_for(timeout=5000)
    page.get_by_role("button", name="开始观测").click()
    page.wait_for_function(
        "JSON.parse(localStorage.getItem('fgo-reader-last-observation')).frameIndex === 0"
    )
    page.locator(".reader-loading").wait_for(state="hidden", timeout=10000)
    page.locator(".dialogue-box").wait_for(timeout=5000)

    page.keyboard.press("Space")
    page.wait_for_function(
        "JSON.parse(localStorage.getItem('fgo-reader-last-observation')).frameIndex === 1"
    )
    assert page.locator(".dialogue-text").text_content() == "第二条记录。"
    assert page.locator(".dialogue-meta span").first.text_content() == "LOG 002"
    assert page.evaluate("localStorage.getItem('fgo-reader-bookmark')") is None

    page.locator(".reader-title-block .round-tool").click()
    page.get_by_text("观测目录", exact=True).wait_for(timeout=5000)
    page.get_by_text("继续上次观测", exact=True).wait_for(timeout=5000)
    page.locator(".quest-row").first.wait_for(timeout=5000)
    restart_button = page.get_by_role("button", name="重新观测")
    continue_button = page.get_by_role("button", name="继续观测")
    restart_button.wait_for(timeout=5000)
    assert restart_button.bounding_box()["x"] < continue_button.bounding_box()["x"]

    page.set_viewport_size({"width": 2400, "height": 1200})
    launch_actions = page.locator(".launch-actions")
    desktop_buttons = launch_actions.locator(".launch-button")
    desktop_boxes = [
        desktop_buttons.nth(index).bounding_box()
        for index in range(desktop_buttons.count())
    ]
    assert all(box and box["height"] <= 80 for box in desktop_boxes)
    assert all(
        item.is_visible()
        for item in launch_actions.locator(".launch-action-copy strong, .launch-action-copy small").all()
    )
    launch_actions.screenshot(path=str(SCREENSHOTS / "launch-actions-desktop.png"))
    page.set_viewport_size({"width": 1180, "height": 900})

    page.reload(wait_until="networkidle", timeout=30000)
    continue_card = page.locator(".resume-card").filter(has_text="继续上次观测")
    continue_card.wait_for(timeout=5000)
    tablet_boxes = [
        page.locator(selector).bounding_box()
        for selector in (
            ".launch-overview",
            ".selected-record",
            ".script-stack",
            ".launch-actions",
        )
    ]
    assert all(tablet_boxes)
    assert [box["x"] for box in tablet_boxes] == sorted(
        box["x"] for box in tablet_boxes
    )
    continue_card.click()
    page.locator(".reader-loading").wait_for(state="hidden", timeout=10000)
    assert page.locator(".dialogue-text").text_content() == "第二条记录。"
    assert page.locator(".dialogue-meta span").first.text_content() == "LOG 002"

    page.keyboard.press("KeyB")
    page.get_by_text("已保存当前位置", exact=True).wait_for(timeout=5000)
    page.keyboard.press("Space")
    page.locator(".completion-panel").wait_for(timeout=5000)
    page.wait_for_function(
        "JSON.parse(localStorage.getItem('fgo-reader-last-observation')).scriptId === '1000000002'"
    )
    page.locator(".completion-panel").get_by_role("button", name="返回目录").click()

    page.get_by_text("继续上次观测", exact=True).wait_for(timeout=5000)
    page.get_by_text("读取手动书签", exact=True).wait_for(timeout=5000)
    assert page.locator(".resume-card").count() == 2
    page.locator(".resume-card").filter(has_text="继续上次观测").click()
    page.locator(".reader-loading").wait_for(state="hidden", timeout=10000)
    assert page.locator(".dialogue-text").text_content() == "下一段记录。"
    assert page.locator(".dialogue-meta span").first.text_content() == "LOG 001"

    page.keyboard.press("Space")
    page.locator(".completion-panel").wait_for(timeout=5000)
    page.wait_for_function(
        "localStorage.getItem('fgo-reader-last-observation') === null"
    )
    page.locator(".completion-panel").get_by_role("button", name="返回目录").click()
    page.get_by_text("读取手动书签", exact=True).wait_for(timeout=5000)
    assert page.get_by_text("继续上次观测", exact=True).count() == 0
    assert page.evaluate(
        "JSON.parse(localStorage.getItem('fgo-reader-bookmark')).scriptId"
    ) == "1000000001"

    restart_button = page.get_by_role("button", name="重新观测")
    continue_button = page.get_by_role("button", name="继续观测")
    restart_button.wait_for(timeout=5000)
    assert restart_button.bounding_box()["x"] < continue_button.bounding_box()["x"]
    restart_button.click()
    page.locator(".reader-loading").wait_for(state="hidden", timeout=10000)
    assert page.locator(".dialogue-text").text_content() == "第一条记录。"
    assert page.locator(".dialogue-meta span").first.text_content() == "LOG 001"
    page.wait_for_function(
        "JSON.parse(localStorage.getItem('fgo-reader-last-observation')).frameIndex === 0"
    )

    page.screenshot(path=str(SCREENSHOTS / "resume-observation.png"), full_page=True)
    assert not page_errors, f"Page errors: {page_errors}"
    browser.close()
