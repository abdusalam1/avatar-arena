# docs/ · 方案、调研与工具

主代码在仓库根目录（`index.html` + `arena-*.mjs`），这里放文档和开发工具。

| 文件 | 内容 |
|---|---|
| [方案-头像大乱斗.md](方案-头像大乱斗.md) | 玩法设计文档：点子评估、5 个必须避开的坑、礼物/称号设计、上线路径、合规清单 |
| [research/market-notes.md](research/market-notes.md) | 平台规则与品类调研（38 个来源，官方文档逐条引用，含证据等级与日期） |
| [research/arch-notes.md](research/arch-notes.md) | 上游「头像打印机」仓库的能力盘点、事件 schema、扩展点（带 file:line） |
| [screenshots/](screenshots/) | README 用的实拍：`demo.gif`、`hero.png`、竖屏、结算、调参、墙体 |
| [publish-guide.md](publish-guide.md) | **发布到 GitHub 的清单**：仓库设置、README 首图、Release、传播话术 |
| [archive/](archive/) | 早期「头像小镇」长线方案的原型（另一条路线，留档参考） |
| [tools/devshot.mjs](tools/devshot.mjs) | 无头 Chrome + CDP：抓控制台报错 + 截图（纯 Node，无依赖） |
| [tools/capture-frames.mjs](tools/capture-frames.mjs) | CDP 连拍，给 README 动图采素材 |
| [tools/make-gif.py](tools/make-gif.py) | 用 Pillow 把连拍帧合成 `docs/screenshots/demo.gif` |

## 开发命令

```powershell
# 跑测试
node --test "arena-*.test.mjs"
python test_launch_windows.py

# 预览（演示模式，不需要数据桥）
python -m http.server 8090
# http://127.0.0.1:8090/index.html?demo=1

# 重新生成 README 动图
node docs/tools/capture-frames.mjs "http://127.0.0.1:8090/index.html?demo=1" docs/frames 34 150 1440 900 12000
python docs/tools/make-gif.py

# 截图 / 看控制台报错
node docs/tools/devshot.mjs "http://127.0.0.1:8090/index.html?demo=1" out.png 12000 1680 1000
```
