"""打一个可以直接上传 GitHub Release 的干净压缩包。

用法：python docs/tools/pack-release.py [版本号]
产物：dist/AvatarArena-v<版本>.zip
"""
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSION = sys.argv[1] if len(sys.argv) > 1 else "1.0.0"
OUT = ROOT / "dist" / f"AvatarArena-v{VERSION}.zip"

# 不进包的东西：git 元数据、运行时配置、缓存、日志、打包产物、动图原始帧
EXCLUDE_DIRS = {".git", ".arena-webview-profile", ".bridge-profile", "__pycache__", "dist",
                "docs/frames", "node_modules"}
EXCLUDE_SUFFIXES = {".pyc", ".log"}
EXCLUDE_NAMES = {".bridge-room", "avatar-cache.json"}


def included(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    if any(part in EXCLUDE_DIRS for part in rel.parts):
        return False
    if path.name in EXCLUDE_NAMES or path.suffix in EXCLUDE_SUFFIXES:
        return False
    return path.is_file()


def main():
    files = sorted(p for p in ROOT.rglob("*") if included(p))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            archive.write(path, Path(f"AvatarArena-v{VERSION}") / path.relative_to(ROOT))
    size_mb = OUT.stat().st_size / 1024 / 1024
    print(f"{OUT}  ({size_mb:.1f} MB, {len(files)} files)")
    for path in files:
        print("  ", path.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
