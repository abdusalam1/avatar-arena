# LiveApp「头像打印机 / Avatar Printer」— Capability Inventory & Extension-Point Map

Read-only architecture audit for designing NEW live-stream game concepts on top of this project.
Workspace: `D:\onedrive\OneDrive\桌面\order\LiveApp`. All claims cite `file:line`.
Mojibake Chinese inside source files (GBK text read as UTF-8) is cosmetic noise; logic is unaffected.

**Verification actually performed (not assumed):**
- `node --test` → **54 tests, 54 pass, 0 fail** (5.7 s) covering every `*.test.mjs` + `test-bridge-ports.mjs`.
- `python test_scene_relay.py` → **3 tests OK**.
- Source was read directly; no project file was modified. Only this notes file was created.

**Working-tree caveat:** the repo is *already dirty* vs `HEAD` before this audit —
`M index.html`, `M launch.py`, `M render-budget.mjs`, `M scene-output.mjs` (+89/−7, mtimes 2026-11-03/04,
i.e. pre-existing owner work, not this audit). **All line numbers below refer to those current
working-tree files** (e.g. `render-budget` floor is already 0.7×, `SceneOutput.render` already has the
33 ms shadow throttle). A `git stash`/checkout would shift some citations in those four files.

---

## 1. Runtime topology and data flow

Four cooperating processes / surfaces. There is **no backend, no database, no auth, no cloud** — everything is loopback.

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 1) BROWSER-BASED SCRAPER  (Chrome/Edge driven over CDP)                               │
│    douyin-bridge.mjs  +  bridge-ws.mjs                                                │
│                                                                                       │
│  live.douyin.com/<room>  ──CDP Network.webSocketFrameReceived──►  handleWSFrame        │
│      (attached tab)            (douyin-bridge.mjs:760-766)         (156-175)          │
│         │                                                             │              │
│         │  every 300 ms: Runtime.evaluate(COLLECT)                    │ protobuf     │
│         └──────────────► parseChatLine / parseLike / allocateLikes ◄──┘  decode      │
│                          (24-45, 273-279, 295-321)                     (72-154)      │
│                                   │                                                  │
│                                   ▼  hub.broadcast(ev)  (bridge-ws.mjs:109-114)       │
│                    ws://127.0.0.1:8765  (fallback 8766-8774, bridge-ws.mjs:73-75)     │
└───────────────────────────────────┬───────────────────────────────────────────────────┘
                                    │ plain JSON text frames (one object per event)
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 2) MAIN PAGE  index.html  (WebView2 app window, or any browser tab)                   │
│    connectBridge() (425) → /__bridge-status → new WebSocket(ws://…)                   │
│    socket.onmessage → add(v) (421) → liveEvent() (417) → demoEngine.event()           │
│                       (demo-rules.mjs:4)  →  queue[]  →  next() (302)                 │
│    next() → createProduct() (250) → phases: idle→printing→reveal→transfer→idle (414)  │
│    render: animate() rAF loop (412-414) → SceneOutput.render (scene-output.mjs:49)    │
│    audio: PrinterAudio.update (printer-audio.mjs:12) + GiftSpeech.pump (gift-speech.mjs:10) │
└───────┬──────────────────────────────────────────────┬────────────────────────────────┘
        │ BroadcastChannel('printer-scene')            │ WebRTC (canvas captureStream)
        │ + long-poll /__scene-events                  │ + data channel 'controls'
        ▼                                              ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────────────┐
│ 3) SIGNALLING  launch.py thread       │   │ 4) SCENE / OBS WINDOW                     │
│    SceneRelay (scene_relay.py)        │   │    live-view.html  (WebView2, or popup)   │
│    GET /__scene-events (long-poll 15s)│   │    <video> mirror only — renders nothing,  │
│    POST /__scene-message              │   │    prints nothing (live-view.html:14-15)  │
│    static HTTP server on 8080 (+list) │   │    OrbitControls → camera-change back     │
│    control endpoints /__start-bridge… │   └──────────────────────────────────────────┘
└──────────────────────────────────────┘              → OBS "window capture" (guide.html:111-112)
```

Reverse channel (page → bridge) is a single message type: `{"type":"set-room","room":"<id>"}`
(`index.html:479` send, `douyin-bridge.mjs:951-957` handled).

### 1.1 Event → print-job path (the thing a new game will bend)

```
WS JSON ──► add(v) index.html:421
              ├─ gift    → liveEvent(kind, {name,avatar}, v.count, v.raw, '礼物·'+raw)   :421
              ├─ like    → liveEvent('like', {name,avatar}, v.count, null,'点赞')        :421
              ├─ follow  → liveEvent('like', {name,avatar}, 1,        null,'关注')       :421
              ├─ join    → liveEvent('like', {name,avatar}, 1,        null,'进场')+welcome :421
              ├─ comment → liveEvent('like', {name,avatar}, 1,        null,'评论')       :421
              └─ hello/ping/room → HUD/status only                                       :421
        ▼
liveEvent() :417
  · printOptions(printRules,type,sourceTag)  (print-settings.mjs:2-7) → {count,size,priority}
  · demoEngine.event(type,user,'live-N',amount,options)               (demo-rules.mjs:4)
        jobs = Array(rule.count * amount) of {name,avatar,size,priority,source,copy,total}
        priority jobs splice in at the first non-priority index (demo-rules.mjs:4)
  · comments are re-inserted BEFORE the first like/follow/join job (index.html:417)
  · preemptForGift() (289-301) · renderQueue() (417) · next() (302)
        ▼
