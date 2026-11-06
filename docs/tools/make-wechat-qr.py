"""把微信名片图裁成干净的二维码方图（README 用）。

用法：python docs/tools/make-wechat-qr.py
输入：docs/screenshots/wechat-source.jpg（微信「我的二维码」名片截图）
输出：docs/screenshots/wechat-qr.png
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "docs" / "screenshots"
SRC = SHOTS / "wechat-source.jpg"
OUT = SHOTS / "wechat-qr.png"

# 二维码区域的大致纵向范围（避开顶部昵称和底部"扫二维码"文字）
Y_MIN_RATIO, Y_MAX_RATIO = 0.22, 0.82
PADDING = 18


def main():
    if not SRC.exists():
        raise SystemExit(f"找不到 {SRC}")
    img = Image.open(SRC).convert("L")
    w, h = img.size
    top, bottom = int(h * Y_MIN_RATIO), int(h * Y_MAX_RATIO)
    band = img.crop((0, top, w, bottom))

    # 找二维码的深色像素包围盒
    pixels = band.load()
    xs, ys = [], []
    for y in range(band.height):
        for x in range(band.width):
            if pixels[x, y] < 90:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise SystemExit("没找到二维码区域")

    left, right = max(0, min(xs) - PADDING), min(w, max(xs) + PADDING)
    upper, lower = max(0, top + min(ys) - PADDING), min(h, top + max(ys) + PADDING)

    qr = Image.open(SRC).convert("RGB").crop((left, upper, right, lower))
    side = max(qr.size)
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    canvas.paste(qr, ((side - qr.width) // 2, (side - qr.height) // 2))
    canvas.save(OUT, optimize=True)
    print(f"{OUT}  ({canvas.width}x{canvas.height}, {OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
