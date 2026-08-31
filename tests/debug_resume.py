import base64
import os
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5192")
PIXEL = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)

BASIC_WARS = [
    {
        "id": 1, "age": "AD.2026", "name": "测试章节", "longName": "继续观测测试",
        "flags": ["mainScenario"], "eventId": 0, "eventName": "",
    }
]

QUEST = {
    "id": 101, "name": "连续观测记录", "type": "main", "spotName": "测试地点",
    "warId": 1, "warLongName": "继续观测测试", "chapterId": 1, "chapterSubId": 0,
    "chapterSubStr": "", "phases": [1],
    "phaseScripts": [
        {"phase": 1, "scripts": [
            {"scriptId": "1000000001", "script": "https://example.test/1000000001.txt"},
            {"scriptId": "1000000002", "script": "https://example.test/1000000002.txt"},
        ]},
    ],
    "priority": 1,
}

WAR_DETAIL = {**BASIC_WARS[0], "spots": [{"id": 1, "name": "测试地点", "quests": [QUEST]}]}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1180, "height": 900})
    page_errors = []
    console_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("requestfinished", lambda r: print(f"DONE  {r.url[:110]}"))
    page.on("requestfailed", lambda r: print(f"FAIL  {r.url[:110]} -> {r.failure}"))

    page.add_init_script(
        "if (!sessionStorage.getItem('resume-e2e-initialized')) {"
        "  localStorage.clear();"
        "  localStorage.setItem('fgo-reader-settings', JSON.stringify({reduceMotion: true}));"
        "  sessionStorage.setItem('resume-e2e-initialized', '1');"
        "}"
    )

    def _cdn_mock(route):
        url = route.request.url
        if url.endswith(".txt") and "/Script/" in url:
            route.fulfill(status=200, content_type="text/plain; charset=utf-8", body="")
            return
        route.fulfill(status=200, content_type="image/png", body=PIXEL)

    page.route("https://static.atlasacademy.io/**", _cdn_mock)
    page.route(
        "https://api.atlasacademy.io/export/CN/basic_war.json",
        lambda route: route.fulfill(json=BASIC_WARS, headers={"access-control-allow-origin": "*"}),
    )
    page.route("**/atlas-api/nice/CN/war/1", lambda route: route.fulfill(json=WAR_DETAIL))
    page.route(
        "https://example.test/1000000001.txt",
        lambda route: route.fulfill(
            body="＠测试终端\n第一条记录。[k]\n＠测试终端\n第二条记录。[k]",
            content_type="text/plain; charset=utf-8",
        ),
    )
    page.route(
        "https://example.test/1000000002.txt",
        lambda route: route.fulfill(
            body="＠测试终端\n下一段记录。[k]", content_type="text/plain; charset=utf-8"
        ),
    )

    page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
    print("--- initial load done, dumping war requests so far ---")
    entries = page.evaluate(
        "performance.getEntriesByType('resource').filter(e => e.name.includes('/war/') || e.name.includes('basic_war')).map(e => Math.round(e.startTime) + 'ms ' + e.name.slice(-45) + ' size=' + e.transferSize)"
    )
    for e in entries:
        print("PERF", e)
    print("--- selecting CN ---")
    page.locator(".region-select select").select_option("CN")
    page.wait_for_timeout(3000)
    entries = page.evaluate(
        "performance.getEntriesByType('resource').filter(e => e.name.includes('/war/') || e.name.includes('basic_war')).map(e => Math.round(e.startTime) + 'ms ' + e.name.slice(-45) + ' size=' + e.transferSize)"
    )
    for e in entries:
        print("PERF", e)
    hero = page.evaluate("document.querySelector('.hero-metrics')?.textContent")
    print("hero metrics:", hero)
    print("page_errors:", page_errors[:3])
    print("console_errors:", console_errors[:5])
    browser.close()
