// 头像小镇 · 事件来源
// 一个文件里放两件事：
//   1) DemoFeed —— 本地模拟直播间，冷启动时也有热闹画面（也方便演示/录屏）
//   2) connectBridge —— 接真实的 douyin-bridge WebSocket（事件 schema 与原项目一致）
//
// 真实 schema（见 douyin-bridge.mjs）：
//   {type:'comment', name, text, avatar}
//   {type:'like',    name, avatar, count}
//   {type:'gift',    name, gift, raw, count, avatar}
//   {type:'join'|'follow', name, avatar}
//   {type:'hello',   room, people:[{name,avatar}]}
//   {type:'ping',    room, ts, people, stats}
//   {type:'room',    room}

export const DEMO_NAMES = [
  '小鱼干', '橘子汽水', '今天也要早睡', '阿莫', '柠檬不酸', '打工人小周', '夜猫子',
  '一颗糖', '风里有诗', '老王隔壁', 'emo收容所', '早八人', '不吃香菜', '半糖去冰',
  '猫猫头', '会飞的鱼', '爱睡觉的树', '小城故事', '八月长安', '刘忙忙'
];

const COMMAND_LINES = [
  '去钓鱼', '上班去', '快去上班', '吃饭了吗', '去吃饭', '睡觉去吧', '回家睡觉',
  '跳舞！', '跳个舞', '去广场', '去公园散步', '逛街去', '喝一杯', '去酒馆',
  '健身去', '去上学', '读书去', '打一架', '切磋一下', '聊聊天', '回家'
];

const CHAT_LINES = [
  '666', '哈哈哈哈', '这小镇也太真实了', '主播不在吗', '无人直播？', '好可爱',
  '我的头像是哪个', '打卡', '来了来了', '这 AI 自己会玩啊', '笑死',
  '围观', '刚下班', '这画风我喜欢', '关注了', '第一次来', '在上班摸鱼看'
];

const GIFT_POOL = [
  { raw: '小心心', gift: 'heart' }, { raw: '小心心', gift: 'heart' }, { raw: '小心心', gift: 'heart' },
  { raw: '啤酒', gift: 'beer' }, { raw: '棒棒糖', gift: 'lollipop' },
  { raw: '玫瑰', gift: 'other' }, { raw: '火箭', gift: 'other' }
];

function pick(list, rand = Math.random) {
  return list[Math.floor(rand() * list.length) % list.length];
}

export class DemoFeed {
  constructor(town, { seed = Date.now() % 100000, rate = 1.6, onEvent = null } = {}) {
    this.town = town;
    this.rate = rate;              // 平均每秒事件数
    this.acc = 0;
    this.seed = seed;
    this.onEvent = onEvent;        // 把模拟事件同步到页面的「直播事件」面板
    this.names = [...DEMO_NAMES];
    this.quiet = false;
  }

  // 演示模式也要“像直播间”：先来一批观众，避免开局空场
  seedRoom() {
    for (let i = 0; i < 3; i++) this.town.feed({ type: 'join', name: pick(this.names) });
  }

  tick(dt) {
    if (this.quiet) return;
    this.acc += dt * this.rate;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.#emitOne();
    }
  }

  #emitOne() {
    const roll = Math.random();
    const name = pick(this.names);
    let ev;
    // 12% 概率是全新观众进场
    if (roll < 0.12) {
      ev = { type: 'join', name: pick(this.names) };
    } else if (roll < 0.40) {
      ev = { type: 'like', name, count: 1 + Math.floor(Math.random() * 8) };
    } else if (roll < 0.52) {
      const gift = pick(GIFT_POOL);
      ev = { type: 'gift', name, raw: gift.raw, gift: gift.gift, count: Math.random() < 0.2 ? 2 : 1 };
    } else {
      // 剩下是弹幕：一半是指令，一半是闲聊
      ev = { type: 'comment', name, text: Math.random() < 0.55 ? pick(COMMAND_LINES) : pick(CHAT_LINES) };
    }
    try { this.onEvent?.(ev); } catch { /* UI 回调异常不影响模拟 */ }
    this.town.feed(ev);
  }
}

// 接真实数据桥：优先问 launch.py 的 /__bridge-status，失败则直连 8765
export function connectBridge({ onEvent, onStatus, onPeople, url } = {}) {
  let socket = null;
  let stopped = false;
  let timer = null;

  const status = (s) => { try { onStatus?.(s); } catch { /* 忽略 UI 回调异常 */ } };

  async function resolveUrl() {
    if (url) return url;
    try {
      const res = await fetch('/__bridge-status', { signal: AbortSignal.timeout(4000) });
      const json = await res.json();
      if (json?.ok && json.url) return json.url;
    } catch { /* 直接用 python -m http.server 打开时没有这个接口，退化为直连 */ }
    return 'ws://127.0.0.1:8765';
  }

  async function connect() {
    if (stopped) return;
    const address = await resolveUrl();
    status({ state: 'connecting', url: address });
    try {
      socket = new WebSocket(address);
    } catch (error) {
      status({ state: 'offline', error: String(error) });
      schedule();
      return;
    }
    socket.onopen = () => status({ state: 'live', url: address });
    socket.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      // 房间快照：把已经出现过、带头像的观众预热进小镇
      if ((msg.type === 'hello' || msg.type === 'ping') && Array.isArray(msg.people)) {
        onPeople?.(msg.people);
        if (msg.type === 'ping' && msg.stats) onStatus?.({ state: 'live', stats: msg.stats, room: msg.room });
      }
      if (['comment', 'like', 'gift', 'join', 'follow'].includes(msg.type)) onEvent?.(msg);
    };
    socket.onclose = () => {
      status({ state: 'offline' });
      schedule();
    };
    socket.onerror = () => status({ state: 'error' });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(connect, 3000);
  }

  connect();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      try { socket?.close(); } catch { /* 已关闭 */ }
    }
  };
}
