"""Build the README GIF + hero still from captured frames (Pillow)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
frames_dir = root / "docs" / "frames"
shots = root / "docs" / "screenshots"
shots.mkdir(parents=True, exist_ok=True)

files = sorted(frames_dir.glob("frame-*.png"))
if not files:
    raise SystemExit("no frames: run docs/tools/capture-frames.mjs first")

WIDTH = 760
STEP = 2          # 隔帧取样，控制体积（README 里 1MB 左右最舒服）
COLORS = 80

files = files[::STEP]
images = []
for path in files:
    img = Image.open(path).convert("RGB")
    height = round(img.height * WIDTH / img.width)
    images.append(img.resize((WIDTH, height), Image.LANCZOS))

# 中间帧做首图
images[len(images) // 2].save(shots / "hero.png", optimize=True)

palette = [img.quantize(colors=COLORS, method=Image.MEDIANCUT) for img in images]
gif = shots / "demo.gif"
palette[0].save(gif, save_all=True, append_images=palette[1:], duration=170 * STEP, loop=0,
                optimize=True, disposal=2)
print("gif:", gif, round(gif.stat().st_size / 1024), "KB", "frames:", len(images))
