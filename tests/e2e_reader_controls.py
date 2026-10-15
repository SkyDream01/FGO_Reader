"""Offline regression checks for ADV navigation, endings and reader shortcuts."""
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5187")
OUT = Path(__file__).resolve().parents[1] / "node_modules" / ".tmp" / "reader-controls"
OUT.mkdir(parents=True, exist_ok=True)
SCRIPTS = {
    "0100009910": """＠旁白
第一句。[k]
＠旁白
第二句。[k]
？1：路线一
＠旁白
分支一。[k]
？2：路线二
＠旁白
分支二。[k]
？！
＠旁白
最后一句。[k]
[fadeout black 0.05]
[wait fade]
[end]
""",
    "0100009911": "＠旁白\n唯一一句。[k]\n[end black]",
    "0100009912": """＠旁白
一[k]
＠旁白
二[k]
＠旁白
三[k]
[page]
[wait touch]
[effect bit_talk_rubble]
？1：继续
＠旁白
四[k]
？！
[end white]
""",
    "0100009913": "\n".join(f"＠旁白\n第{i:02d}句。[k]" for i in range(1, 31)),
    "0100009914": """[effect bit_talk_rubble]
[label menu]
[menu ask=问 done=完]
[label ask]
[branch finish asked true]
[flag asked true]
[jump menu]
[label finish]
＠旁白
尾[k]
[end]
[label done]
[end]
""",
    "0100009915": "＠旁白\n这是一段仍在逐字显示的未读文本，请勿直接跳过。[k]",
}


