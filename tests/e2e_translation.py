import json
import os
from pathlib import Path

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
                    "script": "https://static.atlasacademy.io/translation-test.txt",
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
    config_updates = []
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
        "https://static.atlasacademy.io/translation-test.txt",
        lambda route: route.fulfill(
            body=SCRIPT,
            content_type="text/plain; charset=utf-8",
            headers={"access-control-allow-origin": "*"},
        ),
    )

    def translation_handler(route):
        if route.request.url.endswith("/config/openai"):
            payload = json.loads(route.request.post_data or "{}")
            config_updates.append(payload)
            route.fulfill(
                json={
                    "sourceLanguage": "ja",
                    "targetLanguage": "zh-Hans",
                    "clientOverridesAllowed": True,
                    "localEnv": {
                        "openai": {
                            "editable": True,
                            "fileName": ".env.local",
                            "baseUrl": payload["baseUrl"],
                            "model": payload["model"],
                            "allowNoAuth": payload["allowNoAuth"],
                            "apiKeyConfigured": bool(payload["apiKey"]),
                        }
                    },
                    "providers": [],
                }
            )
            return

        if route.request.url.endswith("/config"):
            saved_openai = config_updates[-1] if config_updates else {
                "baseUrl": "http://127.0.0.1:11434/v1",
                "model": "qwen-local",
                "allowNoAuth": False,
            }
            route.fulfill(
                json={
                    "sourceLanguage": "ja",
                    "targetLanguage": "zh-Hans",
                    "clientOverridesAllowed": True,
                    "localEnv": {
                        "openai": {
                            "editable": True,
                            "fileName": ".env.local",
                            "baseUrl": saved_openai["baseUrl"],
                            "model": saved_openai["model"],
                            "allowNoAuth": saved_openai["allowNoAuth"],
                            "apiKeyConfigured": True,
                        }
                    },
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
                            "serverConfigured": True,
                            "experimental": False,
                            "configurationId": "openai-local-test-v1",
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

    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
    page.locator(".region-select select").select_option("JP")
    page.get_by_role("button", name="开始观测").click()
    page.locator(".reader-loading").wait_for(state="hidden", timeout=10000)
    page.locator(".dialogue-box").wait_for(timeout=5000)

    assert page.locator(".speaker-plate strong").text_content() == "マシュ"
    source_text = page.locator(".dialogue-text").text_content()
    assert source_text == "先輩、おはようございます。", repr(source_text)
    assert len(translation_requests) == 0

    page.get_by_role("button", name="设置", exact=True).click()
    manual_section = page.locator(".manual-translation-section")
    manual_section.get_by_text("人工翻译文件", exact=True).wait_for(timeout=5000)
    with page.expect_download() as download_info:
        manual_section.get_by_role("button", name="导出翻译母本").click()
    template = json.loads(Path(download_info.value.path()).read_text(encoding="utf-8"))
    assert template["format"] == "fgo-reader-translation-template"
    assert template["scriptId"] == "1000000099"
    exported_sources = {entry["sourceText"] for entry in template["entries"]}
    assert "今日もよろしくお願いします。" in exported_sources
    assert "もう少し休みます。" in exported_sources

    # Keep one choice blank to verify that manual mode falls back to Japanese
    # instead of asking the configured Bing provider to fill the gap.
    for entry in template["entries"]:
        if entry["sourceText"] != "まだ眠い":
            entry["translatedText"] = TRANSLATIONS.get(entry["sourceText"], "")
    translation_file = {
        "name": "fgo-translation-1000000099.json",
        "mimeType": "application/json",
        "buffer": json.dumps(template, ensure_ascii=False).encode("utf-8"),
    }
    manual_section.locator('input[type="file"]').set_input_files(translation_file)
    page.get_by_text("已导入", exact=False).wait_for(timeout=5000)
    assert manual_section.get_by_text("本脚本不会调用在线翻译", exact=False).is_visible()

    bad_template = {**template, "scriptId": "1000000000"}
    manual_section.locator('input[type="file"]').set_input_files({
        "name": "wrong-script.json",
        "mimeType": "application/json",
        "buffer": json.dumps(bad_template, ensure_ascii=False).encode("utf-8"),
    })
    manual_section.get_by_text("不属于当前脚本", exact=False).wait_for(timeout=5000)

    page.keyboard.press("Escape")
    page.get_by_text("前辈，早上好。", exact=True).wait_for(timeout=5000)
    assert page.locator(".speaker-plate strong").text_content() == "玛修"
    assert len(translation_requests) == 0

    page.keyboard.press("t")
    page.get_by_text("先輩、おはようございます。", exact=True).wait_for(timeout=5000)
    page.keyboard.press("t")
    page.get_by_text("前辈，早上好。", exact=True).wait_for(timeout=5000)

    page.keyboard.press("Space")
    # Choice groups remain in one language; one missing manual entry makes the
    # complete group use the Japanese source for this visit.
    page.get_by_text("おはよう", exact=True).wait_for(timeout=5000)
    page.get_by_text("まだ眠い", exact=True).wait_for(timeout=5000)
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

    page.once("dialog", lambda dialog: dialog.accept())
    page.locator(".manual-translation-section").get_by_role("button", name="移除").click()
    page.get_by_text("已移除当前脚本的人工译文", exact=True).wait_for(timeout=5000)
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    assert len(translation_requests) > 0
    assert all(request["provider"] == "bing" for request in translation_requests)

    page.get_by_role("button", name="设置", exact=True).click()

    page.locator(".translation-settings-section select").select_option("openai")
    page.get_by_text(".env.local", exact=True).wait_for(timeout=5000)
    provider_fields = page.locator(".translation-provider-fields")
    assert provider_fields.locator('input[type="url"]').input_value() == "http://127.0.0.1:11434/v1"
    assert provider_fields.locator('input:not([type])').input_value() == "qwen-local"
    assert "已保存" in (provider_fields.locator('input[type="password"]').get_attribute("placeholder") or "")
    provider_fields.locator('input:not([type])').fill("qwen-local-2")
    provider_fields.locator('input[type="password"]').fill("new-test-key")
    page.get_by_role("button", name="保存到 .env.local").click()
    page.get_by_text("大模型配置已保存到 .env.local 并应用", exact=True).wait_for(timeout=5000)
    assert config_updates == [{
        "baseUrl": "http://127.0.0.1:11434/v1",
        "model": "qwen-local-2",
        "apiKey": "new-test-key",
        "allowNoAuth": False,
        "clearApiKey": False,
    }]
    page.screenshot(path="screenshots/llm-env-settings.png", full_page=True)
    page.set_viewport_size({"width": 760, "height": 900})
    page.wait_for_timeout(250)
    panel_box = page.locator(".settings-panel").bounding_box()
    assert panel_box and panel_box["width"] >= 750
    page.locator(".settings-list").evaluate("element => { element.scrollTop = element.scrollHeight; }")
    page.wait_for_timeout(150)
    assert page.get_by_role("button", name="保存到 .env.local").is_visible()
    page.screenshot(path="screenshots/llm-env-settings-mobile.png", full_page=True)
    assert not page_errors, f"Page errors: {page_errors}"
    browser.close()
