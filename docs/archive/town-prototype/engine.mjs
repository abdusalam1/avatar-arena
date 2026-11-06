// 头像小镇 · 核心模拟引擎
// -----------------------------------------------------------------------------
// 纯逻辑、零依赖、无 DOM：可以像项目里的其它 *.test.mjs 一样用 node --test 单测。
// 设计目标：把直播间事件（评论/点赞/礼物/进场/关注）翻译成小镇里“看得见”的动作，
// 并且在没有真人时也能自己运转（无人直播）。
//
// 数据流：
//   douyin-bridge WebSocket ──► Town.feed(ev) ──► residents / log / effects
//                                            └──► Town.tick(dt) 推进世界
//                                            └──► Town.snapshot() 给渲染层
// -----------------------------------------------------------------------------

// 小镇地点表（世界坐标 0..100 × 0..80）
export const PLACES = {
  gate:    { label: '城门',   emoji: '🏮', x: 50, y: 11 },
  factory: { label: '工厂',   emoji: '🏭', x: 16, y: 24 },
  river:   { label: '河边',   emoji: '🎣', x: 82, y: 38 },
  bar:     { label: '酒馆',   emoji: '🍺', x: 30, y: 58 },
  diner:   { label: '饭馆',   emoji: '🍜', x: 62, y: 16 },
  square:  { label: '广场',   emoji: '⛲', x: 50, y: 46 },
  shop:    { label: '杂货铺', emoji: '🏪', x: 10, y: 52 },
  park:    { label: '公园',   emoji: '🌳', x: 72, y: 66 },
  school:  { label: '学堂',   emoji: '🏫', x: 88, y: 14 }
};

// 状态（动作）表：emoji 用于头顶气泡，label 用于播报
export const STATES = {
  arrive: { emoji: '👋', label: '刚到小镇' },
  idle:   { emoji: '💭', label: '发呆' },
  walk:   { emoji: '🚶', label: '走路' },
  work:   { emoji: '🔧', label: '打工' },
  fish:   { emoji: '🎣', label: '钓鱼' },
  eat:    { emoji: '🍜', label: '吃饭' },
  drink:  { emoji: '🍺', label: '喝酒' },
  sleep:  { emoji: '💤', label: '睡觉' },
  dance:  { emoji: '💃', label: '跳舞' },
  shop:   { emoji: '🛒', label: '逛街' },
  fight:  { emoji: '⚔️', label: '切磋' },
  chat:   { emoji: '💬', label: '聊天' },
  sweet:  { emoji: '🍬', label: '吃糖' },
  love:   { emoji: '❤️', label: '心动' },
  gym:    { emoji: '🏋️', label: '健身' },
  study:  { emoji: '📚', label: '上学' },
  star:   { emoji: '🌟', label: '上头条' }
};

// 各动作的持续时间（真实秒）与目标地点
const ACTIONS = {
  work:  { place: 'factory', seconds: 42, stamina: -14, coins: 6,  exp: 3 },
  fish:  { place: 'river',   seconds: 30, stamina: -4,  coins: 4,  exp: 2 },
  eat:   { place: 'diner',   seconds: 12, stamina: 12, coins: -3, exp: 1 },
  drink: { place: 'bar',     seconds: 20, stamina: 6,  coins: -2, exp: 1 },
  sleep: { place: 'home',    seconds: 55, stamina: 40, coins: 0,  exp: 1 },
  dance: { place: 'square',  seconds: 24, stamina: -6, coins: 0,  exp: 2 },
  shop:  { place: 'shop',    seconds: 10, stamina: 0,  coins: -4, exp: 1 },
  gym:   { place: 'park',    seconds: 18, stamina: -8, coins: 0,  exp: 4 },
  study: { place: 'school',  seconds: 26, stamina: -5, coins: 0,  exp: 5 },
  fight: { place: 'square',  seconds: 10, stamina: -10, coins: 0,  exp: 6 },
  chat:  { place: 'square',  seconds: 8,  stamina: 0,   coins: 0,  exp: 1 },
  sweet: { place: null,      seconds: 6,  stamina: 4,   coins: 0,  exp: 1 },
  love:  { place: null,      seconds: 6,  stamina: 2,   coins: 0,  exp: 1 },
  star:  { place: 'square',  seconds: 14, stamina: 8,   coins: 20, exp: 10 }
};

