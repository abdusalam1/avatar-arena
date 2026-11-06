// 头像小镇 · 渲染层（Canvas 2D，单文件零依赖）
// 画面本身自带所需信息（天数/时间/天气/头条/充能条），因此可以单独弹出成
// OBS 采集窗口，不需要右侧控制面板一起出镜。

import { PLACES, STATES } from './engine.mjs';

const W = 100, H = 80;            // 世界尺寸
const FONT = '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';

// 装饰性小树（固定坐标，避免和建筑/道路打架）
const TREES = [
  [13, 17], [43, 15], [57, 33], [21, 41], [35, 52], [68, 27], [83, 46],
  [45, 63], [61, 57], [25, 31], [74, 23], [17, 71], [84, 76], [33, 38],
  [55, 68], [77, 60], [11, 44], [65, 43]
];

// 世界坐标 → 画布坐标。
// 横屏：轻微竖向压缩（看起来像一块斜放的沙盘），铺满画布。
// 竖屏：等比缩放，沙盘贴着信息区上方摆放，上方留出天空 + 头条位。
export function project(x, y, width, height, layout) {
  const padX = layout?.padX ?? 0.06;
  const padTop = layout?.padTop ?? 0.10;
  const padBottom = layout?.padBottom ?? 0.07;
  if (layout?.portrait) {
    const band = height * (1 - padTop - padBottom);
    const k = Math.min((width * (1 - padX * 2)) / W, band / H);
    const boardW = W * k, boardH = H * k;
    const ox = (width - boardW) / 2;
    const oy = Math.max(padTop * height, height * (1 - padBottom) - boardH);
    return { sx: ox + x * k, sy: oy + y * k, k };
  }
  return {
    sx: (padX + (x / W) * (1 - padX * 2)) * width,
    sy: (padTop + (y / H) * (1 - padTop - padBottom)) * height
  };
}

