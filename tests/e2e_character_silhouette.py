"""Pixel regression for 9415900320's white giant transformation, fully offline.

Run against Vite with FGO_E2E_URL, or a built atlas_alignment.html fixture
with FGO_ALIGNMENT_SITE (see e2e_atlas_alignment.py).
"""
import io
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots" / "character-silhouette"
URL = os.environ.get("FGO_E2E_URL", "http://127.0.0.1:5187")
BACKGROUND = (35, 73, 92)
BODY = (204, 80, 40)
FACE = (40, 180, 220)
META = {"id": 1098364700, "faceX": 384, "faceY": 130,
        "offsetX": 39, "offsetY": 124, "extendData": {}}


def png(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def pixels(image):
    data = image.tobytes()
    return zip(data[0::3], data[1::3], data[2::3])


merged = Image.new("RGBA", (1024, 1536))
draw = ImageDraw.Draw(merged)
draw.rectangle((384, 180, 639, 740), fill=BODY + (255,))
# Spare expressions must never become additional silhouettes.
for y in range(768, 1536, 256):
    for x in range(0, 1024, 256):
        draw.ellipse((x + 32, y + 32, x + 223, y + 223), fill=FACE + (255,))
MERGED = png(merged)
TEXTURE = png(merged.crop((0, 0, 1024, 1024)))
EQUIPMENT = png(merged.crop((0, 0, 1024, 768)))
BACK = png(Image.new("RGB", (1344, 626), BACKGROUND))


def script(commands="", kind="charaSet", face=2, scale=1):
    return f"""[enableFullScreen]
[scene 293500]
[{kind} K 1098364700 1 巨大化演出用]
[charaFace K {face}]
[charaScale K {scale}]
{commands}
[charaFadein K 0 1]
＠K：巨大化演出用
剪影回归。
[k]
"""


server = None
site = os.environ.get("FGO_ALIGNMENT_SITE")
if site:
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=site))
    Thread(target=server.serve_forever, daemon=True).start()
    URL = f"http://127.0.0.1:{server.server_port}"

OUT.mkdir(parents=True, exist_ok=True)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        def assets(route):
            url = route.request.url
            body = MERGED if "_merged" in url else TEXTURE if "CharaFigure" in url else EQUIPMENT if "CharaGraph" in url else BACK
            # Deliberately omit CORS headers: tinting must also work on a
            # composed canvas whose pixels cannot be read back or exported.
            route.fulfill(content_type="image/png", body=body)

        page.route("https://static.atlasacademy.io/**", assets)
        page.route("**/atlas-api/raw/JP/svtScript?*", lambda route: route.fulfill(json=[META]))
        page.route("**/atlas-api/nice/JP/equip/*", lambda route: route.fulfill(json={
            "extraAssets": {"charaGraph": {"ascension": {"0": "https://static.atlasacademy.io/JP/CharaGraph/test.png"}}}
        }))
        page.goto(URL + "/tests/fixtures/atlas_alignment.html", wait_until="networkidle")
        page.wait_for_function("window.fixtureReady")

        def render(source):
            page.evaluate("source => window.renderFrame(source)", source)
            page.wait_for_function("""() => {
                const sprite = document.querySelector('.character-sprite');
                const image = sprite?.querySelector('img');
                return document.querySelector('.scene-image')?.complete &&
                    (image ? image.complete && image.naturalWidth > 0 : sprite?.querySelector('canvas.ready'));
            }""")
            page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
            return Image.open(io.BytesIO(page.screenshot())).convert("RGB")

        for width, height in [(1344, 576), (1024, 576), (780, 440)]:
            page.set_viewport_size({"width": width, "height": height})
            for kind, face, scale in [("charaSet", 2, 1), ("charaSet", 3, 1.3), ("equipSet", 0, 1)]:
                normal = render(script(kind=kind, face=face, scale=scale))
                reference = list(pixels(normal))
                assert BODY in reference
                if kind == "charaSet":
                    assert FACE in reference
                for color, expected in [("FFFFFFFF", (255, 255, 255)),
                                        ("FF8000FF", (255, 128, 0)),
                                        ("000000FF", (0, 0, 0)),
                                        ("00000080", (17, 36, 46))]:
                    tinted = render(script(f"[charaFilter K silhouette {color}]", kind, face, scale))
                    tinted.save(OUT / f"{kind}-{width}-{face}-{color}.png")
                    for original, actual in zip(reference, pixels(tinted)):
                        if original == BACKGROUND:
                            assert actual == BACKGROUND, (width, kind, color, "unused face or shifted figure", actual)
                        elif original in (BODY, FACE):
                            assert all(abs(a - b) <= 1 for a, b in zip(actual, expected)), (width, kind, color, "body/face tint", actual)

                # Switching the same mounted sprite back to normal must clear
                # the filter without retaining a stale tint or expression.
                restored = render(script("[charaFilter K normal]", kind, face, scale))
                assert restored.tobytes() == normal.tobytes(), (width, kind, face, "normal reset")

        page.set_viewport_size({"width": 1344, "height": 576})
        white = render(script("[charaFilter K silhouette FFFFFFFF]"))
        shadowed = render(script("[charaFilter K silhouette FFFFFFFF]\n[charaShadow K true]"))
        assert sum(pixel == (255, 255, 255) for pixel in pixels(shadowed)) == sum(pixel == (255, 255, 255) for pixel in pixels(white))
        assert shadowed.tobytes() != white.tobytes(), "shadow must remain visible alongside the tint"
        assert not errors, errors
        browser.close()
finally:
    if server:
        server.shutdown()
        server.server_close()

print("Character silhouette checks passed (white/color/alpha, cropped expressions, scaling, shadow, normal reset, canvas/image, wide/16:9/mobile, no CORS)")
