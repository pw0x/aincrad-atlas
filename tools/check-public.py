"""Read-only smoke check of an Aincrad Atlas deployment. Python standard library only."""

import argparse
from html.parser import HTMLParser
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = {}
        self.world = None
        self.ids = set()

    def handle_starttag(self, name, attrs):
        values = dict(attrs)
        if name == 'html':
            self.world = values.get('data-world')
        if 'id' in values:
            self.ids.add(values['id'])
        if name in ('img', 'script') and values.get('src'):
            self.assets[values['src']] = 'image' if name == 'img' else 'script'
        if name == 'link' and values.get('rel') in ('stylesheet', 'modulepreload') and values.get('href'):
            self.assets[values['href']] = 'style' if values['rel'] == 'stylesheet' else 'script'


class SameOrigin(HTTPRedirectHandler):
    def __init__(self, origin):
        self.origin = origin

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url = urlsplit(newurl)
        if (url.scheme, url.netloc) != self.origin:
            raise ValueError('Unexpected cross-origin redirect from ' + req.full_url)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def check(origin, expected):
    parts = urlsplit(origin)
    local = parts.scheme == 'http' and parts.hostname in ('127.0.0.1', 'localhost', '::1')
    if not ((parts.scheme == 'https' or local) and parts.hostname and parts.path in ('', '/')
            and not parts.username and not parts.password and not parts.query and not parts.fragment):
        raise ValueError('Pass an HTTPS site origin or an HTTP loopback origin.')
    endpoint = (parts.scheme, parts.netloc)
    http = build_opener(SameOrigin(endpoint))

    def get(path, accept, sample=False):
        url = urljoin(origin.rstrip('/') + '/', path)
        parsed = urlsplit(url)
        if (parsed.scheme, parsed.netloc) != endpoint:
            raise ValueError('Unexpected cross-origin asset ' + path)
        headers = {'Accept': accept, 'User-Agent': 'Aincrad-Atlas-Public-Check/1'}
        if sample:
            headers['Range'] = 'bytes=0-511'
        with http.open(Request(url, headers=headers), timeout=15) as response:
            if response.status not in ((200, 206) if sample else (200,)):
                raise ValueError(f'{url} returned HTTP {response.status}')
            return response.headers.get_content_type(), response.read(512 if sample else 1024 * 1024)

    assets = {}
    scripts_by_page = {}
    for page, world in (('/', 'castle'), ('/index.html', 'castle'), ('/floor-01.html', 'town'), ('/floor-22.html', 'cabin')):
        mime, raw = get(page, 'text/html')
        doc = Page()
        doc.feed(raw.decode('utf-8'))
        if mime != 'text/html' or world != doc.world or 'atlas' not in doc.ids or 'script' not in doc.assets.values():
            raise ValueError('Unexpected scene or document at ' + page)
        scripts_by_page[page] = set()
        for path, kind in doc.assets.items():
            url = urljoin(urljoin(origin, page), path)
            assets[url] = kind
            if kind == 'script':
                scripts_by_page[page].add(url)
    types = {'script': {'application/javascript', 'text/javascript', 'application/ecmascript'},
             'style': {'text/css'}, 'image': {'image/jpeg', 'image/png', 'image/webp', 'image/avif'}}
    join_scripts = set()
    for url, kind in assets.items():
        mime, sample = get(url, '*/*', sample=kind != 'script')
        if not sample or mime not in types[kind] or sample.lstrip().lower().startswith((b'<!doctype html', b'<html')):
            raise ValueError(f'{url} returned an invalid {kind} ({mime})')
        if kind == 'script' and all(marker in sample for marker in
                (b'join-agent', b'join-copy', b'git clone https://github.com/pw0x/aincrad-atlas.git')):
            join_scripts.add(url)
    for page, scripts in scripts_by_page.items():
        if not scripts.intersection(join_scripts):
            raise ValueError(f'{page} lacks the viewer bundle with the agent prompt and copy control.')

    legacy_url = urljoin(origin, '/portal.html?lang=en')
    try:
        with http.open(legacy_url, timeout=15) as response:
            destination = response.geturl()
    except HTTPError as err:
        # Python versions before 3.11 expose HTTP 308 without following it.
        if err.code != 308:
            raise
        destination = urljoin(legacy_url, err.headers.get('Location', ''))
        err.close()
    if destination != urljoin(origin, '/?lang=en'):
        raise ValueError('The old portal link did not redirect to the scene root with its query.')
    for retired in ('/api/progress', '/api/feedback', '/api/worker/lease'):
        try:
            with http.open(urljoin(origin, retired), timeout=15):
                raise ValueError('Retired route is still public: ' + retired)
        except HTTPError as err:
            if err.code not in (404, 410):
                raise
            err.close()

    mime, data = get('/api/version', 'application/json')
    if mime != 'application/json':
        raise ValueError(f'The version endpoint returned {mime}')
    version = json.loads(data)['version']
    if not isinstance(version, str) or not re.fullmatch('[a-f0-9]{40}', version):
        raise ValueError('The deployment did not identify a full source commit.')
    if expected and not version.startswith(expected.lower()):
        raise ValueError(f'Expected {expected}, found {version}.')
    print(f'{version}: castle at the root, three previews, agent prompt, {len(assets)} linked assets and legacy redirects verified.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('origin', help='e.g. https://aincrad.pw0studio.com')
    parser.add_argument('--expect-commit', help='expected Git SHA or prefix of at least seven characters')
    args = parser.parse_args()
    if args.expect_commit and not re.fullmatch('[a-fA-F0-9]{7,40}', args.expect_commit):
        parser.error('--expect-commit needs 7 to 40 hexadecimal characters')
    try:
        check(args.origin, args.expect_commit)
    except (OSError, URLError, KeyError, ValueError, TypeError) as err:
        sys.exit('Public check failed: ' + str(err))