// 弹幕命令 → 动作。键为关键词，越具体的放越前面。
// 中文为主，兼容英文与 emoji，方便 TikTok 场景复用。
const COMMANDS = [
  { intent: 'work',  words: ['上班', '干活', '打工', '搬砖', '加班', '工作', 'work', 'job'] },
  { intent: 'fish',  words: ['钓鱼', '摸鱼', '抓鱼', 'fish'] },
  { intent: 'eat',   words: ['吃饭', '吃东西', '干饭', '饿了', 'eat', 'food'] },
  { intent: 'drink', words: ['喝酒', '喝一杯', '喝点', '去酒馆', '酒吧', 'drink', 'beer'] },
  { intent: 'sleep', words: ['睡觉', '休息', '躺平', '回家睡', 'sleep', 'rest'] },
  { intent: 'dance', words: ['跳舞', '蹦迪', '跳舞机', 'dance'] },
  { intent: 'shop',  words: ['逛街', '买东西', '购物', 'shopping', 'buy'] },
  { intent: 'gym',   words: ['健身', '锻炼', '跑步', 'gym', 'run'] },
  { intent: 'study', words: ['上学', '读书', '学习', 'study', 'learn'] },
  { intent: 'fight', words: ['打一架', '切磋', '单挑', '决斗', '打他', '打架', 'fight', 'duel'] },
  { intent: 'chat',  words: ['聊天', '唠嗑', '聊会', 'chat', 'talk'] },
  { intent: 'home',  words: ['回家', '回家去', '回屋', 'go home'] },
  { intent: 'gate',  words: ['去城门', '出门', '去门口'] },
  { intent: 'park',  words: ['去公园', '散步', '逛逛'] },
  { intent: 'square', words: ['去广场', '广场'] }
];

// 礼物 → 效果。raw 是礼物原名（抖音/TikTok 名称差异很大），用关键词模糊匹配。
const GIFTS = [
  { key: 'rocket',   words: ['火箭', 'rocket', '跑车', 'car', '嘉年华', 'castle', '飞机', '游艇'], tier: 3, action: 'star',    coins: 60,  love: 30, label: '上头条' },
  { key: 'rose',     words: ['玫瑰', 'rose', '花', 'flower'],                                     tier: 2, action: 'love',    coins: 10,  love: 22, label: '心动' },
  { key: 'beer',     words: ['啤酒', 'beer', '酒'],                                               tier: 1, action: 'drink',   coins: 4,   love: 10, label: '干杯' },
  { key: 'lollipop', words: ['棒棒糖', 'lollipop', '糖', 'candy'],                                tier: 1, action: 'sweet',   coins: 4,   love: 10, label: '吃糖' },
  { key: 'heart',    words: ['小心心', '爱心', 'heart', '心'],                                    tier: 1, action: 'love',    coins: 3,   love: 12, label: '比心' },
  { key: 'other',    words: [],                                                                   tier: 1, action: 'dance',   coins: 5,   love: 8,  label: '收到礼物' }
];

// 段位：长期目标，让观众第二天还回来
export const RANKS = [
  { name: '路过的', exp: 0 }, { name: '街坊', exp: 12 }, { name: '熟客', exp: 30 },
  { name: '小店主', exp: 70 }, { name: '大老板', exp: 150 }, { name: '副镇长', exp: 300 },
  { name: '镇长', exp: 600 }
];

const HOME_SPOTS = [
  { x: 8, y: 10 }, { x: 22, y: 9 }, { x: 36, y: 11 }, { x: 64, y: 9 },
  { x: 78, y: 11 }, { x: 50, y: 20 }, { x: 6, y: 32 }, { x: 5, y: 68 },
  { x: 40, y: 70 }, { x: 56, y: 72 }, { x: 79, y: 52 }, { x: 81, y: 72 }
];

// 确定性随机（便于测试复现）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseCommand(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const s = raw.toLowerCase();
  for (const cmd of COMMANDS) {
    for (const word of cmd.words) {
      if (s.includes(word.toLowerCase())) return { intent: cmd.intent, word };
    }
  }
  return null;
}

export function matchGift(rawName) {
  const s = String(rawName ?? '').toLowerCase();
  for (const gift of GIFTS) {
    if (!gift.words.length) continue;
    for (const word of gift.words) {
      if (s.includes(String(word).toLowerCase())) return gift;
    }
  }
  return GIFTS[GIFTS.length - 1];
}

