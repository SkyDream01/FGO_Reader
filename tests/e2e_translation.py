import json
import os

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5192")

BASIC_WARS = [
    {
        "id": 1,
        "age": "AD.2026",
        "name": "翻訳テスト",
        "longName": "日文翻译测试",
        "flags": ["mainScenario"],
        "eventId": 0,
        "eventName": "",
    }
]

QUEST = {
    "id": 101,
    "name": "翻訳テスト",
    "type": "main",
    "spotName": "カルデア",
    "warId": 1,
    "warLongName": "日文翻译测试",
    "chapterId": 1,
    "chapterSubId": 0,
    "chapterSubStr": "",
    "phases": [1],
    "phaseScripts": [
        {
            "phase": 1,
            "scripts": [
                {
                    "scriptId": "1000000099",
                    "script": "https://example.test/translation.txt",
                }
            ],
        }
    ],
    "priority": 1,
}

WAR_DETAIL = {
    **BASIC_WARS[0],
    "spots": [{"id": 1, "name": "カルデア", "quests": [QUEST]}],
}

SCRIPT = """＠マシュ
先輩、おはようございます。[k]

？1：おはよう
＠マシュ
今日もよろしくお願いします。[k]
？2：まだ眠い
＠マシュ
もう少し休みます。[k]
？！
"""

TRANSLATIONS = {
    "マシュ": "玛修",
    "先輩、おはようございます。": "前辈，早上好。",
    "おはよう": "早上好",
    "まだ眠い": "还很困",
    "今日もよろしくお願いします。": "今天也请多关照。",
    "もう少し休みます。": "再休息一会儿。",
}


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page_errors = []
    translation_requests = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.add_init_script(
        "localStorage.clear();"
        "localStorage.setItem('fgo-reader-settings', JSON.stringify({reduceMotion:true}));"
        "localStorage.setItem('fgo-reader-translation-settings:v1', JSON.stringify({"
        "mode:'source',provider:'bing',deepl:{authKey:'',serverUrl:''},"
        "openai:{baseUrl:'',apiKey:'',model:'',allowNoAuth:false}}));"
    )

    for region in ("CN", "JP"):
        page.route(
            f"https://api.atlasacademy.io/export/{region}/basic_war.json",
            lambda route: route.fulfill(
                json=BASIC_WARS,
                headers={"access-control-allow-origin": "*"},
            ),
        )

    page.route(
        "**/atlas-api/nice/JP/war/1",
        lambda route: route.fulfill(json=WAR_DETAIL),
    )
    page.route(
        "https://example.test/translation.txt",
        lambda route: route.fulfill(
            body=SCRIPT,
            content_type="text/plain; charset=utf-8",
            headers={"access-control-allow-origin": "*"},
        ),
    )

    def translation_handler(route):
        if route.request.url.endswith("/config"):
            route.fulfill(
                json={
                    "sourceLanguage": "ja",
                    "targetLanguage": "zh-Hans",
                    "clientOverridesAllowed": True,
                    "providers": [
                        {
                            "id": "deepl",
                            "label": "DeepL",
                            "serverConfigured": False,
                            "experimental": False,
                            "configurationId": None,
                        },
                        {
                            "id": "openai",
                            "label": "OpenAI 兼容",
                            "serverConfigured": False,
                            "experimental": False,
                            "configurationId": None,
                        },
                        {
                            "id": "bing",
                            "label": "Bing / Edge（非官方）",
                            "serverConfigured": True,
                            "experimental": True,
                            "configurationId": "bing-test-v1",
                        },
                    ],
                }
            )
            return

        payload = json.loads(route.request.post_data or "{}")
        translation_requests.append(payload)
        route.fulfill(
            json={
                "provider": payload["provider"],
                "configurationId": "bing-test-v1",
                "translations": [
                    {
                        "id": item["id"],
                        "translatedText": TRANSLATIONS.get(item["text"], f"译：{item['text']}"),
                    }
                    for item in payload["items"]
                ],
            }
        )

    page.route("**/translation-api**", translation_handler)

    page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
    page.locator(".region-select select").select_option("JP")
    page.get_by_role("button", name="开始观测").click()
    page.locator(".reader-loading").wait_for(state="hidden", timeout=10000)
    page.locator(".dialogue-box").wait_for(timeout=5000)

    assert page.locator(".speaker-plate strong").text_content() == "マシュ"
    source_text = page.locator(".dialogue-text").text_content()
    assert source_text == "先輩、おはようございます。", repr(source_text)
    assert len(translation_requests) == 0

    page.keyboard.press("t")
    page.get_by_text("前辈，早上好。", exact=True).wait_for(timeout=5000)
    assert page.locator(".speaker-plate strong").text_content() == "玛修"
    assert all(request["provider"] == "bing" for request in translation_requests)

    page.keyboard.press("t")
    page.get_by_text("先輩、おはようございます。", exact=True).wait_for(timeout=5000)
    page.keyboard.press("t")
    page.get_by_text("前辈，早上好。", exact=True).wait_for(timeout=5000)

    page.keyboard.press("Space")
    page.get_by_text("早上好", exact=True).wait_for(timeout=5000)
    page.keyboard.press("1")
    page.get_by_text("今天也请多关照。", exact=True).wait_for(timeout=5000)

    page.keyboard.press("l")
    page.get_by_text("历史记录", exact=True).wait_for(timeout=5000)
    assert page.locator(".log-list").get_by_text("玛修", exact=True).count() >= 1
    assert page.locator(".log-list").get_by_text("前辈，早上好。", exact=True).count() == 1

    saved = page.evaluate(
        "JSON.parse(localStorage.getItem('fgo-reader-translation-settings:v1'))"
    )
    assert saved["mode"] == "translated"
    assert saved["provider"] == "bing"

    page.keyboard.press("Escape")
    page.get_by_role("button", name="设置", exact=True).click()
    page.get_by_text("日文翻译", exact=True).wait_for(timeout=5000)
    assert page.locator(".translation-settings-section select").input_value() == "bing"
    assert page.get_by_text("可能随时失效", exact=False).is_visible()
    assert not page_errors, f"Page errors: {page_errors}"
    browser.close()
