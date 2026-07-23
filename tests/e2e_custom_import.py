from __future__ import annotations

from base64 import b64decode
from io import BytesIO
import json
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5188")
ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "screenshots"
SCREENSHOTS.mkdir(exist_ok=True)

# A tiny valid PNG is enough to confirm that package assets are rendered from blob URLs.
PIXEL_PNG = b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/" \
    "P7L5WQAAAABJRU5ErkJggg=="
)


def make_package() -> bytes:
    manifest = {
        "format": "fgo-reader-script-package",
        "version": 1,
        "title": "浏览器导入测试包",
        "author": "E2E",
        "region": "JP",
        "script": "story.txt",
        "assets": {
            "backgrounds": {"1": "assets/scene.png"},
            "characters": {"900001": "assets/chara.png"},
        },
    }
    script = """
[scene 1]
[charaSet A 900001 0 本地角色]
[charaPut A 1]
＠A：本地角色
本地资源已经载入。
[k]
？1：走左边
＠本地角色
左侧分支。
[k]
？2：走右边
＠本地角色
右侧分支。
[k]
？！
""".strip()
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False))
        archive.writestr("story.txt", script)
        archive.writestr("assets/scene.png", PIXEL_PNG)
        archive.writestr("assets/chara.png", PIXEL_PNG)
    return buffer.getvalue()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    atlas_asset_requests: list[str] = []
    translation_requests: list[str] = []

    def block_atlas_asset(route):
        atlas_asset_requests.append(route.request.url)
        route.abort()

    page.route("https://static.atlasacademy.io/**", block_atlas_asset)
    page.on(
        "request",
        lambda request: translation_requests.append(request.url)
        if request.method == "POST" and request.url.endswith("/translation-api")
        else None,
    )
    page.add_init_script(
        "localStorage.clear();"
        "localStorage.setItem('fgo-reader-settings', JSON.stringify({reduceMotion:true}));"
    )
    page.goto(BASE_URL, wait_until="commit", timeout=30000)
    page.get_by_role("button", name="导入 ZIP 资源包").wait_for(timeout=30000)
    # Ignore unrelated library artwork requested before the local story opens.
    atlas_asset_requests.clear()

    page.locator("input[type=file]").set_input_files(
        {
            "name": "reader-test.zip",
            "mimeType": "application/zip",
            "buffer": make_package(),
        }
    )
    page.get_by_role("heading", name="确认导入资源包").wait_for(timeout=10000)
    page.screenshot(path=str(SCREENSHOTS / "custom-import-preview.png"), full_page=True)
    assert not page.get_by_label("允许此脚本使用翻译服务").is_checked()
    page.locator(".custom-translation-consent").click()
    assert page.get_by_label("允许此脚本使用翻译服务").is_checked()
    page.get_by_role("button", name="导入并开始观测").click()

    loader = page.locator(".reader-loading")
    loader.wait_for(state="hidden", timeout=15000)
    page.get_by_text("本地资源已经载入。", exact=True).wait_for(timeout=10000)
    assert page.locator(".scene-image").get_attribute("src").startswith("blob:")
    assert page.locator(".character-sprite img").get_attribute("src").startswith("blob:")
    assert not atlas_asset_requests, atlas_asset_requests
    assert page.get_by_role("button", name="译文").is_visible()

    page.keyboard.press("Space")
    page.get_by_text("走右边", exact=True).click()
    page.get_by_text("右侧分支。", exact=True).wait_for(timeout=10000)

    page.get_by_role("button", name="返回目录").click()
    page.get_by_role("button", name="浏览脚本库").click()
    custom_row = page.locator(".custom-package-row")
    custom_row.get_by_text("浏览器导入测试包", exact=True).wait_for(timeout=10000)
    custom_row.locator('input[type="checkbox"]').click()
    page.wait_for_function(
        "() => !document.querySelector('.custom-package-row input[type=checkbox]').checked"
    )
    assert not custom_row.locator('input[type="checkbox"]').is_checked()
    custom_row.get_by_role("button", name="继续", exact=True).click()
    page.locator(".reader-loading").wait_for(state="hidden", timeout=10000)
    page.get_by_text("右侧分支。", exact=True).wait_for(timeout=10000)

    # Offline manual imports remain available after third-party translation
    # consent is disabled for the custom package.
    page.get_by_role("button", name="设置", exact=True).click()
    manual_section = page.locator(".manual-translation-section")
    manual_section.get_by_text("离线导入和显示人工译文不受影响", exact=False).wait_for(timeout=5000)
    with page.expect_download() as download_info:
        manual_section.get_by_role("button", name="导出翻译母本").click()
    template = json.loads(Path(download_info.value.path()).read_text(encoding="utf-8"))
    for entry in template["entries"]:
        entry["translatedText"] = f"译：{entry['sourceText']}"
    manual_section.locator('input[type="file"]').set_input_files({
        "name": "custom-manual-translation.json",
        "mimeType": "application/json",
        "buffer": json.dumps(template, ensure_ascii=False).encode("utf-8"),
    })
    page.get_by_text("已导入", exact=False).wait_for(timeout=5000)
    page.keyboard.press("Escape")
    page.get_by_text("译：右侧分支。", exact=True).wait_for(timeout=10000)
    assert not translation_requests

    page.get_by_role("button", name="返回目录").click()
    page.get_by_role("button", name="浏览脚本库").click()
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator(".custom-package-row button[title='删除资源包']").click()
    page.get_by_text("脚本库为空", exact=True).wait_for(timeout=10000)
    page.get_by_text("暂无可继续的记录", exact=True).wait_for(timeout=10000)

    # Verify that version-1 records (which kept scriptText in the packages
    # store) are migrated into the v2 script store without losing playback.
    migration_context = browser.new_context()
    migration_context.route(
        "**/seed-v1",
        lambda route: route.fulfill(
            status=200,
            content_type="text/html",
            body="<!doctype html><title>seed</title>",
        ),
    )
    migration_page = migration_context.new_page()
    migration_page.goto(f"{BASE_URL}/seed-v1", wait_until="domcontentloaded")
    migration_page.evaluate(
        """async () => {
          const legacy = {
            id: "custom-v1-aaaaaaaaaaaaaaaaaaaaaaaa",
            scriptId: "custom-v1-aaaaaaaaaaaaaaaaaaaaaaaa",
            format: "fgo-reader-script-package",
            version: 1,
            title: "旧版迁移测试包",
            region: "CN",
            scriptText: "＠旁白\\n旧版存储已经迁移。\\n[k]",
            assets: { backgrounds: {}, characters: {}, bgm: {} },
            importedAt: 1,
            updatedAt: 1,
            archiveName: "legacy.zip",
            byteSize: 100,
            translationAllowed: false,
            preview: { frameCount: 1, choiceCount: 0, characterCount: 0, sceneCount: 0, bgmCount: 0 }
          };
          await new Promise((resolve, reject) => {
            const request = indexedDB.open("fgo-reader-custom-scripts", 1);
            request.onupgradeneeded = () => {
              request.result.createObjectStore("packages", { keyPath: "id" });
              request.result.createObjectStore("assets", { keyPath: ["packageId", "path"] });
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const database = request.result;
              const transaction = database.transaction("packages", "readwrite");
              transaction.objectStore("packages").put(legacy);
              transaction.oncomplete = () => { database.close(); resolve(null); };
              transaction.onerror = () => reject(transaction.error);
            };
          });
        }"""
    )
    migration_page.goto(BASE_URL, wait_until="domcontentloaded")
    migration_page.get_by_role("button", name="浏览脚本库").wait_for(timeout=30000)
    migration_page.get_by_role("button", name="浏览脚本库").click()
    migration_page.locator(".custom-library-modal").get_by_text("旧版迁移测试包", exact=True).wait_for(timeout=10000)
    migration_page.locator(".custom-library-modal").get_by_role("button", name="开始", exact=True).click()
    migration_page.locator(".reader-loading").wait_for(state="hidden", timeout=10000)
    migration_page.get_by_text("旧版存储已经迁移。", exact=True).wait_for(timeout=10000)
    migration_context.close()
    browser.close()