// 名字 → 稳定颜色 + 首字（拿不到头像时的兜底，思路同原项目的 fallbackAvatar）
export function nameColor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return `hsl(${h} 62% 52%)`;
}

export function rankOf(exp) {
  let rank = RANKS[0];
  for (const r of RANKS) if (exp >= r.exp) rank = r;
  return rank;
}

// 互动积分：点赞/评论/礼物加权。榜单和胜负都用它，而不是“谁刷得多”。
// 这样免费行为（点赞、评论）也真的能改变结果 —— 平台准入规则要求免费行为必须有效果。
export function interactionScore(r) {
  return Math.round((r.exp || 0) * 2 + (r.likes || 0) * 1 + (r.comments || 0) * 3 + (r.gifts || 0) * 4 + (r.love || 0) * 0.5);
}

// 抖音「直播小玩法」评论关键词上限是 10 个（官方 FAQ），这里正好导出这 10 个，
// 直接照抄到开放平台配置里；其余弹幕走通用反馈，不做指令。
export const COMMAND_KEYWORDS = ['上班', '钓鱼', '吃饭', '喝酒', '睡觉', '跳舞', '逛街', '健身', '上学', '打架'];

const GATE = PLACES.gate;

export class Town {
  // autoFill 默认关闭：平台准入规则明令「玩法内不允许任何形式的机器人，包括暖场假出怪」。
  // 只有本地演示（screen-recording / 单独 showcase）才应该打开它。
  constructor({ seed = 1, daySeconds = 600, maxResidents = 24, autoFill = false, startHour = 8 } = {}) {
    this.rng = mulberry32(seed);
    this.daySeconds = Math.max(60, daySeconds);   // 现实多少秒 = 小镇一天
    this.maxResidents = maxResidents;
    this.autoFill = autoFill;
    // 开播就从早上开始，第一眼是白天而不是半夜（24 小时直播时也一样）
    this.elapsed = (Math.max(0, Math.min(23.5, Number(startHour) || 0)) / 24) * this.daySeconds;
    this.day = 1;
    this.residents = new Map();
    this.log = [];
    this.effects = [];                             // 给渲染层的一次性特效
    this.energy = 0;                               // 点赞充能 0..100，满则触发全城事件
    this.weather = 'sun';
    this.weatherUntil = 0;
    this.headline = '';                            // 今日头条（大礼物）
    this.dayStats = this.#emptyDayStats();
    this.totalEvents = 0;
    this.lastRealEventAt = this.elapsed;            // 用于空闲自动补位
    this.order = 0;
    this.lastSettlement = '';
  }

