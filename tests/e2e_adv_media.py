"""Actual local cue playback, video lifecycle and the bundled offline demo ZIP."""
import io
import json
import math
import os
import struct
import wave
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5187")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("https://api.atlasacademy.io/**", lambda route: route.fulfill(json=[]))
    page.route("https://static.atlasacademy.io/**", lambda route: route.abort())
    page.add_init_script("localStorage.clear();localStorage.setItem('fgo-reader-settings',JSON.stringify({textSpeed:0}));")
    page.goto(URL, wait_until="networkidle")
    video = bytes(page.evaluate("""async () => {
      const canvas = document.createElement('canvas'); canvas.width=160; canvas.height=90;
      const ctx=canvas.getContext('2d'), stream=canvas.captureStream(12), chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
      const done=new Promise(resolve => recorder.onstop=resolve);
      recorder.ondataavailable=e=>chunks.push(e.data); recorder.start();
      for(let i=0;i<24;i++){ctx.fillStyle='#17384a';ctx.fillRect(0,0,160,90);ctx.fillStyle='#95e8f0';ctx.fillRect(10+i*5,40,20,10);await new Promise(r=>setTimeout(r,83));}
      recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
      return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
    }"""))
    audio = io.BytesIO()
    with wave.open(audio, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
        w.writeframes(b"".join(struct.pack("<h", int(1000 * math.sin(i * math.pi * 2 * 440 / 8000))) for i in range(800)))
    package = io.BytesIO()
    manifest = {"format": "fgo-reader-script-package", "version": 1, "title": "本地媒体验证", "region": "CN", "script": "story.txt", "assets": {"movies": {"clip": "clip.webm"}, "sounds": {"Se/bank/beep": "beep.wav"}}}
    with ZipFile(package, "w", ZIP_STORED) as z:
        z.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False))
        z.writestr("story.txt", "[cueSe bank beep]\n[wait se]\n[criMovie clip bgmStop true]\n＠旁白\n真实影片播放结束。\n[k]\n[end]")
        z.writestr("clip.webm", video); z.writestr("beep.wav", audio.getvalue())
    page.locator('input[type="file"]').set_input_files({"name": "media.zip", "mimeType": "application/zip", "buffer": package.getvalue()})
    page.get_by_role("button", name="导入并开始观测").click()
    expect(page.locator(".adv-movie video")).to_be_visible()
    assert page.locator(".adv-movie video").get_attribute("src").startswith("blob:")
    expect(page.locator(".dialogue-text")).to_have_text("真实影片播放结束。", timeout=10000)
    expect(page.locator(".adv-movie")).to_have_count(0)
    assert not errors, errors
    page.close()
    demo = browser.new_page(viewport={"width": 1440, "height": 900})
    demo.route("https://api.atlasacademy.io/**", lambda route: route.fulfill(json=[]))
    demo.route("https://static.atlasacademy.io/**", lambda route: route.abort())
    demo.add_init_script("localStorage.clear();localStorage.setItem('fgo-reader-settings',JSON.stringify({textSpeed:0}));")
    demo.goto(URL, wait_until="networkidle")
    demo.locator('input[type="file"]').set_input_files(str(ROOT / "examples" / "adv-supplement.zip"))
    expect(demo.get_by_role("heading", name="确认导入资源包")).to_be_visible()
    demo.get_by_role("button", name="导入并开始观测").click()
    expect(demo.locator(".dialogue-text")).to_contain_text("这是自制矢量演出。")
    expect(demo.locator(".load-note")).to_have_count(0)
    expect(demo.locator(".adv-runtime-effect svg")).to_have_count(1)
    demo.screenshot(path=str(ROOT / "node_modules" / ".tmp" / "adv-e2e" / "offline-demo.png"))
    browser.close()
print("Local media and offline demo browser contracts passed")
