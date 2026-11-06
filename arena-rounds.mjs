// 头像大乱斗 · 局 / 称号 / 王者墙
// -----------------------------------------------------------------------------
// 大乱斗的死穴是"看 5 分钟就腻"。解法不是加更多规则，而是加**局**：
// 每 X 分钟结算一次，给出王者、连吃王、复仇成功、首杀等称号，并留下"王者墙"。
// 观众的目标从"变大"变成"上榜 + 拿称号"，才有第二天回来的理由。
//
// 纯逻辑、无 DOM、无定时器：由页面按帧调用 tick(now)，因此可以直接单测。
// -----------------------------------------------------------------------------

export const TITLES = {
  king: { zh: '本局王者', en: 'Round King' },
  giant: { zh: '巨物', en: 'Colossus' },
  firstBlood: { zh: '首杀', en: 'First Blood' },
  combo: { zh: '连吃王', en: 'Feeding Frenzy' },
  revenge: { zh: '复仇成功', en: 'Revenge' }
};

export const ROUND_DEFAULTS = {
  roundSeconds: 600,      // 一局 10 分钟
  comboKills: 5,          // 一局吃掉多少个算"连吃王"
  giantMassFactor: 8,     // 体积达到基础体型几倍算"巨物"
  hallMax: 20             // 王者墙保留最近多少局
};

export class RoundManager {
  constructor(options = {}) {
    this.cfg = { ...ROUND_DEFAULTS, ...options };
    this.storage = options.storage || null;   // { read() → object|null, write(value) }
    this.round = 1;
    this.startedAt = 0;
    this.kills = new Map();      // name → 本局吃人数
    this.eatenBy = new Map();    // name → 最近吃掉他的名字
    this.firstKill = '';
    this.revenge = new Set();
    this.hall = [];
    this.lastResult = null;
    this.settled = false;
  }

  start(now) {
    this.startedAt = now;
    this.#resetRound();
    this.hall = this.#loadHall();
    return this;
  }

  #resetRound() {
    this.kills.clear();
    this.eatenBy.clear();
    this.revenge.clear();
    this.firstKill = '';
    this.settled = false;
  }

  // 引擎事件 → 局内统计。页面在收到引擎 log 或引擎回调时喂进来。
  observe(ev = {}) {
    if (ev.kind !== 'eat') return;
    const predator = String(ev.predator || '');
    const prey = String(ev.prey || '');
    if (!predator || !prey) return;
    this.kills.set(predator, (this.kills.get(predator) || 0) + 1);
    if (!this.firstKill) this.firstKill = predator;
    // 复仇：吃掉的是"之前吃过自己"的人
    if (this.eatenBy.get(predator) === prey) this.revenge.add(predator);
    this.eatenBy.set(prey, predator);
  }

  progress(now) {
    const left = this.remaining(now);
    return 1 - left / this.cfg.roundSeconds;
  }

  remaining(now) {
    return Math.max(0, this.cfg.roundSeconds - (now - this.startedAt) / 1000);
  }

  // 每到时间就结算；返回本局结果或 null
  tick(now, snapshot) {
    if (this.settled || !this.startedAt) return null;
    if (now - this.startedAt < this.cfg.roundSeconds * 1000) return null;
    return this.settle(snapshot, now);
  }

  settle(snapshot, now) {
    const alive = Array.isArray(snapshot?.alive) ? [...snapshot.alive] : [];
    alive.sort((a, b) => b.mass - a.mass);
    const top = alive[0];
    const titles = [];

    if (top) titles.push({ name: top.name, key: 'king', mass: top.mass });
    for (const a of alive.slice(0, 3)) {
      if (a.mass >= 100 * this.cfg.giantMassFactor) titles.push({ name: a.name, key: 'giant', mass: a.mass });
    }
    if (this.firstKill) titles.push({ name: this.firstKill, key: 'firstBlood' });
    for (const [name, kills] of this.kills) {
      if (kills >= this.cfg.comboKills) titles.push({ name, key: 'combo', kills });
    }
    for (const name of this.revenge) titles.push({ name, key: 'revenge' });

    const result = {
      round: this.round,
      at: new Date(now).toISOString(),
      winner: top ? { name: top.name, mass: top.mass } : null,
      ranking: alive.slice(0, 3).map((a) => ({ name: a.name, mass: a.mass })),
      titles
    };

    if (top) {
      this.hall.unshift({
        round: this.round,
        name: top.name,
        mass: top.mass,
        at: result.at,
        titles: titles.filter((t) => t.name === top.name).map((t) => t.key)
      });
      this.hall = this.hall.slice(0, this.cfg.hallMax);
      this.#saveHall();
    }

    this.lastResult = result;
    this.settled = true;
    this.round += 1;
    this.startedAt = now;
    this.#resetRound();
    return result;
  }

  #loadHall() {
    try {
      const raw = this.storage?.read?.();
      const list = Array.isArray(raw?.hall) ? raw.hall : [];
      return list
        .filter((h) => h && typeof h.name === 'string')
        .map((h) => ({
          round: Number(h.round) || 0,
          name: h.name.slice(0, 24),
          mass: Number(h.mass) || 0,
          at: typeof h.at === 'string' ? h.at : '',
          titles: Array.isArray(h.titles) ? h.titles.filter((k) => k in TITLES) : []
        }))
        .slice(0, this.cfg.hallMax);
    } catch { return []; }
  }

  #saveHall() {
    try { this.storage?.write?.({ hall: this.hall }); } catch { /* 隐私模式忽略 */ }
  }
}
