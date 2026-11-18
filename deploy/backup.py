#!/usr/bin/python3
"""Snapshot only the Atlas database, keeping the last successful backup on failure."""
import os
from pathlib import Path
import shutil
import sqlite3

db = Path('/var/lib/aincrad-atlas/atlas.sqlite3')
folder = Path('/var/backups/aincrad-atlas')
folder.mkdir(mode=0o700, exist_ok=True)
os.umask(0o077)
target = folder / 'atlas.sqlite3'
temporary = folder / 'atlas.next'
if shutil.disk_usage(folder).free < db.stat().st_size + (1 << 30):
    raise SystemExit('Insufficient space to take another backup')
temporary.unlink(missing_ok=True)
try:
    with sqlite3.connect(db.as_uri() + '?mode=ro', uri=True) as source, sqlite3.connect(temporary) as backup:
        source.backup(backup, pages=256, sleep=0.05)
        if backup.execute('PRAGMA quick_check').fetchone() != ('ok',):
            raise RuntimeError('Backup failed SQLite verification')
    temporary.replace(target)
finally:
    temporary.unlink(missing_ok=True)
