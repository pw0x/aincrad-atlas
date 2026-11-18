"""Package an existing production build for an offline reference release."""
import argparse
from hashlib import sha256
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--out", type=Path, default=ROOT / "release")
OUT = parser.parse_args().out
NAME = "aincrad-atlas-preview.zip"

if not all((DIST / name).is_file() for name in ("index.html", "floor-01.html", "floor-22.html", "LICENSE", "LICENSE-ART.txt")):
    raise SystemExit("Build the project with npm run build before packaging.")

OUT.mkdir(parents=True, exist_ok=True)
members = [path for path in DIST.rglob("*") if path.is_file() and path.suffix != ".gz"]
members.extend(ROOT / name for name in ("preview.py", "start-preview.cmd"))

def entry(name):
    info = ZipInfo(name)
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    info.compress_type = ZIP_DEFLATED
    return info

with ZipFile(OUT / NAME, "w") as archive:
    for path in sorted(members):
        archive.writestr(entry(path.relative_to(ROOT).as_posix()), path.read_bytes())
    archive.writestr(entry("START-HERE.txt"), (
        "Aincrad Atlas / 浮游城图志\n\n"
        "Extract the complete archive. With Python 3 installed, run start-preview.cmd on Windows "
        "or python3 preview.py --open on macOS or Linux.\n"
        "解压全部文件，使用 Python 3 启动本地预览。入口 http://127.0.0.1:18764/\n\n"
        "Source, credits and agent collaboration: https://github.com/pw0x/aincrad-atlas\n"
        "Original code: MIT. Original artwork: CC BY 4.0. Third-party notices: dist/third-party/.\n"
    ).encode("utf-8"))

digest = sha256((OUT / NAME).read_bytes()).hexdigest()
(OUT / "SHA256SUMS.txt").write_bytes(f"{digest}  {NAME}\n".encode("ascii"))
print(f"{NAME} {digest}")
