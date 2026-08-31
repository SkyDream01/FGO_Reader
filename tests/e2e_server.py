"""Static e2e server for the built app.

Serves `dist/` and proxies `/atlas-api/*` to api.atlasacademy.io, replacing
the vite dev proxy so the Python e2e suite can run against the production
build without Node (`python tests/e2e_server.py [port]`).
"""

import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DIST = Path(__file__).resolve().parents[1] / "dist"
ATLAS_ORIGIN = "https://api.atlasacademy.io"


class E2EHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def log_message(self, format, *args):  # noqa: A002 - stdlib signature
        pass

    def _proxy_atlas(self):
        # Mirror the vite dev proxy: strip the /atlas-api prefix.
        target = f"{ATLAS_ORIGIN}{self.path[len('/atlas-api'):]}"
        try:
            request = urllib.request.Request(target, headers={"User-Agent": "fgo-reader-e2e"})
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
                content_type = response.headers.get("Content-Type", "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
        except urllib.error.HTTPError as error:
            self.send_response(error.code)
            self.end_headers()
        except Exception:
            self.send_response(502)
            self.end_headers()

    def do_GET(self):
        if self.path.startswith("/atlas-api/"):
            self._proxy_atlas()
            return
        super().do_GET()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5199
    server = ThreadingHTTPServer(("127.0.0.1", port), E2EHandler)
    print(f"e2e server on http://127.0.0.1:{port} (dist + atlas proxy)")
    server.serve_forever()


if __name__ == "__main__":
    main()
