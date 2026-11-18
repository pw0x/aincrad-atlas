import hashlib
import io
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'deploy'))
import receive


def archive(run=1, extra=None):
    data = io.BytesIO()
    with tarfile.open(fileobj=data, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        entries = {p: b'release' for p in receive.REQUIRED}
        entries['deploy-run.txt'] = str(run).encode()
        entries['dist/assets/scene-Abc_12xY.js'] = b'const scene = true'
        for path, content in entries.items():
            item = tarfile.TarInfo(path)
            item.size = len(content)
            tar.addfile(item, io.BytesIO(content))
        if extra:
            tar.addfile(extra)
    data.seek(0)
    return data


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)

    def test_archive_boundaries(self):
        content = archive().getvalue()
        out = io.BytesIO()
        receive.spool(io.BytesIO(content), out, hashlib.sha256(content).hexdigest())
        self.assertEqual(out.read(), content)
        with self.assertRaises(ValueError):
            receive.spool(io.BytesIO(content), io.BytesIO(), '0' * 64)
        for name, kind in [('../escape', tarfile.REGTYPE), ('dist/../escape', tarfile.REGTYPE),
                           ('dist/link', tarfile.SYMTYPE), ('server/unknown.py', tarfile.REGTYPE),
                           ('dist/pipe', tarfile.FIFOTYPE), ('dist/index.html', tarfile.REGTYPE)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory(dir=self.root) as tree:
                entry = tarfile.TarInfo(name)
                entry.type = kind
                entry.linkname = '/etc/passwd' if kind == tarfile.SYMTYPE else ''
                with self.assertRaises(ValueError):
                    receive.unpack(archive(extra=entry), Path(tree))
        self.assertFalse((self.root / 'escape').exists())

    @unittest.skipIf(os.name == 'nt', 'Production release switching uses Linux directory symlinks')
    def test_rollback_then_retry_staged_revision_and_keep_cached_assets(self):
        one, two = '1' * 40, '2' * 40
        restarted = []
        def restart():
            restarted.append(receive.current_release(self.root).name)
        receive.publish(self.root, archive(1), one, restart, lambda sha: True)
        self.assertEqual(restarted, [one])
        with self.assertRaisesRegex(RuntimeError, 'health check'):
            receive.publish(self.root, archive(2), two, restart, lambda sha: sha == one)
        self.assertEqual(restarted, [one, two, one])
        self.assertEqual(receive.current_release(self.root).name, one)
        self.assertEqual((self.root / 'current-run').read_text(), '1\n')
        receive.publish(self.root, archive(2), two, restart, lambda sha: True)
        receive.publish(self.root, archive(3), two, restart, lambda sha: True)
        self.assertEqual(restarted, [one, two, one, two])
        self.assertEqual((self.root / 'current/revision.env').read_text(), f'ATLAS_VERSION={two}\n')
        asset = self.root / 'assets/scene-Abc_12xY.js'
        current_asset = self.root / 'current/dist/assets' / asset.name
        self.assertTrue(os.path.samefile(asset, current_asset))
        with self.assertRaisesRegex(ValueError, 'newer'):
            receive.publish(self.root, archive(1), one, restart, lambda sha: True)
        self.assertEqual(receive.current_release(self.root).name, two)

    @unittest.skipIf(os.name == 'nt', 'Production release switching uses Linux directory symlinks')
    def test_first_activation_can_recover_after_failed_start(self):
        sha = 'b' * 40
        with self.assertRaisesRegex(RuntimeError, 'health check'):
            receive.publish(self.root, archive(), sha, lambda: None, lambda value: False)
        self.assertIsNone(receive.current_release(self.root))
        receive.publish(self.root, archive(), sha, lambda: None, lambda value: True)
        self.assertEqual(receive.current_release(self.root).name, sha)


if __name__ == '__main__':
    unittest.main()
