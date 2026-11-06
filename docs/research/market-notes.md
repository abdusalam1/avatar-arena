# 无人直播 / 互动直播 选型调研笔记

> 调研日期：**2026-11-04**（证据截取至当日）。调研对象：抖音/快手/小红书（主）、TikTok（次）。
> 用途：给「头像打印机」同一技术底座寻找**新的互动/无人直播形态**提供事实底稿。本文只做证据归纳，不做最终创意裁决。
> 写作原则：**官方规则 > 平台开发者文档 > 行业媒体 > 厂商/营销稿 > 自媒体**。每条结论后标注证据强度与日期；政策类结论一律看 2025–2026 年版本。

**证据强度标记**：`[官方]` 平台规则/开发者文档/监管文件 · `[官媒]` 新华社/人民网/第一财经等 · `[行业]` 游戏葡萄/GameLook/游戏智库等 · `[营销]` 服务商或厂商稿 · `[技术]` 开源仓库/开发者文档 · `[二手]` 转述或自媒体

---

## 0. 先给结论（TL;DR）

1. **「无人直播」本身在抖音是被明文禁止的**：抖音集团副总裁李亮 2025-03-17 明确表示"抖音明确规定禁止无人直播""虚拟人直播必须在平台进行真人实名认证，并由真人驱动进行实时互动，不允许完全由人工智能驱动"（[IT之家](https://www.ithome.com/0/838/498.htm)、[DoNews](https://www.donews.com/news/detail/8/4820639.html)）`[官媒/二手·2025-03]`。同一条禁令在 2025-09-25 的《抖音直播关于治理录播挂机的公告》里被落到处罚口径：2025 年以来处罚 **45 万+** 个"录播/挂机"直播间、**3.3 万**个黑灰产账号被无限期回收直播权限、**5 人**被刑事拘留（[中国网络视听协会转发](http://www.cnsa.cn/art/2025/9/25/art_1957_47623.html)、[第一财经](https://www.yicai.com/news/102842975.html)）`[官媒·2025-09]`。
2. **同一平台上存在一条被官方承认的"互动直播"正门**：抖音开放平台的**「直播小玩法」**。它给开发者开放评论/礼物/点赞/粉丝团数据推送、给主播提供"直播伴侣"内挂载的 exe 玩法客户端，并有完整的提案—审核—白名单—结算链路（[创建直播玩法](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/toybox-start)、[常见问题](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/FAQ)）`[官方·持续更新]`。**要不要走这条路，决定了产品是"灰色工具"还是"可投放的生意"。**
3. **平台在 2026 年的官方增长叙事是「联机 + 社交 + 创新品类」**，对战类（坦克/攻城）已是存量红海，且准入规则里有"避免同质化"硬条款（[2026 抖音互动与游戏行业大会报道](http://gamethk.com/news/detail/20146/1.html)、[直播玩法准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation)）`[行业/官方·2026-03 / 2025-09]`。
4. **AI 生成内容已进入"强制标识"阶段**：国家《人工智能生成合成内容标识办法》2025-09-01 施行（[光明网转载全文](https://m.gmw.cn/2025-03/14/content_1303991405.htm)）`[官方·2025-09]`；《直播电商监督管理办法》2026-02-01 施行，数字人主播纳入监管、须标识并持续提示（[新华社](https://www.news.cn/politics/20260130/8b7890c0c6aa4a149a43a3cbcf072069/c.html)）`[官媒·2026-01]`；小红书 2026-08-18 已开始专项治理三类 AI 违规直播（[新浪转载公告](https://www.sina.cn/news/detail/5333335266300385.html)、[虎嗅](https://mm.huxiu.com/moment/1272228.html)）`[官方/二手·2026-08]`。
5. **TikTok 的规则方向与中国平台同构、但更"人味"**：LIVE 要求真实、原创、可互动；平台把第三方工具（含 TTS/语音转写朗读评论）的责任归给创作者（[TechCrunch 对 2025-09 新版社区规范的解读](https://techcrunch.com/2025/08/15/tiktoks-new-guidelines-add-subtle-changes-for-live-creators-ai-content-and-more/)）；TikTok Shop 自 2026-06-22（美国）起在"高质量短视频与直播"规则中禁止 AI 声音、预录音频、静态/动画画面占比过半（[AuditSocials 解读](https://www.auditsocials.com/blog/tiktok-shop-high-quality-live-rules-2026-ai-voice-pre-recorded-audio-ban-live-shopping)，营销/合规服务商，`[营销·2026-07]`）。
6. **一句话给创意会**：同一套 3D 打印 + 桥 + TTS 底座，**能做的不是"更逼真的无人直播"，而是"被官方承认的、有人格的互动养成玩法"**——让观众的头像/物件成为"留在场上、会长大、会被看见"的实体；无人化只做"主播不在时的填充与陪伴"，不做"假装有人在互动"。

---

## 1. 平台规则地图（按"会不会封号"排序，而不是按平台排序）

### 1.1 法律与监管层（对所有平台生效）

| 时间 | 文件 | 与产品直接相关的条款 | 证据 |
|---|---|---|---|
| 2025-09-01 施行 | 《人工智能生成合成内容标识办法》（国信办通字〔2025〕2 号） | 生成合成内容须有**显式标识**（文字/声音/图形，用户可明显感知）与**隐式标识**（元数据）；**"呈现虚拟场景时，在起始画面的适当位置添加显著的提示标识"**；音频也要有语音/节奏提示；不得恶意删除、篡改、伪造、隐匿标识 | [光明网全文](https://m.gmw.cn/2025-03/14/content_1303991405.htm) `[官方]` |
| 2026-02-01 施行 | 《直播电商监督管理办法》 | 使用 AI 生成的人物图像、视频从事直播电商活动，**应当标识并持续向消费者提示**；数字人主播正式纳入监管 | [新华社](https://www.news.cn/politics/20260130/8b7890c0c6aa4a149a43a3cbcf072069/c.html)、[法治日报](http://www.legaldaily.com.cn/index/content/2026-02/03/content_9333821.html) `[官媒]` |
| 2025-12 | 北京市消协 + 京东/美团/拼多多/唯品会/**抖音/快手/小红书/微信直播** 8 平台《促进 AI 技术规范应用承诺书》 | 商家/创作者用 AI 数字人、虚拟场景须在**显著位置标注"AI 生成"或"拟真场景"**；平台对**未标识**的疑似 AI 数字人/虚拟场景可**屏蔽链接**；严禁 AI 换脸仿冒名人 | [人民网](http://bj.people.com.cn/n2/2025/1205/c14540-41432994.html) `[官媒·2025-12]` |

> 对「3D 打印场景 + AI 语音播报」的含义：**这不是"要不要标"的问题，而是"标在哪里、每场都标"的问题**（小红书公告特别说明 AI 声明"默认关闭、不保留历史状态，每次开播需重新开启"）。

### 1.2 抖音：一条红线 + 一条正门

**红线（无人直播）**
- 官方口径：禁止无人直播；虚拟人直播必须**真人实名认证 + 真人驱动 + 实时互动**，完全由 AI 驱动不被允许（[IT之家 2025-03-17](https://www.ithome.com/0/838/498.htm)）`[官媒]`。
- 处罚口径（2025-09-25 公告）："录播/挂机"的判定场景包括——
  1) 盗播他人内容、播放已录制音视频；
  2) **挂机、定格、黑屏等无意义画面，直播间几乎没有互动**；
  3) **使用作弊插件/道具进行无真人出镜直播**。
  后果：45 万+ 直播间被警告/中断/封禁；7 月一次性对播放"剪指甲/剥鸡蛋壳"录播的**600+ 账号**回收直播权限；3.3 万黑灰产账号无限期回收权限；"直播保镖"团伙开发 30 余款录播作弊软件、非法所得数百万元，**5 人因涉嫌提供侵入非法控制计算机信息系统程序、工具罪被刑拘**（[CNSA](http://www.cnsa.cn/art/2025/9/25/art_1957_47623.html)、[第一财经](https://www.yicai.com/news/102842975.html)、[国际在线转载](https://m.sohu.com/a/938623078_115239/)）`[官媒·2025-09]`。
- 官方对"直播"的定义（同一公告）：**"所见即所得"，真实、实时、互动是基本要求**；要让观众看到"镜头前真实的状态、即时的反馈"，并能通过评论、连麦参与。

**正门（直播小玩法 / 弹幕互动）**
- 接入链路：注册开发者 → 创建"直播小玩法"→ **提案评估（含 Demo 视频）** → 过审后申请能力（礼物/点赞/评论/直播信息/exe 客户端/云启动/粉丝团/官方题库）→ 配置礼物与评论关键词 → 提审上线（[创建直播玩法](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/toybox-start)）`[官方]`。
- 能力边界：评论关键词**最多 10 个**；礼物只能用平台指定礼物（1–1200 抖币档位，选 1–8 种）；**不开放全量评论**（"受数据合规限制，全量评论或指定用户评论不支持开放"）（[FAQ](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/FAQ)）`[官方]`。
- 结算：玩法特殊礼物流水 **平台 50% / 主播 50%**；开发者从主播流水收 X% 服务费，官方口径"**开发者收益为主播收益的 16%、流水的 8%**"，支持自定价（同上）`[官方]`。
- 数据推送：评论/礼物/点赞/粉丝团均为**秒级**、**不保证绝对时序**、**可能重复**；评论/点赞"不保证可靠性，会有数据丢失"；礼物"尽力而为"并提供有限回查；HTTP 回调，**响应超 2 秒（礼物 3 秒）即判失败**，连续 10 次失败熔断；默认 **QPS 100**；**暂不支持长连接**（[数据开放说明](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/develop/server/live-room-scope/data-open/data-open-desc)）`[官方]`。
- 准入规则（2025-09-01 版）对设计有硬约束，详见 §3.4；其中与本项目最相关的几条：
  - **不允许在玩法内设置任何形式的机器人，包括暖场时的假出怪机制**；"出兵需要来源于用户真实产生直播间行为，不能欺骗用户"（[FAQ Q9](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/FAQ)）；
  - 点赞/评论等**免费行为必须有对应反馈**，"不可设计为有概率无效果"；
  - **不允许抽奖、竞猜**；名称/外显不得使用【抽奖】【盲盒】【礼盒】；
  - **不允许商城/交易系统**；用户资产累计最长 **3 个月**（2024 年 FAQ 写 31 天，2025-09 准入规则写 3 个月——**政策在放宽，但以最新版为准**）；
  - 排行榜计算须纳入点赞等互动指标，**不可只算礼物价值**；不可只突出 TOP1，**至少覆盖 TOP3**；
  - 组刷礼物单次整体价值 **≤30000 抖币**；
  - 同名/同质化玩法会被拒审或下线；
  - **AR/VR 能力暂不引入**；跨平台组房不支持。

### 1.3 快手：规则更"文本化"，红线同样清晰

官方《直播管理规范》（[kuaishou.cn/norm?tab=live](https://www.kuaishou.cn/norm?tab=live)）`[官方]`：
- **无主播出镜**：在"扰乱平台管理秩序"项下明确列出——"引导进行电商交易，但**无主播出镜**，或主播行为与电商主题及商品无实质关系"，包括"无主播出镜，仅展示一张纸、广告信息或某实物""主播在直播中睡觉"等 → 中等违规 `[官方]`。
- **赌博**："直播赌博或展示与涉赌相关的任何内容，包括非法赌牌、红包赌博、网络赌博网站、赌博游戏、赌博工具" → **严重违规**（可停播、收回权限、冻结收益、封号）。
- **抽奖**：非官方渠道抽奖（截屏抽奖、从粉丝/订单列表抽、口播加粉丝团抽奖、引导站外抽奖）→ 违规，须用官方抽奖工具。
- **导流**：宣传/推广/导流到其他平台、露出微信号手机号引导站外交易 → 违规。
- **作弊**：刷粉刷赞、数据造假、行为作弊、使用外挂及作弊软件 → 违规。
- **诱导消费**：恶意诱导/诱骗高额送礼、以打赏送红包诱导加群加好友 → 违规。

快手弹幕玩法技术形态（官方文档）：玩法是**exe 客户端**，由"快手直播伴侣"启动，通过启动参数拿 roomCode、窗口位置、IPC；画面由伴侣捕获（game/window/camera 三种），支持 Unity/UE/Cocos（[客户端接入说明](https://open.kuaishou.com/miniPlayDocs/technologyrelated/Affiliatedability/basicability/clientside.html)）`[官方·2024-11]`。

### 1.4 小红书：最新、最细的 AI 直播治理样本

2026-08-18《小红书关于打击 AI 违规直播的治理公告》（平台治理官方账号"薯管家"发布，[新浪转载](https://www.sina.cn/news/detail/5333335266300385.html)、[虎嗅](https://mm.huxiu.com/moment/1272228.html)）`[官方/二手·2026-08]`：
- **一类 AI 身份造假（关停）**：AI 换脸/声音克隆/数字人伪装明星、企业家、头部网红 → 关停 + **12 小时禁播**，严重可至永久封禁；**不可声明豁免**。
- **二类 AI 低质直播（限流）**：以 AI 生成为主、画面渲染错误（**穿模、畸形、糊化**）或声音合成失真（金属音、断句错乱）→ 限流；不可声明豁免。
- **三类用了 AI 未声明（停推）**：AI 数字人/虚拟形象出镜、AI 人声或录音替代真人讲解 → 停推；**开启"AI 声明"可实时豁免**（画面挂"含 AI 生成内容"标签）。
- **明确豁免**：真人 AI 换装/AR 滤镜、**Vtuber**、展示第三方产品/设备本身内置 AI 功能 → 不属于违规。
- 依据即 §1.1 的三部法规。

> 这条对"3D 打印 + 机械臂 + AI 语音"最有用：**非人形虚拟场景 + AI 语音**落在"三类"（可声明豁免），但**渲染质量（穿模/糊化）会直接触发"二类"限流**——3D 场景的观感质量是合规问题，不只是美术问题。

### 1.5 TikTok（本环境无法直连 tiktok.com，结论以可访问的二手报道为准）

- **LIVE 内容的底层要求**：真实、原创、可互动；录播/静态循环"可能被限制推荐或变现"（[StreamHouse 2026-09-16 平台对照](https://streamhouse.co/blog/which-platforms-allow-pre-recorded-streams)，`[二手·2026-09]`）。
- **第三方工具责任归创作者**：2025-09-13 生效的新版社区规范新增——创作者要对直播里发生的一切负责，**包括使用实时翻译、语音转文字等第三方工具朗读观众评论**；商业内容必须披露；引导站外购买会被降权（[TechCrunch 2025-08-15](https://techcrunch.com/2025/08/15/tiktoks-new-guidelines-add-subtle-changes-for-live-creators-ai-content-and-more/)）`[行业·2025-08]`。→ **TTS 播报弹幕在 TikTok 是"创作者责任区"，不是灰色免责区。**
- **TikTok Shop 的"高质量直播"规则（2026-06-22 美国生效）**：禁止 AI 生成声音、录音/电台式音频、直播中的预录音频；静态图/幻灯片/滚动图、动画形象**占屏超过 50%** 属于不合格；要求真人实时口播或手语、露脸、多角度展示商品；违规可扣分、限权、扣佣金、封号（[AuditSocials 2026-07-15 解读](https://www.auditsocials.com/blog/tiktok-shop-high-quality-live-rules-2026-ai-voice-pre-recorded-audio-ban-live-shopping)，`[营销/合规服务商·2026-07]`，需向官方复核）。→ **若未来要在 TikTok 做"带货"，纯 AI 语音/纯动画场景路线已被封死；纯娱乐打赏直播另论。**
- **TikTok 的礼物经济现实**：NPC 式直播（主播扮演不可控 NPC，观众送礼触发固定反应/念名字）是 2025 年的成熟玩法；FXC Intelligence 数据显示**礼物价值的 77% 由 TikTok 留存**，2023 年欧洲礼物规模 18–22 亿美元、创作者仅得 4.18–5.11 亿美元（[Euronews Srbija 2025-12-30](https://www.euronews.rs/magazin/tehnologija/203661/kako-tiktok-algoritmi-eksploatisu-mladih-kreatora/vest)，`[二手·2025-12]`）。
- 官方入口（提案前须人工复核，本环境连接被重置）：
  - Community Guidelines – LIVE：https://www.tiktok.com/community-guidelines/en/live
  - Community Guidelines 总入口（含 LIVE 与变现章节）：https://www.tiktok.com/community-guidelines/en/

---

## 2. 合规判定表（Safe / Risky / Banned）

> 判定基准：抖音/快手/小红书为主，TikTok 单列。每条只给**一条最要命的规则**。

### ✅ SAFE（可做，且最好走官方通道）

| 做法 | 唯一最重要规则 | 证据 |
|---|---|---|
| 以「直播小玩法」形态做评论/礼物/点赞驱动的互动（对战、养成、竞速、闯关、整蛊、社交等） | **只能通过开放平台提案 + exe 客户端 + 官方数据能力接入**；数据源不能自采 | [创建直播玩法](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/toybox-start) |
| 真人出镜/真人驱动 + 虚拟形象/虚拟场景辅助 | 虚拟人直播须**真人实名 + 真人驱动实时互动**，不可纯 AI 驱动 | [IT之家](https://www.ithome.com/0/838/498.htm) |
| 直播里出现 AIGC 画面/语音时开启 AI 声明 | 虚拟场景**起始画面**要有显著标识；AI 声明需**每场重开** | [标识办法](https://m.gmw.cn/2025-03/14/content_1303991405.htm)、[小红书公告](https://www.sina.cn/news/detail/5333335266300385.html) |
| 免费行为（点赞/评论）也产生可见效果，礼物只做"更快/更炫/更独特" | **免费行为必须有对应反馈，不可纯付费维度** | [准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation) |
| 月榜/段位/称号（数据 ≤3 个月，覆盖 TOP3 以上） | 用户资产最长 **3 个月**，榜单不可只算礼物 | 同上 |
| 展示实物设备/真实打印过程（非合成画面） | 画面必须是**真实、实时**的，不能是录播 | [CNSA 公告](http://www.cnsa.cn/art/2025/9/25/art_1957_47623.html) |

### ⚠️ RISKY（能做但高概率限流/封号，必须改造）

| 做法 | 唯一最重要规则 | 证据 |
|---|---|---|
| **现有产品形态：无真人出镜的 3D 打印/机械臂自动直播** | 抖音禁止无人直播；"挂机/定格/黑屏且几乎无互动"直接命中录播挂机条款 | [IT之家](https://www.ithome.com/0/838/498.htm)、[CNSA](http://www.cnsa.cn/art/2025/9/25/art_1957_47623.html) |
| 30 秒无互动自动补"测试头像"（现有 idle-fill） | 官方小玩法明令**禁止机器人/暖场假出怪**；无人直播语境下更会被当成"互动造假" | [FAQ Q9](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/FAQ) |
| AI 生成场景 24 小时挂着（如"末日安全屋"式助眠） | 若为**实时渲染 + 真实互动 + AI 声明**属灰色；若播循环视频=录播违规 | [刺猬公社/投资界](https://news.pedaily.cn/202511/557924.shtml)、[CNSA](http://www.cnsa.cn/art/2025/9/25/art_1957_47623.html) |
| TTS 语音播报昵称/评论 | 合规但须声明 AI 语音；TikTok 把第三方朗读工具的合规责任归创作者 | [TechCrunch](https://techcrunch.com/2025/08/15/tiktoks-new-guidelines-add-subtle-changes-for-live-creators-ai-content-and-more/) |
| 礼物触发随机/概率（盲盒感） | 只能"外观随机"，**数值/定位/数量随机=违规**；概率须公示；名称不得出现盲盒/礼盒 | [准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation) |
| 倍率/Plinko/转盘式礼物玩法 | 抖音=**抽奖/竞猜**明令禁止；TikTok 可做但涉赌风险高 | [准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation)、[Plinko 案例](https://wgmojo.gg/widgets/games/plinko) |
| 数字人口播/虚拟主播 | 需真人实名 + 真人驱动 + AI 标识；小红书对"AI 低质（穿模/糊化）"直接限流 | [IT之家](https://www.ithome.com/0/838/498.htm)、[小红书公告](https://www.sina.cn/news/detail/5333335266300385.html) |
| 私域/站外引流（加微信、跳转 App） | 快手/抖音均禁止站外导流；小玩法要求"直播间即开即玩，不提供独立下载或引流" | [快手规范](https://www.kuaishou.cn/norm?tab=live)、[准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation) |
| 用逆向协议（TikTok-Live-Connector / 抖音 WSS 解码）采集数据做商用产品 | 平台把"作弊插件/工具"链条按黑产处理，已有刑拘判例；数据合规上也不被官方承认 | [CNSA](http://www.cnsa.cn/art/2025/9/25/art_1957_47623.html)、[开源实现](https://github.com/zerodytrash/TikTok-Live-Connector) |

### ⛔ BANNED（明确禁止 / 已有人被处罚）

| 做法 | 唯一最重要规则 | 证据 |
|---|---|---|
| 录播、挂机、定格、黑屏、盗播 | 2025 年已处罚 45 万+ 直播间、3.3 万账号无限期回收权限、5 人刑拘 | [CNSA](http://www.cnsa.cn/art/2025/9/25/art_1957_47623.html) |
| 无真人出镜的电商直播 | 快手明文列为违规（"无主播出镜，仅展示某实物"） | [快手直播管理规范](https://www.kuaishou.cn/norm?tab=live) |
| 未标识的 AI 数字人/虚拟场景 | 8 平台承诺书：可**屏蔽链接**；法规要求标识并持续提示 | [人民网](http://bj.people.com.cn/n2/2025/1205/c14540-41432994.html)、[新华社](https://www.news.cn/politics/20260130/8b7890c0c6aa4a149a43a3cbcf072069/c.html) |
| AI 换脸/声音克隆冒充公众人物 | 小红书：关停 + 12h 禁播，严重至永久；不可声明豁免 | [小红书公告](https://www.sina.cn/news/detail/5333335266300385.html) |
| 赌博/棋牌/捕鱼/老虎机/推币机/上分器 | 快手严重违规；抖音题材禁入（含捕鱼、扑克牌类） | [快手规范](https://www.kuaishou.cn/norm?tab=live)、[准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation) |
| 玩法内抽奖/竞猜/盲盒/礼盒包装 | 抖音准入规则逐条禁止，违规可下线、暂停结算 | [准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation) |
| 军事、历史人物篡改、传奇画风、股票红绿折线 | 抖音题材禁入清单 | 同上 |
| 非官方抽奖（截屏/口播加粉丝团/站外） | 快手：须用官方抽奖工具 | [快手规范](https://www.kuaishou.cn/norm?tab=live) |
| 数据造假/刷量/外挂/作弊软件 | 快手违规；平台已把"直播保镖"类工具链送进刑事程序 | [快手规范](https://www.kuaishou.cn/norm?tab=live)、[CNSA](http://www.cnsa.cn/art/2025/9/25/art_1957_47623.html) |
| 诱导未成年人消费 | 各平台底线条款；抖音题材/设计双重限制 | [快手规范](https://www.kuaishou.cn/norm?tab=live)、[准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation) |
| 跨平台组房 / 联屏对战（抖音） | "联屏对战模式暂不支持且不准入"；2025-09 后仅非经典类可申请同局连线 | [FAQ](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/FAQ)、[准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation) |
| AR/VR 能力接入 | 抖音"暂不引入，请联系对接运营洽谈" | [准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation) |

---

## 3. 已验证的互动格式（12 个，含饱和与难度）

> 判定说明：**留存**列只写有证据的机制，不写猜测；**饱和**按 2026 年供给密度判断；**难度**= 在官方通道内落地的工作量（不含美术）。

| # | 格式 | 代表案例 | 互动机制 | 为什么留人（证据） | 变现 | 饱和 | 难度 |
|---|---|---|---|---|---|---|---|
| 1 | **双阵营对战**（坦克/攻城/攻防） | 红蓝坦克大战、兵临城下 | 评论选边、礼物出兵、共享血条 | 数值即时反馈 + 阵营归属；《兵临城下》曾做到**全平台月流水 6000 万** | 礼物=兵力；8% 开发者分成 | **很高**（平台主力存量品类，同质化会被拒审） | 中 |
| 2 | **角力/力量博弈** | 拔河、推塔 | 双方累计礼物推条 | 输赢 5 秒内可见，适合主播喊麦带节奏 | 同上 | 高 | 低 |
| 3 | **修仙/境界养成（个人数值）** | 《爱Y-青云直上》《沙雕修仙对抗》 | 点赞/指令加入、礼物突破境界、系统播报 | 2024-11 单日**新增 459 名主播、472 个直播间、4575.9 万热度**；"排行榜驱动 + 即时社交荣誉感" | 礼物=突破/回血；段位与月榜 | 中高（修仙题材已被平台明确准入，供给快速增加） | 中高 |
| 4 | **宠物/怪物养成（每观众一个实体）** | Evo Monster（TikTok） | 评论=孵化自己的怪、点赞=加速、礼物=进化/聚光 | "每个观众有自己的怪"→ 身份上屏 + 长期养成；大额礼物触发**镜头聚光** | 礼物=XP/进化；Top Gifters 榜 | 中（TikTok widget 生态已 93 款，但"每观众实体"仍是少数） | 中 |
| 5 | **竞速/条图** | 赛马、赛车条 | 礼物加速、点赞助跑 | 有明确终点与名次，短周期高潮 | 礼物=加速 | 中 | 中 |
| 6 | **整蛊/主播受罚** | 整蛊类小玩法 | 观众投票/礼物决定主播遭遇 | 平台文档称创新类里"**只有整蛊**脱离了数值博弈"；主播反应提供情绪价值 | 礼物=整蛊道具 | **低**（供给少） | 中（但**内容安全最难**：不得丑化/暴力/低俗） |
| 7 | **社交/关系养成** | 2026 官方主推"主播战队/家族战队/一键摇人/连线同玩" | 关系链、组队、邀请进房 | 2026 大会：**每 3 人发起邀请带来 1 个进房用户**；联机玩法营收**每半年 +30%** | 礼物=队伍增益；社交裂变 | **低**（平台正在扶持） | 高（要处理关系链/跨房） |
| 8 | **投票/表决** | 《超级狸谱表决》（B 站） | 评论投票决定剧情/选项 | B 站两周末**300 万参与、100 万+ 弹幕** | 礼物=加权票 | 中（形式旧，但成本极低） | 低 |
| 9 | **答题/trivia** | HQ 式、Anagram | 评论抢答、礼物加成 | 低门槛参与 + 排行榜；适合无人值守时段 | 礼物=复活/翻倍 | 低 | 低-中（抖音须用官方题库） |
| 10 | **概率/倍率（Plinko/转盘）** | TT Interactive Plinko | 礼物=落球，倍率桶 x1–x8 | "观众一互动就有可见结果"是核心；Top Gifters 与运气分离 | 礼物=落球 | 高（TikTok 侧） | 低；**抖音侧=违规，不能做** |
| 11 | **无人氛围/助眠/自习** | AI"末日安全屋"（抖音/B 站） | 几乎无互动，靠场景与白噪音 | "AI 制作、不需专人值守、极低成本可整夜/全天在线"；有观众**每日打卡** | 打赏弱；靠带货（床品/香薰）与私域 | 中（同质化快） | 低；**合规风险高（无人直播/录播判定）** |
| 12 | **NPC 反应式（人演机器）** | TikTok NPC 直播 | 礼物=触发固定台词/动作，观众"控制"主播 | 固定反应可预期→ 重复送礼测试；念送礼者名字制造可见性 | 礼物；**平台抽走 77% 礼物价值** | 高（TikTok 已泛滥） | 低（真人成本高） |

补充两个"看着像机会、其实难"的方向：
- **实物联动（夹娃娃/打印实物寄送）**：留存靠"真的能拿到"，但物流、成本、履约投诉、平台"无实物交易"规则都会拖死；只适合作为**小奖品点缀**。
- **云蹦迪/音乐律动**：2022 年 B 站《修勾夜店》一夜爆红后迅速退潮（[游戏葡萄/扬帆出海](https://www.yfchuhai.com/article/10769.html)）——**典型"内容消耗快"的失败样本**。

### 3.4 抖音准入规则里"会直接毙掉创意"的条款（做 Brief 前先自查）

来源：[直播玩法准入规则（2025-09-01 版）](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation)、[品类与扶持规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/category-rules)、[FAQ](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/FAQ)。

1. **避免同质化**：与平台已上线玩法相同/相似会被拒；相似品类需在美术、场景、机制（至少多 1 种局内机制）、礼物效果上全部差异化。
2. **反挂机设计**："主播和用户之间缺乏互动内容，容易衍生挂机直播间的玩法设计"不予引入。
3. **反机器人**：不允许任何形式的机器人（含暖场假出怪）；定时 NPC 的数量/强度须所有直播间一致且**明显区别于互动触发的单位**。
4. **反抽奖**：不允许抽奖/竞猜；不得出现【抽奖】【盲盒】【礼盒】；随机只允许外观差异，且概率公示。
5. **反付费墙**：点赞/评论必须有反馈；不允许"付费解锁关卡"；不允许累计消费解锁效果；组刷 ≤30000 抖币。
6. **反引流**：即开即玩，不提供独立下载或站外引流。
7. **安全用词**：玩法设计、用户侧/主播侧外显**不得出现"玩家""游戏"等词**，并需规避"游戏、背包、血条、赛季、BUFF、PVP、抽奖、盲盒"等枚举词（附录表）。
8. **题材禁令**：军事、扑克牌/棋牌、捕鱼、历史人物篡改、传奇画风、股票术语/红绿折线、刻意制造对立引战。
9. **美术质量**：核心元素清晰、不得严重漂浮/穿模/面向异常、不得简陋——**这一条与小红书"AI 低质（穿模/糊化）限流"叠加，意味着 3D 渲染质量=合规门槛**。
10. **评论上屏需批准**："未经平台事先书面认可，不允许将玩法内评论内容直接通过投屏等方式展示至玩法直播画面中。"

---

## 4. 机制原语（可复用的互动循环）

> 把"格式"拆成"原语"，才能在同一套 3D 打印底座上快速换皮、快速过提案。

- **P1 输入→可见后果（≤2s 设计目标）**：官方数据是"秒级"且可能丢失（[数据开放说明](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/develop/server/live-room-scope/data-open/data-open-desc)），所以 UI 必须**本地先给乐观反馈**（排队/占位/动画起手），再等真实数据确认。
- **P2 身份可见**：昵称 + 头像 + 专属颜色/编号上屏。现有产品的"三层头像获取 + 头像缓存"正是这条原语的最强资产（见项目 [README 第 63 行](../../README.md#L63)）。
- **P3 每观众一个持久实体**：一个人一个工件/宠物/座位，**留在场上**、可被围观。这是 Evo Monster 的核心，也是最接近"头像打印机"的迁移路径。
- **P4 免费行为也有反馈**：点赞=加速/热度，评论=下单/指令。既是留存，也是**官方硬性要求**（否则"纯付费维度"违规）。
- **P5 公共进度/合作目标**：全场共同把一件大工件做完（协作而非对抗），承接"联机+社交"的 2026 方向。
- **P6 状态与段位**：月榜、称号、境界；注意上限 3 个月、须覆盖 TOP3 以上、不得只算礼物。
- **P7 高光时刻**：大额礼物=镜头聚光/专属动画/全场播报。礼物必须"被看见"，否则付费动机不成立。
- **P8 合规版空闲填充**：不能假装有观众。可做的是——**明确标注的"演示/练习模式"**、系统 NPC（外显明显不同且告知）、或循环播放"本场回顾"并标"回放"；**绝不能把测试头像伪装成真实观众**。
- **P9 仪式感/周期**：整点大工件、每日主题、月度结算，把"路过"变成"回访"。
- **P10 社交裂变**：一键摇人/组队/邀请进房（平台 2026 主推，且每 3 次邀请约带来 1 个进房用户）。

---

## 5. 技术使能与延迟预算

### 5.1 官方通道（推荐）
- **抖音直播小玩法**：能力清单与接入如上（§1.2）。官方还提供"抖音云服务"：官方口径称**指令推送失败率降低 90%、时延降低 60%、成本降低 10–30%**，已支持上百款弹幕玩法（[创建直播玩法](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/toybox-start)）。
- **快手弹幕玩法**：exe + 直播伴侣 + IPC + 三种画面捕获（game/window/camera），Unity/UE/Cocos 均可（[官方文档](https://open.kuaishou.com/miniPlayDocs/technologyrelated/Affiliatedability/basicability/clientside.html)）。

### 5.2 非官方通道（可做原型，不可规模化）
- **TikTok-Live-Connector**（Node，非官方逆向）：可拿 chat/gift/like/follow/subscribe/battle 等事件；WebSocket 优先，回退轮询默认 **1000ms**；无需凭证（[GitHub](https://github.com/zerodytrash/TikTok-Live-Connector)）`[技术]`。
- **DouyinLiveWebFetcher**（Python，2025 版抖音网页弹幕抓取）（[GitHub](https://github.com/saermart/DouyinLiveWebFetcher)）`[技术]`。
- **本项目现有 bridge**：从本机浏览器直播间页面/协议帧读取，**每 0.3 秒采集**，礼物插队、点赞限流（约 0.4 秒放行一张），自带"30 秒无互动补位"（项目 `README.md`）。技术上比开源库更完整，但**合规上属于逆向路径**。

### 5.3 端到端延迟预算（设计用）
| 环节 | 量级 | 依据 |
|---|---|---|
| 采集（本机 bridge 轮询） | 0.3–1 s | 项目 README / 连接器默认 1 s |
| 平台推送（官方） | **秒级**，无序、可能重复/丢失 | [数据开放说明](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/develop/server/live-room-scope/data-open/data-open-desc) |
| 服务端处理 + 回调 ACK | 2 s（礼物 3 s）否则判失败 | 同上 |
| 3D 渲染/动画起手 | 0.1–0.5 s（本地） | 项目实测口径 |
| 推流到观众端 | 2–5 s（平台 CDN） | 行业常识，需实测 |

**结论：端到端 3–8 秒是现实区间。** 设计上要"**起手即反馈**"（先出现占位/动画），不要承诺"1 秒内完成"。

### 5.4 其他技术件
- **OBS / 浏览器源**：Livecade、TT Interactive 等 TikTok 互动游戏均以单条 browser source 接入 OBS / Streamlabs / **TikTok LIVE Studio**（[Evo Monster](https://github.com/livecade/evo-monster-tiktok-live-game)、[TT Interactive](https://wgmojo.gg/widgets)）——本项目"独立场景窗口 + OBS 采集"的做法与生态一致。
- **TTS/语音**：礼物语音播报是最低成本的"人格化"；但需 AI 声明（小红书）与创作者责任（TikTok）。
- **数字人**：合规成本最高（实名+真人驱动+标识），且小红书明确对"低质 AI 直播"限流，不建议作为第一版。

---

## 6. 失败模式（饱和 / 上线即死 / 会被判违规）

1. **纯录播/挂机**：已从"限流"升级为"刑事风险"（30 余款软件、5 人刑拘）（[CNSA](http://www.cnsa.cn/art/2025/9/25/art_1957_47623.html)）。
2. **"无人直播躺赚"类教程/工具**：平台公开点名"无需真人直播""躺平即可赚钱"是黑产话术（同上）。
3. **同质化对战**：平台准入有"避免同质化"条款，且主播端已内卷到"返点低、收益低、熬时长"（后者为自媒体观察，`[二手]`，仅作参考）。
4. **抽奖/盲盒/概率**：抖音玩法内直接禁止；TikTok 侧也面临"数字老虎机"舆论（[Euronews](https://www.euronews.rs/magazin/tehnologija/203661/kako-tiktok-algoritmi-eksploatisu-mladih-kreatora/vest)）。
5. **数字人带货**：未标识被屏蔽、低质被限流、无真人被禁（§1.1、§1.4）。
6. **云蹦迪/热点玩法**：2022 年爆红后快速退潮，说明"内容消耗速度"是这类产品的死因（[游戏葡萄](https://www.yfchuhai.com/article/10769.html)）。
7. **棋牌/捕鱼/军事/传奇画风**：题材层面直接禁入（[准入规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation)）。
8. **AR/VR 接入**：平台暂不引入。
9. **站外引流/私域**：快手、抖音均明文禁止。
10. **把"AI 生成"当卖点却不标识**：8 平台承诺书 + 三部法规，风险已从"平台规则"升到"法规"。

---

## 7. 给创意会的 5 条最强洞察

1. **"无人"不是卖点，"不冷场"才是。** 平台真正打击的是"假互动/假实时"，不是"没有人脸"。官方数据延迟是秒级、且可能丢失，因此产品竞争力在于**任何时刻画面都有事发生、且观众能看出与自己有关**（P1/P2/P8）。
2. **官方通道 = 流量 + 结算 + 保护，逆向通道 = 速度 + 封号。** 小玩法开发者只拿流水的 8%（[FAQ](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/FAQ)），但换来的是平台推荐的玩法榜、主播招募、结算与合规背书；逆向方案连"被平台承认"都做不到，且平台已把工具链按黑产处理。
3. **2026 的平台顺风是"联机 + 社交 + 创新品类"，不是"更卷的对战"。** 官方给创新类（社交/养成/竞速/闯关/整蛊等）资源位与扶持，对战类被"避免同质化"条款约束（[品类与扶持规则](https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/category-rules)、[2026 大会](http://gamethk.com/news/detail/20146/1.html)）。
4. **付费红线把"随机"全部挤到"外观与身份"，这恰好是"头像/工件"的主场。** 不能抽奖、不能概率影响数值，但可以做**确定性效果 + 外观/称号/镜头聚光 + 月榜**——即"我的头像/工件/宠物在场上被看见"。
5. **AI 标识是成本最低的合规投资，渲染质量是最容易被忽略的合规风险。** 开 AI 声明只要一个开关；但"穿模/糊化/金属音"会直接触发限流（小红书二类），3D 实时渲染的画质与稳定性必须当**合规指标**来做。

---

## 8. 三个可落地方向（给 Brief 的候选，不做最终裁决）

> 前提：都建议走**抖音直播小玩法**官方通道；把现有 3D 打印场景改造成"玩法画面"，bridge 只做原型验证，不做商用数据源。

**A.「养成类」我的工件会进化（最贴近现有资产）**
- 机制：评论=下单/命名，点赞=加速，礼物=稀有材料/外观；每个观众一个工件，**留在传送带上**，随时间/互动升级；全场共同完成"本月大件"（P3+P4+P5+P6）。
- 为什么能留：Evo Monster 已验证"每观众一个实体 + 聚光"；官方"养成"是创新类扶持品类。
- 风险：需重新包装掉"游戏/背包/血条"等词；不能有机器人暖场；数据 3 个月清零要做成"月度重铸"叙事。

**B.「整蛊类」观众指挥机械臂整主播（差异化最高）**
- 机制：观众用评论/礼物选择"下一个整蛊动作"，由真人（或真人驱动的虚拟形象）承受并反应；机械臂/打印机作为"道具"（P7 高光）。
- 为什么能留：平台文档称整蛊是唯一脱离数值博弈的创新形态，供给少；主播反应提供情绪价值。
- 风险：**内容安全最难**——不得丑化/暴力/低俗/人身伤害；必须真人出镜或真人驱动。

**C.「联机类」双直播间 PK 打印（吃 2026 红利）**
- 机制：两个直播间/两位主播各自打印，观众送礼助战，实时对比进度与完成度（P5+P10）。
- 为什么能留：联机玩法营收每半年 +30%，平台 2026 主推；社交裂变（一键摇人）。
- 风险：抖音联屏/同局连线有限制（仅非经典类可申请、跨平台组房不支持），需提前与平台确认。

**明确不建议**：任何形式的"循环视频 + 测试头像冒充观众 + 纯 AI 语音念弹幕"的 24h 无人直播；以及"抽奖/盲盒/倍率"式礼物玩法。

---

## 9. 来源清单（按类型与日期）

**监管 / 官媒**
1. 《人工智能生成合成内容标识办法》全文（2025-09-01 施行）— https://m.gmw.cn/2025-03/14/content_1303991405.htm
2. 新华社：2 月新规，"AI 主播"纳入直播电商监管（2026-01-30）— https://www.news.cn/politics/20260130/8b7890c0c6aa4a149a43a3cbcf072069/c.html
3. 法治日报：《直播电商监督管理办法》施行（2026-02-03）— http://www.legaldaily.com.cn/index/content/2026-02/03/content_9333821.html
4. 人民网：8 家电商平台签订《促进 AI 技术规范应用承诺书》（2025-12-05）— http://bj.people.com.cn/n2/2025/1205/c14540-41432994.html
5. 第一财经：抖音今年处罚超 45 万个"录播""挂机"直播间（2025-09-25）— https://www.yicai.com/news/102842975.html

**抖音官方 / 权威转载**
6. 中国网络视听节目服务协会转载《抖音直播关于治理录播挂机的公告》（2025-09-25）— http://www.cnsa.cn/art/2025/9/25/art_1957_47623.html
7. 抖音开放平台：直播小玩法常见问题（收益/准入/机器人/随机/数据）— https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/FAQ
8. 抖音开放平台：创建直播玩法（提案→能力→审核）— https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/zn/toybox-start
9. 抖音开放平台：直播玩法准入规则（2025-09-01 版）— https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/creation
10. 抖音开放平台：玩法品类与扶持规则 — https://developer.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/category-rules
11. 抖音开放平台：数据开放说明（秒级/无序/回调超时/QPS）— https://developer.open-douyin.com/docs/resource/zh-CN/interaction/develop/server/live-room-scope/data-open/data-open-desc
12. 抖音开放平台：运营规范说明 — https://partner.open-douyin.com/docs/resource/zh-CN/interaction/operation/guide/rules
13. 抖音规则中心（官方入口，JS 渲染，本环境未能直读）— https://www.douyin.com/rule/encyclopedia

**快手官方**
14. 快手社区规则·直播管理规范 — https://www.kuaishou.cn/norm?tab=live
15. 快手弹幕玩法客户端接入说明 — https://open.kuaishou.com/miniPlayDocs/technologyrelated/Affiliatedability/basicability/clientside.html

**小红书**
16. 小红书关于打击 AI 违规直播的治理公告（2026-08-18，新浪转载）— https://www.sina.cn/news/detail/5333335266300385.html
17. 虎嗅：小红书专项治理三类 AI 违规直播行为（2026-08-18）— https://mm.huxiu.com/moment/1272228.html

**抖音合规现状（媒体）**
18. IT之家：抖音副总裁李亮谈 AI 无人直播（2025-03-17）— https://www.ithome.com/0/838/498.htm
19. DoNews：抖音集团副总裁警告 AI 无人直播风险（2025-03-17）— https://www.donews.com/news/detail/8/4820639.html
20. 国际在线/搜狐：抖音直播禁止录播挂机（2025-09-25）— https://m.sohu.com/a/938623078_115239/
21. 服务商视角：2026 数字人直播被封原因（2026-06-24，营销稿，仅作行业氛围参考）— https://www.snkxd.com/news/id/47

**TikTok（官方页不可直连，采用可访问的二手来源）**
22. TikTok Community Guidelines – LIVE（官方入口，本环境连接被重置）— https://www.tiktok.com/community-guidelines/en/live
23. TechCrunch：TikTok 新社区规范对 LIVE 创作者/AI 内容的影响（2025-08-15）— https://techcrunch.com/2025/08/15/tiktoks-new-guidelines-add-subtle-changes-for-live-creators-ai-content-and-more/
24. StreamHouse：哪些平台允许预录直播（2026-09-16）— https://streamhouse.co/blog/which-platforms-allow-pre-recorded-streams
25. AuditSocials：TikTok Shop 2026 高质量 LIVE 规则（禁 AI 声音/预录音频/静态过半）（2026-07-15，合规服务商）— https://www.auditsocials.com/blog/tiktok-shop-high-quality-live-rules-2026-ai-voice-pre-recorded-audio-ban-live-shopping
26. Euronews Srbija：TikTok 的 NPC 直播与礼物经济（2025-12-30）— https://www.euronews.rs/magazin/tehnologija/203661/kako-tiktok-algoritmi-eksploatisu-mladih-kreatora/vest
27. TT Interactive：93 款 TikTok LIVE 互动游戏目录 — https://wgmojo.gg/widgets
28. TT Interactive：Plinko 互动玩法机制 — https://wgmojo.gg/widgets/games/plinko
29. TikTok LIVE 观众控制玩法 8 种方法 — https://www.toktutorials.com/post/viewers-control-any-tiktok-live-game-8-methods

**行业数据 / 案例**
30. 游戏葡萄（扬帆出海转载）：单产品月流水 6000 万，弹幕互动玩法赛道（2023-06-02）— https://www.yfchuhai.com/article/10769.html
31. GameLook：弹幕修仙游戏大爆发（2024-11-05）— https://so.html5.qq.com/page/real/search_news?docid=70000021_5626728ef8719552
32. 游戏智库：2026 抖音直播玩法生态（联机+社交，2025 峰值 +34%、营收 +22%）（2026-03-12，厂商稿性质）— http://gamethk.com/news/detail/20146/1.html
33. 刺猬公社/投资界：AI 生成的"末日安全屋"助眠直播（2025-11-28）— https://news.pedaily.cn/202511/557924.shtml

**开源 / 技术**
34. TikTok-Live-Connector（非官方 TikTok LIVE API 客户端）— https://github.com/zerodytrash/TikTok-Live-Connector
35. DouyinLiveWebFetcher（抖音网页弹幕抓取）— https://github.com/saermart/DouyinLiveWebFetcher
36. Livecade / Evo Monster（TikTok 每观众怪物养成，OBS browser source）— https://github.com/livecade/evo-monster-tiktok-live-game
37. 开源项目「Live-Game-AI-Streamer」技术调研：官方小玩法 vs 逆向 WebSocket（2026-05-20）— https://github.com/xiaobao0818/Live-Game-AI-Streamer-xiaobao

---

## 10. 待复核清单（写进 Brief 前必须人工确认）

- [ ] 抖音直播小玩法**当前**准入规则原文（本环境读到的是 2025-09-01 版；平台称会动态调整）。
- [ ] 抖音"联屏/同局主播连线"2026 年最新开放范围（FAQ 与准入规则口径不一致）。
- [ ] 小红书 AI 声明入口与豁免话术（公告写"每次开播需重开"）。
- [ ] TikTok Community Guidelines – LIVE 与 Monetization 原文（本环境无法直连 tiktok.com）。
- [ ] 快手弹幕玩法**准入/分成**细则（本次只拿到客户端接入文档）。
- [ ] 3D 场景在直播码率下的渲染质量实测（穿模/糊化=小红书二类限流风险）。

*本文件仅为调研底稿，不含最终产品决策；所有政策以平台最新公示为准。*
