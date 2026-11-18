"""Serve the deployed revision and evidence already referenced by public GitHub issues."""

from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
from urllib.parse import urlsplit


ISSUES = 'https://github.com/pw0x/aincrad-atlas/issues'
RECEIPT = re.compile(r'/api/feedback/([0-9a-f]{32})(?:/(capture\.jpg|task))?')


class Handler(BaseHTTPRequestHandler):
    server_version = 'AtlasArchive'
    sys_version = ''
    timeout = 10

    def reply(self, status, data, *, location=None):
        if isinstance(data, bytes):
            mime = 'image/jpeg'
        else:
            mime = 'application/json; charset=utf-8'
            data = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'public, max-age=86400' if mime == 'image/jpeg' else 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if location:
            self.send_header('Location', location)
        if status == 405:
            self.send_header('Allow', 'GET, HEAD')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/version':
            return self.reply(200, {'version': self.server.version})
        match = RECEIPT.fullmatch(path)
        if not match or not self.server.archive.is_file():
            return self.reply(404, {'error': 'Not found'})
        identifier, resource = match.groups()
        query = ('SELECT image FROM feedback WHERE id = ?' if resource == 'capture.jpg'
                 else 'SELECT issue FROM feedback WHERE id = ?')
        try:
            with closing(sqlite3.connect(self.server.archive.as_uri() + '?mode=ro', uri=True)) as db:
                row = db.execute(query, (identifier,)).fetchone()
        except sqlite3.Error:
            return self.reply(503, {'error': 'Archive unavailable'})
        if row is None:
            return self.reply(404, {'error': 'Receipt not found'})
        if resource == 'capture.jpg':
            if not row[0]:
                return self.reply(404, {'error': 'Capture not found'})
            return self.reply(200, row[0])
        number = row[0]
        if not isinstance(number, int) or number < 1:
            return self.reply(410, {'id': identifier, 'status': 'archived'})
        url = f'{ISSUES}/{number}'
        receipt = {'id': identifier, 'status': 'dispatched', 'url': url}
        if resource == 'task':
            return self.reply(302, receipt, location=url)
        return self.reply(200, receipt)

    do_HEAD = do_GET

    def do_POST(self):
        self.reply(405, {'error': 'Read-only archive'})

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    if sys.argv[1:] != ['serve']:
        sys.exit('Usage: python3 server/atlas.py serve')
    with ThreadingHTTPServer((os.environ.get('ATLAS_BIND', '127.0.0.1'), int(os.environ.get('ATLAS_PORT', 8093))), Handler) as server:
        server.archive = (Path(os.environ.get('ATLAS_STATE_DIR', '/var/lib/aincrad-atlas')) / 'atlas.sqlite3').resolve()
        server.version = os.environ['ATLAS_VERSION']
        server.serve_forever()
