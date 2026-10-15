"""Browser contracts for how-to-adv-unrestored and locally authored vector assets."""
import base64
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5187")
OUT = Path(__file__).resolve().parents[1] / "node_modules" / ".tmp" / "adv-e2e"
OUT.mkdir(parents=True, exist_ok=True)
PIXEL = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
SCRIPT = """＄entry
[scene 10110]
[charaSet A 1001 1 玛修]
[charaFadein A 0]
[communicationCharaLoop 98003003 0 5 1 3]
[wait communicationChara]
[effect bit_talk_charge_blu 100,0]
[messageChange cinema]
[messageAlign bottom]
[autoAndBackLog false]
＠玛修
自制演出[messageShake 0.05 4 3 3]显示中。[f large center]字号对齐。
[k]
[communicationCharaFace 5]
[effectStop bit_talk_charge_blu]
[messageShakeStop]
[clear]
[communicationCharaClear]
[criMovie missing_movie bgmPlay true]
＠旁白
影片已跳过。
[k]
[notification 提示 "通知正文"]
[selectionCentering false]
[menu one="选项一" two="选项二"]
＄one
[end]
＄two
[autoAndBackLog true]
[messageChange]
[talkNameBack]
＠旁白
菜单跳转成功。
[k]
[endFade white]
[end]
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(error.stack or str(error)))
    page.route("https://static.atlasacademy.io/**", lambda route: route.fulfill(status=200, content_type="image/png", body=PIXEL))
    page.route("https://api.atlasacademy.io/**", lambda route: route.fulfill(json=[]))
    page.route("**/atlas-api/**", lambda route: route.fulfill(status=200, content_type="text/plain; charset=utf-8", body=SCRIPT) if "/script/" in route.request.url else route.fulfill(json=[]))
    page.add_init_script("localStorage.clear(); localStorage.setItem('fgo-reader-settings',JSON.stringify({textSpeed:0}));")
    page.goto(URL, wait_until="networkidle")
    page.locator(".direct-script input").fill("0100009998")
    page.locator(".direct-script input").press("Enter")
    expect(page.locator(".dialogue-text")).to_contain_text("自制演出")
    expect(page.locator('.adv-communication[data-face="3"]')).to_have_count(1)
    expect(page.locator('.adv-runtime-effect[data-effect="bit_talk_charge_blu"] svg')).to_have_count(1)
    expect(page.locator('.dialogue-wrap[data-skin="cinema"]')).to_have_count(1)
    assert page.locator(".dialogue-box").evaluate("e => getComputedStyle(e).justifyContent") == "flex-end"
    assert page.locator(".dialogue-wrap").evaluate("e => getComputedStyle(e).transform") != "none"
    expect(page.get_by_title("自动 (A)", exact=True)).to_have_count(0)
    expect(page.get_by_title("记录 (L)", exact=True)).to_have_count(0)
    page.screenshot(path=str(OUT / "communication-effects.png"))
    page.keyboard.press("Enter")
    expect(page.locator(".dialogue-wrap")).to_have_count(0)
    expect(page.locator('.character-sprite[data-slot="A"]')).to_have_count(1)
    expect(page.locator('.adv-communication[data-face="5"]')).to_have_count(1)
    page.keyboard.press("Enter")
    expect(page.locator('.adv-movie[data-movie="missing_movie"]')).to_have_count(1)
    expect(page.locator(".adv-communication")).to_have_count(0)
    page.screenshot(path=str(OUT / "movie-placeholder.png"))
    page.get_by_role("button", name="跳过影片", exact=True).click()
    expect(page.locator(".dialogue-text")).to_have_text("影片已跳过。")
    page.keyboard.press("Enter")
    expect(page.get_by_role("dialog", name="提示")).to_contain_text("通知正文")
    page.get_by_role("button", name="确定", exact=True).click()
    expect(page.locator(".choice-menu")).to_have_attribute("data-centering", "false")
    page.get_by_role("button", name="选项二").click()
    expect(page.locator(".dialogue-text")).to_have_text("菜单跳转成功。")
    expect(page.get_by_title("自动 (A)", exact=True)).to_have_count(1)
    page.keyboard.press("Enter")
    expect(page.get_by_role("heading", name="观测记录已抵达末尾")).to_be_visible()
    assert not errors, errors
    browser.close()
print("ADV supplement browser contracts passed")
