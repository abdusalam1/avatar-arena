// 头像大乱斗 · 核心引擎（纯逻辑、零依赖、可单测）
// -----------------------------------------------------------------------------
// 玩法：点赞 → 头像进地图；评论 → 稍微变大；礼物 → 暴涨；
//      所有头像无规则游动，同级相碰弹开，大的吃掉小的并变大。
//
// 相对"原始想法"改掉的四个坑（都在配置里可调）：
//   1) 滚雪球：吃掉只吸收 62% 质量 + 大号每秒衰减 + 质量上限 → 王者会被追平
//   2) 纯随机游走：加了"小的逃、大的追"的显性行为（smarts 可调 0=纯随机）
//   3) 点赞洪水：点赞优先让已有头像变大，只有"这个人还没有头像"时才进场
//   4) 被吃即退场：被吃掉的人再互动一次就能复活，死亡变成节目效果
//
// 平台合规（对应「直播小玩法」规则）：
//   · 空场不造假观众（不产生任何"机器人"）
//   · 免费行为（点赞/评论）有肉眼可见的效果，礼物只是"更快更炫"
//   · 吃/被吃是确定性规则，没有任何随机数值奖励
// -----------------------------------------------------------------------------

export const WORLD = { w: 1600, h: 900 };
export const BASE_MASS = 100;

export const DEFAULTS = {
  maxAlive: 60,            // 地图里同时存在的头像上限
  likeMass: 2,             // 每 1 个赞加的质量
  likeCooldownMs: 220,     // 同一个人点赞加质量的最短间隔
  commentMass: 14,         // 评论"稍微变大"
  commentCooldownMs: 1500,
  giftMass: { heart: 25, beer: 45, lollipop: 65, rose: 95, rocket: 220, other: 40 },
  eatGain: 0.62,           // 吃掉后吸收的比例（<1 → 总质量缓慢泄漏）
  decayPerSec: 0.004,      // 大号每秒按比例衰减
  decayFrom: 3,            // 质量达到基础的几倍开始衰减（默认 300）
  decayTo: 2,              // 衰减下限：一路压到基础的几倍（默认 200，可调）
  decayMinPerSec: 3,       // 衰减的最低速度（保证能走到下限，不会无限拖尾）
  maxMassFactor: 26,       // 质量上限 = 基础质量 × 该倍数
  smarts: 0.65,            // 0=纯随机游走，1=强烈追逃
  speed: 118,              // 基础移动速度（世界单位/秒），可现场调
  hypeBoost: 0.9,          // 互动越多，节奏最多加快多少倍（0.9 = 最多 ×1.9）
  hypeWindow: 6,           // 用最近多少秒的互动量算"热度"
  hypeRefRate: 6,          // 每秒多少个互动算"满热度"
  hypeSmoothing: 2.0,      // 节奏回落的平滑速度（越大回落越快）
  bounceRatio: 1.15,       // 半径比 < 该值 = 同级，相碰弹开
  reviveCooldownMs: 2500   // 被吃掉后多久能重新进场
};

export function radiusOf(mass) {
  return 2.4 * Math.sqrt(Math.max(1, mass));
}

export function maxMassOf(cfg = DEFAULTS) {
  return BASE_MASS * cfg.maxMassFactor;
}

