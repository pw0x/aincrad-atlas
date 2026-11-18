from contextlib import closing
from http.client import HTTPConnection
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from atlas import Handler, ThreadingHTTPServer


class ArchiveTest(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.http = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.http.version = 'a' * 40
        self.http.archive = Path(folder.name) / 'atlas.sqlite3'
        self.addCleanup(self.http.server_close)
        self.addCleanup(self.http.shutdown)
        threading.Thread(target=self.http.serve_forever, daemon=True).start()

    def request(self, method, path):
        with closing(HTTPConnection('127.0.0.1', self.http.server_port, timeout=5)) as client:
            client.request(method, path)
            result = client.getresponse()
            return result.status, result.headers, result.read()

    def test_archived_issue_uses_original_capture_and_github_task(self):
        identifier = 'a' * 32
        base = '/api/feedback/' + identifier
        image = b'archived pixels'
        with closing(sqlite3.connect(self.http.archive)) as db:
            db.execute('CREATE TABLE feedback(id TEXT, issue INTEGER, image BLOB)')
            db.execute('INSERT INTO feedback VALUES (?,?,?)', (identifier, 9, image))
            db.commit()
        url = 'https://github.com/pw0x/aincrad-atlas/issues/9'
        self.assertEqual(json.loads(self.request('GET', base)[2])['url'], url)
        code, headers, _ = self.request('GET', base + '/task')
        self.assertEqual((code, headers['Location']), (302, url))
        code, headers, data = self.request('GET', base + '/capture.jpg')
        self.assertEqual((code, headers['Content-Type'], data), (200, 'image/jpeg', image))
        self.assertEqual(self.request('HEAD', base + '/capture.jpg')[2], b'')
        self.assertEqual(self.request('GET', '/api/feedback/' + 'f' * 32)[0], 404)

    def test_preview_needs_no_queue_or_archive(self):
        status, _, data = self.request('GET', '/api/version')
        self.assertEqual((status, json.loads(data)), (200, {'version': self.http.version}))
        self.assertEqual(self.request('GET', '/api/progress')[0], 404)
        self.assertEqual(self.request('GET', '/api/feedback/' + 'a' * 32)[0], 404)
        for path in ('/api/feedback', '/api/worker/lease'):
            self.assertEqual(self.request('POST', path)[0], 405)
        self.assertFalse(self.http.archive.exists())
