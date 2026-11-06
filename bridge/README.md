# bridge/ · 抖音直播数据桥（上游原样内置）

本目录是上游开源的抖音直播间数据采集器，**原样复制、未做任何修改**：

- 上游项目：**头像打印机** `https://github.com/rhfbgfgfdg999999/3d-printer-live`（作者 **志哥AI / VESAM9J**，213★）
- 版本：commit `c3a21d4c09dac31879be34d9b27d351e5547b7d8`（2026-11-01）
- 许可：**MIT**，见 [LICENSE](LICENSE)（版权归原作者 志哥AI）

## 文件

| 文件 | 作用 |
|---|---|
| `douyin-bridge.mjs` | 采集器：CDP 读取直播间页面的弹幕/点赞/礼物/进场，解码协议帧，起 WebSocket 服务 |
| `bridge-ws.mjs` | 内置的最小 WebSocket 服务端（无第三方依赖） |

只依赖 **Node.js 18+** 内置模块，不需要 `npm install`。

## 用法

`launch.py` 会自动发现本目录（优先级：环境变量 `ARENA_BRIDGE_DIR` → `bridge/` → 同级 `LiveApp/`），
页面右上「直播连接（抖音）」点「开始抓取」时执行的就是：

```bash
node bridge/douyin-bridge.mjs <房间号>
```

## 运行时产物（已在 .gitignore 中）

`avatar-cache.json`（头像缓存）、`desktop-bridge.log`（日志）、`.bridge-room`（上次房间号）、
`.bridge-profile/`（直播间登录态）。想清空登录态直接删 `.bridge-profile/`。

## 想自己更新到上游新版？

```powershell
# 用上游覆盖本目录的两个文件，然后同步更新上面的 commit 号
Invoke-WebRequest 'https://github.com/rhfbgfgfdg999999/3d-printer-live/raw/main/douyin-bridge.mjs' -OutFile bridge/douyin-bridge.mjs
Invoke-WebRequest 'https://github.com/rhfbgfgfdg999999/3d-printer-live/raw/main/bridge-ws.mjs' -OutFile bridge/bridge-ws.mjs
```

> 如果你改过上游代码，请把改动作为独立 patch 提交并在此说明，别让"原样"变成谎话。
