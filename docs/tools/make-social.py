"""生成 GitHub 仓库的 Social preview（1280×640）和一张 README 顶部横幅。

用法：python docs/tools/make-social.py
输入：docs/screenshots/hero.png
输出：docs/screenshots/social-preview.png
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "docs" / "screenshots"
SRC = SHOTS / "hero.png"
OUT = SHOTS / "social-preview.png"

W, H = 1280, 640
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",   # 微软雅黑 Bold
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]


def load_font(size: int):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def cover(img: Image.Image, w: int, h: int) -> Image.Image:
    """等比缩放并居中裁剪到目标尺寸。"""
    scale = max(w / img.width, h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left = (resized.width - w) // 2
    top = (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def main():
    if not SRC.exists():
        raise SystemExit("先运行 docs/tools/capture-frames.mjs 生成 hero.png")
    base = cover(Image.open(SRC).convert("RGB"), W, H)

    # 底部渐变遮罩，保证文字可读
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(H // 2, H):
        alpha = int(200 * (y - H // 2) / (H // 2))
        draw.rectangle([0, y, W, y + 1], fill=(6, 9, 14, alpha))
    base = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")

    draw = ImageDraw.Draw(base)
    title_font = load_font(64)
    sub_font = load_font(28)
    tag_font = load_font(22)

    draw.text((64, H - 208), "头像大乱斗 · Avatar Arena", font=title_font, fill=(255, 214, 102))
    draw.text((66, H - 124), "直播间互动游戏 · 点赞进场 / 评论变大 / 礼物暴涨 / 大的吞掉小的",
              font=sub_font, fill=(238, 230, 214))
    draw.text((66, H - 70), "Canvas 2D · 无构建 · 可接抖音弹幕 · MIT 开源",
              font=tag_font, fill=(154, 163, 178))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    base.save(OUT, optimize=True)
    print(f"{OUT}  ({OUT.stat().st_size / 1024:.0f} KB, {W}x{H})")


if __name__ == "__main__":
    main()
