// 头像大乱斗 · 渲染层（Canvas 2D，零依赖）
// 画面自带全部直播信息（在线数/王者/体型榜/欢迎播报/操作提示），可单独弹成 OBS 采集窗口。

import { WORLD } from './arena-engine.mjs';

const FONT = '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';

// 横屏：整张地图等比铺满并居中。
// 竖屏：地图贴在上半屏（等比、不裁切），下半屏留给体型榜/播报——竖屏直播就靠这块信息留住人。
export function fitOf(width, height) {
  const portrait = height / width > 1.32;
  if (portrait) {
    const s = (width * 0.94) / WORLD.w;
    return { s, ox: width * 0.03, oy: height * 0.115, portrait: true };
  }
  const s = Math.min(width / WORLD.w, height / WORLD.h);
  return { s, ox: (width - WORLD.w * s) / 2, oy: (height - WORLD.h * s) / 2, portrait: false };
}

export function project(x, y, width, height) {
  const f = fitOf(width, height);
  return { sx: f.ox + x * f.s, sy: f.oy + y * f.s, s: f.s };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 体型档位：环的颜色 + 称号（越大越显眼，这是“被看见”的奖励）
export function tierOf(mass) {
  const m = mass / 100;
  if (m >= 12) return { ring: '#ff4d6d', label: '霸主', glow: 'rgba(255,77,109,.55)' };
  if (m >= 6) return { ring: '#ffd166', label: '巨物', glow: 'rgba(255,209,102,.45)' };
  if (m >= 3) return { ring: '#c9a7ff', label: '大块头', glow: 'rgba(201,167,255,.40)' };
  if (m >= 1.6) return { ring: '#7ee7c7', label: '壮实', glow: 'rgba(126,231,199,.32)' };
  return { ring: '#e8e2d4', label: '萌新', glow: 'rgba(232,226,212,.22)' };
}

export class ArenaRender {
  constructor(canvas, { t = (k, v) => (v ? String(k) : String(k)), lang = 'zh' } = {}) {
    this.t = t;
    this.lang = lang === 'en' ? 'en' : 'zh';
    this.round = null;      // {index, remaining, progress}
    this.lastWinner = '';   // 上局王者
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = new Map();
    this.particles = [];
    this.toasts = [];        // 欢迎/播报横幅队列
    this.time = 0;
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
  }

  avatar(name, url) {
    if (!url) return null;
    const cached = this.images.get(name);
    if (cached?.url === url) return cached.ready ? cached.img : null;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const record = { url, img, ready: false };
    img.onload = () => { record.ready = true; };
    img.onerror = () => { record.failed = true; };
    img.src = url;
    this.images.set(name, record);
    return null;
  }

  resize(width, height, dpr = 1, commitStyle = true) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.dpr = dpr;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      if (commitStyle) {
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
      } else {
        this.canvas.style.width = '';
        this.canvas.style.height = '';
      }
    }
    this.width = w;
    this.height = h;
  }

  // 播报横幅（进场欢迎 / 王者 / 被吃）
  toast(text, kind = 'join', seconds = 4) {
    this.toasts.push({ text, kind, t: 0, life: seconds });
    if (this.toasts.length > 4) this.toasts.splice(0, this.toasts.length - 4);
  }

  spawnEffects(list) {
    for (const fx of list) {
      const p = project(fx.x ?? WORLD.w / 2, fx.y ?? WORLD.h / 2, this.width, this.height);
      if (fx.kind === 'eat') {
        for (let i = 0; i < 26; i++) {
          const ang = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 190;
          this.particles.push({ kind: 'spark', x: p.sx, y: p.sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: .7, t: 0, hue: fx.hue ?? 20 });
        }
      } else if (fx.kind === 'spawn') {
        this.particles.push({ kind: 'ring', x: p.sx, y: p.sy, life: .55, t: 0, r0: 6, r1: 60, hue: 48 });
      } else if (fx.kind === 'bump') {
        this.particles.push({ kind: 'ring', x: p.sx, y: p.sy, life: .28, t: 0, r0: 4, r1: 30, hue: fx.hue ?? 200 });
      } else if (fx.kind === 'gift') {
        for (let i = 0; i < 16; i++) {
          this.particles.push({ kind: 'star', x: p.sx + (Math.random() - .5) * 60, y: p.sy + (Math.random() - .5) * 60, vx: (Math.random() - .5) * 60, vy: -40 - Math.random() * 80, life: .9, t: 0, hue: fx.hue ?? 45 });
        }
      } else if (fx.kind === 'sparkle') {
        for (let i = 0; i < 8; i++) {
          this.particles.push({ kind: 'star', x: p.sx + (Math.random() - .5) * 40, y: p.sy, vx: (Math.random() - .5) * 40, vy: -30 - Math.random() * 40, life: .6, t: 0, hue: 45 });
        }
      }
    }
  }

  setLang(lang) { this.lang = lang === 'en' ? 'en' : 'zh'; }

  frame(dt, snap, extra = {}) {
    if (!snap) return;
    if (extra.round !== undefined) this.round = extra.round;
    if (extra.lastWinner !== undefined) this.lastWinner = extra.lastWinner;
    this.time += dt;
    const ctx = this.ctx, w = this.width, h = this.height;
    const f = fitOf(w, h);
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.#drawField(ctx, w, h, f);
    this.#drawParticles(ctx, dt, 'under');
    for (const a of snap.alive) this.#drawAvatar(ctx, a, snap, f);
    this.#drawParticles(ctx, dt, 'over');
    this.#drawHud(ctx, w, h, snap, f);
    this.#drawToasts(ctx, dt, w, h);
    ctx.restore();
  }

  #drawField(ctx, w, h, f) {
    const bg = ctx.createRadialGradient(w * .5, h * .5, Math.min(w, h) * .1, w * .5, h * .5, Math.max(w, h) * .75);
    bg.addColorStop(0, '#151b26');
    bg.addColorStop(1, '#0a0d13');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 竞技场地面
    const x = f.ox, y = f.oy, ww = WORLD.w * f.s, hh = WORLD.h * f.s;
    const field = ctx.createLinearGradient(x, y, x, y + hh);
    field.addColorStop(0, '#1b2230');
    field.addColorStop(1, '#141a24');
    ctx.fillStyle = field;
    ctx.beginPath(); ctx.roundRect(x, y, ww, hh, 18); ctx.fill();
    // 网格
    ctx.strokeStyle = 'rgba(120,150,190,.07)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= WORLD.w; gx += 100) {
      const p = project(gx, 0, w, h);
      ctx.beginPath(); ctx.moveTo(p.sx, y); ctx.lineTo(p.sx, y + hh); ctx.stroke();
    }
    for (let gy = 0; gy <= WORLD.h; gy += 100) {
      const p = project(0, gy, w, h);
      ctx.beginPath(); ctx.moveTo(x, p.sy); ctx.lineTo(x + ww, p.sy); ctx.stroke();
    }
    // 边框光
    ctx.strokeStyle = 'rgba(255,180,87,.22)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, ww, hh, 18); ctx.stroke();
  }

  #drawAvatar(ctx, a, snap, f) {
    const p = project(a.x, a.y, this.width, this.height);
    const r = a.r * f.s;
    const tier = tierOf(a.mass);
    const isKing = snap.king === a.name;

    // 外发光（大的更亮）
    const glowR = r * (isKing ? 2.1 : 1.5);
    const glow = ctx.createRadialGradient(p.sx, p.sy, r * .6, p.sx, p.sy, glowR);
    glow.addColorStop(0, tier.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, glowR, 0, Math.PI * 2); ctx.fill();

    // 头像
    const record = this.images.get(a.name);
    const img = record?.ready ? record.img : null;
    ctx.save();
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = `hsl(${a.hue} 55% 46%)`;
    ctx.fill();
    if (img) {
      try { ctx.drawImage(img, p.sx - r, p.sy - r, r * 2, r * 2); } catch { /* 跨域失败就用底色 */ }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = `700 ${Math.round(r * .92)}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(a.name).slice(0, 1), p.sx, p.sy);
    }
    // 吃掉别人时闪一下
    if (a.flash) {
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillRect(p.sx - r, p.sy - r, r * 2, r * 2);
    }
    ctx.restore();

    // 环
    ctx.lineWidth = Math.max(2, r * .09);
    ctx.strokeStyle = tier.ring;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2); ctx.stroke();

    // 王者皇冠
    if (isKing) {
      ctx.font = `${Math.round(Math.max(16, r * .6))}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('👑', p.sx, p.sy - r - r * .42);
    }

    // 名字牌（小头像也保证看得见是谁）
    const label = a.name.length > 8 ? a.name.slice(0, 8) + '…' : a.name;
    const fs = clamp(Math.max(11, r * .34), 11, 22);
    ctx.font = `700 ${Math.round(fs)}px ${FONT}`;
    const tw = ctx.measureText(label).width;
    const ty = p.sy + r + fs * .95;
    ctx.fillStyle = 'rgba(8,11,16,.62)';
    ctx.beginPath(); ctx.roundRect(p.sx - tw / 2 - 5, ty - fs * .72, tw + 10, fs * 1.5, 4); ctx.fill();
    ctx.fillStyle = isKing ? '#ffd166' : '#f2ece0';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, p.sx, ty + fs * .08);
  }

  #drawParticles(ctx, dt, layer) {
    const alive = [];
    for (const p of this.particles) {
      p.t += dt;
      if (p.t >= p.life) continue;
      const k = p.t / p.life;
      if (p.kind !== 'ring') p.vy += 120 * dt;
      if (layer === 'under' && p.kind !== 'ring') { alive.push(p); continue; }
      if (layer === 'over' && p.kind === 'ring') { alive.push(p); continue; }
      if (p.kind === 'ring') {
        ctx.strokeStyle = `hsla(${p.hue},90%,68%,${1 - k})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * k, 0, Math.PI * 2); ctx.stroke();
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = p.kind === 'star' ? `hsl(${p.hue},95%,66%)` : `hsl(${p.hue},85%,62%)`;
        const s = p.kind === 'star' ? 4 : 3;
        ctx.fillRect(p.x, p.y, s, s);
        ctx.globalAlpha = 1;
      }
      alive.push(p);
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
  }

  #drawHud(ctx, w, h, snap, f) {
    const s = clamp(w / 1100, .8, 1.8);
    ctx.textBaseline = 'middle';
    // 左上：在线 + 王者
    const online = `👥 ${snap.stats.online}`;
    ctx.font = `700 ${Math.round(14 * s)}px ${FONT}`;
    const ow = ctx.measureText(online).width;
    ctx.fillStyle = 'rgba(8,11,16,.66)';
    ctx.beginPath(); ctx.roundRect(14 * s, 14 * s, ow + 20 * s, 30 * s, 8 * s); ctx.fill();
    ctx.fillStyle = '#f2ece0';
    ctx.textAlign = 'left';
    ctx.fillText(online, 24 * s, 29 * s);

    if (snap.king) {
      const king = `👑 ${snap.king}`;
      ctx.font = `700 ${Math.round(13 * s)}px ${FONT}`;
      const kw = ctx.measureText(king).width;
      ctx.fillStyle = 'rgba(255,209,102,.16)';
      ctx.strokeStyle = 'rgba(255,209,102,.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(14 * s + ow + 28 * s, 14 * s, kw + 20 * s, 30 * s, 8 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.fillText(king, 24 * s + ow + 28 * s, 29 * s);
    }

    // 节奏：互动越多跑得越快，画面上要让观众看见"房间热起来了"
    const pace = Number(snap.pace) || 1;
    if (pace > 1.05) {
      const heat = Math.min(1, Math.max(0, Number(snap.heat) || 0));
      const chip = '⚡ ' + this.t('hud.pace', { x: pace.toFixed(1) });
      ctx.font = `800 ${Math.round(13 * s)}px ${FONT}`;
      const pw = ctx.measureText(chip).width;
      const px = w - pw - 18 * s;
      let py = 50 * s;
      // 右上若已有体型榜，就放到它下面
      if (snap.ranking && snap.ranking.length) py = 50 * s + (snap.ranking.length > 3 ? 3 : snap.ranking.length) * 26 * s + 6 * s;
      ctx.fillStyle = `rgba(255,180,87,${0.14 + heat * 0.20})`;
      ctx.strokeStyle = `rgba(255,180,87,${0.45 + heat * 0.4})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(px - 6 * s, py, pw + 14 * s, 24 * s, 7 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd9a0';
      ctx.textAlign = 'left';
      ctx.fillText(chip, px, py + 12 * s);
    }

    // 顶部中间：本局倒计时（有了"局"才有目标感）
    if (this.round) {
      const total = Math.max(0, Math.round(this.round.remaining));
      const mm = String(Math.floor(total / 60)).padStart(2, '0');
      const ss = String(total % 60).padStart(2, '0');
      const label = this.t('hud.round', { n: this.round.index }) + '·' + this.t('hud.roundLeft', { time: mm + ':' + ss });
      ctx.font = `700 ${Math.round(12.5 * s)}px ${FONT}`;
      const tw2 = ctx.measureText(label).width;
      const boxW2 = Math.max(150 * s, tw2 + 28 * s);
      const bx2 = w / 2 - boxW2 / 2, by2 = 14 * s;
      ctx.fillStyle = 'rgba(8,11,16,.66)';
      ctx.beginPath(); ctx.roundRect(bx2, by2, boxW2, 30 * s, 8 * s); ctx.fill();
      // 进度条
      const pW = boxW2 - 20 * s, pH = 3.5 * s;
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.beginPath(); ctx.roundRect(bx2 + 10 * s, by2 + 23 * s, pW, pH, pH / 2); ctx.fill();
      const pg = ctx.createLinearGradient(bx2, 0, bx2 + pW, 0);
      pg.addColorStop(0, '#7ee7c7'); pg.addColorStop(1, '#ffd166');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.roundRect(bx2 + 10 * s, by2 + 23 * s, Math.max(2, pW * Math.max(0, Math.min(1, this.round.progress))), pH, pH / 2); ctx.fill();
      ctx.fillStyle = '#f2ece0';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, w / 2, by2 + 12 * s);
      ctx.textAlign = 'left';
      if (this.lastWinner) {
        ctx.font = `600 ${Math.round(10.5 * s)}px ${FONT}`;
        ctx.fillStyle = 'rgba(255,209,102,.85)';
        ctx.textAlign = 'center';
        ctx.fillText(this.t('hud.winner', { name: this.lastWinner }), w / 2, by2 + 38 * s);
        ctx.textAlign = 'left';
      }
    }
    // 右上：体型榜 TOP3
    if (snap.ranking.length) {
      const rows = snap.ranking.slice(0, 3);
      const boxW = 168 * s, rowH = 26 * s;
      const boxH = rowH * rows.length + 12 * s;
      const bx = w - boxW - 14 * s, by = 14 * s;
      ctx.fillStyle = 'rgba(8,11,16,.66)';
      ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 10 * s); ctx.fill();
      ctx.textAlign = 'left';
      rows.forEach((r, i) => {
        const y = by + 12 * s + rowH * i + rowH / 2 - 3 * s;
        ctx.font = `700 ${Math.round(12 * s)}px ${FONT}`;
        ctx.fillStyle = i === 0 ? '#ffd166' : '#c9cfda';
        ctx.fillText(`${i + 1}`, bx + 12 * s, y);
        ctx.fillStyle = i === 0 ? '#ffe6a8' : '#e8e2d4';
        const nm = r.name.length > 7 ? r.name.slice(0, 7) + '…' : r.name;
        ctx.fillText(nm, bx + 26 * s, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffb457';
        ctx.fillText(String(r.mass), bx + boxW - 12 * s, y);
        ctx.textAlign = 'left';
      });
    }

    // 底部：操作提示 + 合规标识（竖屏时挪进下方信息区）
    if (!f.portrait) {
      const hint = this.t('hud.hint');
      ctx.font = `700 ${Math.round(13 * s)}px ${FONT}`;
      const hw = Math.min(w - 30 * s, ctx.measureText(hint).width + 24 * s);
      ctx.fillStyle = 'rgba(8,11,16,.66)';
      ctx.beginPath(); ctx.roundRect(14 * s, h - 44 * s, hw, 30 * s, 8 * s); ctx.fill();
      ctx.fillStyle = '#f2ece0';
      ctx.fillText(hint, 26 * s, h - 29 * s, hw - 24 * s);

      const mark = this.t('hud.compliance');
      ctx.font = `600 ${Math.round(10.5 * s)}px ${FONT}`;
      const mw = ctx.measureText(mark).width;
      ctx.fillStyle = 'rgba(8,11,16,.5)';
      ctx.beginPath(); ctx.roundRect(w - mw - 28 * s, h - 40 * s, mw + 16 * s, 22 * s, 6 * s); ctx.fill();
      ctx.fillStyle = 'rgba(242,236,224,.8)';
      ctx.fillText(mark, w - mw - 20 * s, h - 29 * s);
    } else {
      this.#drawPortraitPanel(ctx, w, h, snap, f);
    }

    // 空场：不造假，直接告诉观众怎么加入
    if (!snap.alive.length) {
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.round(26 * s)}px ${FONT}`;
      ctx.fillStyle = 'rgba(242,236,224,.88)';
      ctx.fillText(this.t('empty.title'), f.ox + WORLD.w * f.s / 2, f.oy + WORLD.h * f.s * .45);
      ctx.font = `700 ${Math.round(15 * s)}px ${FONT}`;
      ctx.fillStyle = 'rgba(255,180,87,.9)';
      ctx.fillText(this.t('empty.hint'), f.ox + WORLD.w * f.s / 2, f.oy + WORLD.h * f.s * .45 + 38 * s);
      ctx.textAlign = 'left';
    }
  }

  // 竖屏下方信息区：体型榜 + 最近播报 + 操作提示 + 合规标识
  #drawPortraitPanel(ctx, w, h, snap, f) {
    const s = clamp(w / 760, 1, 2.2);
    const left = 22 * s, right = w - 22 * s, innerW = right - left;
    const top = snap.ranking.slice(0, 5);
    const lines = snap.log.slice(-3);
    const rowH = 30 * s, lineH = 21 * s;
    const contentH = 26 * s + top.length * rowH + 10 * s + lines.length * lineH + 16 * s + 24 * s;
    const cardH = contentH + 34 * s;
    const cardY = h - cardH - 14 * s;
    ctx.fillStyle = 'rgba(13,16,21,.74)';
    ctx.beginPath(); ctx.roundRect(12 * s, cardY, w - 24 * s, cardH, 14 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let y = cardY + 26 * s;
    ctx.font = `800 ${Math.round(14 * s)}px ${FONT}`;
    ctx.fillStyle = 'rgba(242,236,224,.55)';
    ctx.fillText(this.t('hud.rankTitle'), left, y);
    y += 26 * s;

    const max = Math.max(1, ...top.map((r) => r.mass));
    top.forEach((r, i) => {
      const nameW = 0.42 * innerW;
      ctx.font = `700 ${Math.round(13 * s)}px ${FONT}`;
      ctx.fillStyle = i === 0 ? '#ffd166' : '#c9cfda';
      ctx.fillText(`${i + 1}`, left, y);
      ctx.fillStyle = i === 0 ? '#ffe6a8' : '#e8e2d4';
      const nm = r.name.length > 8 ? r.name.slice(0, 8) + '…' : r.name;
      ctx.fillText(nm, left + 20 * s, y, nameW);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffb457';
      ctx.fillText(String(r.mass), right, y);
      ctx.textAlign = 'left';
      const barX = left + 20 * s, barW = innerW - 20 * s - 46 * s;
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.beginPath(); ctx.roundRect(barX, y + 11 * s, barW, 5 * s, 3 * s); ctx.fill();
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, '#7ee7c7'); grad.addColorStop(1, '#ffd166');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(barX, y + 11 * s, Math.max(3, barW * (r.mass / max)), 5 * s, 3 * s); ctx.fill();
      y += rowH;
    });

    y += 10 * s;
    ctx.font = `600 ${Math.round(12.5 * s)}px ${FONT}`;
    for (const line of lines) {
      ctx.fillStyle = line.kind === 'eat' ? 'rgba(255,120,150,.9)' : 'rgba(242,236,224,.66)';
      ctx.fillText(line.text.slice(0, 26), left, y, innerW);
      y += 21 * s;
    }

    ctx.font = `700 ${Math.round(12.5 * s)}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,180,87,.95)';
    ctx.fillText(this.t('hud.hint'), left, y + 6 * s, innerW);

    const mark = this.t('hud.compliance');
    ctx.font = `600 ${Math.round(10 * s)}px ${FONT}`;
    const mw = ctx.measureText(mark).width;
    ctx.fillStyle = 'rgba(8,11,16,.55)';
    ctx.beginPath(); ctx.roundRect(w - mw - 26 * s, h - 52 * s, mw + 16 * s, 20 * s, 6 * s); ctx.fill();
    ctx.fillStyle = 'rgba(242,236,224,.75)';
    ctx.fillText(mark, w - mw - 18 * s, h - 42 * s);
  }
  #drawToasts(ctx, dt, w, h) {
    this.toasts = this.toasts.filter((t) => (t.t += dt) < t.life).slice(-3);
    const s = clamp(w / 1100, .8, 1.8);
    this.toasts.forEach((t, i) => {
      const k = t.t / t.life;
      const alpha = k < .12 ? k / .12 : k > .8 ? (1 - k) / .2 : 1;
      const y = h * .075 + i * 36 * s;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.font = `700 ${Math.round(15 * s)}px ${FONT}`;
      const tw = ctx.measureText(t.text).width;
      const color = t.kind === 'eat' ? 'rgba(255,77,109,.92)' : t.kind === 'king' ? 'rgba(255,209,102,.92)' : 'rgba(126,231,199,.92)';
      ctx.fillStyle = 'rgba(8,11,16,.72)';
      ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2 - 14 * s, y - 16 * s, tw + 28 * s, 32 * s, 8 * s); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.text, w / 2, y);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    });
  }
}
