"""Serve the built atlas from the loopback address, including its local media."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import sys
import urllib.request
import webbrowser

BUILD = Path(__file__).resolve().parent / "dist"
PORT = 18764
URL = f"http://127.0.0.1:{PORT}/"


class AtlasHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".wasm": "application/wasm",
        ".glb": "model/gltf-binary",
        ".webp": "image/webp",
    }
    server_version = "AincradAtlas/1"

    def send_head(self):
        self.gzip_response = False
        self.original_file = None
        accepted = self.headers.get("Accept-Encoding", "")
        for item in accepted.lower().split(","):
            name, _, options = item.strip().partition(";")
            if name != "gzip":
                continue
            if re.match(r"\s*q\s*=\s*0(?:\.0*)?\s*$", options):
                break
            original = Path(super().translate_path(self.path))
            if original.is_dir() and self.path.split("?")[0].endswith("/"):
                original = original / "index.html"
            if original.is_file() and Path(str(original)+".gz").is_file():
                self.original_file = str(original)
                self.gzip_response = True
            break
        return super().send_head()

    def translate_path(self, path):
        if getattr(self, "gzip_response", False):
            return self.original_file + ".gz"
        return super().translate_path(path)

    def guess_type(self, path):
        return super().guess_type(self.original_file or path)

    def end_headers(self):
        if getattr(self, "gzip_response", False):
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Vary", "Accept-Encoding")
        fingerprint = re.search(r"-[A-Za-z0-9_-]{8}\.[a-z0-9]+$", self.path)
        self.send_header("Cache-Control", "public, max-age=31536000, immutable" if fingerprint else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--open", action="store_true", dest="open_browser")
    args = parser.parse_args()
    if not (BUILD / "floor-22.html").exists():
        sys.exit("Missing dist/floor-22.html. Run npm ci and npm run build first.")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(AtlasHandler, directory=str(BUILD)))
    except OSError:
        with urllib.request.urlopen(URL, timeout=3) as response:
            if not response.headers.get("Server", "").startswith("AincradAtlas/"):
                sys.exit(f"Another service is using port {PORT}.")
        if args.open_browser:
            webbrowser.open(URL)
        return
    print(f"Aincrad Atlas: {URL}", flush=True)
    if args.open_browser:
        webbrowser.open(URL)
    with server:
        server.serve_forever()


if __name__ == "__main__":
    main()
