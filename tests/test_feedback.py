import base64
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.request import Request, urlopen
import uuid

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from atlas import Handler, ThreadingHTTPServer, snapshot
import dispatcher
from feedback import Problem, Store


def payload():
    out = io.BytesIO()
    Image.new('RGB', (20, 12), '#6788c3').save(out, 'JPEG')
    return {
        'requestId': str(uuid.uuid4()), 'scene': 'town', 'view': 'glasswork', 'version': '1ac2',
        'message': '北廊窗玻璃\n@someone **observation**',
        'viewport': {'width': 1280, 'height': 720, 'dpr': 1.25},
        'camera': {'position': [2, 5, -7], 'target': [1.5, 0, 4]},
        'screenshot': 'data:image/jpeg;base64,' + base64.b64encode(out.getvalue() + b'private trailer').decode(),
    }


class FeedbackTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.path = Path(folder.name) / 'atlas.sqlite3'
        self.origin = 'https://atlas.example.org'
        self.repo = 'pw0x/aincrad-atlas'
        self.store = Store(self.path, self.origin, 'abc123', self.repo)

    def test_concurrent_submit_and_dispatch_survive_restart(self):
        body = payload()
        body['version'] = 'ab12' * 10
        with ThreadPoolExecutor(max_workers=4) as pool:
            ids = list(pool.map(lambda _: self.store.submit(body, '192.0.2.1')['id'], range(4)))
        self.assertEqual(len(set(ids)), 1)
        store = Store(self.path, self.origin, 'newcommit', self.repo)
        jpg = store.capture(ids[0])
        self.assertNotIn(b'private trailer', jpg)
        with Image.open(io.BytesIO(jpg)) as image:
            self.assertEqual(image.size, (20, 12))
            channels = zip(image.getpixel((1, 1)), (103, 136, 195))
            self.assertTrue(all(abs(actual - expected) <= 3 for actual, expected in channels))
        with ThreadPoolExecutor(max_workers=4) as pool:
            jobs = [j for j in pool.map(lambda _: store.claim(), range(4)) if j]
        self.assertEqual(len(jobs), 1)
        job = jobs[0]
        self.assertEqual(job['issue']['labels'], ['visitor-feedback', 'agent-ready', 'scene:town'])
        body_md = job['issue']['body']
        self.assertIn('floor-01.html?pose=2,5,-7,1.5,0,4#glasswork', body_md)
        self.assertIn('/capture.jpg)', body_md)
        self.assertIn('    @someone **observation**', body_md)
        self.assertIn('untrusted evidence', body_md)
        self.assertTrue(body_md.endswith(job['marker']))
        self.assertIn('北廊窗玻璃', job['issue']['title'])
        self.assertNotIn('@someone', job['issue']['title'])
        self.assertIn('`abc123`', body_md)
        self.assertIn(f'https://github.com/{self.repo}/commit/' + body['version'], body_md)
        ack = {'id': ids[0], 'lease': job['lease'], 'number': 55}
        store.finish(ack, True)
        store.finish(ack, True)
        self.assertEqual(store.submit(body, '192.0.2.1'), {
            'id': ids[0], 'status': 'dispatched', 'url': 'https://github.com/pw0x/aincrad-atlas/issues/55'})
        self.assertIsNone(store.claim())
        with self.assertRaises(Problem) as conflict:
            store.submit(dict(body, message='changed'), '192.0.2.1')
        self.assertEqual(conflict.exception.status, 409)

    def test_routes_each_scene_and_provisions_labels_idempotently(self):
        expected = {'visitor-feedback', 'agent-ready'}
        for scene in ('castle', 'town', 'cabin'):
            self.store.submit(dict(payload(), scene=scene, labels=['scene:other']), '::1')
            labels = self.store.claim()['issue']['labels']
            self.assertEqual(labels, ['visitor-feedback', 'agent-ready', 'scene:' + scene])
            expected.update(labels)
        created = set()
        def github(path, token, body=None):
            if body is not None:
                self.assertNotIn(body['name'], created)
                created.add(body['name'])
            elif unquote(path.split('/')[-1]) not in created:
                raise HTTPError(path, 404, 'Missing label', {}, None)
        with patch('dispatcher.github', side_effect=github):
            dispatcher.ensure_labels(self.repo, 'test')
            dispatcher.ensure_labels(self.repo, 'test')
        self.assertEqual(created, expected)

    def test_progress_reads_direct_issue_pages_skips_prs_and_counts_beyond_preview(self):
        def issue(n):
            return {'number': n, 'title': f'Task {n}', 'html_url': f'https://github.com/{self.repo}/issues/{n}',
                    'updated_at': '2026-11-18T01:23:00Z', 'labels': [{'name': 'agent-ready'}]}
        pages = []
        def github(path, token):
            url = urlsplit(path)
            if url.path.endswith('/commits'):
                return []
            self.assertEqual(url.path, f'/repos/{self.repo}/issues')
            params = parse_qs(url.query)
            self.assertEqual(params['state'], ['open'])
            self.assertEqual(params['labels'], ['agent-ready'])
            self.assertEqual(params['per_page'], ['100'])
            page = int(params['page'][0])
            pages.append(page)
            if page == 1:
                return [issue(n) for n in range(1, 11)] + [dict(issue(n), pull_request={}) for n in range(11, 101)]
            return [issue(10)] + [issue(n) for n in range(101, 105)]
        with patch('dispatcher.github', side_effect=github):
            summary = dispatcher.progress(self.repo)
        self.assertEqual(pages, [1, 2])
        self.assertEqual(summary['openTaskCount'], 14)
        self.assertEqual([task['number'] for task in summary['tasks']], [*range(1, 11), 101, 102])

    def test_quotas_and_malformed_or_missing_image(self):
        body = payload()
        with self.assertRaises(Problem):
            self.store.submit(dict(body, screenshot='data:image/jpeg;base64,aHRtbA=='), '::1')
        body.update(screenshot=None, camera=None, view='')
        identifier = self.store.submit(body, '::1')['id']
        with self.assertRaises(Problem) as missing:
            self.store.capture(identifier)
        self.assertEqual(missing.exception.status, 404)
        for _ in range(4):
            self.store.submit(dict(body, requestId=str(uuid.uuid4())), '::1')
        with self.assertRaises(Problem) as limited:
            self.store.submit(dict(body, requestId=str(uuid.uuid4())), '::1')
        self.assertEqual(limited.exception.status, 429)
        self.assertEqual(self.store.submit(body, '::1')['id'], identifier)

    def test_lost_create_response_reconciles_closed_issue(self):
        body = payload()
        identifier = self.store.submit(body, '::1')['id']
        external = []

        def github(path, token, data=None):
            if '/labels/' in path:
                return {}
            if data:
                # An unrelated visitor's own issue can quote the legitimate publisher's entire report.
                external.append(dict(data, number=18, state='open', author_association='NONE', user={'login': 'guest'}))
                external.append(dict(data, number=29, state='closed', user={'login': 'github-actions[bot]', 'type': 'Bot'}))
                raise TimeoutError()
            self.assertIn('state=all', path)
            return external

        with patch('dispatcher.github', side_effect=github):
            with self.assertRaises(TimeoutError):
                dispatcher.deliver(self.repo, 'test', self.store.claim, self.store.finish)
            with closing(self.store.connect()) as db, db:
                db.execute('UPDATE feedback SET next_try=0')
            self.assertEqual(dispatcher.deliver(self.repo, 'test', self.store.claim, self.store.finish), 1)
        self.assertEqual(len(external), 2)
        self.assertTrue(self.store.lookup(identifier)['url'].endswith('/29'))

    def test_existing_receipts_and_worker_survive_storage_pressure(self):
        body = payload()
        receipt = self.store.submit(body, '::1')
        for budgets in ({'min_free_bytes': 10**24}, {'max_state_bytes': 80}):
            store = Store(self.path, self.origin, 'revision', self.repo, **budgets)
            self.assertEqual(store.submit(body, '::1'), receipt)
            with self.assertRaises(Problem) as blocked:
                store.submit(dict(body, requestId=str(uuid.uuid4())), '::1')
            self.assertEqual(blocked.exception.status, 503)
        self.assertEqual(store.claim()['id'], receipt['id'])

    def test_http_boundaries(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        server.store, server.worker_secret, server.trust_proxy = self.store, 's' * 40, False
        base = 'http://127.0.0.1:' + str(server.server_port)
        def req(path, body=None, **extra):
            hdr = {'Content-Type': 'application/json', **extra}
            data = None if body is None else json.dumps(body).encode()
            with urlopen(Request(base + path, data=data, headers=hdr)) as response:
                return response.status, json.load(response)
        self.assertEqual(req('/api/version'), (200, {'version': 'abc123'}))
        self.assertEqual(req('/api/progress')[1]['source'], 'unavailable')
        with patch.object(Handler, 'intake_slots', threading.BoundedSemaphore(0)):
            with self.assertRaises(HTTPError) as busy:
                req('/api/feedback', payload(), Origin=self.origin)
            self.assertEqual(busy.exception.code, 503)
            self.assertTrue(busy.exception.headers.get('Retry-After'))
            busy.exception.close()
            self.assertEqual(req('/api/version')[0], 200)
        for path, body, headers in [('/api/worker/lease', {}, {}), ('/api/feedback', payload(), {'Origin': 'https://wrong.example'}),
                                    ('/api/feedback', payload(), {'Origin': self.origin, 'Sec-Fetch-Site': 'cross-site'})]:
            with self.assertRaises(HTTPError) as refused:
                req(path, body, **headers)
            self.assertEqual(refused.exception.code, 403)
            refused.exception.close()
        code, receipt = req('/api/feedback', payload(), Origin=self.origin)
        self.assertEqual(code, 202)
        uid = receipt['id']
        with urlopen(base + f'/api/feedback/{uid}/capture.jpg') as response:
            self.assertEqual(response.headers['Content-Type'], 'image/jpeg')
        job = req('/api/worker/lease', {}, Authorization='Bearer ' + server.worker_secret)[1]['job']
        self.assertEqual(req('/api/worker/ack', dict(lease=job['lease'], id=uid, number=8), Authorization='Bearer ' + server.worker_secret)[0], 200)
        self.assertTrue(req('/api/feedback/' + uid)[1]['url'].endswith('/8'))
        value = {'changes': [], 'tasks': [], 'openTaskCount': 0, 'updatedAt': '2026-11-01T01:25:00Z'}
        self.assertEqual(req('/api/worker/progress', value, Authorization='Bearer ' + server.worker_secret)[0], 200)
        self.assertEqual(req('/api/progress')[1]['openTaskCount'], 0)
        with self.assertRaises(Problem):
            snapshot(dict(value, changes=[{'sha': 'h' * 40}]), self.repo)


if __name__ == '__main__':
    unittest.main()
