"""GitHub reconciliation, shared by the restricted Actions worker and optional on-host worker."""

from datetime import datetime, timezone
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Neither the worker credential nor the GitHub token should follow a redirected request.
        return None


def api(url, token=None, body=None, github=False):
    headers = {'User-Agent': 'Aincrad-Atlas/1', 'Accept': 'application/json'}
    if github:
        headers['Accept'] = 'application/vnd.github+json'
        headers['X-GitHub-Api-Version'] = '2022-11-28'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    raw = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        raw = json.dumps(body).encode()
    with build_opener(NoRedirect()).open(Request(url, data=raw, headers=headers), timeout=15) as response:
        return json.load(response)


def repo_name(value):
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', value, re.ASCII):
        raise ValueError('ATLAS_REPO must be owner/repository')
    return value


def public_origin(value, local=False):
    parsed = urlsplit(value)
    https = parsed.scheme == 'https'
    loopback = local and parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1', '::1')
    if not ((https or loopback) and parsed.hostname and not parsed.username and not parsed.password and
            parsed.path in ('', '/') and not parsed.query and not parsed.fragment):
        raise ValueError('ATLAS_PUBLIC_ORIGIN must be the canonical HTTPS origin')
    return f'{parsed.scheme}://{parsed.netloc}'


def github(path, token=None, body=None):
    return api('https://api.github.com' + path, token, body, github=True)


def progress(repo, token=None):
    commits = github(f'/repos/{repo}/commits?sha=main&per_page=8', token)
    changes = [{'sha': c['sha'], 'title': c['commit']['message'].split('\n', 1)[0][:220],
                'url': c['html_url'], 'date': c['commit']['committer']['date']} for c in commits]
    # The repository listing reflects newly dispatched issues before GitHub's search index catches up.
    tasks, numbers = [], set()
    for page in range(1, 31):
        query = urlencode({'state': 'open', 'labels': 'agent-ready', 'sort': 'updated', 'direction': 'desc',
                           'per_page': 100, 'page': page})
        rows = github(f'/repos/{repo}/issues?' + query, token)
        for row in rows:
            number = row['number']
            if 'pull_request' in row or number in numbers:
                continue
            numbers.add(number)
            if len(tasks) < 12:
                tasks.append({'number': number, 'title': row['title'][:220], 'url': row['html_url'],
                              'date': row['updated_at'], 'labels': [label['name'] for label in row['labels']]})
        if len(rows) < 100:
            break
    else:
        raise ValueError('Incomplete GitHub task listing')  # Keep the previous complete snapshot.
    return {'changes': changes, 'tasks': tasks, 'openTaskCount': len(numbers),
            'updatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}


def ensure_labels(repo, token):
    for name, color, desc in [('visitor-feedback', 'd9a25f', 'Observation submitted from a public Atlas scene'),
                              ('agent-ready', '44786a', 'Available for a peer agent to claim and verify'),
                              ('scene:castle', '708abd', 'Floating castle exterior'),
                              ('scene:town', 'c38655', 'Floor 1 Town of Beginnings'),
                              ('scene:cabin', '73966c', 'Floor 22 lakeside cabin')]:
        path = f'/repos/{repo}/labels/' + quote(name, safe='')
        try:
            github(path, token)
        except HTTPError as err:
            if err.code != 404:
                raise
            err.close()
            try:
                github(f'/repos/{repo}/labels', token, {'name': name, 'color': color, 'description': desc})
            except HTTPError as conflict:
                if conflict.code != 422:
                    raise
                conflict.close()
                github(path, token)


def existing_issue(repo, token, job):
    marker = job['marker']
    since = datetime.fromtimestamp(job['created'] - 300, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    page = 1
    while page <= 30:
        # Read both open and closed issues. Search indexing or a changed label must not cause duplicates.
        query = urlencode({'since': since, 'state': 'all', 'per_page': 100, 'page': page,
                           'sort': 'created', 'direction': 'asc'})
        rows = github(f'/repos/{repo}/issues?' + query, token)
        for row in rows:
            # Public visitors can copy published issue bodies. Only a project publisher can acknowledge a delivery.
            user = row.get('user') or {}
            project_publisher = (user.get('login') == 'github-actions[bot]' and user.get('type') == 'Bot'
                                 or row.get('author_association') in ('OWNER', 'MEMBER', 'COLLABORATOR'))
            if 'pull_request' not in row and project_publisher and (row.get('body') or '').rstrip().endswith(marker):
                return row['number']
        if len(rows) < 100:
            return None
        page += 1
    raise RuntimeError('Retry reconciliation exceeded its bounded GitHub history window')


def deliver(repo, token, claim, finish, limit=20):
    delivered = 0
    for _ in range(limit):
        job = claim()
        if job is None:
            break
        try:
            if not delivered:
                ensure_labels(repo, token)
            number = existing_issue(repo, token, job) if job['attempt'] > 1 else None
            if number is None:
                number = github(f'/repos/{repo}/issues', token, job['issue'])['number']
            finish({'id': job['id'], 'lease': job['lease'], 'number': number}, True)
            delivered += 1
        except Exception:
            # An issue creation may have succeeded before the connection failed. The next lease reconciles first.
            try:
                finish({'id': job['id'], 'lease': job['lease']}, False)
            except Exception:
                pass  # A lost acknowledgement is recoverable when the lease expires.
            raise
    return delivered


def failure(exc):
    # Response bodies and request headers may contain visitor data or credentials.
    return f'HTTP {exc.code}' if isinstance(exc, HTTPError) else type(exc).__name__


def remote():
    origin = public_origin(os.environ['ATLAS_PUBLIC_ORIGIN'])
    repo = repo_name(os.environ['GITHUB_REPOSITORY'])
    secret = os.environ['ATLAS_WORKER_SECRET']
    token = os.environ['GITHUB_TOKEN']
    if len(secret) < 32 or not token:
        raise ValueError('Worker credentials are not configured')

    def site(action, body):
        return api(origin + '/api/worker/' + action, secret, body)

    count = deliver(repo, token, lambda: site('lease', {})['job'],
                    lambda body, ok: site('ack' if ok else 'retry', body))
    site('progress', progress(repo, token))
    print(f'{count} feedback item(s) reconciled; progress snapshot updated.')


if __name__ == '__main__':
    try:
        remote()
    except (KeyError, ValueError, RuntimeError, OSError, URLError) as err:
        print('Dispatch did not complete (' + failure(err) + '). The next run resumes the queue.', file=sys.stderr)
        sys.exit(1)
