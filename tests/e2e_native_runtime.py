"""Native ADV semantics with deterministic API responses and no remote assets."""
import base64
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5187")
PIXEL = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
SCRIPT = """＄entry
[scene 10110]
[cameraFilter gray]
[charaSet A 1001 0 玛修]
[charaSet B 2002 2 角色]
[charaFadein A 0 0]
[charaFadein B 0 2]
[charaLayer B sub #B]
[subRenderDepth #B 5]
[subCameraMove #B 0 100,-20 1.5]
[subRenderFadein #B 0 0,0]
＠A：玛修
你好，[#前辈:せんぱい]。[#强调][line3]
[k]
[cameraMoveEase 100,-20 0.25 easeOutSine 1.2]
[wait camera]
＠玛修
镜头已移动。
[k]
[flag asked true]
？1：已隐藏；asked
？2：走第二条
＠玛修
第二条分支。
[k]
？！
＠旁白
共通结尾。
[k]
[end]
"""

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.set_default_timeout(10000)
    errors = []
    page.on("pageerror", lambda error: errors.append(error.stack or str(error)))
    page.route("https://static.atlasacademy.io/**", lambda route: route.fulfill(status=200, content_type="image/png", body=PIXEL))
    page.route("https://api.atlasacademy.io/**", lambda route: route.fulfill(json=[], headers={"access-control-allow-origin": "*"}))
    def api(route):
        if "/script/" in route.request.url:
            route.fulfill(status=200, content_type="text/plain; charset=utf-8", body=SCRIPT)
        else:
            route.fulfill(status=200, content_type="application/json", body="[]")
    page.route("**/atlas-api/**", api)
    page.add_init_script("if (!localStorage.getItem('fgo-e2e-initialized')) { localStorage.clear(); localStorage.setItem('fgo-e2e-initialized','1'); localStorage.setItem('fgo-reader-settings', JSON.stringify({textSpeed:10})); }")
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    assert not errors, errors
    page.locator(".direct-script input").fill("0100009999")
    page.locator(".direct-script input").press("Enter")
    page.locator(".dialogue-box").wait_for()
    expect(page.locator(".dialogue-text")).to_contain_text("你好，前辈")
    expect(page.locator(".dialogue-text")).to_contain_text("强调[line3]")
    expect(page.locator(".dialogue-text ruby rt")).to_have_text("せんぱい")
    assert page.locator('.adv-sub-layer[data-group="#B"] .character-sprite[data-slot="B"]').count() == 1
    assert page.locator('.adv-sub-layer[data-group="#B"]').evaluate("el => getComputedStyle(el).zIndex") == "105"
    assert page.locator(".world-layer").evaluate("el => getComputedStyle(el).filter") == "grayscale(1)"
    # A text speed preference change must preserve the live interpreter position.
    page.get_by_role("button", name="设置", exact=True).click()
    page.locator('input[type="range"]').first.fill("70")
    page.keyboard.press("Escape")
    expect(page.locator(".dialogue-text")).to_contain_text("强调[line3]")
    page.keyboard.press("Enter")
    expect(page.locator(".dialogue-text")).to_have_text("镜头已移动。")
    matrix = page.locator(".world-layer").evaluate("el => new DOMMatrix(getComputedStyle(el).transform).a")
    assert abs(matrix - 1.2) < 0.001, matrix
    page.keyboard.press("Enter")
    expect(page.locator(".choice-menu button")).to_have_count(1)
    page.get_by_role("button", name="走第二条").click()
    expect(page.locator(".dialogue-text")).to_have_text("第二条分支。")
    page.keyboard.press("Enter")
    expect(page.locator(".dialogue-text")).to_have_text("共通结尾。")
    page.keyboard.press("b")
    record = page.evaluate("JSON.parse(localStorage.getItem('fgo-reader-bookmark:v7'))")
    assert record["choiceTrail"][0]["optionIndex"] == 1, record
    page.keyboard.press("ArrowLeft")
    expect(page.locator(".dialogue-text")).to_have_text("第二条分支。")
    page.keyboard.press("Enter")
    expect(page.locator(".dialogue-text")).to_have_text("共通结尾。")
    page.reload(wait_until="networkidle")
    # Resume is exposed in the library after a reload.
    resume = page.get_by_role("button", name="继续上次观测", exact=False)
    expect(resume).to_have_count(1)
    resume.click()
    expect(page.locator(".dialogue-text")).to_have_text("共通结尾。")
    screenshots = ROOT / "screenshots"
    screenshots.mkdir(exist_ok=True)
    page.screenshot(path=str(screenshots / "native-runtime.png"), full_page=True)
    assert not errors, errors
    browser.close()
print("Native runtime browser checks passed")
