"""Atlas Scene geometry and the 9415900210 sceneSet regression, fully offline.

Atlas reference: packages/db/src/Component/Scene.tsx (1344x576, offsetY).
Run against Vite: python tests/e2e_atlas_alignment.py
"""
import io
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import parse_qs, urlparse

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5187")
OUT = ROOT / "screenshots" / "atlas-alignment"
OUT.mkdir(parents=True, exist_ok=True)

# Also accepts a standalone Vite build of the HTML fixture. The server lives
# in this process, so failed checks do not leave a Windows child server behind.
site = os.environ.get("FGO_ALIGNMENT_SITE")
server = None
if site:
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=site))
    Thread(target=server.serve_forever, daemon=True).start()
    URL = f"http://127.0.0.1:{server.server_port}"


def png(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


wide = Image.new("RGB", (1344, 626), "#23495c")
draw = ImageDraw.Draw(wide)
for x in range(0, 1344, 64):
    draw.line((x, 0, x, 626), fill="#54908c", width=2)
for y in range(0, 626, 64):
    draw.line((0, y, 1344, y), fill="#54908c", width=2)
WIDE = png(wide)
LEGACY = png(wide.crop((160, 0, 1184, 626)))
merged = Image.new("RGBA", (1024, 3072))
draw = ImageDraw.Draw(merged)
draw.rectangle((384, 180, 640, 740), fill="red")
draw.rectangle((256, 768, 511, 1023), fill="blue")
MERGED = png(merged)
TEXTURE = png(merged.crop((0, 0, 1024, 1024)))
blue_merged = Image.new("RGBA", (1024, 3072))
ImageDraw.Draw(blue_merged).rectangle((384, 180, 640, 740), fill="blue")
BLUE_MERGED = png(blue_merged)
cinema = Image.new("RGBA", (1024, 1024))
draw = ImageDraw.Draw(cinema)
draw.rectangle((0, 0, 1023, 69), fill="black")
draw.rectangle((0, 407, 1023, 476), fill="black")
CINEMA = png(cinema)
mask = Image.new("RGB", (1024, 1024), "black")
ImageDraw.Draw(mask).polygon([(464, 0), (1023, 0), (1023, 625), (250, 625)], fill="white")
MASK = png(mask)
SUB_BACKGROUND = png(Image.new("RGB", (1344, 626), "red"))
META = {"id": 5060000, "faceX": 384, "faceY": 146, "offsetX": 2, "offsetY": 124, "extendData": {}}
SCRIPT = """[enableFullScreen]
[scene 293500]
[charaSet E 5060000 1 ビショーネ]
[charaFadein E 0 1]
＠ビショーネ
Atlas metadata placement.
[k]
"""
# Exact commands before the screenshot's dialogue in 9415900210.
MOVED = """[enableFullScreen]
[scene 293500]
[sceneSet T 293500 1]
[charaScale T 1.2]
[charaFadein T 0.5 0,-220]
[charaMoveEase T 50,-220 1.0 easeOutSine]
＠ビショーネ
まあまあ、地元だからって全部そのへんのことが
[k]
"""
MASKED = """[enableFullScreen]
[scene 293500]
[sceneSet O 294100 1]
[charaFadein O 0 1]
[charaLayer O sub #A]
[charaSet B 5036001 1 切入人物]
[charaFadein B 0 0,250]
[charaDepth B 2]
[charaLayer B sub #A]
[subCameraFilter #A maskEdge cut359_mask16 5 0,0,0,255]
[subRenderFadein #A 0 0,-270]
＠旁白
斜切蒙版。
[k]
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    pending_masks = []
    defer_mask = False

    def assets(route):
        url = route.request.url
        if "missing_1344_626" in url:
            route.fulfill(status=404, body="")
        elif "cut359_mask16/cut359_mask16.png" in url:
            if defer_mask:
                pending_masks.append(route)
            else:
                route.fulfill(content_type="image/png", body=MASK)
        elif "cut063_cinema_fs/cut063_cinema_fs.png" in url:
            route.fulfill(content_type="image/png", body=CINEMA)
        elif "back294100_1344_626.png" in url:
            route.fulfill(content_type="image/png", body=SUB_BACKGROUND)
        elif "/CharaFigure/5036001/5036001_merged.png" in url:
            route.fulfill(content_type="image/png", body=BLUE_MERGED)
        else:
            image = WIDE if "_1344_626" in url else MERGED if "_merged" in url else TEXTURE if "CharaFigure" in url else LEGACY
            route.fulfill(status=200, content_type="image/png", body=image, headers={"access-control-allow-origin": "*"})

    page.route("https://static.atlasacademy.io/**", assets)
    def metadata(route):
        cid = int(parse_qs(urlparse(route.request.url).query)["charaId"][0])
        route.fulfill(json=[{**META, "id": cid}])
    page.route("**/atlas-api/raw/JP/svtScript?*", metadata)
    page.goto(URL + "/tests/fixtures/atlas_alignment.html", wait_until="networkidle")
    page.wait_for_function("window.fixtureReady")

    for width, height in [(1344, 576), (1024, 576), (780, 440)]:
        page.set_viewport_size({"width": width, "height": height})
        page.evaluate("source => window.renderFrame(source)", SCRIPT)
        page.locator(".character-sprite canvas.ready").wait_for()
        page.wait_for_function("document.querySelector('.scene-image')?.complete")
        unit = min(width / 1024, height / 576)
        background = page.locator(".scene-image").bounding_box()
        assert abs(background["width"] - 1344 * unit) < 0.1, background
        assert abs(background["height"] - 626 * unit) < 0.1, background
        assert abs(background["y"] - (height - 626 * unit) / 2) < 0.1, background
        # Inspect the final pixels; Atlas images can legitimately taint canvas.
        screenshot = page.screenshot()
        pixels = Image.open(io.BytesIO(screenshot)).convert("RGB")
        red = Image.new("L", pixels.size)
        channels = pixels.tobytes()
        red.putdata([255 if r > 240 and g < 10 and b < 10 else 0 for r, g, b in zip(channels[0::3], channels[1::3], channels[2::3])])
        bounds = red.getbbox()
        assert bounds is not None
        # Independent Atlas Scene formula: native source pixels + metadata.
        expected_x = width / 2 + (-512 + 2 * META["offsetX"] + 384) * unit
        expected_y = height / 2 + (-288 - META["offsetY"] + 180) * unit
        assert abs(bounds[0] - expected_x) < 1.5, bounds
        assert abs(bounds[1] - expected_y) < 1.5, bounds
        (OUT / f"metadata-{width}.png").write_bytes(screenshot)
        original_box = page.locator(".character-sprite").bounding_box()
        page.evaluate("source => window.renderFrame(source)", SCRIPT.replace("＠", "[charaFace E 2]\n＠"))
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        assert page.locator(".character-sprite").bounding_box() == original_box

        page.evaluate("source => window.renderFrame(source)", SCRIPT.replace("＠", "[charaScale E 1.2]\n＠"))
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        scaled_pixels = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
        channels = scaled_pixels.tobytes()
        scaled_red = Image.new("L", scaled_pixels.size)
        scaled_red.putdata([255 if r > 240 and g < 10 and b < 10 else 0 for r, g, b in zip(channels[0::3], channels[1::3], channels[2::3])])
        # Scaling preserves the source bitmap's metadata origin, not screen center.
        scaled_top = (height - 576 * unit) / 2 + (-META["offsetY"] + 180 * 1.2) * unit
        assert abs(scaled_red.getbbox()[1] - scaled_top) < 1.5

        page.evaluate("source => window.renderFrame(source)", MOVED)
        layer = page.locator('.stage-layer-sprite[data-slot="T"]')
        layer.wait_for()
        page.wait_for_function("document.querySelector('.stage-layer-sprite')?.complete")
        box = layer.bounding_box()
        assert box["x"] <= 0 and box["y"] <= 0, box
        assert box["x"] + box["width"] >= width, box
        assert box["y"] + box["height"] >= height - 0.1, box
        page.screenshot(path=str(OUT / f"sceneSet-{width}.png"))

        page.evaluate("source => window.renderFrame(source)", SCRIPT.replace("[scene 293500]", "[scene 293500]\n[pictureFrame cut063_cinema]"))
        frame = page.locator(".adv-picture-frame.cinematic")
        page.wait_for_function("document.querySelector('.adv-picture-frame')?.complete")
        assert frame.get_attribute("src").endswith("/cut063_cinema_fs/cut063_cinema_fs.png")
        assert abs(frame.bounding_box()["width"] - 1344 * unit) < 0.1
        cinema_pixels = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
        assert cinema_pixels.getpixel((width // 2, int(height * 0.05))) == (0, 0, 0)
        assert cinema_pixels.getpixel((width // 2, int(height * 0.95))) == (0, 0, 0)
        assert cinema_pixels.getpixel((width // 10, height // 2)) != (0, 0, 0)

        defer_mask = width == 1344
        page.evaluate("source => window.renderFrame(source)", MASKED)
        if defer_mask:
            page.wait_for_function("document.querySelector('.adv-sub-layer[data-group=\"#A\"]')?.dataset.maskState === 'loading'")
            assert page.locator('.adv-sub-layer[data-group="#A"]').evaluate("el => getComputedStyle(el).opacity") == "0"
            page.wait_for_function("document.querySelector('.scene-image')?.complete")
            assert pending_masks
            for route in pending_masks:
                route.fulfill(content_type="image/png", body=MASK)
            pending_masks.clear()
        defer_mask = False
        page.wait_for_function("document.querySelector('.adv-sub-layer[data-group=\"#A\"]')?.dataset.maskState === 'ready'")
        assert page.locator('.adv-sub-layer[data-group="#A"] .adv-sub-mask').evaluate("el => getComputedStyle(el).maskMode") == "luminance"
        page.wait_for_function("[...document.querySelectorAll('.stage-layer-sprite')].every(i=>i.complete) && [...document.querySelectorAll('.character-sprite canvas')].every(c=>c.classList.contains('ready'))")
        masked_pixels = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
        assert masked_pixels.getpixel((int(width * 0.9), height // 2))[0] > 240
        assert masked_pixels.getpixel((int(width * 0.1), height // 2))[0] < 120
        # subRender y=-270 and chara y=250 must not clip the portrait's head.
        assert masked_pixels.getpixel((int(width * 0.55), int(height * 0.17)))[2] > 240
        page.screenshot(path=str(OUT / f"masked-{width}.png"))

        page.evaluate("source => window.renderFrame(source)", MASKED.replace("[subRenderFadein #A 0 0,-270]", "[subRenderFadein #A 0 0,0]"))
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        edge_pixels = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
        # The native half-width sample keeps this point inside the diagonal;
        # stretching the 626px portion or fitting the whole mask clips it out.
        assert edge_pixels.getpixel((int(width * 0.42), int(height * 0.1)))[2] > 240

    # A prepared sub-camera must stay invisible during the giant's entrance,
    # then reveal its masked contents over the authored 0.2-second fade.
    page.set_viewport_size({"width": 1344, "height": 576})
    entry = MASKED.replace("[subRenderFadein #A 0 0,-270]", "[wt 0.5]\n[subRenderFadein #A 0.2 0,-270]\n[wt 0.3]")
    state = page.evaluate("source => window.startPlayback(source)", entry)
    assert state["subLayers"][0]["visible"] is False
    page.wait_for_function("document.querySelector('.adv-sub-layer')?.dataset.maskState === 'ready' && [...document.querySelectorAll('img')].every(i=>i.complete)")
    assert page.locator(".adv-sub-layer").evaluate("el => getComputedStyle(el).opacity") == "0"
    state = page.evaluate("window.advancePlayback(500)")
    assert state["subLayers"][0]["alpha"] == 0
    state = page.evaluate("window.advancePlayback(100)")
    assert abs(state["subLayers"][0]["alpha"] - 0.5) < 0.001
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    midpoint = Image.open(io.BytesIO(page.screenshot())).convert("RGB").getpixel((1209, 288))
    assert all(abs(actual - expected) <= 2 for actual, expected in zip(midpoint, (145, 36, 46))), midpoint
    state = page.evaluate("window.advancePlayback(100)")
    assert abs(state["subLayers"][0]["alpha"] - 1) < 0.001

    # The second figure in 9415900210 uses Put + FadeTime rather than Fadein.
    # Check its actual pixels as it slides in alongside the first figure.
    pair = """[enableFullScreen]
[scene 293500]
[charaSet A 5060000 1]
[charaSet B 5036001 1]
[charaFadein A 0 -200,0]
[charaPut B 350,0]
[charaMoveEase B 250,0 0.8 easeOutSine]
[charaFadeTime B 0.8 1]
[wt 1]
＠旁白
同框。
[k]
"""
    page.evaluate("source => window.startPlayback(source)", pair)
    page.wait_for_function("[...document.querySelectorAll('.character-sprite canvas')].length === 2 && [...document.querySelectorAll('.character-sprite canvas')].every(c=>c.classList.contains('ready'))")
    page.evaluate("window.advancePlayback(400)")
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    halfway = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    assert halfway.getpixel((950, 200))[2] > 165
    page.evaluate("window.advancePlayback(400)")
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    together = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    assert together.getpixel((450, 200)) == (255, 0, 0)
    assert together.getpixel((950, 200)) == (0, 0, 255)

    # Pixel checks distinguish a sweep's direction from its inverse. Check
    # both covering and revealing, in all four directions used by the scripts.
    for direction, first, last in [
        ("rectangleStripLeftToRight", (134, 288), (1209, 288)),
        ("rectangleStripRightToLeft", (1209, 288), (134, 288)),
        ("rectangleStripUpToDown", (672, 57), (672, 518)),
        ("rectangleStripDownToUp", (672, 518), (672, 57)),
    ]:
        for kind in ["out", "in"]:
            source = f"[enableFullScreen]\n[scene 293500]\n[wipe{kind} {direction} 1.0 1]\n[wait wipe]\n＠旁白\n擦屏\n[k]"
            page.evaluate("source => window.startPlayback(source)", source)
            page.evaluate("window.advancePlayback(250)")
            page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
            pixels = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
            assert (pixels.getpixel(first) == (0, 0, 0)) == (kind == "out"), (direction, kind, "first")
            assert (pixels.getpixel(last) == (0, 0, 0)) == (kind == "in"), (direction, kind, "last")
            state = page.evaluate("window.advancePlayback(750)")
            assert state["wipe"]["alpha"] == (1 if kind == "out" else 0)

    page.evaluate("window.renderFallback('missing')")
    page.wait_for_function("document.querySelector('#fallback-probe')?.src.endsWith('backmissing.png') && document.querySelector('#fallback-probe')?.naturalWidth > 0")
    page.evaluate("window.renderFallback('293500')")
    page.wait_for_function("document.querySelector('#fallback-probe')?.src.endsWith('back293500_1344_626.png') && document.querySelector('#fallback-probe')?.naturalWidth === 1344")
    assert not errors, errors
    browser.close()
if server:
    server.shutdown()
    server.server_close()
print("Atlas alignment checks passed (wide/16:9/mobile, metadata, moved background, cinema, masked fade, wipe directions, asset fallback)")