next(): busy guard → active = queue.shift() → score=60+rand(36) (:302)
```

Printing is **strictly serial** (`busy` flag, `index.html:302`), one medallion at a time.

---

## 2. Capability inventory (what already exists)

| Capability | Where | Notes / limits |
|---|---|---|
| Live comment/gift/like/join/follow ingest | `douyin-bridge.mjs:24-45, 156-175, 797-872` | text scrape + protobuf协议帧, 300 ms cadence (`:889`) |
| Same schema from TikTok edition | `index-en.html` + `gift-speech-en.mjs` | separate files, same event names (`gift-preemption.test.mjs:5`) |
| Avatar resolution (3 layers) | protocol frames `156-175`; page scrape `COLLECT 325-400`; profile-card hover `618-734` | persisted cache `avatar-cache.json` max 3000 (`179-180`), saved 30 s (`935`) |
| Anonymous "like" attribution | `allocateLikes 295-321` | fabricates owner by fair round-robin over roster, cap 3/pass, 1/pass if no avatar |
| Priority gift pre-emption | `index.html:289-301`, `demo-rules.mjs:4` | active non-priority job is re-queued and its product discarded mid-print |
| Auto-demo / idle fill | `index.html:287-288`, `print-settings.mjs:19-20` | demo gap 0/3/5/10/15/30/60/120 s; idle fill after 15/30/60/120 s |
| Auto-start / reconnect bridge | `index.html:424-425`, `douyin-bridge.mjs:771-785, 938-942` | retry every 3 s, follow `.bridge-room` file every 2 s |
| Multi-window print dedupe | `index.html:28-32, 38-40, 60` | leader election over BroadcastChannel; every print path gated by `printAllowed()` |
| Scene mirror to OBS window | `index.html:40-52`, `live-view.html`, `scene_relay.py` | WebRTC 40 Mbps H.264, manual frame push per render |
| Quality tiers | `index.html:194-200, 311-317`, `scene-output.mjs:3-10, 36-48`, `render-budget.mjs:5-7` | 5 presets × 6 AA modes; adaptive internal scale 0.7×–2×; 4K pixel cap |
| Output resolutions | `index.html:313` (landscape/portrait × 720p/1080p) | chosen by `?scene=1` gear panel `541-577` and main-window select `386` |
| 3D set dressing | `index.html:84-231` (desk, room, 5 AI backdrops), `setRoom 229` | themes: home/study/night/workshop/garden |
| Rate-limited like storms | `douyin-bridge.mjs:239-254`, `index.html:421` | token bucket ≈2.5/s, cap 20 |
| Bilingual voice | `gift-speech.mjs` / `gift-speech-en.mjs` | browser TTS, 16 gift + 6 printing + 16 welcome templates |
| Procedural machine SFX | `printer-audio.mjs` | WebAudio oscillators + 2 recorded WAVs |
| Rules panel (8 toggles + per-type count/size) | `print-settings.mjs:8-22`, `index.html:474-478` | persisted to `localStorage.printRules` |
| Print log | `index.html:518-520` | in-memory only, 400 records, lost on reload |
| Rule-sheet PNG export | `download-rules.mjs:1-28`, `launch.py:315-331` | canvas → pywebview save dialog |
| Desktop shell | `launch.py` | HTTP server, bridge spawn/stop, scene window, live-room window |
| Test harness | 13 JS test files + 1 Python | 54 + 3 assertions-green |

### 2.1 What the data does **not** contain (designers must not assume it)
- **No user id.** Identity is the nickname string; matching uses `normKey()` (strip spaces + ornamental emoji, `douyin-bridge.mjs:67-69`). Nickname change = new person.
- **No gift price/tier.** `mapGift()` collapses everything to `beer|lollipop|heart|other` (`:47-52`). A 嘉年华 and a 小心心 are both just ≥1 unit.
- **No real like attribution.** Every `like` event's owner is synthesized (`allocateLikes`, `:295-321`); when the roster is empty the delta is dropped (`:824`).
- **No real follow identity.** Follows are mostly inferred from the room owner's fan count polled every 30 s (`pollFollowers`, `:531-572`) and attributed to most-recent viewers.
- **No gender / region / level / streak / history.** Score is `60+rand(36)` (`index.html:302`), purely decorative.
- **No backend.** Page reload loses the queue, counters and `printRecords` (`index.html:518`); only `localStorage` + `avatar-cache.json` survive.
- **No time-series.** `ping.stats` is cumulative counters only (`douyin-bridge.mjs:900`).

---

## 3. Event schema (bridge → page)

All frames are one JSON object per WebSocket text frame, broadcast to every connected page
(`bridge-ws.mjs:109-114`). `avatar` is a **full CDN URL** or `""`.

| `type` | Fields | Producer (file:line) | Page effect (`index.html:421`) |
|---|---|---|---|
| `like` | `name`, `avatar`, `count` 1–3 (protocol) / 1–100 (page) | `douyin-bridge.mjs:252`, `:823` | source `点赞`, `count` jobs |
| `follow` | `name`, `avatar` | `:260` (Social), `:566` (fan-count) | source `关注`, 1 job if `printRules.follow` |
| `join` | `name`, `avatar` | `:269` (Member), `:865` (text) | 1 job if `printRules.join` + welcome TTS if `joinVoice` |
| `gift` | `name`, `avatar`, `gift`∈{`beer`,`lollipop`,`heart`,`other`}, `raw` (Chinese gift name), `count` 1–100 | `:860` | `RULES[gift].count × count` jobs, priority |
| `comment` | `name`, `avatar`, `text` | `:861` | source `评论`, 1 job if `printRules.comment` |
| `hello` | `room`, `people[≤8]{name,avatar}` | `:895`, `:917`, `:924` | connect banner, seeds `lastSnapshotPeople` |
| `ping` | `room`, `ts`, `people[≤8]`, `stats{comment,like,gift,join,lastAgo,roster}` | `:900` (every 2 s) | HUD line "弹幕X · 点赞Y · 礼物Z · 观众N" |
| `room` | `room` | **never sent by this bridge** | branch exists at `index.html:421` — dead/compat |

Page → bridge (only one):

| `type` | Fields | Producer | Consumer |
|---|---|---|---|
| `set-room` | `room` (5–25 digits) | `index.html:479` | `douyin-bridge.mjs:951-957` → `applyRoom()` (persists to `.bridge-room`, navigates tab) |

Cross-window messages (not on the WebSocket):

| Channel | Types | Where |
|---|---|---|
| `BroadcastChannel('printer-scene')` | `who{sid,born,scene}` every 2 s | `scene-channel.mjs:6,24`, `index.html:60` |
| long-poll `/__scene-events` + POST `/__scene-message` | `view-request, view-offer, view-answer, view-ice, view-ping, view-ready, view-bye, view-size, view-stats, view-camera, view-camera-request, view-camera-change` (whitelist) | `scene_relay.py:15-19`, `scene-channel.mjs:11-29` |

Notes: `view-*` go through the HTTP relay; everything else stays inside BroadcastChannel
(`scene-channel.mjs:24-29`). The relay is bounded to 256 events and never replays history to a
new client (`scene_relay.py:10,25-33`; `test_scene_relay.py:11-13`). Only same-origin local pages
may POST (`launch.py:125-129`).

---

## 4. Scheduler / queue semantics (exact rules)

- **Job shape**: `{...user, size:'small'|'large', priority:bool, source:string, copy:i+1, total:n}` (`demo-rules.mjs:4`).
- **Per-event multipliers** (`demo-rules.mjs:1`): like 1×small, heart 1×large, beer 2×large, lollipop 3×large, other 1×large; all gifts `priority:true`.
  Live amount from the room multiplies: `count = rule.count * amount`, amount clamped to 1–100 (`demo-rules.mjs:4`; page clamps in `index.html:421`).
  → one "棒棒堂 ×1" = 3 jobs; one gift with `count:100` = **300 jobs**.
- **Priority insertion**: gifts splice in at the first non-priority index → gifts are FIFO among
  themselves but jump every normal job (`demo-rules.mjs:4`; proven by `demo-rules.test.mjs:5-12`).
- **Comment ordering**: after insertion, comment-triggered jobs are moved to *before the first
  like/follow/join job* (`index.html:417`) — i.e. comments outrank likes but not gifts.
- **Pre-emption** (`preemptForGift`, `index.html:289-301`):
  - only fires when `busy && !active.priority && queue[0].priority`;
  - mid-`printing`: the unfinished job is put back ahead of other normal jobs and the half-printed
    product is **disposed** (it will be printed again from scratch);
  - mid-`reveal`/`transfer`: the finished product is moved onto the conveyor instead of dropped, and
    **no duplicate job** is created (`gift-preemption.test.mjs:13`).
- **Manual pause** freezes both printing and conveyor (`index.html:414` `if(!paused)`), and blocks
  pre-emption (`:290`).
- **Auto-demo fallback** (`replenishDemo`, `:287`): only when `autoDemo && !paused && !busy &&
  queue.length===0`; gap from `printRules.demoGapMs` (0 disables). Bridge connect turns auto-demo
  **off** and drops all non-live queue entries (`:425` onopen); disconnect turns it back on.
- **Idle fill** (`idleTestFill`, `:288`, ticker at `:425`): 1 job (`'30秒无互动·测试头像'`,
  `markLive=false`) when `printRules.idleFill` and no real message for `idleSeconds`, and queue < 2.
- **Settings are snapshotted per job** — changing rules does not re-plan queued work
  ("打印规则对新收到的互动生效，已排队任务保持不变", `print-settings.mjs:21`).

---

## 5. Render / scene pipeline

### 5.1 The "print" is a stylised medallion, not a model of the avatar image
- Product = wooden/porcelain base + circular medallion (96 segments × 18 rings,
  radius .607) + portrait disc + convex glass + glint shader (`index.html:250-285`).
- The avatar image is only used as a **texture on the portrait disc**
  (`new THREE.TextureLoader().load(v.avatar||fallbackAvatar(...))`, `:285`).
  If the texture fails to load the error callback is empty → the disc stays white (no fallback there).
- Material tier is chosen from the random score: `>=90` gold, `>=80` octagon dark, `>=70` silver,
  else wood (`:250-252`); name + score are drawn onto a canvas label (`:284`).

### 5.2 Layer animation (fake FDM)
- `printDuration = 12` simulated seconds, `layerCount = 72` layers (`:400`); `dt` is multiplied by
  `simulationSpeed` (`:414`), default `4` (`:400`).
- Each layer is a closed 4-corner path with 24 samples per side = 96 points (`layerPath`, `:401-405`);
  deposited filament is a `LineSegments` whose `drawRange` grows as `(layer*96+index)*2` (`:408-409`).
- A clipping plane at `g.position.y + (.58 + layer/72*1.85) * factor` hides the not-yet-printed part
  (`createProduct:250`, `updateDeposition:408`) — this is what makes it look "printed layer by layer".
- Gantry Y and head X/Z track the deposition point; the fan spins (`:409`); 4 filament spools and
  animated hoses (`updateHoses`, `:137-140`).

### 5.3 Phase machine (`animate`, `index.html:414`)
`printing` (12 s sim) → `reveal` (gantry lifts, 0.55 s sim) → `transfer` (6 s sim, `runTransfer:171-175`)
→ `idle` → `next()`.
`runTransfer` timeline in sim-seconds: reach 0–1.2, descend 1.2–1.65, attach+lifff 1.65–2.35,
carry 2.35–3.75, lower 3.75–4.45, release 4.45, retreat 4.9–6.0.
Arm is 2-link IK (`solveArm:168`, `armL1=3, armL2=2.8` at `:165`); rest pose `:169`.

**Measured throughput**
| simulationSpeed | per item (12 + 0.55 + 6 sim-s) | items/min |
|---|---|---|
| 1× | ≈18.6 s | ≈3.2 |
| 4× (default) | ≈4.6 s | ≈13 |
| 12× (demo fast) | ≈1.5 s | ≈39 |

### 5.4 Conveyor & lifetime
Belt from x=-4.3 to x=12 at z=3.2, speed `.21`/s (`:145`); placed products ride it
(`:414`) and are disposed past `beltEnd-.15` (`:414`, `disposeProduct:286`). Conveyor and print run in
parallel, so finished items overlap the next print.

### 5.5 Camera
- Default camera `(6.8, 9.6, 24.5)` target `(3.6, 2.3, 1.3)`, FOV 36 (`:73,75`).
- "头像近景" preset `(2,4.8,11)` target `(1.5,1.65,2.2)` (`:192`).
- Up to **10 saved named camera presets** in `localStorage.printer-views`, plus "initial view";
  last-used view auto-restored (`:233-247`), and dragging persists `printer-view-last` (`:247`).
- Camera can be driven from the OBS window via `view-camera-change` (`:56`); the main window
  answers `view-camera-request` (`:55`).
- Camera is **independent of the event stream** today — nothing auto-cuts on events.

### 5.6 Render quality tiers
- Presets (`:194`): `lite` (no reflections/shadows/glint), `1` 1×, `2` 1.25×, `4` 1.5×, `8` 2× —
  freely combinable with the 6 AA modes. Four friendly aliases (low/standard/high/ultra) map onto
  quality+AA pairs at `:341`, wired at `:348-350`.
- AA modes (`scene-output.mjs:3-10`): off / MSAA 2/4/8 / SSAA 1.5/2.
- `SceneOutput.configure` clamps internal scale by `sqrt(8294400/(w*h))` (a 4K-pixel budget), max
  texture size, and a `limit` (`scene-output.mjs:36-48`). Output canvas size never changes.
- Shadow map refreshed at ~30 Hz only (`scene-output.mjs:54-55`); `renderer.shadowMap.autoUpdate=false` (`:74`).
- Adaptive downscale: `nextRenderScale` drops internal scale ×0.75 (floor 0.7) when FPS < 80 % of
  target, recovers only after 20 s at ≥90 % (`render-budget.mjs:5-7`, `:369-380`).
- Target FPS ∈ {24,30,60,90,120} (`:312`), also applied to the WebRTC `maxFramerate` (`:47`).

### 5.7 Scene takeover / multiple windows
- Rank = age, but a `?scene=1` window gets `-1e12` (always preferred): `peerRank/myRank`
  (`index.html:29-31`). Stale peers expire after 6 s; `who` heartbeat every 2 s (`:60`).
- `printAllowed() === iAmLeader()` (`:32`) gates **every** event→job path (`:421`).
- The OBS window (`live-view.html`) renders nothing and prints nothing (`live-view.html:14-15`) — it
  only plays the mirrored `<video>` and sends camera changes.
- When a mirror is connected the main window hides its own stage (`setSceneDetached`, `:304-309`),
  and the 3D canvas keeps rendering with `captureStream(0)` + one `requestFrame()` per rAF
  (`:43, :414`) at 40 Mbps, H.264 preferred (`:47-48`).

---

## 6. Audio (two independent systems; **no pre-recorded speech**)

**(a) Machine SFX — procedural + 2 recorded WAVs** (`printer-audio.mjs`)
- WebAudio graph: master gain → 8:1 limiter (`:4`); requires a real user gesture; `resume()` with a
  2.5 s timeout throws `浏览器未解除音频暂停` (`:6`).
- Loops `assets/printing-writing.wav` while `phase==='printing'` (`:12`), and
  `assets/robot-arm.wav` during `phase==='transfer'`, re-triggered per arm segment at
  `[0,1.2,1.65,2.35,3.75,4.45,4.9]` sim-seconds (`:13` — matches `runTransfer:172`).
- UI cues are **synthesised oscillator notes** (`cue()` table, `:11`): on/complete/queue/gift/like/
  pause/resume/skip/reset/scene. `start` and `transfer` are deliberately silent (`:11`).
- Silenced when `document.hidden` (`:3, :10`), on mute (`:9`), and on page hide (`:14`).

**(b) Viewer speech — browser `speechSynthesis` (TTS), Chinese** (`gift-speech.mjs`)
- Runtime synthesis, not clips: `SpeechSynthesisUtterance` with `rate 1.05`, `pitch 1.16`,
  `volume .85` (`index.html:463`, `gift-speech.mjs:10`); voice prefers Windows zh-CN female voices
  (`:4`) and is user-selectable (`index.html:467`).
- Template banks: 16 gift thanks, 6 printing-start, 6 printing-done, 16 welcomes (`gift-speech.mjs:5-7`).
- **Queue discipline**: FIFO, max **12** pending; overflow ⇒ caption only, text dropped (`:8`).
  `printing()` is a *no-op while speaking or while anything is queued* (`:6`) — start/finish lines are
  intentionally lossy, gift/welcome lines are not (they go through `enqueue`).
- Gated by a first user gesture (`unlocked`; `index.html:459`) and by `printRules.giftVoice/joinVoice`
  (`index.html:421`). `stop()` bumps `generation` so late `onend`/`onerror` cannot resurrect the queue (`:11`).
- Speech is **fire-and-forget and unsynced with animation** — nothing waits for `onend`.

---

## 7. Desktop shell (ports, health, capture)

`launch.py` is the single entry point; `start.bat` → `python launch.py`.

| Concern | Implementation |
|---|---|
| HTTP static server | thread on first free port of `(8080,8081,8181,8088,8090,8095,8282,8388)`, reuse if it already serves this app (`launch.py:69-83`) |
| MIME pinning | `.mjs/.js → text/javascript`, `.wasm`, `.wav` … because Windows registry mangles these (`:86-115`) |
| Cache | `no-store` on everything so Ctrl+R picks up edits (`:117-122`) |
| Bridge discovery | `bridge_status()` probes `8765-8774` for `/health` with `service=='avatar-printer'` and matching `identity` (i.e. the same folder), bypassing system proxies (`:32-47`; `bridge-ws.mjs:68`) |
| Start bridge | spawn `node douyin-bridge.mjs <room>` with `PRINTER_CDP_PORT=9224`, log to `desktop-bridge.log`, wait ≤3 s for health (`:195-225`, `:389-411`) |
| Live-room window | separate process, `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9224`, profile `.live-webview-profile` (`:367-387, 480-486`) |
| Scene/OBS window | separate process `--scene-view`, profile `.scene-webview-profile`, sizes from orient map, `PRINTER_PORT` inherited (`:333-350, 465-479`) |
| Anti-throttling | always adds `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling` (`:441-452`) — without this the popup mirror goes laggy/soft |
| Capture-compat mode | `.capture-compat` file ⇒ adds `--disable-gpu --disable-accelerated-video-decode` (`:453-456`, `:302-313`) |
| JS↔Python API | `DesktopApi` via pywebview `js_api`: `open_scene_window`, `resize_scene`, `open_live_room`, `start_capture`, `stop_capture`, `save_rules_png`, `restart_program`, capture-compat get/set (`:280-440`) |
| Guarded control endpoints | `/__bridge-status`, `/__scene-events`, `/__scene-message`, `/__start-bridge`, `/__stop-bridge`, `/__open-live`, `/__open-scene`; all require `Host` = 127.0.0.1:ACTIVE_PORT **and** `Sec-Fetch-Site: same-origin` (`:124-263`) |
| Guard scripts | `run-server-forever.bat` (restarts if 8080 not listening), `run-bridge-forever.bat` (restarts bridge if health fails) |
| Vertical 1080×1920 path | `outputSizes` incl. `portrait-1080p:[1080,1920]` (`index.html:313`); scene window size map (`launch.py:467-469`); OBS instruction "window capture the 1080×1920 window" (`guide.html:111-112`); `live.html` is a legacy static 1080×1920 frame (`live.html:1`) |

---

## 8. Persistence map

| Key / file | Written at | Contents |
|---|---|---|
| `localStorage.printRules` | `index.html:477` | 8 toggles + `demoGapMs` (v2 migration deletes `gift`, `:474`) |
| `localStorage.printer-{quality-key,quality,aa-mode,smooth,target-fps,overlay,sound,orient}` | `:200,206,358,382,202,443,313…` | render prefs |
| `localStorage.printer-room` | `setRoom:229` | 3D room theme |
| `localStorage.printer-views / -view-active / -view-last` | `:236-247` | camera presets (≤10) |
| `localStorage.printer-live-room` | `:479` | last room id |
| `.bridge-room` | bridge `:921`, launch `:213,383` | current room id, watched every 2 s (`:938-942`) |
| `avatar-cache.json` | bridge `:195-206`, saved 30 s (`:935`) | 3000 nickname→avatar URLs |
| `desktop-bridge.log` | launch `:212,407` | bridge stdout/stderr |

---

## 9. Test harness — invariants and how to extend it

`node --test` (Node 24, no package.json needed) discovers **13 JS files, 54 tests, all green**;
`python test_scene_relay.py` adds 3.

| File | Invariant locked in |
|---|---|
| `bridge.test.mjs` (180 L, 20 tests) | chat/gift/join/follow parsing, gift bucketing, junk-name filter, like-count parsing, dedupe window, protobuf decode (nickname vs. badge mix-up regression), RoomUserSeq batch avatars, envelope-not-killed-by-Common regression, like round-robin fairness, hover click coordinates + retry, full click event sequence |
| `demo-rules.test.mjs` | counts/sizes per rule, dedupe by id, unknown rule throws, gift FIFO + priority placement |
| `demo-scenario.test.mjs` | the shipped 7-item demo round ordering |
| `print-settings.test.mjs` | per-event count/size applied to *new* jobs, gift priority off keeps old jobs, out-of-range count falls back to defaults |
| `gift-preemption.test.mjs` | runs the *inline* `preemptForGift` source from **both** `index.html` and `index-en.html` in `vm` — re-queue vs. keep-finished-product behaviour |
| `auto-demo.test.mjs` | 30 s gap, `demoGapMs:0` disables, `force`, blocked by pause/busy/non-empty queue |
| `idle-fill.test.mjs` | 30 s boundary (29 999 ms vs 30 000 ms), timer reset, queue<2, pause, empty pool |
| `arm.test.mjs` | runs `solveArm` source from `index.html` in Node with real three.js; 8 IK targets hit exactly |
| `hose.test.mjs` | 15 hose/socket endpoint checks while gantry+head move |
| `recorded-audio.test.mjs` | writing loop only while printing, pause silences, no `start`/`transfer` cue tones |
| `speech.test.mjs` / `welcome.test.mjs` / `demo-speech.test.mjs` | 100 sampled templates keep name/count, no adjacent repeats, gesture gate, no backlog |
| `test-bridge-ports.mjs` | occupied-port fallback, `/health` identity, WS delivery |
| `test_scene_relay.py` | peer-only delivery, no stale replay, 256 bound, type whitelist |

**Two reusable testing patterns for new features** (this is the cheapest part of the codebase to extend):
1. **Pure module + `node:test`** — anything you can put in a small `.mjs` (`demo-rules`, `print-settings`,
   `render-budget`, `gift-speech`) is instantly testable (see `print-settings.test.mjs:5-20`).
2. **Source-slice + `new Function`/`vm.runInNewContext`** — inline functions inside `index.html` are
   extracted by string search and executed in Node with stubs (`auto-demo.test.mjs:2`,
   `idle-fill.test.mjs:6-10`, `gift-preemption.test.mjs:6-11`, `arm.test.mjs:2`). Keep new game-logic
   functions **contiguous and brace-balanced** and they inherit this harness for free.
3. `check-popup.mjs` (130 L) is an out-of-band CDP integration test with 10 assertions
   (scene-mode visuals, gear auto-hide, leader election, `printerDiagnostics()`); `test_native_output.py`
   drives real WebView2 windows and asserts mirrored video frames advance.

---

## 10. Cheapest extension points (ranked by cost/benefit)

Effort: **S** ≈ ≤1 file, ≤60 lines, half a day incl. test · **M** ≈ 1–3 files, 1–2 days ·
**L** ≈ cross-cutting (bridge + scene + audio + tests), 3+ days, real risk.
**Dual-maintenance tax:** `index.html` (127 264 B, 579 dense lines) and `index-en.html`
(125 852 B, 567 lines) are two full copies of scene+scheduler+UI; a page change is ×2 unless the
concept is English-only. `gift-preemption.test.mjs:5` is the only automated guard that both copies
still agree.

| # | Extension | Hook point | Why cheap | Effort |
|---|---|---|---|---|
| 1 | **Retarget the printed object** (badge → cup, keychain, trophy, card) | `createProduct()` body `index.html:250-285`, label `:284` | pure geometry/material swap; conveyor + IK + label contract unchanged | **S** |
| 2 | **Tune pacing/throughput** (12 s print, 72 layers, 4× speed) | `index.html:400` (one line) | affects only timing; re-balance `printer-audio.mjs:13` arm segments + `runTransfer:172` if you change the 6-s transfer | **S** |
| 3 | **New HUD/game panel in the side column** | clone the `livePanel`/`historyPanel` innerHTML pattern `index.html:471-474`, CSS in `assets/live-rules.css` | panels are plain DOM, no framework | **S** |
| 4 | **New on-set display content** (the 3D screen already draws "剩余打印 / 今日业绩") | `updateScreen()` `index.html:176` | one canvas redraw fn, called from `next()`/`renderQueue()` | **S** |
| 5 | **New room/theme set** | add PNGs under `assets/generated/`, extend `generatedRooms`/`setRoom` `index.html:217-229`, option list `:556` | data-driven; `assets/generated/PROMPTS.md` documents the art pipeline | **S** |
| 6 | **New camera behaviour / auto-director** (cut to close-up on gift, orbit on completion) | `applyView()` + `loadViews()` `index.html:233-247`; phase machine `:414`; portrait preset `:192` | camera is already decoupled from events; just call `applyView`/tween from the gift branch | **S–M** |
| 7 | **Extra bridge event / extra field on `ping`** (score, rank, streak) | emit at `douyin-bridge.mjs:787-794`/`:900`; consume in `add()` `index.html:421` | schema is open JSON; page already ignores unknown types; `ping.stats` is the natural side-channel | **S** |
| 8 | **New gift → reward mapping** (5th bucket, or per-gift multipliers) | `mapGift` `douyin-bridge.mjs:47-52`; `RULES` `demo-rules.mjs:1`; defaults `print-settings.mjs:1`; panel rows `:16-17` | three small tables + icon PNG (`assets/generated/original-icons/`) | **M** |
| 9 | **Replace/augment speech** (recorded clips, remote TTS, per-event lines) | `gift-speech.mjs` whole file (12 lines), `enqueue/pump:8-10`; unlock gesture `index.html:459`; caption sink `:463` | the class API (`say/printing/welcome/stop`) is already the seam; `speech.test.mjs` pattern gives free tests | **M** |
| 10 | **Deterministic / event-derived scoring** instead of `60+rand(36)` | `index.html:302`; consume in materials `:250-256` and label `:284` | one pure function + 1 test; unlocks real competition/leaderboards | **M** |
| 11 | **Per-viewer persistent profile** (visits, streak, level, collection) | reuse the `avatarCache` pattern `douyin-bridge.mjs:179-215` + `feedAvatar:223-237`; or a new `localStorage` ring in the page | a JSON sidecar keyed by `normKey(name)`; no DB needed | **M** |
| 12 | **Queue-policy replacement** (multi-printer lanes, EDF, batching, team scoring) | `demo-rules.mjs:4` + `preemptForGift` `index.html:289-301` + `next()` `:302` | the queue is a plain array and the tests already exercise insertion order — swap the policy module and keep the tests | **M** |
| 13 | **New window/overlay as a game surface** (scoreboard window, chat overlay, vertical HUD) | `live.html` (1080×1920 static frame, 1 line) + `/__open-scene` `launch.py:235-258` + `outputSizes` `index.html:313` | the shell already opens `--app=` windows at arbitrary sizes with no address bar | **M** |
| 14 | **Two-way control channel to the scene** (remote buttons, voting UI, operator pad) | data channel `'controls'` already created at `index.html:44` and consumed in `live-view.html:19-31`; relay whitelist `scene_relay.py:15-19` | channel exists and carries arbitrary JSON; add a type + handler both sides (whitelist is the only gate) | **M** |
| 15 | **New local control endpoint** (e.g. `/__game-start?mode=x`) | copy the guarded `/__start-bridge` handler `launch.py:195-225`; call from page | `_guard()` (same-origin) already exists; no new security model | **S–M** |
| 16 | **Real second live platform** (Kuaishou/TikTok live besides Douyin) | parse layer is already exported pure fns `douyin-bridge.mjs:24-71, 273-321`; adapter boundary = `run()`'s `emit()` `:787-794` | emit the same 5 event types from a new adapter and the whole page works; you must redo the DOM/protocol scraping | **L** |
| 17 | **Second robot arm / new choreography** | `solveArm` `:168`, `runTransfer` `:171-175`, `beginTransfer` `:170`, arm build `:154-167` | IK + arm audio sync + `arm.test.mjs` all need updating; highest visual payoff after #1 | **L** |
| 18 | **3D product physics/stacking on the belt** | belt loop `:414`, `products[]`, `disposeProduct:286` | today items pass through each other; adding collisions touches the animation loop and disposal rules | **L** |

**Recommended "cheapest viable game"** = #1 + #3 + #7 + #10 (+#9) — all S/M, no bridge-protocol
breakage, no new process, testable with the existing harness. This keeps every new decision inside
`index.html` + one small `.mjs` module.

---

## 11. Hard constraints a new concept must respect

**C1 — End-to-end latency is seconds, not milliseconds.**
Scrape tick 300 ms (`douyin-bridge.mjs:889`) → comment avatar gate waits up to 12×200 ms = 2.4 s for
the protocol frame before falling back to a profile-card click (`:845-857`) → hover path is serialised
with 4 s per-name cooldown and up to 3 click rounds × ~4 s (`:576-734`) → WS → page queue. Add the
in-print wait (0–4.6 s at 4×). **Realistic "viewer comments → their medallion starts printing" is
1–3 s in the good case and 5–15 s when the avatar is missing or the queue is busy.** Any timed
game mechanic (countdown, round, "first to react") must budget ≥5 s of jitter, and the gift
pre-emption is your only hard interrupt.

**C2 — Throughput is one item at a time (≈4.6 s default, ≈18.6 s at 1×).**
`printDuration 12 + reveal .55 + transfer 6` sim-seconds, `dt × simulationSpeed` (`index.html:400,
414, 175`). Job explosion: one lollipop = 3 jobs, `count×` up to 100 ⇒ 300 jobs (`demo-rules.mjs:4`).
Like storms are token-bucketed at ≈2.5/s cap 20 (`douyin-bridge.mjs:241-243, 814-818`) but **gifts are
not rate-limited at all**. A "gift war" concept will build a 10-minute backlog within seconds; you
must either batch (`n` viewers → 1 special item), cap the queue, or despawn old jobs.

**C3 — Avatar availability is best-effort, and the 3D portrait has no fallback.**
Three layers (protocol / page scrape / profile-card click) + a 3000-entry persistent cache
(`douyin-bridge.mjs:179-222`). Likes are only attributed to roster members; with an empty roster the
delta is silently dropped (`:824`). The portrait texture is loaded from `douyinpic` with
`crossOrigin='anonymous'` (`index.html:285`, `assets/three.module.js:44695`) — if CORS/TLS fails the
disc stays white and the `onError` handler is empty (`:285`). The 2D card `<img>` path does have a
generated initial-letter fallback (`fallbackAvatar:416`). **Do not design a game whose rules depend on
"everyone has a face"** — design for `avatar === ''` and use `fallbackAvatar`-style art in 3D too.

**C4 — Speech is unsynchronised, lossy and needs a user gesture.**
Browser `speechSynthesis`: queue cap 12 (overflow ⇒ caption only, `gift-speech.mjs:8`), printing
start/finish lines are dropped whenever something is already speaking (`:6`), unlock requires a real
pointer/key event (`:6, index.html:459`), voice set depends on the machine's Windows voices (`:3-4`),
and nothing waits for `onend`. Machine SFX are tied to phases instead (`printer-audio.mjs:12-13`).
So: never gate game state on speech completion; if a new game needs spoken rules/countdowns, drive the
timing from the animation clock and treat TTS as decoration. Also two audio subsystems need two
independent mutes (`index.html:443` vs `:467`).

**C5 — Windows/WebView2 realities.**
(a) Real output is a *separate* window/process because OBS captures by window
(`launch.py:333-350`, `guide.html:111-112`); (b) that window uses a **separate profile**
(`.scene-webview-profile`, `launch.py:477-478`) so `localStorage` and `BroadcastChannel` do **not**
cross it (only the in-browser `window.open` popup path shares the profile, `index.html:393`) —
cross-window state between the WebView2 windows must go through the HTTP relay (`SceneRelay`,
256-event buffer) or WebRTC; (c) without the anti-occlusion flags (`launch.py:441-452`) the mirrored render drops to a few
FPS when covered; (d) every port is dynamic/looked-up, never hardcoded — HTTP `8080→…` (`launch.py:72`),
WS `8765→8774` (`bridge-ws.mjs:73-75`), CDP `9224` live / `9223` self-launched (`launch.py:380-386`);
(e) the internal render scale is capped by a 4K pixel budget and will auto-degrade to 0.7× on weak
GPUs (`scene-output.mjs:39-40`, `render-budget.mjs:5-7`) — a shader-heavy concept must ship a `lite`
tier; (f) `.mjs` MIME is pinned by the Python server (`launch.py:86-115`) — ship plain `.js/.mjs`, no
bundler, no `node_modules`.

**C6 — Exactly one window may print.**
`printAllowed()` (`index.html:32`) wraps every event path (`:421`). Any new mechanic that enqueues
work must go through `liveEvent()`/`printAllowed()` or two windows will double-print (the
`gift-preemption.test.mjs`/`check-popup.mjs` leader-election tests exist for this).

**C7 — All state is in-memory.**
Reload/restart loses queue, `printRecords` (`index.html:518`), counters. A game with scores/levels must
add its own persistence (see extension #11) and must survive a room switch, which wipes roster/avatars/
like state (`resetRoomState`, `douyin-bridge.mjs:521-528`).

**C8 — Settings are two namespaces with non-obvious defaults (verify before designing around it).**
`printRules` (`index.html:474`) holds only toggles + `demoGapMs`; per-type `*Count`/`*Size`/
`giftPriority` live in `PRINT_DEFAULTS` (`print-settings.mjs:1`). `printOptions` reads **only** the
passed object (`print-settings.mjs:2-7`), so an absent `giftSize` evaluates to `'small'` and
**overrides** `RULES.gift.size='large'` via `{...RULES[type],...options}` (`demo-rules.mjs:4`) until a
user touches that select. Code path is unambiguous; if the concept cares about medal size, seed
`printRules` from `PRINT_DEFAULTS` first. Likewise an out-of-range `amount` throws inside
`demoEngine.event` and `liveEvent` swallows it (`index.html:417`), so bad events vanish silently.

---

## 12. Misc traps / dead code worth knowing

- `type:'room'` branch at `index.html:421` is never produced by this bridge (compat only).
- `/__open-scene` (`launch.py:235-258`) and `index.previous.html` (16 KB) are legacy; the live UI uses
  `open_scene_window()` → `live-view.html` (`index.html:387-396`).
- `index.html:417` `liveEvent` calls `demoEngine.event(..., 'live-'+(++eventId), ...)` so the dedupe
  path in `demo-rules.mjs:4` never triggers for live events (only demo buttons reuse ids).
- The 3D scene has **two** sets of decorative rooms: real geometry groups (`study/workshop/garden`,
  `:210-212`) and AI-generated backdrops (`generatedRooms`, `:217-229`); `setRoom` switches both.
- `simulationSpeed` is not persisted and is only reset by the demo buttons (`:529,532`); after a reload
  it is 4× (`:400`) even though the demo-speed select renders "1×" first (`:469`).
- Print log and queue UI show at most 5/100 rows (`:417, :519`); `printRecords` capped at 400 (`:520`).
- `avatar-cache.json` is committed and contains real viewer nicknames/URLs — treat as PII when
  proposing anything that ships the repo.
- No `package.json`; tests are run as `node --test` from the repo root, so any new module must be
  plain ESM with no bare imports (except `three` which is imported by relative path everywhere).

---

## 13. Effort-estimation cheat sheet

| Quantity | Value | Source |
|---|---|---|
| Page code that must be duplicated for EN | 127 KB / 579 lines ↔ 126 KB / 567 lines | `index.html`, `index-en.html` |
| Bridge size / complexity | 970 lines, ~6 independent concerns (parse, protocol, avatar, hover, CDP, run loop) | `douyin-bridge.mjs` |
| Small pure modules (cheap to change) | 5–122 lines each | `demo-rules`, `print-settings`, `render-budget`, `scene-channel`, `gift-speech`, `scene-output` |
| Test suite runtime | 5.7 s (54 tests) | measured |
| Print cycle | 18.55 simulated seconds = 4.64 s real at 4× | `index.html:400,414,175` |
| Throughput ceiling | ≈13 items/min (4×), ≈3.2/min (1×) | derived |
| Max jobs from one event | 300 (`count` 100 × lollipop 3) | `demo-rules.mjs:1,4` |
| Like bucket | 20 tokens, +1 per 400 ms | `douyin-bridge.mjs:241` |
| Scrape cadence | 300 ms | `douyin-bridge.mjs:889` |
| Avatar cache | 3000 entries, 30 s flush | `douyin-bridge.mjs:180,935` |
| Speech templates | 16 gift / 6 printing / 6 done / 16 welcome | `gift-speech.mjs:5-7` |
| Render pixel budget | 8 294 400 px (4K) internal cap | `scene-output.mjs:39-40` |
| WebRTC mirror | 40 Mbps, H.264 preferred, manual frame push | `index.html:43,47-48,414` |
| Relay buffer | 256 events, 15 s long-poll | `scene_relay.py:10,25-33` |