// 名字 → 稳定色相（没有头像图时用它兜底）
export function hueOf(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

const GIFTS = [
  { key: 'rocket', words: ['火箭', 'rocket', '跑车', 'car', '嘉年华', 'castle', '飞机', '游艇'] },
  { key: 'rose', words: ['玫瑰', 'rose', '花', 'flower'] },
  { key: 'beer', words: ['啤酒', 'beer', '酒'] },
  { key: 'lollipop', words: ['棒棒糖', 'lollipop', '糖', 'candy'] },
  { key: 'heart', words: ['小心心', '爱心', 'heart', '心'] }
];

export function giftKeyOf(raw) {
  const s = String(raw ?? '').toLowerCase();
  for (const g of GIFTS) for (const w of g.words) if (s.includes(String(w).toLowerCase())) return g.key;
  return 'other';
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Arena {
  constructor(options = {}) {
    this.cfg = { ...DEFAULTS, ...options };
    this.rng = mulberry32(this.cfg.seed ?? 1);
    this.time = 0;                 // 秒
    this.avatars = new Map();      // name → avatar
    this.log = [];
    this.effects = [];
    this.events = [];   // 结构化事件（给局管理器/播报用，不依赖中文日志文本）
    this.records = [];             // 历史王者（最大质量）
    this.stats = { joins: 0, likes: 0, comments: 0, gifts: 0, eats: 0, peak: 0 };
    this.king = '';
    this.lastKingAt = -99;
    this.pace = 1;                 // 当前节奏倍率（互动越多越接近 1 + hypeBoost）
    this.eventMarks = [];          // 最近互动的时间戳，用来算热度
  }

  get alive() {
    return [...this.avatars.values()].filter((a) => a.alive);
  }

  // 热度：最近 hypeWindow 秒里每秒多少互动 → 0..1
  #heat() {
    const window = Math.max(1, this.cfg.hypeWindow);
    this.eventMarks = this.eventMarks.filter((at) => this.time - at <= window);
    const perSecond = this.eventMarks.length / window;
    return Math.max(0, Math.min(1, perSecond / Math.max(0.5, this.cfg.hypeRefRate)));
  }

  #markEvent() {
    this.eventMarks.push(this.time);
    if (this.eventMarks.length > 400) this.eventMarks.splice(0, this.eventMarks.length - 400);
  }

  // ---- 事件入口（schema 与 douyin-bridge 对齐）------------------------------
  feed(ev = {}) {
    const type = String(ev.type || '');
    const KNOWN = ['join', 'like', 'comment', 'gift', 'follow'];
    if (!KNOWN.includes(type)) return { accepted: false };
    const name = String(ev.name || ev.nickname || '').slice(0, 24);
    if (!name) return { accepted: false };
    this.#markEvent();   // 任何真实互动都算热度，房间越热闹跑得越快

    const existing = this.avatars.get(name);

    // 加入：进场/关注/第一次发弹幕点赞
    if (type === 'join' || type === 'follow') {
      const a = this.#spawn(name, ev.avatar);
      if (a) { a.love += type === 'follow' ? 2 : 1; this.stats.joins++; }
      return { accepted: !!a, spawned: !!a };
    }

    // 之前没出现过的观众，先按"加入"处理（免费行为也能进场）
    let a = existing;
    if (!a) {
      a = this.#spawn(name, ev.avatar);
      if (a) this.stats.joins++;
    }
    if (!a) return { accepted: false, reason: 'full' };
    if (ev.avatar && !a.avatar) a.avatar = ev.avatar;
    a.lastSeen = this.time;

    if (!a.alive) {
      // 被吃掉过：随便一个互动就复活（死亡只是节目效果，不是终点）
      if (this.time - a.diedAt < this.cfg.reviveCooldownMs / 1000) return { accepted: false, reason: 'cooldown' };
      a.alive = true; a.mass = BASE_MASS; a.killedBy = '';
      a.x = this.#randX(); a.y = this.#randY();
      this.#push('revive', `✨ ${name} 又回来了`, { name });
      this.#ev('revive', { name });
      this.#fx('spawn', { name });
    }

    if (type === 'like') {
      const n = Math.max(1, Math.min(100, Number(ev.count) || 1));
      a.likes += n; this.stats.likes += n;
      if (this.time - a.lastLikeAt >= this.cfg.likeCooldownMs / 1000) {
        a.lastLikeAt = this.time;
        this.#grow(a, this.cfg.likeMass * n, 'like');
      }
      return { accepted: true };
    }

    if (type === 'comment') {
      a.comments++; this.stats.comments++;
      if (this.time - a.lastCommentAt >= this.cfg.commentCooldownMs / 1000) {
        a.lastCommentAt = this.time;
        this.#grow(a, this.cfg.commentMass, 'comment');
      }
      return { accepted: true };
    }

    if (type === 'gift') {
      const key = giftKeyOf(ev.raw || ev.gift || '');
      const amount = Math.max(1, Math.min(100, Number(ev.count) || 1));
      const add = (this.cfg.giftMass[key] ?? this.cfg.giftMass.other) * amount;
      a.gifts += amount; this.stats.gifts += amount;
      this.#grow(a, add, 'gift');
      this.#push('gift', `🎁 ${name} 送出 ${amount} 个${ev.raw || ev.gift || '礼物'}，体型 +${Math.round(add)}`, { name });
      this.#fx('gift', { name, hue: a.hue });
      this.#ev('gift', { name, key, add });
      if (add >= 200) this.#push('headline', `🌟 ${name} 送出${ev.raw || '大礼物'}，全图瞩目`, { name });
      return { accepted: true, gift: key };
    }
    return { accepted: false };
  }

  #spawn(name, avatar = '') {
    const live = this.alive;
    if (live.length >= this.cfg.maxAlive) return null;
    const a = {
      name,
      avatar: String(avatar || ''),
      hue: hueOf(name),
      mass: BASE_MASS,
      x: this.#randX(), y: this.#randY(),
      vx: 0, vy: 0,
      angle: this.rng() * Math.PI * 2,
      alive: true,
      bornAt: this.time,
      decaying: false,    // 是否已进入"大号衰减"（进入后会一路压到地板）
      stuckT: 0,          // 贴墙卡住计时（自愈用）
      markX: 0, markY: 0, // 上次检查位置
      diedAt: -99,
      killedBy: '',
      lastSeen: this.time,
      lastLikeAt: -99,
      lastCommentAt: -99,
      likes: 0, comments: 0, gifts: 0, eats: 0, love: 0,
      peak: BASE_MASS
    };
    this.avatars.set(name, a);
    this.#push('join', `👋 ${name} 进场了`, { name });
    this.#ev('join', { name });
    this.#fx('spawn', { name });
    return a;
  }

  #grow(a, add, source) {
    if (!a.alive || !(add > 0)) return;
    a.mass = Math.min(maxMassOf(this.cfg), a.mass + add);
    a.peak = Math.max(a.peak, a.mass);
    this.stats.peak = Math.max(this.stats.peak, a.mass);
    if (source === 'gift') this.#fx('sparkle', { name: a.name });
  }

  #randX() { return 90 + this.rng() * (WORLD.w - 180); }
  #randY() { return 90 + this.rng() * (WORLD.h - 180); }

  // ---- 世界推进 ------------------------------------------------------------
  tick(dt = 1 / 60) {
    const step = Math.max(0, Math.min(0.05, dt));
    this.time += step;

    // 节奏：互动越热闹 → 越快（有上限），停手后平滑回落
    const target = 1 + Math.max(0, this.cfg.hypeBoost) * this.#heat();
    this.pace += (target - this.pace) * Math.min(1, Math.max(0.1, this.cfg.hypeSmoothing) * step);

    const list = this.alive;
    if (!list.length) return;

    for (const a of list) this.#steer(a, list, step);
    for (const a of list) this.#move(a, step);
    this.#collide(list);
    for (const a of list) this.#decay(a, step);
    this.#updateKing();
  }

  #steer(a, list, dt) {
    const cfg = this.cfg;
    // 无规则游走：角度缓慢随机漂移
    a.angle += (this.rng() - 0.5) * 3.4 * dt;
    let dx = Math.cos(a.angle), dy = Math.sin(a.angle);

    if (cfg.smarts > 0) {
      const r = radiusOf(a.mass);
      let fleeX = 0, fleeY = 0, chaseX = 0, chaseY = 0, danger = 0, preyFound = 0;
      for (const o of list) {
        if (o === a) continue;
        const d = Math.hypot(o.x - a.x, o.y - a.y);
        if (d < 1 || d > 420) continue;
        const or = radiusOf(o.mass);
        const nx = (o.x - a.x) / d, ny = (o.y - a.y) / d;
        if (or > r * cfg.bounceRatio) {
          // 有威胁：越近逃得越急
          const w = (1 - d / 420) * (or / r);
          fleeX -= nx * w; fleeY -= ny * w; danger += w;
        } else if (r >= or * cfg.bounceRatio) {
          // 是猎物：饿的时候追得更起劲
          const w = (1 - d / 420) * 0.9;
          chaseX += nx * w; chaseY += ny * w;
          preyFound += w;
        }
      }
      let bx = 0, by = 0;
      if (danger > 0) { bx += fleeX * 2; by += fleeY * 2; }
      if (preyFound > 0) { bx += chaseX; by += chaseY; }
      const bl = Math.hypot(bx, by);
      if (bl > 0.001) {
        const k = Math.min(1, cfg.smarts);
        dx = dx * (1 - k) + (bx / bl) * k;
        dy = dy * (1 - k) + (by / bl) * k;
      }
    }

    // 墙体处理：不能用"把 dx 加一点"的软办法——每帧速度都被平滑拉回游走方向，
    // 结果就是贴墙/卡角落。这里改成三件事：
    //   ① 消掉朝墙的法向分量（保留切向 → 沿墙滑行）
    //   ② 按贴墙程度加一股指向场内的推力（越贴越强，角落两面叠加 → 被弹出去）
    //   ③ 卡住自愈：位置几乎不动时直接把朝向甩向场地中心
    const r = radiusOf(a.mass);
    const band = Math.max(90, r * 2.2);
    let pushX = 0, pushY = 0;
    if (a.x < band) pushX = (band - a.x) / band;
    else if (a.x > WORLD.w - band) pushX = -(a.x - (WORLD.w - band)) / band;
    if (a.y < band) pushY = (band - a.y) / band;
    else if (a.y > WORLD.h - band) pushY = -(a.y - (WORLD.h - band)) / band;

    if (pushX || pushY) {
      const pl = Math.hypot(pushX, pushY) || 1;
      const ux = pushX / pl, uy = pushY / pl;   // 指向场内的单位向量
      const closeness = Math.min(1, Math.hypot(pushX, pushY));
      const outward = dx * ux + dy * uy;        // >0 表示正在朝场地内侧走
      if (outward < 0) {
        // 正在往墙上撞：把法向分量整体拿掉（留切向），并额外反向一点，弹得干脆
        dx -= ux * outward * (1 + closeness * 2.5);
        dy -= uy * outward * (1 + closeness * 2.5);
      }
      // 贴得越紧，向内的推力越大；角落两个方向叠加，所以不会停在那
      dx += ux * closeness * 2.6;
      dy += uy * closeness * 2.6;
    }

    // 卡住自愈：贴墙且 0.8 秒内几乎没位移 → 直接朝场地中心走
    a.stuckT = (a.stuckT || 0) + dt;
    if (a.stuckT >= 0.8) {
      const moved = Math.hypot(a.x - (a.markX ?? a.x), a.y - (a.markY ?? a.y));
      const nearWall = !!pushX || !!pushY;
      if (nearWall && moved < 3) {
        const toCenter = Math.atan2(WORLD.h / 2 - a.y, WORLD.w / 2 - a.x);
        a.angle = toCenter + (this.rng() - 0.5) * 0.8;
        a.vx = Math.cos(a.angle) * this.#speedOf(a.mass) * 0.9;
        a.vy = Math.sin(a.angle) * this.#speedOf(a.mass) * 0.9;
        dx = Math.cos(a.angle);
        dy = Math.sin(a.angle);
      }
      a.stuckT = 0;
      a.markX = a.x;
      a.markY = a.y;
    }

    const dl = Math.hypot(dx, dy) || 1;
    const speed = this.#speedOf(a.mass);
    const responsiveness = (pushX || pushY) ? Math.min(1, 9 * dt) : Math.min(1, 3.2 * dt);
    a.vx += ((dx / dl) * speed - a.vx) * responsiveness;
    a.vy += ((dy / dl) * speed - a.vy) * responsiveness;
  }

  #speedOf(mass) {
    // 越大越慢：给小的留出逃跑空间（否则一开局就定胜负）
    // 再乘当前节奏：直播间越热闹，全场跑得越快
    return Math.max(42, this.cfg.speed * Math.pow(BASE_MASS / mass, 0.14)) * this.pace;
  }

  #move(a, dt) {
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    const r = radiusOf(a.mass);
    // 撞墙反弹：位置夹回边界 + 法向速度反向（切向保留），并给一个最小弹开速度，
    // 这样即使速度刚好归零也不会黏在墙上。
    if (a.x < r) { a.x = r; a.vx = Math.abs(a.vx) * 0.75 + 18; }
    else if (a.x > WORLD.w - r) { a.x = WORLD.w - r; a.vx = -Math.abs(a.vx) * 0.75 - 18; }
    if (a.y < r) { a.y = r; a.vy = Math.abs(a.vy) * 0.75 + 18; }
    else if (a.y > WORLD.h - r) { a.y = WORLD.h - r; a.vy = -Math.abs(a.vy) * 0.75 - 18; }
  }

  #collide(list) {
    const cfg = this.cfg;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive) continue;
        const ra = radiusOf(a.mass), rb = radiusOf(b.mass);
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > ra + rb || dist === 0) continue;
        const nx = dx / dist, ny = dy / dist;

        // 大小差够大 → 吃
        if (ra >= rb * cfg.bounceRatio) { this.#eat(a, b); continue; }
        if (rb >= ra * cfg.bounceRatio) { this.#eat(b, a); continue; }

        // 同级 → 弹开（等质量弹性碰撞的简化版）
        const overlap = ra + rb - dist;
        a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
        const av = a.vx * nx + a.vy * ny;
        const bv = b.vx * nx + b.vy * ny;
        const impulse = (bv - av);
        a.vx += nx * impulse; a.vy += ny * impulse;
        b.vx -= nx * impulse; b.vy -= ny * impulse;
        this.#fx('bump', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, hue: a.hue });
      }
    }
  }

  #eat(predator, prey) {
    const gain = prey.mass * this.cfg.eatGain;
    predator.mass = Math.min(maxMassOf(this.cfg), predator.mass + gain);
    predator.peak = Math.max(predator.peak, predator.mass);
    predator.eats++;
    predator.flashUntil = this.time + 0.22;
    this.stats.eats++;
    prey.alive = false;
    prey.diedAt = this.time;
    prey.killedBy = predator.name;
    this.stats.peak = Math.max(this.stats.peak, predator.mass);
    this.#push('eat', `💀 ${predator.name} 吞掉了 ${prey.name}（体型 ${Math.round(predator.mass)}）`, { name: predator.name });
    this.#fx('eat', { x: prey.x, y: prey.y, hue: prey.hue, name: predator.name });
    this.#ev('eat', { predator: predator.name, prey: prey.name });
  }

  // 衰减：只有"大号"才进入衰减，但一旦进入就会一路压到 decayTo 地板（默认 200），
  // 而不是掉回起点（300）就停——旧逻辑正是因此永远卡在 300。
  #decay(a, dt) {
    const cfg = this.cfg;
    const startAt = BASE_MASS * Math.max(1.5, cfg.decayFrom ?? 3);
    const floor = BASE_MASS * Math.max(1, Math.min((cfg.decayTo ?? 2), (cfg.decayFrom ?? 3) - 0.5));
    if (a.mass > startAt) a.decaying = true;
    if (!a.decaying) return;
    if (a.mass <= floor) { a.mass = floor; a.decaying = false; return; }
    const proportional = a.mass * cfg.decayPerSec * dt;   // 越大掉得越快
    const linear = (cfg.decayMinPerSec ?? 3) * dt;        // 保证真的能走到地板，不会无限拖尾
    a.mass = Math.max(floor, a.mass - Math.max(proportional, linear));
  }

  #updateKing() {
    const list = this.alive;
    if (!list.length) { this.king = ''; return; }
    let top = list[0];
    for (const a of list) if (a.mass > top.mass) top = a;
    this.king = top.name;
    if (top.mass > BASE_MASS * 8 && this.time - this.lastKingAt > 45) {
      this.lastKingAt = this.time;
      this.#push('king', `👑 当前王者：${top.name}（体型 ${Math.round(top.mass)}）`, { name: top.name });
    }
  }

  // 一键清屏：移除地图上所有头像（直播换场/画面太乱时的急救按钮）。
  // 不清统计和历史记录，只清场上的头像；之后新的互动会重新进场。
  clear() {
    const count = this.alive.length;
    this.avatars.clear();
    this.eventMarks = [];
    this.pace = 1;
    this.king = '';
    this.lastKingAt = -99;
    this.#push('clear', `🧹 清屏：移除了 ${count} 个头像`, {});
    this.#fx('clear', {});
    return count;
  }

  recordKing() {
    const list = this.alive;
    if (!list.length) return null;
    const top = list.reduce((m, a) => (a.mass > m.mass ? a : m), list[0]);
    this.records.push({ name: top.name, mass: Math.round(top.mass), at: Math.round(this.time) });
    this.records = this.records.slice(-20);
    return top;
  }

  #push(kind, text, extra = {}) {
    this.log.push({ kind, text, at: this.time, ...extra });
    if (this.log.length > 240) this.log.splice(0, this.log.length - 240);
  }

  #fx(kind, data) {
    this.effects.push({ kind, ...data, at: this.time });
    if (this.effects.length > 120) this.effects.splice(0, this.effects.length - 120);
  }

  takeEffects() { return this.effects.splice(0, this.effects.length); }

  takeEvents() { return this.events.splice(0, this.events.length); }

  #ev(kind, data) {
    this.events.push({ kind, ...data, at: this.time });
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
  }

  // ---- 渲染层快照 ----------------------------------------------------------
  snapshot() {
    const list = this.alive.map((a) => ({
      name: a.name, avatar: a.avatar, hue: a.hue,
      x: a.x, y: a.y, mass: Math.round(a.mass), r: radiusOf(a.mass),
      eats: a.eats, likes: a.likes, comments: a.comments, gifts: a.gifts, peak: Math.round(a.peak),
      flash: (a.flashUntil || 0) > this.time
    }));
    const ranking = [...list].sort((a, b) => b.mass - a.mass).slice(0, 5);
    return {
      time: this.time,
      alive: list,
      ranking,
      king: this.king,
      pace: Math.round(this.pace * 100) / 100,   // 当前节奏倍率（1 = 正常）
      heat: Math.round(this.#heat() * 100) / 100, // 最近互动热度 0..1
      stats: { ...this.stats, online: list.length },
      records: this.records.slice(-5),
      log: this.log.slice(-30)
    };
  }
}
