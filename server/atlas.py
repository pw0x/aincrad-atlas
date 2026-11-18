"""Loopback HTTP API for the Atlas site. Run behind the site's TLS reverse proxy."""

import hmac
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import logging
import os
from pathlib import Path
import re
import sys
import threading
import time
from urllib.parse import urlsplit

import dispatcher
from feedback import MAX_BODY, MAX_STATE_BYTES, MIN_FREE_BYTES, Problem, Store


def snapshot(body, repo):
    # Accept just the bounded public projection of the GitHub response, including only this repository's links.
    def utc(value):
        if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ', value):
            return False
        datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ')
        return True
    def title(value):
        return isinstance(value, str) and len(value) <= 220
    try:
        changes, tasks = body['changes'], body['tasks']
        count = body['openTaskCount']
        if not (isinstance(changes, list) and len(changes) <= 8 and isinstance(tasks, list) and
                len(tasks) <= 12 and type(count) is int and count >= len(tasks) and utc(body['updatedAt'])):
            raise ValueError
        base = 'https://github.com/' + repo
        for row in changes:
            if not (re.fullmatch('[a-f0-9]{40}', row['sha']) and title(row['title']) and utc(row['date'])
                    and row['url'] == base + '/commit/' + row['sha']):
                raise ValueError
        for row in tasks:
            if not (type(row['number']) is int and row['number'] > 0 and title(row['title']) and utc(row['date'])
                    and row['url'] == base + '/issues/' + str(row['number']) and isinstance(row['labels'], list)
                    and all(isinstance(x, str) and len(x) <= 50 for x in row['labels'])):
                raise ValueError
        return {key: body[key] for key in ('updatedAt', 'changes', 'tasks', 'openTaskCount')}
    except (KeyError, TypeError, ValueError):
        raise Problem(422, 'Invalid progress snapshot') from None


class Handler(BaseHTTPRequestHandler):
    server_version = 'AtlasAPI'
    sys_version = ''
    timeout = 20
    intake_slots = threading.BoundedSemaphore(4)

    def reply(self, code, data, content_type='application/json; charset=utf-8', cache='no-store'):
        if isinstance(data, dict):
            data = json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', cache)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
        if code == 429:
            self.send_header('Retry-After', '3600')
        elif code == 503:
            self.send_header('Retry-After', '60')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

    def payload(self, maximum):
        if self.headers.get_content_type() != 'application/json':
            raise Problem(415, 'Content-Type application/json required')
        lengths = self.headers.get_all('Content-Length', [])
        if len(lengths) != 1 or not re.fullmatch(r'[0-9]{1,9}', lengths[0]) or self.headers.get('Transfer-Encoding'):
            raise Problem(411, 'Valid Content-Length required')
        size = int(lengths[0])
        if size > maximum:
            raise Problem(413, 'Request body too large')
        data = self.rfile.read(size)
        try:
            obj = json.loads(data.decode('utf-8'))
            if not isinstance(obj, dict):
                raise ValueError
            return obj
        except (ValueError, UnicodeError, RecursionError):
            raise Problem(400, 'Invalid JSON object') from None

    def worker(self, action):
        token = self.server.worker_secret
        authorization = self.headers.get('Authorization', '')
        if not token or not hmac.compare_digest(authorization.encode(), ('Bearer ' + token).encode()):
            raise Problem(403, 'Worker authentication required')
        body = self.payload(65536)
        store = self.server.store
        if action == 'lease':
            return self.reply(200, {'job': store.claim()})
        if action in ('ack', 'retry'):
            store.finish(body, action == 'ack')
        elif action == 'progress':
            store.save_progress(snapshot(body, store.repo))
        else:
            raise Problem(404, 'Endpoint not found')
        self.reply(200, {'ok': True})

    def handle_api(self):
        path = urlsplit(self.path).path
        store = self.server.store
        if self.command in ('GET', 'HEAD'):
            if path == '/api/version':
                return self.reply(200, {'version': store.version})
            if path == '/api/progress':
                return self.reply(200, store.progress(), cache='public, max-age=30')
            match = re.fullmatch(r'/api/feedback/([a-f0-9]{32})(/capture\.jpg)?', path)
            if match:
                if match[2]:
                    return self.reply(200, store.capture(match[1]), 'image/jpeg', cache='public, max-age=86400')
                return self.reply(200, store.lookup(match[1]))
        elif self.command == 'POST':
            if path.startswith('/api/worker/'):
                return self.worker(path[len('/api/worker/'):])
            if path == '/api/feedback':
                if (self.headers.get_all('Origin', []) != [store.origin] or
                        self.headers.get('Sec-Fetch-Site', 'same-origin') != 'same-origin'):
                    raise Problem(403, 'Same-origin submission required')
                address = self.client_address[0]
                if self.server.trust_proxy:
                    # The reverse proxy must overwrite this header with the verified connection address.
                    try:
                        address = str(ipaddress.ip_address(self.headers.get('X-Real-IP', '')))
                    except ValueError:
                        raise Problem(400, 'Client address missing from trusted proxy') from None
                if not self.intake_slots.acquire(blocking=False):
                    raise Problem(503, '正在处理其他现场记录，请稍后重试。')
                try:
                    result = store.submit(self.payload(MAX_BODY), address)
                finally:
                    self.intake_slots.release()
                return self.reply(200 if result['status'] == 'dispatched' else 202, result)
        raise Problem(404, 'Endpoint not found')

    def run_api(self):
        try:
            self.handle_api()
        except Problem as error:
            self.reply(error.status, {'error': str(error)})
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            self.close_connection = True
        except Exception as error:
            logging.error('API request failed (%s)', dispatcher.failure(error))
            self.reply(503, {'error': 'Service temporarily unavailable'})

    do_GET = run_api
    do_HEAD = run_api
    do_POST = run_api

    def log_message(self, fmt, *args):
        # Keep visitor identifiers, IPs, free text and credentials out of service logs.
        pass


