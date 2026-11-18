#!/usr/bin/python3
"""Forced SSH command for the Atlas deploy key. Install root-owned outside the release tree."""

import filecmp
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import time
from urllib.error import URLError
from urllib.request import ProxyHandler, build_opener


ROOT = Path('/srv/aincrad-atlas')
SHA = re.compile('[a-f0-9]{40}')
HASHED_ASSET = re.compile(r'.+-[a-zA-Z0-9_-]{8}\.[a-zA-Z0-9]+(?:\.gz)?')
# Older CI builds included the dispatcher modules. Their archives can still be retried.
ALLOWED_BACKEND = {'server/atlas.py', 'server/feedback.py', 'server/dispatcher.py'}
REQUIRED = {'server/atlas.py', 'dist/index.html', 'dist/floor-01.html', 'dist/floor-22.html', 'deploy-run.txt'}
MAX_ARCHIVE = 256 * 1024 * 1024
KEEP = 5


def spool(stream, dest, digest):
    actual = hashlib.sha256()
    while True:
        block = stream.read(1024 * 1024)
        if not block:
            break
        if dest.tell() + len(block) > MAX_ARCHIVE:
            raise ValueError('Archive too large')
        actual.update(block)
        dest.write(block)
    if actual.hexdigest() != digest:
        raise ValueError('Archive digest does not match')
    dest.seek(0)


def unpack(archive, tree):
    seen = set()
    total = 0
    # A plain tar bounds compressed inputs and avoids decompressing a second copy of already-encoded textures.
    with tarfile.open(fileobj=archive, mode='r:') as tar:
        for item in tar:
            name = item.name.rstrip('/')
            parts = name.split('/')
            if (len(name) > 240 or any(p in ('', '.', '..') or p.startswith('.') for p in parts)
                    or '\\' in name or any(ord(c) < 32 or ord(c) == 127 for c in name)):
                raise ValueError('Invalid archive path')
            allowed = (parts[0] == 'dist' or name in ALLOWED_BACKEND or name in ('server', 'deploy-run.txt'))
            if not allowed or name in seen or len(seen) >= 4096:
                raise ValueError('Unexpected archive entry')
            seen.add(name)
            path = tree.joinpath(*parts)
            if item.type == tarfile.DIRTYPE:
                if name in ALLOWED_BACKEND or name == 'deploy-run.txt' or item.size:
                    raise ValueError('Invalid directory')
                path.mkdir(parents=True, exist_ok=True)
                continue
            if item.type not in (tarfile.REGTYPE, tarfile.AREGTYPE) or item.sparse is not None:
                raise ValueError('Only regular files and directories are accepted')
            total += item.size
            if (name in ('server', 'dist') or item.size < 0 or item.size > 96 * 1024 * 1024 or
                    total > MAX_ARCHIVE or (name == 'deploy-run.txt' and item.size > 32)):
                raise ValueError('Invalid file size or path')
            path.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(item) as src, path.open('xb') as dst:
                shutil.copyfileobj(src, dst, 1024 * 1024)
            # All executables are invoked through the system Python. Never preserve archive modes or ownership.
            path.chmod(0o644)
    if not all((tree / name).is_file() for name in REQUIRED) or not (tree / 'dist/assets').is_dir():
        raise ValueError('Required distribution files missing')
    run_file = tree / 'deploy-run.txt'
    run_value = run_file.read_text(encoding='ascii').strip()
    if not re.fullmatch(r'[1-9][0-9]{0,17}', run_value):
        raise ValueError('Invalid release sequence')
    run_file.unlink()
    return int(run_value)


def link_assets(source_dir, cache):
    cache.mkdir(exist_ok=True, mode=0o755)
    # Vite puts hashed assets directly under dist/assets; public/assets/materials keeps its stable nested paths.
    for src in source_dir.iterdir():
        if not src.is_file() or not HASHED_ASSET.fullmatch(src.name):
            continue
        target = cache / src.name
        if target.exists():
            if not filecmp.cmp(src, target, shallow=False):
                raise ValueError('Conflicting content for hashed asset ' + src.name)
            src.unlink()
            os.link(target, src)
        else:
            os.link(src, target)


def current_release(root):
    current = root / 'current'
    if not current.is_symlink():
        if current.exists():
            raise RuntimeError('current must be a release symlink')
        return None
    target = current.resolve(strict=True)
    if target.parent != (root / 'releases').resolve() or not SHA.fullmatch(target.name):
        raise RuntimeError('current does not point to a local release')
    return target