  #emptyDayStats() {
    return { coins: 0, gifts: 0, likes: 0, comments: 0, joins: 0, topGift: { name: '', raw: '' } };
  }

  get hour() {
    const frac = (this.elapsed % this.daySeconds) / this.daySeconds;
    return frac * 24;
  }

  get isNight() {
    return this.hour < 6 || this.hour >= 22;
  }

  // ---- 观众入场 -----------------------------------------------------------
  addViewer({ name, avatar = '', auto = false } = {}) {
    const clean = String(name ?? '').trim().slice(0, 24);
    if (!clean) return null;
    if (this.residents.has(clean)) {
      const r = this.residents.get(clean);
      r.lastSeen = this.elapsed;
      if (avatar && !r.avatar) r.avatar = avatar;
      return r;
    }
    if (this.residents.size >= this.maxResidents) return null;
    const spot = HOME_SPOTS[this.residents.size % HOME_SPOTS.length];
    const r = {
      name: clean,
      avatar: String(avatar || ''),
      color: nameColor(clean),
      home: { x: spot.x + (this.rng() * 2 - 1), y: spot.y + (this.rng() * 2 - 1) },
      pos: { x: GATE.x + (this.rng() * 6 - 3), y: GATE.y + (this.rng() * 3) },
      target: null,
      state: 'arrive',
      stateUntil: 0,
      action: null,
      coins: 30,
      mood: 60,
      stamina: 80,
      exp: 0,
      gifts: 0,
      love: 0,
      auto: !!auto,
      joinedAt: this.elapsed,
      lastSeen: this.elapsed,
      lastCommandAt: -99,
      commands: 0,
      bubbleUntil: 0,
      title: '',
      wins: 0,
      likes: 0,
      comments: 0
    };
    this.residents.set(clean, r);
    this.dayStats.joins++;
    this.#push('join', `🏮 ${clean} 入住了小镇`, { name: clean });
    this.#fx('spawn', { name: clean });
    // 刚进门先走向自己的家
    this.#walkTo(r, r.home, 'idle');
    return r;
  }

  // ---- 直播事件入口（与 douyin-bridge 的 schema 对齐）-----------------------
  // ev: {type:'comment'|'like'|'gift'|'join'|'follow', name, avatar, text, count, gift, raw}
  feed(ev = {}) {
    const type = String(ev.type || '');
    const KNOWN = ['comment', 'like', 'gift', 'join', 'follow'];
    // 未知事件直接丢弃：绝不能凭空造出一个居民
    if (!KNOWN.includes(type)) return { accepted: false, log: [] };
    const name = String(ev.name || ev.nickname || '').slice(0, 24);
    if (!name) return { accepted: false, log: [] };

    if (type === 'comment' || type === 'like' || type === 'gift' || type === 'follow' || type === 'join') {
      this.lastRealEventAt = this.elapsed;
      this.totalEvents++;
    }

    let resident = this.residents.get(name);
    if (type === 'join' || type === 'follow') {
      resident = this.addViewer({ name, avatar: ev.avatar });
      if (resident) {
        resident.love += type === 'follow' ? 12 : 6;
        resident.mood = clamp(resident.mood + 8, 0, 100);
      }
      return { accepted: !!resident, log: this.log.slice(-1) };
    }
    if (!resident) resident = this.addViewer({ name, avatar: ev.avatar });
    if (!resident) return { accepted: false, log: [] };
    resident.lastSeen = this.elapsed;
    if (ev.avatar && !resident.avatar) resident.avatar = ev.avatar;

    if (type === 'comment') return this.#onComment(resident, ev);
    if (type === 'like') return this.#onLike(resident, ev);
    if (type === 'gift') return this.#onGift(resident, ev);
    return { accepted: false, log: [] };
  }

  #onComment(r, ev) {
    const text = String(ev.text ?? '').slice(0, 120);
    this.dayStats.comments++;
    r.comments++;
    // 防刷：同一人 4 秒内只执行一条指令，但依然算互动
    const cool = this.elapsed - r.lastCommandAt < 4;
    const cmd = parseCommand(text);
    if (!cmd) {
      r.mood = clamp(r.mood + 1, 0, 100);
      if (!cool) this.#say(r, '嗯？', 2.2);
      return { accepted: true, parsed: null, log: [] };
    }
    if (cool) return { accepted: true, parsed: cmd, throttled: true, log: [] };
    r.lastCommandAt = this.elapsed;
    r.commands++;
    r.mood = clamp(r.mood + 3, 0, 100);
    this.#applyIntent(r, cmd.intent, `弹幕·${cmd.word}`);
    return { accepted: true, parsed: cmd, log: this.log.slice(-1) };
  }

  #onLike(r, ev) {
    const n = Math.max(1, Math.min(100, Number(ev.count) || 1));
    this.dayStats.likes += n;
    r.likes += n;
    r.mood = clamp(r.mood + Math.min(6, n), 0, 100);
    r.stamina = clamp(r.stamina + Math.min(8, n), 0, 100);
    this.energy = Math.min(100, this.energy + n);
    if (this.energy >= 100) {
      this.energy = 0;
      this.#cityEvent();
    }
    return { accepted: true, log: [] };
  }

  #onGift(r, ev) {
    const gift = matchGift(ev.raw || ev.gift || '');
    const amount = Math.max(1, Math.min(100, Number(ev.count) || 1));
    const gain = gift.coins * amount;
    r.coins += gain;
    r.love += gift.love * amount;
    r.gifts += amount;
    r.mood = clamp(r.mood + 12, 0, 100);
    this.dayStats.gifts += amount;
    if (gain >= 60 || gift.tier >= 3) this.dayStats.topGift = { name: r.name, raw: String(ev.raw || ev.gift || '') };
    this.#push('gift', `🎁 ${r.name} 送出 ${amount} 个${ev.raw || ev.gift || '礼物'}`, { name: r.name });
    this.#fx('gift', { name: r.name, tier: gift.tier, color: r.color });
    this.#applyIntent(r, gift.action, `礼物·${gift.label}`);
    if (gift.tier >= 3) {
      this.headline = `${r.name} 送出${ev.raw || ev.gift}，全镇围观`;
      this.#fx('fireworks', { name: r.name });
      this.#push('headline', `🌟 头条：${this.headline}`, { name: r.name });
    }
    return { accepted: true, gift: gift.key, log: this.log.slice(-1) };
  }

  #applyIntent(r, intent, source) {
    const act = ACTIONS[intent];
    if (!act) return false;
    if (intent === 'fight') {
      const rival = this.#pickRival(r);
      this.#walkTo(r, PLACES.square, 'fight', { rival: rival?.name || '' });
    } else if (act.place === 'home') {
      this.#walkTo(r, r.home, 'sleep');
    } else if (!act.place) {
      this.#act(r, intent);
    } else {
      this.#walkTo(r, PLACES[act.place], intent);
    }
    this.#say(r, STATES[intent]?.emoji || '✨', 3);
    this.#push('action', `${r.name} ${source} · ${STATES[intent]?.label || intent}`, { name: r.name });
    return true;
  }

  #pickRival(r) {
    const others = [...this.residents.values()].filter((o) => o !== r);
    if (!others.length) return null;
    return others[Math.floor(this.rng() * others.length)];
  }

  // ---- 世界推进 -----------------------------------------------------------
  tick(dt = 0.1) {
    const step = Math.max(0, Math.min(1, dt));
    this.elapsed += step;

    // 天数结算
    const dayNow = Math.floor(this.elapsed / this.daySeconds) + 1;
    if (dayNow !== this.day) {
      this.#settleDay();
      this.day = dayNow;
      this.dayStats = this.#emptyDayStats();
    }

    // 天气
    if (this.elapsed > this.weatherUntil) this.#rollWeather();

    // 无人直播：一段时间没有真人消息，就补一个“自动邻居”，避免画面空转
    if (this.autoFill && this.elapsed - this.lastRealEventAt > 25) {
      const autos = [...this.residents.values()].filter((r) => r.auto).length;
      const reals = this.residents.size - autos;
      if (reals === 0 && autos < 5) {
        this.lastRealEventAt = this.elapsed - 15; // 5 秒后再补一个
        this.addViewer({ name: AUTO_NAMES[autos % AUTO_NAMES.length], auto: true });
      }
    }

    for (const r of this.residents.values()) this.#tickResident(r, step);
  }

  #tickResident(r, dt) {
    // 走向目标
    if (r.target) {
      const dx = r.target.x - r.pos.x;
      const dy = r.target.y - r.pos.y;
      const dist = Math.hypot(dx, dy);
      const speed = 11 * (r.stamina < 20 ? 0.6 : 1);   // 世界单位/秒
      if (dist <= speed * dt + 0.05) {
        r.pos.x = r.target.x;
        r.pos.y = r.target.y;
        r.target = null;
        this.#beginAction(r);
      } else {
        r.pos.x += (dx / dist) * speed * dt;
        r.pos.y += (dy / dist) * speed * dt;
        if (r.state !== 'walk' && r.state !== 'arrive') r.state = 'walk';
      }
      return;
    }
    // 动作进行中
    if (r.stateUntil > 0) {
      if (this.elapsed >= r.stateUntil) {
        this.#finishAction(r);
      }
      return;
    }
    // 空闲 → 自己找事做（无人值守的关键）
    if (this.elapsed >= (r.idleSince ?? 0) + 1.5) {
      r.idleSince = this.elapsed;
      this.#autoDecide(r);
    }
  }

  #beginAction(r) {
    const act = r.action;
    if (!act) {
      r.state = 'idle';
      r.idleSince = this.elapsed;
      return;
    }
    const def = ACTIONS[act.intent] || { seconds: 6 };
    r.state = act.intent;
    r.stateUntil = this.elapsed + def.seconds;
    if (def.stamina) r.stamina = clamp(r.stamina + def.stamina, 0, 100);
    if (act.intent === 'fight') this.#resolveFight(r, act.rival);
  }

  #finishAction(r) {
    const act = r.action || {};
    const def = ACTIONS[act.intent] || {};
    if (def.coins) r.coins = Math.max(0, r.coins + def.coins);
    if (def.exp) r.exp += def.exp;
    r.action = null;
    r.state = 'idle';
    r.stateUntil = 0;
    r.idleSince = this.elapsed;
    const before = rankOf(r.exp - (def.exp || 0)).name;
    const after = rankOf(r.exp).name;
    if (after !== before) {
      r.title = after;
      this.#push('rank', `🎖️ ${r.name} 晋升为「${after}」`, { name: r.name });
      this.#fx('rank', { name: r.name });
      this.#say(r, '🎖️', 3);
    }
  }

  // 切磋按“确定性”规则判定：互动积分高者赢，礼物只是固定加成。
  // 平台规则：礼物不得带来“数值随机”（只允许外观随机），所以这里绝不用随机数。
  #resolveFight(a, rivalName) {
    const b = rivalName ? this.residents.get(rivalName) : null;
    if (!b) {
      a.exp += 2;
      this.#push('fight', `⚔️ ${a.name} 在广场练了一套拳，经验 +2`, { name: a.name });
      this.#fx('fight', { x: PLACES.square.x, y: PLACES.square.y, name: a.name });
      return;
    }
    const winner = interactionScore(a) >= interactionScore(b) ? a : b;
    const loser = winner === a ? b : a;
    winner.wins++;
    winner.mood = clamp(winner.mood + 10, 0, 100);
    winner.exp += 4;
    loser.mood = clamp(loser.mood - 6, 0, 100);
    loser.coins = Math.max(0, loser.coins - 3);
    this.#push('fight', `⚔️ ${a.name} 和 ${b.name} 在广场切磋，${winner.name} 赢了（互动积分高者胜）`, { name: winner.name });
    this.#fx('fight', { x: PLACES.square.x, y: PLACES.square.y, name: winner.name });
  }

  // 无人时的自动行为：按作息时间选动作
  #autoDecide(r) {
    if (r.stamina < 22) return this.#walkTo(r, r.home, 'sleep');
    if (r.state !== 'idle' && r.state !== 'arrive') return;
    const h = this.hour;
    let intent;
    if (h < 6) intent = 'sleep';
    else if (h < 9) intent = this.rng() < 0.6 ? 'eat' : 'gym';
    else if (h < 12) intent = 'work';
    else if (h < 14) intent = 'eat';
    else if (h < 18) intent = this.rng() < 0.78 ? 'work' : 'fish';
    else if (h < 21) intent = pick(this.rng(), ['fish', 'shop', 'dance', 'chat', 'gym']);
    else if (h < 23) intent = this.rng() < 0.5 ? 'drink' : 'dance';
    else intent = 'sleep';
    this.#applyIntent(r, intent, '自动');
  }

  #walkTo(r, place, actionIntent, extra = {}) {
    r.target = { x: place.x + (this.rng() * 2 - 1), y: place.y + (this.rng() * 2 - 1) };
    r.action = { intent: actionIntent, place, ...extra };
    r.state = 'walk';
    r.stateUntil = 0;
    r.idleSince = 0;
  }

  #act(r, intent) {
    const def = ACTIONS[intent] || { seconds: 6 };
    r.state = intent;
    r.stateUntil = this.elapsed + def.seconds;
    r.action = null;
  }

  #settleDay() {
    const all = [...this.residents.values()];
    if (!all.length) { this.lastSettlement = ''; return; }
    const topCoins = [...all].sort((a, b) => b.coins - a.coins)[0];
    const topLove = [...all].sort((a, b) => b.love - a.love)[0];
    const topExp = [...all].sort((a, b) => b.exp - a.exp)[0];
    topCoins.title = '今日首富';
    topLove.title = '最佳街坊';
    topExp.title = '卷王';
    this.lastSettlement = `第 ${this.day} 天日报 · 首富 ${topCoins.name}（${Math.round(topCoins.coins)} 币）· 人气王 ${topLove.name} · 卷王 ${topExp.name}`;
    this.#push('day', `📰 ${this.lastSettlement}`, {});
    this.#fx('day', {});
  }

  #rollWeather() {
    const roll = this.rng();
    const h = this.hour;
    if (roll > 0.72) {
      this.weather = 'rain';
      this.#push('weather', '🌧️ 下雨了，街上的脚步声密了起来', {});
    } else {
      this.weather = h >= 19 || h < 6 ? 'night' : 'sun';
    }
    this.weatherUntil = this.elapsed + 120 + this.rng() * 240;
  }

  // 点赞充能满 → 全城事件（让“点赞”不是刷屏，而是公共进度条）
  #cityEvent() {
    const all = [...this.residents.values()];
    for (const r of all) r.mood = clamp(r.mood + 20, 0, 100);
    this.#push('city', '🎆 广场放烟花了！全城心情 +20', {});
    this.#fx('fireworks', { name: '小镇' });
    this.weather = 'night';
  }

  #say(r, emoji, seconds) {
    r.bubble = emoji;
    r.bubbleUntil = this.elapsed + seconds;
  }

  #push(kind, text, extra = {}) {
    this.log.push({ kind, text, at: this.elapsed, day: this.day, ...extra });
    if (this.log.length > 300) this.log.splice(0, this.log.length - 300);
  }

  #fx(kind, data) {
    this.effects.push({ kind, ...data, at: this.elapsed });
    if (this.effects.length > 60) this.effects.splice(0, this.effects.length - 60);
  }

  takeEffects() {
    return this.effects.splice(0, this.effects.length);
  }

  // ---- 渲染层 / 面板用的快照 ---------------------------------------------
  snapshot() {
    return {
      day: this.day,
      hour: this.hour,
      elapsed: this.elapsed,
      isNight: this.isNight,
      weather: this.weather,
      energy: this.energy,
      headline: this.headline,
      settlement: this.lastSettlement,
      totalEvents: this.totalEvents,
      stats: { ...this.dayStats, residents: this.residents.size },
      places: PLACES,
      residents: [...this.residents.values()].map((r) => ({
        name: r.name,
        avatar: r.avatar,
        color: r.color,
        x: r.pos.x,
        y: r.pos.y,
        home: { x: r.home.x, y: r.home.y },
        state: r.state,
        walking: !!r.target,
        emoji: r.bubbleUntil > this.elapsed ? r.bubble : null,
        coins: Math.round(r.coins),
        mood: Math.round(r.mood),
        stamina: Math.round(r.stamina),
        exp: r.exp,
        rank: rankOf(r.exp).name,
        title: r.title,
        auto: r.auto,
        gifts: r.gifts,
        likes: r.likes,
        comments: r.comments,
        score: interactionScore(r),
        love: r.love
      })),
      // 平台规则：榜单不能只算礼物、至少覆盖 TOP3，且必须纳入点赞/评论等互动指标。
      // 所以这里排的是「互动积分」，不是「收到多少礼物」。
      ranking: [...this.residents.values()]
        .sort((a, b) => interactionScore(b) - interactionScore(a))
        .slice(0, 5)
        .map((r) => ({ name: r.name, coins: Math.round(r.coins), score: interactionScore(r), rank: rankOf(r.exp).name, auto: r.auto })),
      log: this.log.slice(-40)
    };
  }

  // ---- 持久化（刷新/重启后分身还在）--------------------------------------
  save() {
    return {
      v: 1,
      day: this.day,
      savedAt: this.elapsed,
      residents: [...this.residents.values()].map((r) => ({
        name: r.name, avatar: r.avatar, coins: r.coins, exp: r.exp, love: r.love,
        gifts: r.gifts, title: r.title, home: r.home, wins: r.wins
      }))
    };
  }

  load(data, offlineSeconds = 0) {
    if (!data || !Array.isArray(data.residents)) return 0;
    let restored = 0;
    for (const saved of data.residents.slice(0, this.maxResidents)) {
      if (!saved?.name || this.residents.has(saved.name)) continue;
      const r = this.addViewer({ name: saved.name, avatar: saved.avatar });
      if (!r) continue;
      r.coins = Number(saved.coins) || 0;
      r.exp = Number(saved.exp) || 0;
      r.love = Number(saved.love) || 0;
      r.gifts = Number(saved.gifts) || 0;
      r.title = String(saved.title || '');
      r.wins = Number(saved.wins) || 0;
      if (saved.home) r.home = saved.home;
      // 离线收益：每小时 4 币，最多 8 小时（要回来领，才有理由再回来）
      const hours = Math.min(8, Math.max(0, offlineSeconds / 3600));
      r.coins += Math.round(hours * 4);
      restored++;
    }
    return restored;
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function pick(rand, list) {
  return list[Math.floor(rand * list.length) % list.length];
}

// 无人时的“自动邻居”名字（不伪装成真人：渲染层会标注“自动”）
export const AUTO_NAMES = ['阿福', '小满', '老陈', '阿桃', '铁蛋', '小舟', '阿吉', '七喜'];