def synchronize(store, token_file, stop):
    def token():
        return Path(token_file).read_text().strip() if token_file else None
    def refresh():
        store.save_progress(snapshot(dispatcher.progress(store.repo, token()), store.repo))
    next_refresh = 0
    while not stop.is_set():
        if token_file:
            try:
                dispatched = dispatcher.deliver(store.repo, token(), store.claim, store.finish)
                if dispatched:
                    next_refresh = 0
            except Exception as err:
                logging.warning('Delivery will retry (%s)', dispatcher.failure(err))
        if time.monotonic() >= next_refresh:
            try:
                refresh()
            except Exception as err:
                logging.warning('Keeping last progress snapshot (%s)', dispatcher.failure(err))
            next_refresh = time.monotonic() + 300
        stop.wait(5 if token_file else 300)


def serve():
    path = Path(os.environ['ATLAS_STATE_DIR'])
    path.mkdir(parents=True, exist_ok=True)
    origin = dispatcher.public_origin(os.environ['ATLAS_PUBLIC_ORIGIN'], local=True)
    repo = dispatcher.repo_name(os.environ.get('ATLAS_REPO', 'pw0x/aincrad-atlas'))
    version = os.environ['ATLAS_VERSION']
    if not re.fullmatch('[a-zA-Z0-9_.-]{1,80}', version):
        raise ValueError('Invalid ATLAS_VERSION')
    secret = os.environ.get('ATLAS_WORKER_SECRET', '')
    token_file = os.environ.get('ATLAS_GITHUB_TOKEN_FILE')
    if (secret and len(secret) < 32) or (not secret and not token_file):
        raise ValueError('Configure a dedicated 32+ character worker secret or a repository-scoped token file')
    store = Store(path / 'atlas.sqlite3', origin, version, repo,
                  min_free_bytes=int(os.environ.get('ATLAS_MIN_FREE_BYTES', MIN_FREE_BYTES)),
                  max_state_bytes=int(os.environ.get('ATLAS_MAX_STATE_BYTES', MAX_STATE_BYTES)))
    stop = threading.Event()
    with ThreadingHTTPServer((os.environ.get('ATLAS_BIND', '127.0.0.1'), int(os.environ.get('ATLAS_PORT', 8093))), Handler) as server:
        server.store = store
        server.worker_secret = secret
        server.trust_proxy = os.environ.get('ATLAS_TRUST_PROXY') == '1'
        threading.Thread(target=synchronize, args=(store, token_file, stop), daemon=True).start()
        logging.info('Atlas API listening on %s', server.server_address)
        try:
            server.serve_forever()
        finally:
            stop.set()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    if sys.argv[1:] != ['serve']:
        sys.exit('Usage: python3 server/atlas.py serve')
    serve()