def switch(root, release):
    # This unique link and current live on the same filesystem.
    with tempfile.TemporaryDirectory(prefix='.link-', dir=root) as directory:
        link = Path(directory) / 'current'
        link.symlink_to('releases/' + release.name)
        link.replace(root / 'current')


def prune(root, active):
    releases = root / 'releases'
    candidates = [p for p in releases.iterdir() if p != active and SHA.fullmatch(p.name)
                  and p.is_dir() and not p.is_symlink() and p.resolve().parent == releases.resolve()]
    candidates.sort(key=lambda p: p.stat().st_mtime_ns, reverse=True)
    for expired in candidates[KEEP - 1:]:
        shutil.rmtree(expired)
    for asset in (root / 'assets').iterdir():
        if asset.is_file() and not asset.is_symlink() and HASHED_ASSET.fullmatch(asset.name) and asset.stat().st_nlink == 1:
            asset.unlink()


def restart():
    subprocess.run(['/usr/bin/sudo', '-n', '/usr/bin/systemctl', 'restart', 'aincrad-atlas.service'],
                   check=True, timeout=45, stdin=subprocess.DEVNULL)


def healthy(sha):
    opener = build_opener(ProxyHandler({}))
    cutoff = time.monotonic() + 30
    while time.monotonic() < cutoff:
        try:
            with opener.open('http://127.0.0.1:8093/api/version', timeout=1.5) as response:
                if json.loads(response.read(1024)) == {'version': sha}:
                    return True
        except (OSError, URLError, ValueError):
            pass
        time.sleep(.4)
    return False


def publish(root, archive, sha, restart_api=restart, check=healthy):
    releases = root / 'releases'
    releases.mkdir(exist_ok=True, mode=0o755)
    with tempfile.TemporaryDirectory(dir=releases, prefix='.stage-') as scratch:
        staged = Path(scratch) / 'tree'
        staged.mkdir(mode=0o755)
        sequence = unpack(archive, staged)
        previous = current_release(root)
        sequence_file = root / 'current-run'
        high = int(sequence_file.read_text()) if sequence_file.exists() else 0
        if sequence < high:
            raise ValueError('A newer main build has already been published')
        target = releases / sha
        if target.is_symlink() or (target.exists() and not target.is_dir()):
            raise ValueError('Invalid target release')
        revision = f'ATLAS_VERSION={sha}\n'
        (staged / 'revision.env').write_text(revision, encoding='ascii')
        if target.exists():
            # A staged version may survive a failed first activation. Verify it and retry the actual switch.
            for base in ('server', 'dist'):
                old = {p.relative_to(target) for p in (target / base).rglob('*') if p.is_file() and '__pycache__' not in p.parts}
                new = {p.relative_to(staged) for p in (staged / base).rglob('*') if p.is_file()}
                if old != new or any(not filecmp.cmp(staged / p, target / p, shallow=False) for p in new):
                    raise ValueError('Existing revision has different release files')
            if (target / 'revision.env').read_text(encoding='ascii') != revision:
                raise ValueError('Existing revision has different version metadata')
        else:
            link_assets(staged / 'dist/assets', root / 'assets')
            staged.rename(target)
        if previous != target or not check(sha):
            switch(root, target)
            try:
                restart_api()
                if not check(sha):
                    raise RuntimeError('New API failed the revision health check')
            except Exception:
                if previous and previous != target:
                    switch(root, previous)
                    restart_api()
                    if not check(previous.name):
                        raise RuntimeError('Prior release restored on disk but failed its health check')
                elif not previous:
                    (root / 'current').unlink()
                raise
        pending = Path(scratch) / 'current-run'
        pending.write_text(str(sequence) + '\n', encoding='ascii')
        pending.replace(sequence_file)
        os.utime(target)
        prune(root, target)


def main():
    import fcntl  # Linux forced-command host.
    command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
    args = re.fullmatch(r'publish ([a-f0-9]{40}) ([a-f0-9]{64})', command)
    if not args:
        raise ValueError('Expected publish <source SHA> <archive SHA-256>')
    sha, digest = args.groups()
    os.umask(0o022)
    def expired(signum, frame):
        raise TimeoutError('Upload time limit exceeded')
    signal.signal(signal.SIGALRM, expired)
    with (ROOT / '.publish.lock').open('a') as lock, tempfile.TemporaryFile(dir=ROOT) as archive:
        signal.alarm(300)
        try:
            fcntl.flock(lock, fcntl.LOCK_EX)
            spool(sys.stdin.buffer, archive, digest)
        finally:
            signal.alarm(0)
        publish(ROOT, archive, sha)
    print('Published and verified ' + sha)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        sys.exit('Publication failed: ' + str(error))