// 沙盘四条边（供内部分割区使用）
function boardBox(width, height, layout) {
  const a = project(0, 0, width, height, layout);
  const b = project(W, H, width, height, layout);
  return { x: a.sx, y: a.sy, w: b.sx - a.sx, h: b.sy - a.sy };
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 一天中的光照色调
function lightOf(hour) {
  if (hour < 5) return { tint: 'rgba(10,16,48,.58)', sky: ['#070b1c', '#131a35'] };
  if (hour < 7) return { tint: 'rgba(255,157,110,.20)', sky: ['#22243c', '#f0a071'] };
  if (hour < 17) return { tint: 'rgba(0,0,0,0)', sky: ['#8fc7e8', '#dff0f7'] };
  if (hour < 19) return { tint: 'rgba(255,122,69,.20)', sky: ['#f6b26b', '#ffd9a8'] };
  if (hour < 22) return { tint: 'rgba(59,47,102,.34)', sky: ['#2b2350', '#5b3f7a'] };
  return { tint: 'rgba(10,16,48,.55)', sky: ['#070b1c', '#131a35'] };
}

export class TownView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = new Map();
    this.particles = [];
    this.focusName = '';
    this.focusUntil = 0;
    this.time = 0;
    this.lastSnap = null;
    this.labels = true;
    this.dpr = 1;
    this.width = 1;
    this.height = 1;
    // 布局参数：竖屏时上下留出直播信息区，小镇等比缩放居中
    this.layout = { padX: 0.06, padTop: 0.10, padBottom: 0.07, portrait: false };
  }

  // 观众真实头像：拿到就换成图，拿不到用首字色块兜底（与原项目 fallbackAvatar 同思路）
  avatar(name, url) {
    if (!url) return null;
    const cached = this.images.get(name);
    if (cached?.url === url) return cached.img;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const record = { url, img, ready: false };
    img.onload = () => { record.ready = true; };
    img.onerror = () => { record.failed = true; };
    img.src = url;
    this.images.set(name, record);
    return img;
  }

  focus(name, seconds = 6) {
    this.focusName = name;
    this.focusUntil = this.time + seconds;
  }

  resize(width, height, dpr = 1, commitStyle = true) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.dpr = dpr;
    const canvas = this.canvas;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // 竖屏时显示尺寸交给 CSS（aspect-ratio），只改后备缓冲，避免布局反馈循环
      if (commitStyle) {
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
      } else {
        // 清掉横屏时写死的内联尺寸，否则会把 CSS 的 9:16 压掉
        canvas.style.width = '';
        canvas.style.height = '';
      }
    }
    this.width = w;
    this.height = h;
    this.layout.portrait = w / h < 0.95;
    this.layout.padTop = this.layout.portrait ? 0.13 : 0.10;
    this.layout.padBottom = this.layout.portrait ? 0.20 : 0.07;
  }

  // 引擎特效 → 画面粒子
  spawnEffects(list) {
    for (const fx of list) {
      const c = this.#center();
      if (fx.kind === 'fireworks') {
        for (let i = 0; i < 90; i++) {
          const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 190;
          this.particles.push({ kind: 'spark', x: c.x, y: c.y * 0.62, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 1.4, t: 0, hue: Math.random() * 360 });
        }
      } else if (fx.kind === 'gift') {
        for (let i = 0; i < 26; i++) {
          this.particles.push({ kind: 'coin', x: c.x + (Math.random() - 0.5) * 160, y: c.y * 0.75, vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 90, life: 1.6, t: 0, hue: fx.tier >= 3 ? 45 : 200 });
        }
      } else if (fx.kind === 'rank') {
        this.particles.push({ kind: 'ring', x: c.x, y: c.y * 0.7, vx: 0, vy: 0, life: 1.1, t: 0, hue: 45 });
      } else if (fx.kind === 'fight') {
        for (let i = 0; i < 14; i++) {
          this.particles.push({ kind: 'spark', x: c.x + (Math.random() - 0.5) * 120, y: c.y * 0.8, vx: (Math.random() - 0.5) * 160, vy: -50 - Math.random() * 80, life: 0.5, t: 0, hue: 12 });
        }
      }
    }
  }

  #center() {
    const p = project(50, 46, this.width, this.height, this.layout);
    return { x: p.sx, y: p.sy };
  }

  frame(dt, snap) {
    if (!snap) return;
    this.time += dt;
    this.lastSnap = snap;
    const ctx = this.ctx, w = this.width, h = this.height;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const light = lightOf(snap.hour);
    this.#drawSky(ctx, w, h, light, snap);
    this.#drawGround(ctx, w, h, light, snap);
    // 画笔按 y 排序：靠后的先画
    const items = [];
    for (const [key, place] of Object.entries(PLACES)) {
      if (key === 'home') continue;
      items.push({ y: place.y, draw: () => this.#drawPlace(ctx, key, place, snap, light) });
    }
    // 每个 residences 里的小房子（观众分身的家）
    for (const [tx, ty] of TREES) {
      items.push({ y: ty, draw: () => this.#drawTree(ctx, tx, ty) });
    }
    const seenHomes = new Set();
    for (const r of snap.residents) {
      if (!r.home) continue;
      const key = Math.round(r.home.x) + ':' + Math.round(r.home.y);
      if (seenHomes.has(key)) continue;
      seenHomes.add(key);
      items.push({ y: r.home.y - 0.4, draw: () => this.#drawHome(ctx, r, snap) });
    }
    for (const r of snap.residents) {
      items.push({ y: r.y, draw: () => this.#drawResident(ctx, r, snap) });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
    this.#drawParticles(ctx, dt);
    if (light.tint !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = light.tint;
      ctx.fillRect(0, 0, w, h);
    }
    this.#drawHud(ctx, w, h, snap);
    // 空场：不伪造观众（平台禁止假出怪），只给一句“怎么加入”
    if (!snap.residents.length) {
      const box = boardBox(w, h, this.layout);
      const cx = box.x + box.w / 2, cy = box.y + box.h * 0.46;
      const s = this.layout.portrait ? clamp(w / 760, 1, 2.4) : clamp(w / 1100, 0.72, 1.5);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.round(20 * s)}px ${FONT}`;
      ctx.fillStyle = 'rgba(20,26,32,.88)';
      ctx.fillText('小镇还在等第一位观众', cx, cy);
      ctx.font = `600 ${Math.round(13 * s)}px ${FONT}`;
      ctx.fillStyle = 'rgba(20,26,32,.62)';
      ctx.fillText('发一句弹幕（免费），你的分身就会走进来住下', cx, cy + 30 * s, box.w * 0.9);
    }
    ctx.restore();
  }

  #drawSky(ctx, w, h, light, snap) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, light.sky[0]);
    sky.addColorStop(1, light.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    if (snap.isNight) {
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 60; i++) {
        const x = ((i * 7919) % 1000) / 1000 * w;
        const y = ((i * 6151) % 1000) / 1000 * h * 0.09;
        const s = i % 7 === 0 ? 1.8 : 1;
        ctx.globalAlpha = 0.35 + ((i * 37) % 100) / 160;
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffeaa7';
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.055, 15, 0, Math.PI * 2);
      ctx.fill();
    } else if (snap.hour >= 7 && snap.hour < 18) {
      ctx.fillStyle = '#fff6d5';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(w * 0.84, h * 0.05, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (snap.weather === 'rain') {
      ctx.fillStyle = 'rgba(120,150,180,.10)';
      ctx.fillRect(0, 0, w, h);
    }
    // 竖屏：沙盘下方压一层暗色“舞台地”，让信息区读得清
    if (this.layout.portrait) {
      const floor = ctx.createLinearGradient(0, h * 0.45, 0, h);
      floor.addColorStop(0, 'rgba(8,12,18,0)');
      floor.addColorStop(0.55, 'rgba(8,12,18,.55)');
      floor.addColorStop(1, 'rgba(8,12,18,.94)');
      ctx.fillStyle = floor;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
    }
  }

  #drawGround(ctx, w, h, light, snap) {
    const p0 = project(0, 0, w, h, this.layout), p1 = project(W, H, w, h, this.layout);
    const gx = p0.sx, gy = p0.sy, gw = p1.sx - p0.sx, gh = p1.sy - p0.sy;
    // 沙盘：一块带投影的圆角板子（竖屏时它就是画面正中的“小镇”）
    const box = boardBox(w, h, this.layout);
    const radius = Math.max(12, Math.min(box.w, box.h) * 0.035);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#5f8f63';
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, radius); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, radius); ctx.clip();
    // 草地底色（先铺地，再画岸线和河水，顺序不能反）
    const grass = ctx.createLinearGradient(gx, gy, gx, gy + gh);
    grass.addColorStop(0, '#7fae7a');
    grass.addColorStop(1, '#5f8f63');
    ctx.fillStyle = grass;
    ctx.fillRect(gx, gy, gw, gh);
    // 河：一条带柔和岸线的水道（不是一堵蓝墙）
    const shore = project(88, 0, w, h, this.layout);
    const river = project(93, 0, w, h, this.layout);
    const riverEnd = project(93, H, w, h, this.layout);
    ctx.fillStyle = snap.isNight ? '#c9b795' : '#d8c9a8';
    ctx.beginPath();
    ctx.moveTo(shore.sx, gy);
    for (let y = 0; y <= H; y += 4) {
      const p = project(88 + Math.sin(y / 9) * 1.2, y, w, h, this.layout);
      ctx.lineTo(p.sx, p.sy);
    }
    ctx.lineTo(riverEnd.sx, riverEnd.sy);
    ctx.lineTo(riverEnd.sx, gy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = light.sky[0] === '#070b1c' ? '#16233f' : '#5aa9c9';
    ctx.beginPath();
    ctx.moveTo(river.sx, gy);
    for (let y = 0; y <= H; y += 4) {
      const p = project(93 + Math.sin(y / 7) * 1.4, y, w, h, this.layout);
      ctx.lineTo(p.sx, p.sy);
    }
    ctx.lineTo(p1.sx, riverEnd.sy);
    ctx.lineTo(p1.sx, gy);
    ctx.closePath();
    ctx.fill();
    // 水波
    ctx.strokeStyle = 'rgba(255,255,255,.30)';
    ctx.lineWidth = 1;
    for (let y = 6; y < H; y += 9) {
      const p = project(94.5, y, w, h, this.layout);
      ctx.beginPath();
      ctx.moveTo(p.sx - 6, p.sy);
      ctx.quadraticCurveTo(p.sx, p.sy - 2, p.sx + 8, p.sy);
      ctx.stroke();
    }
    // 地面网格（轻）
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const p = project(0, (H / 10) * i, w, h, this.layout);
      ctx.beginPath(); ctx.moveTo(gx, p.sy); ctx.lineTo(shore.sx, p.sy); ctx.stroke();
    }
    // 道路：从广场连到各地点
    const square = PLACES.square;
    ctx.strokeStyle = 'rgba(240,232,214,.42)';
    ctx.lineWidth = Math.max(3, w * 0.006);
    ctx.lineCap = 'round';
    for (const key of ['gate', 'factory', 'diner', 'bar', 'shop', 'park', 'school', 'river']) {
      const place = PLACES[key];
      const a = project(square.x, square.y, w, h, this.layout);
      const b = project(place.x, place.y, w, h, this.layout);
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
    }
    // 雨天水洼
    if (snap.weather === 'rain') {
      ctx.fillStyle = 'rgba(200,225,255,.18)';
      for (let i = 0; i < 16; i++) {
        const p = project((i * 13) % 88 + 4, (i * 29) % 74 + 3, w, h, this.layout);
        ctx.beginPath(); ctx.ellipse(p.sx, p.sy, 9, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  #drawPlace(ctx, key, place, snap, light) {
    const p = project(place.x, place.y, this.width, this.height, this.layout);
    const scale = this.width / 1100;
    const bw = 62 * scale, bh = 44 * scale;
    if (key === 'gate') {
      const s = this.width / 1100 * 1.35;
      ctx.fillStyle = 'rgba(0,0,0,.20)';
      ctx.beginPath(); ctx.ellipse(p.sx, p.sy + 2 * s, 66 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
      // 两根门柱 + 门楣
      const pillar = (dx) => {
        ctx.fillStyle = '#8a5b3d';
        ctx.beginPath(); ctx.roundRect(p.sx + dx - 6 * s, p.sy - 46 * s, 12 * s, 46 * s, 2 * s); ctx.fill();
      };
      pillar(-34 * s); pillar(34 * s);
      ctx.fillStyle = '#7a4d33';
      ctx.beginPath(); ctx.roundRect(p.sx - 48 * s, p.sy - 64 * s, 96 * s, 14 * s, 4 * s); ctx.fill();
      ctx.fillStyle = '#c9a227';
      ctx.beginPath(); ctx.roundRect(p.sx - 48 * s, p.sy - 66 * s, 96 * s, 5 * s, 2 * s); ctx.fill();
      // 灯笼
      for (const dx of [-46, 46]) {
        ctx.fillStyle = '#e2503f';
        ctx.beginPath(); ctx.ellipse(p.sx + dx * s, p.sy - 50 * s, 5 * s, 6.5 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,220,150,.55)';
        ctx.beginPath(); ctx.arc(p.sx + dx * s, p.sy - 50 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
      }
      this.#label(ctx, place.label, p.sx, p.sy + 12 * s, this.width / 1100);
      return;
    }
    // 建筑：墙 + 屋顶
    ctx.save();
    ctx.fillStyle = '#3a3f4b';
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy + 2 * scale, bw * 0.62, 8 * scale, 0, 0, Math.PI * 2); ctx.fill();
    const wall = ctx.createLinearGradient(p.sx, p.sy - bh, p.sx, p.sy);
    wall.addColorStop(0, '#f3e9d2'); wall.addColorStop(1, '#d8c9ad');
    ctx.fillStyle = wall;
    ctx.beginPath(); ctx.roundRect(p.sx - bw / 2, p.sy - bh, bw, bh, 4 * scale); ctx.fill();
    ctx.fillStyle = '#b4573f';
    ctx.beginPath();
    ctx.moveTo(p.sx - bw / 2 - 5 * scale, p.sy - bh);
    ctx.lineTo(p.sx, p.sy - bh - 20 * scale);
    ctx.lineTo(p.sx + bw / 2 + 5 * scale, p.sy - bh);
    ctx.closePath(); ctx.fill();
    // 窗户（夜里亮灯）
    const lit = snap.isNight;
    ctx.fillStyle = lit ? '#ffd982' : '#9ec6d8';
    ctx.fillRect(p.sx - bw * 0.28, p.sy - bh * 0.72, 12 * scale, 12 * scale);
    ctx.fillRect(p.sx + bw * 0.06, p.sy - bh * 0.72, 12 * scale, 12 * scale);
    this.#emoji(ctx, place.emoji, p.sx, p.sy - bh * 0.28, 20 * scale);
    ctx.restore();
    this.#label(ctx, place.label, p.sx, p.sy + 13 * scale, scale);
  }

  // 观众分身的家：每个居民一间小屋，夜里亮窗
  #drawHome(ctx, r, snap) {
    const p = project(r.home.x, r.home.y, this.width, this.height, this.layout);
    const s = this.width / 1100;
    const w = 30 * s, hgt = 20 * s;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy + 2 * s, w * 0.62, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    const wall = ctx.createLinearGradient(p.sx, p.sy - hgt, p.sx, p.sy);
    wall.addColorStop(0, '#e8dcc4'); wall.addColorStop(1, '#c9b795');
    ctx.fillStyle = wall;
    ctx.beginPath(); ctx.roundRect(p.sx - w / 2, p.sy - hgt, w, hgt, 2 * s); ctx.fill();
    ctx.fillStyle = '#8d5b3f';
    ctx.beginPath();
    ctx.moveTo(p.sx - w / 2 - 3 * s, p.sy - hgt);
    ctx.lineTo(p.sx, p.sy - hgt - 11 * s);
    ctx.lineTo(p.sx + w / 2 + 3 * s, p.sy - hgt);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = snap.isNight ? '#ffd982' : '#9ec6d8';
    ctx.fillRect(p.sx - 3 * s, p.sy - hgt * 0.72, 6 * s, 6 * s);
  }

  #drawTree(ctx, tx, ty) {
    const p = project(tx, ty, this.width, this.height, this.layout);
    const s = this.width / 1100;
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy + 1.5 * s, 9 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5a3c';
    ctx.fillRect(p.sx - 1.6 * s, p.sy - 12 * s, 3.2 * s, 12 * s);
    const canopy = ctx.createRadialGradient(p.sx - 2 * s, p.sy - 20 * s, 1, p.sx, p.sy - 15 * s, 12 * s);
    canopy.addColorStop(0, '#7fc07a');
    canopy.addColorStop(1, '#3f7a4d');
    ctx.fillStyle = canopy;
    ctx.beginPath(); ctx.arc(p.sx, p.sy - 16 * s, 10 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.sx - 6 * s, p.sy - 12 * s, 6.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.sx + 6.5 * s, p.sy - 12.5 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
  }

  #drawResident(ctx, r, snap) {
    const p = project(r.x, r.y, this.width, this.height, this.layout);
    const scale = this.width / 1100;
    const radius = (r.auto ? 12 : 15) * scale;
    const bob = r.walking ? Math.sin(this.time * 9 + r.x) * 2 * scale : Math.sin(this.time * 2 + r.y) * 0.8 * scale;
    const y = p.sy + bob;
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy + 2, radius * 0.9, radius * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    // 头像
    const record = this.images.get(r.name);
    const img = record?.ready ? record.img : null;
    ctx.save();
    if (this.focusName === r.name && this.time < this.focusUntil) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath(); ctx.arc(p.sx, y - radius * 1.15, radius * 1.35, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.sx, y - radius * 1.15, radius, 0, Math.PI * 2);
    ctx.fillStyle = r.color;
    ctx.fill();
    if (img) {
      ctx.save();
      ctx.beginPath(); ctx.arc(p.sx, y - radius * 1.15, radius, 0, Math.PI * 2); ctx.clip();
      try { ctx.drawImage(img, p.sx - radius, y - radius * 1.15 - radius, radius * 2, radius * 2); } catch { /* 跨域图失败就保留色块 */ }
      ctx.restore();
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${Math.round(radius * 1.05)}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(r.name).slice(0, 1), p.sx, y - radius * 1.15);
    }
    ctx.lineWidth = Math.max(1.4, 2 * scale);
    ctx.strokeStyle = r.auto ? 'rgba(255,255,255,.35)' : '#ffffff';
    ctx.beginPath(); ctx.arc(p.sx, y - radius * 1.15, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // 头顶动作气泡
    const emoji = r.emoji || (r.walking ? STATES.walk.emoji : STATES[r.state]?.emoji);
    if (emoji) {
      ctx.font = `${Math.round(15 * scale)}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, p.sx + radius * 1.05, y - radius * 2.1);
    }
    // 名字牌（按名字做三档纵向错开，密集时不易叠在一起）
    if (this.labels) {
      const name = r.name + (r.auto ? ' ·自动' : '');
      ctx.font = `600 ${Math.round(11.5 * scale)}px ${FONT}`;
      const tw = ctx.measureText(name).width;
      let hb = 0;
      for (const ch of r.name) hb = (hb * 31 + ch.codePointAt(0)) % 7;
      const ty = y + (7 + (hb % 3) * 12) * scale;
      ctx.fillStyle = r.title ? 'rgba(255,209,102,.92)' : 'rgba(15,17,21,.66)';
      ctx.beginPath();
      ctx.roundRect(p.sx - tw / 2 - 5 * scale, ty, tw + 10 * scale, 16 * scale, 4 * scale);
      ctx.fill();
      ctx.fillStyle = r.title ? '#1a1c22' : '#f6f1e7';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name, p.sx, ty + 8 * scale);
    }
  }

  #drawParticles(ctx, dt) {
    const alive = [];
    for (const p of this.particles) {
      p.t += dt;
      if (p.t >= p.life) continue;
      const k = p.t / p.life;
      if (p.kind === 'ring') {
        ctx.strokeStyle = `hsla(${p.hue},90%,65%,${1 - k})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 20 + k * 160, 0, Math.PI * 2); ctx.stroke();
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt;
        ctx.globalAlpha = 1 - k;
        if (p.kind === 'coin') {
          ctx.fillStyle = `hsl(${p.hue},90%,60%)`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = `hsl(${p.hue},90%,${62 + k * 20}%)`;
          ctx.fillRect(p.x, p.y, 3, 3);
        }
        ctx.globalAlpha = 1;
      }
      alive.push(p);
    }
    this.particles = alive;
  }

  #drawHud(ctx, w, h, snap) {
    // 竖屏画面窄，UI 要按宽度放大，否则在 1080×1920 里看不清
    const scale = this.layout.portrait ? clamp(w / 760, 1, 2.4) : clamp(w / 1100, 0.72, 1.5);
    ctx.save();
    ctx.textBaseline = 'middle';
    // 竖屏：天空区放小镇招牌 + 一句“教你看懂”的副标题
    if (this.layout.portrait) {
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.round(30 * scale)}px ${FONT}`;
      ctx.fillStyle = 'rgba(22,38,50,.90)';
      ctx.fillText('头像小镇', w / 2, h * 0.045);
      ctx.font = `600 ${Math.round(12.5 * scale)}px ${FONT}`;
      ctx.fillStyle = 'rgba(28,48,60,.62)';
      ctx.fillText('你的分身住在这里 · 发弹幕下指令 · 点赞点亮全城', w / 2, h * 0.045 + 28 * scale, w - 60 * scale);
    }
    // 左上：天数 / 时钟 / 天气
    const hh = String(Math.floor(snap.hour)).padStart(2, '0');
    const mm = String(Math.floor((snap.hour % 1) * 60)).padStart(2, '0');
    const weatherIcon = snap.weather === 'rain' ? '🌧️' : snap.isNight ? '🌙' : '☀️';
    ctx.font = `700 ${Math.round(15 * scale)}px ${FONT}`;
    const head = `第 ${snap.day} 天  ${hh}:${mm}  ${weatherIcon}`;
    const pad = 10 * scale;
    const tw = ctx.measureText(head).width;
    ctx.fillStyle = 'rgba(15,17,21,.62)';
    ctx.beginPath(); ctx.roundRect(12 * scale, 12 * scale, tw + pad * 2, 30 * scale, 8 * scale); ctx.fill();
    ctx.fillStyle = '#f6f1e7';
    ctx.textAlign = 'left';
    ctx.fillText(head, 12 * scale + pad, 12 * scale + 15 * scale);

    // 合规标识：虚拟场景 / AI 生成画面（必须出现在画面里，不能只写在控制面板）
    const mark = '虚拟场景 · AI 生成画面';
    ctx.font = `600 ${Math.round(10.5 * scale)}px ${FONT}`;
    const mw = ctx.measureText(mark).width;
    const mx = 12 * scale, my = (this.layout.portrait ? 62 : 48) * scale;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(15,17,21,.45)';
    ctx.beginPath(); ctx.roundRect(mx, my, mw + 14 * scale, 20 * scale, 5 * scale); ctx.fill();
    ctx.fillStyle = 'rgba(246,241,231,.82)';
    ctx.fillText(mark, mx + 7 * scale, my + 10 * scale);

    // 右上：在线 + 点赞充能
    const label = `👥 ${snap.stats.residents}`;
    ctx.font = `700 ${Math.round(13 * scale)}px ${FONT}`;
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(15,17,21,.62)';
    ctx.beginPath(); ctx.roundRect(w - lw - 30 * scale, 12 * scale, lw + 18 * scale, 30 * scale, 8 * scale); ctx.fill();
    ctx.fillStyle = '#f6f1e7';
    ctx.fillText(label, w - lw - 21 * scale, 12 * scale + 15 * scale);

    const barW = 150 * scale, barH = 9 * scale;
    const bx = w - barW - 18 * scale, by = 50 * scale;
    ctx.fillStyle = 'rgba(15,17,21,.55)';
    ctx.beginPath(); ctx.roundRect(bx - 4 * scale, by - 8 * scale, barW + 8 * scale, barH + 16 * scale, 6 * scale); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.roundRect(bx, by, barW, barH, barH / 2); ctx.fill();
    const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
    grad.addColorStop(0, '#ff8fab'); grad.addColorStop(1, '#ffd166');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(bx, by, Math.max(2, barW * (snap.energy / 100)), barH, barH / 2); ctx.fill();
    ctx.font = `600 ${Math.round(10 * scale)}px ${FONT}`;
    ctx.fillStyle = '#f6f1e7';
    ctx.textAlign = 'right';
    ctx.fillText('点赞充能 → 全城烟花', bx + barW, by + barH + 8 * scale);

    // 今日头条 / 日报：横屏在底部，竖屏在顶部天空区
    const line = snap.headline || snap.settlement;
    if (line) {
      const barY = this.layout.portrait ? h * 0.105 : h - 40 * scale;
      ctx.font = `600 ${Math.round(12 * scale)}px ${FONT}`;
      const lw2 = Math.min(w - 36 * scale, ctx.measureText(line).width + 24 * scale);
      ctx.fillStyle = 'rgba(255,209,102,.90)';
      ctx.beginPath(); ctx.roundRect(18 * scale, barY, lw2, 26 * scale, 7 * scale); ctx.fill();
      ctx.fillStyle = '#241d0c';
      ctx.textAlign = 'left';
      ctx.fillText(line, 30 * scale, barY + 13 * scale, lw2 - 24 * scale);
    }
    // 竖屏专享：沙盘下方的信息区（身价榜 + 最近播报 + 指令提示）
    if (this.layout.portrait) this.#drawPortraitPanel(ctx, w, h, snap, scale);
    ctx.restore();
  }

  #drawPortraitPanel(ctx, w, h, snap, scale) {
    const left = 22 * scale, right = w - 22 * scale, innerW = right - left;
    const top = snap.ranking.slice(0, 3);
    const lines = snap.log.slice(-2);
    const rowH = 30 * scale;
    const lineH = 21 * scale;
    const cardH = 20 * scale + 22 * scale + top.length * rowH + 6 * scale + lines.length * lineH + 10 * scale + 26 * scale + 14 * scale;
    const cardY = h - cardH - 14 * scale;

    // 卡片底
    ctx.fillStyle = 'rgba(13,16,21,.62)';
    ctx.beginPath(); ctx.roundRect(left - 8 * scale, cardY, innerW + 16 * scale, cardH, 14 * scale); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let y = cardY + 20 * scale;
    ctx.font = `700 ${Math.round(12 * scale)}px ${FONT}`;
    ctx.fillStyle = 'rgba(246,241,231,.55)';
    ctx.fillText('互动榜 · 点赞/评论/礼物都算分', left, y);
    y += 22 * scale;

    const max = Math.max(1, ...top.map((r) => r.score ?? r.coins));
    for (const [i, r] of top.entries()) {
      const numW = 20 * scale, coinW = 52 * scale;
      const barX = left + numW, barW = innerW - numW - coinW;
      ctx.font = `700 ${Math.round(13 * scale)}px ${FONT}`;
      ctx.fillStyle = i === 0 ? '#ffd166' : 'rgba(246,241,231,.75)';
      ctx.fillText(String(i + 1), left, y);
      ctx.font = `600 ${Math.round(13.5 * scale)}px ${FONT}`;
      ctx.fillStyle = i === 0 ? '#ffd166' : '#f6f1e7';
      ctx.fillText(r.name.slice(0, 8) + (r.auto ? ' ·自动' : ''), barX, y, barW - 8 * scale);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffb457';
      ctx.fillText(String(r.score ?? r.coins), right, y);
      ctx.textAlign = 'left';
      // 进度条
      const barY = y + 10 * scale;
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, 5 * scale, 3 * scale); ctx.fill();
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, '#ff8fab'); grad.addColorStop(1, '#ffd166');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(3, barW * ((r.score ?? r.coins) / max)), 5 * scale, 3 * scale); ctx.fill();
      y += rowH;
    }

    // 最近播报
    y += 6 * scale;
    ctx.font = `600 ${Math.round(12 * scale)}px ${FONT}`;
    for (const line of lines) {
      ctx.fillStyle = 'rgba(246,241,231,.70)';
      ctx.fillText(line.text.slice(0, 30), left, y, innerW);
      y += lineH;
    }

    // 指令提示
    y += 10 * scale;
    ctx.font = `700 ${Math.round(12.5 * scale)}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,180,87,.95)';
    ctx.fillText('发弹幕下指令 → 钓鱼 · 上班 · 跳舞 · 吃饭 · 睡觉 · 打一架', left, y, innerW);
  }

  #emoji(ctx, char, x, y, size) {
    ctx.font = `${Math.round(size)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(char, x, y);
  }

  #label(ctx, text, x, y, scale) {
    ctx.font = `600 ${Math.round(10.5 * scale)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(15,17,21,.55)';
    const tw = ctx.measureText(text).width;
    ctx.beginPath(); ctx.roundRect(x - tw / 2 - 4 * scale, y - 8 * scale, tw + 8 * scale, 15 * scale, 3 * scale); ctx.fill();
    ctx.fillStyle = '#f6f1e7';
    ctx.fillText(text, x, y);
  }
}
