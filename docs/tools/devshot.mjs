// 开发用：无头 Chrome + CDP，抓控制台报错并截图。
// 用法：node ideas/tools/devshot.mjs <url> <out.png> [waitMs] [width] [height] [canvas]
// 纯 Node（Node 22+ 自带 WebSocket），不装任何依赖。
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , url, out, waitMsArg, widthArg, heightArg] = process.argv;
const waitMs = Number(waitMsArg || 6000);
const width = Number(widthArg || 1680);
const height = Number(heightArg || 1000);
const port = 9333 + Math.floor(Math.random() * 200);

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find((p) => existsSync(p));
if (!CHROME) throw new Error('找不到 Chrome/Edge');

const profile = mkdtempSync(join(tmpdir(), 'shot-'));
const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1',
  '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
  `--window-size=${width},${height}`, 'about:blank'
], { stdio: 'ignore', detached: false });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* 还没起来 */ }
    await sleep(120);
  }
  throw new Error('CDP 未就绪');
}

const page = await targets();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
const problems = [];
const logs = [];

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    problems.push('EXCEPTION: ' + (d.exception?.description || d.text) + ' @' + (d.url || '') + ':' + (d.lineNumber ?? ''));
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ');
    logs.push(msg.params.type.toUpperCase() + ': ' + text);
    if (msg.params.type === 'error') problems.push('CONSOLE ERROR: ' + text);
  }
  if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry;
    logs.push('LOG[' + e.level + ']: ' + e.text);
    if (e.level === 'error') problems.push('LOG ERROR: ' + e.text + ' ' + (e.url || ''));
  }
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await new Promise((r) => ws.addEventListener('open', r, { once: true }));
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(waitMs);

// 可选：加载后执行一段脚本（例如把一局时间拨快，验证结算画面）
const evalExpr = process.env.DSH_SHOT_EVAL || process.argv[9];
if (evalExpr) {
  const r = await send('Runtime.evaluate', { expression: evalExpr, returnByValue: true, awaitPromise: true });
  console.log('EVAL', JSON.stringify(r.result?.value ?? r.exceptionDetails?.text ?? null));
  await sleep(1200);
}

// 页面内自检：模块是否加载、渲染循环是否在跑
const probe = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    url: location.href,
    canvas: (()=>{const c=document.querySelector('canvas');return c?{w:c.width,h:c.height,css:c.style.width}:null})(),
    residents: globalThis.__town ? globalThis.__town.snapshot().residents.length : null,
    events: document.getElementById('events')?.children.length ?? null,
    log: document.getElementById('log')?.children.length ?? null,
    rank: document.getElementById('rank')?.children.length ?? null,
    fakeTime: typeof globalThis.__town
  })`,
  returnByValue: true
});

const clipArg = process.argv[8];
let clip;
if (clipArg === 'canvas') {
  const rect = await send('Runtime.evaluate', { expression: JSON.stringify((()=>{const c=document.querySelector('canvas');const r=c.getBoundingClientRect();return {x:r.x+window.scrollX,y:r.y+window.scrollY,width:r.width,height:r.height}})()), returnByValue: true });
  const box = JSON.parse(rect.result.value);
  clip = { ...box, scale: 1 };
}
const shot = await send('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));

console.log('PROBE', probe.result?.value);
console.log('PROBLEMS', problems.length ? '\n- ' + problems.slice(0, 12).join('\n- ') : 'none');
console.log('LOGS', logs.length ? '\n- ' + logs.slice(0, 12).join('\n- ') : 'none');
console.log('WROTE', out);

try { await send('Browser.close'); } catch { /* 已关闭 */ }
ws.close();
child.kill();
process.exit(0);
