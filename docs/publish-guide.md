# 发布到 GitHub 的清单

按顺序做，30 分钟能把仓库发出去。

## 1. 发布前已经填好的（如需修改再动）

- [x] `README.md` 底部「作者 / 联系」：salmjohn / @abdusalam1 / salmjohnn@outlook.com + 微信二维码（`docs/screenshots/wechat-qr.png`）
- [x] `LICENSE`：`Copyright (c) 2026 salmjohn`
- [x] 上游「头像打印机」：[rhfbgfgfdg999999/3d-printer-live](https://github.com/rhfbgfgfdg999999/3d-printer-live)（作者 VESAM9J / 志哥AI，已核实仓库标题与描述一致）；另附 [B 站教程视频](https://www.bilibili.com/video/BV1WJxx61EUf/)
- [ ] 可选：`CHANGELOG.md` 里补上发布日期
- [ ] 可选：二维码想换成"公众号/群二维码"，重跑 `python docs/tools/make-wechat-qr.py` 即可（换掉源图）

## 2. 建仓库

本地仓库已经初始化好（`main` 分支 + 首个提交 + remote 已配置）。只差推送：

```powershell
cd "D:\onedrive\OneDrive\桌面\order\AvatarArena"
git push -u origin main
```

> 第一次推送会要求登录：用 GitHub 账号 `abdusalam1` + Personal Access Token（或 Git Credential Manager 弹窗登录）。
> 仓库名想换的话：`git remote set-url origin https://github.com/abdusalam1/<新名字>.git`，记得在 GitHub 上先建好空仓库（不要勾 README/License）。

## 3. 仓库设置（直接影响能不能被搜到）

- **Description**（推荐这版，带"开源"和英文关键词，方便中英搜到）：
  `开源直播间互动游戏：点赞就进场、评论变大、礼物暴涨，大的吞掉小的。Canvas 2D + OBS 竖屏，可接抖音 / TikTok 直播弹幕`
- **Topics**（最多 20 个，建议 15 个中英混搭）：
  `douyin` `tiktok-live` `live-streaming` `live-game` `interactive` `canvas` `javascript` `python`
  `webview2` `obs` `avatar` `agar-io` `live-stream` `弹幕互动` `open-source`
- **About → Website**：先留空，等有 B 站/抖音视频了再填（链接图标能显著提高点击）
- 勾选 **Issues**（收反馈）和 **Releases**（发版用）；**Packages / Deployments 不要勾**（本项目没有这两类产物，勾了首页会多出空模块）
- **Social preview** 在 Settings 里，不在 About 弹窗里（见下一节）

## 4. 首屏观感（决定 star 率）

- [ ] README 第一屏必须出现 `docs/screenshots/demo.gif`（1.5MB，GitHub 能直接播放）
- [ ] 仓库 Social preview 上传 `docs/screenshots/social-preview.png`（1280×640，已生成，带标题）
  （GitHub → Settings → Social preview）
- [ ] Release 里附一个 zip，方便不看代码的人直接下载

## 5. 打 Release

```powershell
# 打一个干净的分发包（排除运行时目录、缓存、动图素材帧）
Compress-Archive -Path index.html,arena-*.mjs,launch.py,test_launch_windows.py,
  start.bat,start-portrait.bat,README.md,LICENSE,CHANGELOG.md,docs -DestinationPath dist\AvatarArena-v1.0.0.zip
```

然后 GitHub → Releases → Draft a new release：
- tag：`v1.0.0`，标题：`头像大乱斗 v1.0.0`
- 说明直接贴 `CHANGELOG.md` 的 v1.0.0 段落
- 附件：上面的 zip

## 6. 传播（和"火起来"最相关的部分）

按投入产出排序：

1. **B 站 / 抖音短视频（最重要）**：30–60 秒竖屏录屏，开头 3 秒必须是"大的吞掉小的 + 王者皇冠"这种视觉爆点，标题带"开源/免费/直播间弹幕"。
2. **小红书**：图文 6 图：GIF 截帧 + 竖屏画面 + 调参面板 + "怎么接抖音"三步 + 仓库地址。
3. **播客/公众号/掘金/知乎**：写"我是怎么把弹幕做成一个小游戏的"，把 README 的"为什么这样设计"扩写成文章。
4. **相关开源项目下留言**：头像打印机等项目的 issues/discussions 里介绍你的衍生玩法（注意对方仓库规则，别刷屏）。
5. **Reddit / X（英文）**：r/TikTokLive、r/livestreamfail 不合适，优先 X + Hacker News 的 Show HN（用英文 README 的 English 段落）。

## 7. 合规红线（发出去之前务必确认）

- 仓库里**不要**包含抖音协议抓取代码（本仓库已排除，靠外部数据桥）
- README 里保留"演示模式仅用于预览/录屏、正式开播不要伪造互动"的说明（已写）
- 不要在 README 里承诺"无人直播躺赚"之类话术——平台会把这类词当黑产话术
- 商用/上平台引导到「直播小玩法」官方通道

## 8. 发布后 48 小时

- 盯 Issues：前几个 bug report 决定别人愿不愿意 star（快速回复 + 当天修）
- 把常见问题补进 README 的 FAQ
- 有人问"能接 TikTok 吗"：中英双语已支持，但抓取链路要自己接（README 的 English 段落已经说明）
