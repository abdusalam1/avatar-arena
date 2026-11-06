// 开发用：无头 Chrome + CDP 连拍，生成 README 用的动图素材。
// 用法：node docs/tools/capture-frames.mjs <url> <outDir> [frames] [intervalMs] [width] [height] [settleMs]
// 纯 Node（Node 22+ 自带 WebSocket），不装任何依赖。
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , url, outDir, framesArg, intervalArg, widthArg, heightArg, settleArg] = process.argv;
if (!url || !outDir) {
  console.error('usage: node capture-frames.mjs <url> <outDir> [frames=30] [intervalMs=140] [w=1440] [h=900] [settleMs=9000]');
  process.exit(2);
}
const FRAMES = Number(framesArg || 30);
const INTERVAL = Number(intervalArg || 140);
const WIDTH = Number(widthArg || 1440);
const HEIGHT = Number(heightArg || 900);
const SETTLE = Number(settleArg || 9000);
const port = 9333 + Math.floor(Math.random() * 200);

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('找不到 Chrome/Edge');

mkdirSync(outDir, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'frames-'));
const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1',
  '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
  `--window-size=${WIDTH},${HEIGHT}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget() {
  for (let i = 0; i < 120; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* 还没起来 */ }
    await sleep(120);
  }
  throw new Error('CDP 未就绪');
}

const page = await pageTarget();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

await new Promise((r) => ws.addEventListener('open', r, { once: true }));
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(SETTLE);

const written = [];
for (let i = 0; i < FRAMES; i++) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = join(outDir, `frame-${String(i).padStart(3, '0')}.png`);
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  written.push(file);
  await sleep(INTERVAL);
}

try { await send('Browser.close'); } catch { /* 已关闭 */ }
ws.close();
child.kill();
console.log(`frames: ${written.length} -> ${outDir}`);
