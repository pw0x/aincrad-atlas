"""Read-only smoke check of an Aincrad Atlas deployment. Python standard library only."""

import argparse
from html.parser import HTMLParser
import json
import re
import sys
from urllib.error import URLError
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


def check(origin, expected, require_fresh):
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

    def api(path):
        mime, data = get(path, 'application/json')
        if mime != 'application/json':
            raise ValueError(f'{path} returned {mime}')
        return json.loads(data)

    assets = {}
    for page, world in (('/', None), ('/index.html', 'castle'), ('/floor-01.html', 'town'), ('/floor-22.html', 'cabin')):
        mime, raw = get(page, 'text/html')
        doc = Page()
        doc.feed(raw.decode('utf-8'))
        if mime != 'text/html' or world != doc.world or 'script' not in doc.assets.values():
            raise ValueError('Unexpected scene or document at ' + page)
        if world is None and not {'scenes', 'progress', 'feedback'} <= doc.ids:
            raise ValueError('The root document is missing a portal section')
        for path, kind in doc.assets.items():
            assets[urljoin(urljoin(origin, page), path)] = kind
    types = {'script': {'application/javascript', 'text/javascript', 'application/ecmascript'},
             'style': {'text/css'}, 'image': {'image/jpeg', 'image/png', 'image/webp', 'image/avif'}}
    for url, kind in assets.items():
        mime, sample = get(url, '*/*', sample=True)
        if not sample or mime not in types[kind] or sample.lstrip().lower().startswith((b'<!doctype html', b'<html')):
            raise ValueError(f'{url} returned an invalid {kind} ({mime})')
    print(f'Portal, three scenes and {len(assets)} directly referenced assets passed.')
    version = api('/api/version')['version']
    if not isinstance(version, str) or not re.fullmatch('[a-f0-9]{40}', version):
        raise ValueError('The deployment did not identify a full source commit.')
    if expected and not version.startswith(expected.lower()):
        raise ValueError(f'Expected {expected}, found {version}.')
    progress = api('/api/progress')
    if progress.get('version') != version or not progress.get('updatedAt'):
        raise ValueError('Progress is missing an update date or has a different deployment revision.')
    source = progress.get('source')
    if source not in ('cached', 'github') or (require_fresh and source != 'github'):
        raise ValueError('Progress source is ' + str(source))
    changes, tasks, count = progress['changes'], progress['tasks'], progress['openTaskCount']
    repo = 'https://github.com/pw0x/aincrad-atlas'
    if progress.get('repository') != repo or not isinstance(changes, list) or not changes:
        raise ValueError('No traceable repository history in the progress feed.')
    if not isinstance(tasks, list) or type(count) is not int or count < len(tasks):
        raise ValueError('The task list and task count disagree.')
    for entry in changes:
        sha = entry['sha']
        if not re.fullmatch('[a-f0-9]{40}', sha) or not entry['title'] or entry['url'] != f'{repo}/commit/{sha}':
            raise ValueError('A change is missing its commit reference or title.')
    for entry in tasks:
        if not entry['title'] or entry['url'] != f'{repo}/issues/{entry["number"]}' or 'agent-ready' not in entry['labels']:
            raise ValueError('A task is missing its issue reference, title or dispatch label.')
    print(f'{version}: {len(changes)} recent changes, {count} open tasks, {source} as of {progress["updatedAt"]}.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('origin', help='e.g. https://aincrad.pw0studio.com')
    parser.add_argument('--expect-commit', help='expected Git SHA or prefix of at least seven characters')
    parser.add_argument('--require-fresh', action='store_true', help='also fail if GitHub data is marked stale')
    args = parser.parse_args()
    if args.expect_commit and not re.fullmatch('[a-fA-F0-9]{7,40}', args.expect_commit):
        parser.error('--expect-commit needs 7 to 40 hexadecimal characters')
    try:
        check(args.origin, args.expect_commit, args.require_fresh)
    except (OSError, URLError, KeyError, ValueError, TypeError) as err:
        sys.exit('Public check failed: ' + str(err))