def assert_on_top(locator, surface):
    assert locator.evaluate(
        """(element, surface) => {
            const rect = element.getBoundingClientRect();
            return !!document.elementFromPoint(rect.x + rect.width / 2,
                rect.y + rect.height / 2)?.closest(surface);
        }""",
        surface,
    ), f"{surface} was covered by an ADV overlay"


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route("https://api.atlasacademy.io/**", lambda route: route.fulfill(json=[]))
    page.route("https://static.atlasacademy.io/**", lambda route: route.fulfill(status=404))
    page.route(
        "**/atlas-api/**",
        lambda route: route.fulfill(
            content_type="text/plain; charset=utf-8",
            body=SCRIPTS[route.request.url.rsplit("/", 1)[-1]],
        ) if "/script/" in route.request.url else route.fulfill(json=[]),
    )
    page.add_init_script(
        "localStorage.clear(); localStorage.setItem('fgo-reader-settings',"
        "JSON.stringify({textSpeed:0, reduceMotion:false, skipUnread:false}));"
    )
    page.goto(URL, wait_until="networkidle")

    def open_script(script_id):
        direct = page.locator(".direct-script input")
        direct.fill(script_id)
        direct.press("Enter")
        expect(page.locator(".dialogue-text")).to_be_visible()

    def exit_reader():
        page.locator(".reader-title-block button").click()
        expect(page.locator(".direct-script input")).to_be_visible()

    dialogue = page.locator(".dialogue-text")
    open_script("0100009910")
    expect(dialogue).to_have_text("第一句。")
    expect(page.get_by_title("后退 (←)", exact=True)).to_be_disabled()
    page.keyboard.press("NumpadEnter")
    expect(dialogue).to_have_text("第二句。")
    page.keyboard.press("PageDown")
    page.keyboard.press("9")  # Ignore numbers beyond the available options.
    expect(page.locator(".choice-menu")).to_be_visible()
    page.keyboard.press("ArrowDown")
    page.keyboard.press("ArrowUp")
    page.keyboard.press("ArrowDown")
    page.keyboard.press("Enter")
    expect(dialogue).to_have_text("分支二。")
    page.keyboard.press("Space")
    expect(dialogue).to_have_text("最后一句。")
    for expected in ("分支二。", "请选择你的回应。", "第二句。", "第一句。"):
        page.keyboard.press("ArrowLeft")
        expect(dialogue).to_have_text(expected)
    expect(page.get_by_title("后退 (←)", exact=True)).to_be_disabled()
    page.keyboard.press("ArrowLeft")
    expect(dialogue).to_have_text("第一句。")
    page.keyboard.press("Enter")
    page.keyboard.press("Enter")
    page.keyboard.press("KeyH")
    page.keyboard.press("Enter")  # Restore the hidden choice instead of selecting it.
    expect(page.locator(".choice-menu")).to_be_visible()
    page.keyboard.press("1")
    expect(dialogue).to_have_text("分支一。")
    page.keyboard.press("PageUp")
    page.locator(".log-list button").first.click()
    expect(dialogue).to_have_text("第一句。")
    page.keyboard.press("Enter")
    page.keyboard.press("Enter")
    expect(page.locator(".choice-menu")).to_be_visible()
    page.keyboard.press("1")
    page.keyboard.press("Enter")
    page.keyboard.press("Enter")
    ending = page.locator(".completion-panel")
    expect(ending).to_be_visible()
    assert_on_top(ending.locator("h2"), ".completion-panel")
    page.screenshot(path=str(OUT / "black-fade-ending.png"))
    page.keyboard.press("PageUp")
    expect(page.locator(".log-panel")).to_be_visible()
    assert_on_top(page.locator(".log-panel h2"), ".log-panel")
    page.keyboard.press("Escape")
    page.keyboard.press("Shift+/")
    assert_on_top(page.locator(".shortcuts-panel h2"), ".shortcuts-panel")
    page.keyboard.press("Escape")
    page.get_by_role("button", name="返回最后一句", exact=True).focus()
    page.keyboard.press("Enter")
    expect(ending).to_have_count(0)
    expect(dialogue).to_have_text("最后一句。")
    page.keyboard.press("ArrowLeft")
    expect(dialogue).to_have_text("分支一。")
    exit_reader()

    open_script("0100009911")
    page.keyboard.press("Space")
    expect(ending).to_be_visible()
    assert_on_top(ending.locator("h2"), ".completion-panel")
    page.get_by_role("button", name="返回最后一句", exact=True).click()
    expect(dialogue).to_have_text("唯一一句。")
    page.keyboard.press("Enter")
    expect(ending).to_be_visible()
    page.get_by_role("button", name="重新播放", exact=True).focus()
    page.keyboard.press("Space")
    expect(dialogue).to_have_text("唯一一句。")
    exit_reader()

    # Equal-length lines, page/touch waits and a choice with a looping animation
    # must each receive their own auto timer, unaffected by render-frame updates.
    open_script("0100009912")
    page.keyboard.press("KeyA")
    expect(ending).to_be_visible(timeout=15000)
    assert_on_top(ending.locator("h2"), ".completion-panel")
    page.screenshot(path=str(OUT / "auto-white-fade-ending.png"))
    page.get_by_role("button", name="返回最后一句", exact=True).click()
    expect(dialogue).to_have_text("四")
    expect(page.get_by_title("自动 (A)", exact=True)).to_have_attribute("aria-pressed", "false")
    page.wait_for_timeout(1000)
    expect(dialogue).to_have_text("四")
    exit_reader()

    open_script("0100009914")
    page.keyboard.press("KeyA")
    expect(ending).to_be_visible(timeout=10000)
    page.get_by_role("button", name="返回最后一句", exact=True).click()
    expect(dialogue).to_have_text("尾")
    page.keyboard.press("ArrowLeft")
    expect(page.locator(".choice-menu")).to_be_visible()
    page.keyboard.press("ArrowLeft")
    expect(page.get_by_title("后退 (←)", exact=True)).to_be_disabled()
    exit_reader()

    open_script("0100009913")
    expect(dialogue).to_have_text("第01句。")
    page.keyboard.press("KeyS")
    expect(dialogue).to_have_text("第02句。")
    expect(page.get_by_title("跳读 (S)", exact=True)).to_have_attribute("aria-pressed", "false")
    page.wait_for_timeout(200)
    expect(dialogue).to_have_text("第02句。")
    page.keyboard.press("ArrowLeft")
    # Browser/OS combinations and IME key events must not toggle reader modes.
    for code in ("KeyA", "KeyS", "KeyL", "KeyH", "KeyM", "KeyB", "KeyF", "KeyT"):
        page.evaluate(
            "code => window.dispatchEvent(new KeyboardEvent('keydown',"
            "{key:code.slice(3).toLowerCase(), code, ctrlKey:true, bubbles:true}))",
            code,
        )
    page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {key:'a',code:'KeyA',isComposing:true}))")
    expect(page.get_by_title("自动 (A)", exact=True)).to_have_attribute("aria-pressed", "false")
    expect(page.get_by_title("跳读 (S)", exact=True)).to_have_attribute("aria-pressed", "false")
    expect(page.locator(".reader-panel")).to_have_count(0)
    expect(dialogue).to_have_text("第01句。")
    page.keyboard.down("h")
    page.keyboard.down("h")  # Browser repeat must not toggle it back.
    expect(page.locator(".restore-ui")).to_be_visible()
    page.keyboard.up("h")
    page.keyboard.press("KeyH")
    expect(dialogue).to_be_visible()
    page.keyboard.press("KeyL")
    page.keyboard.down("Control")
    page.wait_for_timeout(200)
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    expect(dialogue).to_have_text("第01句。")
    page.keyboard.up("Control")
    # Ctrl advances repeatedly; releasing it, hiding UI and opening panels pause it.
    page.keyboard.down("Control")
    expect(dialogue).not_to_have_text("第01句。")
    page.keyboard.up("Control")
    position = dialogue.text_content()
    page.wait_for_timeout(200)
    expect(dialogue).to_have_text(position)
    page.keyboard.down("Control")
    page.get_by_role("button", name="隐藏界面", exact=False).click()
    page.wait_for_timeout(100)
    expect(dialogue).to_have_count(0)  # UI is unmounted.
    saved_position = page.evaluate("Object.entries(localStorage).find(([key]) => key.startsWith('fgo-reader-progress:') && key.endsWith(':0100009913'))[1]")
    page.wait_for_timeout(250)
    assert page.evaluate("Object.entries(localStorage).find(([key]) => key.startsWith('fgo-reader-progress:') && key.endsWith(':0100009913'))[1]") == saved_position
    page.keyboard.up("Control")
    page.keyboard.press("KeyH")
    page.keyboard.press("KeyB")
    expect(page.get_by_text("已保存当前位置", exact=True)).to_be_visible()
    page.keyboard.press("KeyM")
    expect(page.get_by_role("button", name="恢复声音", exact=True)).to_be_visible()
    page.keyboard.down("Control")
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    position = dialogue.text_content()
    page.wait_for_timeout(200)
    expect(dialogue).to_have_text(position)
    page.keyboard.up("Control")
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    # Repeat navigation is intentional, and should keep moving backwards.
    for _ in range(3):
        page.keyboard.press("PageDown")
    ordinal = int(dialogue.text_content()[1:3])
    page.keyboard.down("ArrowLeft")
    page.keyboard.down("ArrowLeft")
    page.keyboard.up("ArrowLeft")
    expect(dialogue).to_have_text(f"第{ordinal - 2:02d}句。")
    expect(page.get_by_title("自动 (A)", exact=True)).to_have_attribute("aria-pressed", "false")
    exit_reader()
    page.evaluate("localStorage.setItem('fgo-reader-settings', JSON.stringify({textSpeed:100}))")
    open_script("0100009915")
    page.keyboard.press("KeyS")
    expect(page.get_by_title("跳读 (S)", exact=True)).to_have_attribute("aria-pressed", "false")
    page.wait_for_timeout(200)
    assert page.evaluate("Object.entries(localStorage).find(([key]) => key.startsWith('fgo-reader-read:') && key.endsWith(':0100009915'))[1]") == "-1"
    assert not errors, errors
    browser.close()

print("Reader navigation, endings and keyboard contracts passed")
