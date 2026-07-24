from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5191"

BASIC_WARS = [
    {
        "id": 1,
        "age": "AD.2026",
        "name": "测试章节",
        "longName": "下一段剧情测试",
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
    "warLongName": "下一段剧情测试",
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
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.add_init_script(
        "localStorage.clear(); "
        "localStorage.setItem('fgo-reader-settings', JSON.stringify({reduceMotion: true}));"
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
            body="＠测试终端\n第一段剧情结束。[k]",
            content_type="text/plain; charset=utf-8",
            headers={"access-control-allow-origin": "*"},
        ),
    )
    page.route(
        "https://example.test/1000000002.txt",
        lambda route: route.fulfill(
            body="＠测试终端\n第二段剧情开始。[k]",
            content_type="text/plain; charset=utf-8",
            headers={"access-control-allow-origin": "*"},
        ),
    )
    page.route(
        "**/atlas-api/nice/CN/script/1000000001",
        lambda route: route.fulfill(
            body="＠测试终端\n第一段剧情结束。[k]",
            content_type="text/plain; charset=utf-8",
        ),
    )
    page.route(
        "**/atlas-api/nice/CN/script/1000000002",
        lambda route: route.fulfill(
            body="＠测试终端\n第二段剧情开始。[k]",
            content_type="text/plain; charset=utf-8",
        ),
    )

    page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
    page.get_by_role("button", name="开始观测").click()
    loader = page.locator(".reader-loading")
    loader.wait_for(state="hidden", timeout=10000)
    page.locator(".dialogue-box").wait_for(timeout=5000)

    page.keyboard.press("Space")
    next_button = page.get_by_role("button", name="开始下一段剧情")
    next_button.wait_for(timeout=5000)
    assert "连续观测记录" in page.locator(".completion-panel p").text_content()

    next_button.click()
    loader.wait_for(state="hidden", timeout=10000)
    page.locator(".dialogue-box").wait_for(timeout=5000)
    assert page.locator(".dialogue-text").text_content() == "第二段剧情开始。"
    assert page.locator(".dialogue-meta span").first.text_content() == "LOG 001"

    progress_keys = page.evaluate(
        "Object.keys(localStorage).filter(key => key.startsWith('fgo-reader-progress:')).sort()"
    )
    assert progress_keys == [
        "fgo-reader-progress:v4:1000000001",
        "fgo-reader-progress:v4:1000000002",
    ]

    page.keyboard.press("Space")
    page.get_by_text("当前播放队列已结束。", exact=False).wait_for(timeout=5000)
    assert next_button.count() == 0
    assert not page_errors, f"Page errors: {page_errors}"
    browser.close()
