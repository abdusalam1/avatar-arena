// 头像大乱斗 · 事件来源（真实数据桥 + 显式的本地演示，不伪装成观众）
// 真实 schema 与 douyin-bridge.mjs 一致：
//   {type:'comment', name, text, avatar} / {type:'like', name, avatar, count}
//   {type:'gift', name, gift, raw, count, avatar} / {type:'join'|'follow', name, avatar}
//   {type:'hello'|'ping', room, people:[{name,avatar}], stats}

export const DEMO_NAMES = [
  '小鱼干', '橘子汽水', '早八人', '阿莫', '柠檬不酸', '打工人小周', '夜猫子', '一颗糖',
  '风里有诗', '老王隔壁', 'emo收容所', '不吃香菜', '半糖去冰', '猫猫头', '会飞的鱼',
  '爱睡觉的树', '小城故事', '八月长安', '刘忙忙', '大力出奇迹', '社恐本恐', '干饭王'
];

const CHAT = ['666', '哈哈哈', '这也太大了吧', '小的快跑', '刚来，怎么玩', '吃它！', '笑死',
  '我的头像在哪', '这局谁最大', '点赞能进场吗', '好家伙', '别吃我', '围观', '打卡'];

const GIFTS = [
  { raw: '小心心', gift: 'heart' }, { raw: '小心心', gift: 'heart' }, { raw: '小心心', gift: 'heart' },
  { raw: '啤酒', gift: 'beer' }, { raw: '棒棒糖', gift: 'lollipop' },
  { raw: '玫瑰', gift: 'other' }, { raw: '火箭', gift: 'other' }
];

function pick(list) { return list[Math.floor(Math.random() * list.length) % list.length]; }

export class DemoFeed {
  constructor(arena, { rate = 3.2, onEvent = null } = {}) {
    this.arena = arena;
    this.rate = rate;           // 平均每秒事件数（真实直播间峰值远高于此）
    this.acc = 0;
    this.onEvent = onEvent;
    this.quiet = false;
  }

  seedRoom() {
    for (let i = 0; i < 6; i++) this.arena.feed({ type: 'like', name: pick(DEMO_NAMES), count: 1 });
  }

  tick(dt) {
    if (this.quiet) return;
    this.acc += dt * this.rate;
    let guard = 0;
    while (this.acc >= 1 && guard++ < 8) {
      this.acc -= 1;
      this.#emitOne();
    }
  }

  #emitOne() {
    const roll = Math.random();
    const name = pick(DEMO_NAMES);
    let ev;
    if (roll < 0.34) {
      // 点赞：一次 1~12 个（真实直播间点赞是洪水）
      ev = { type: 'like', name, count: 1 + Math.floor(Math.random() * 12) };
    } else if (roll < 0.62) {
      ev = { type: 'comment', name, text: pick(CHAT) };
    } else if (roll < 0.76) {
      const g = pick(GIFTS);
      ev = { type: 'gift', name, raw: g.raw, gift: g.gift, count: Math.random() < 0.15 ? 2 : 1 };
    } else if (roll < 0.9) {
      ev = { type: 'join', name: pick(DEMO_NAMES) };
    } else {
      // 一个人连续点赞，把自己顶大（真实场景里“榜一大哥连点”就是这样）
      const fan = pick(DEMO_NAMES);
      ev = { type: 'like', name: fan, count: 10 };
    }
    try { this.onEvent?.(ev); } catch { /* UI 回调异常不影响模拟 */ }
    this.arena.feed(ev);
  }
}

// 真实数据桥：优先问 launch.py 的 /__bridge-status，失败则直连 8765
export function connectBridge({ onEvent, onStatus, onPeople, room = '' } = {}) {
  let socket = null, stopped = false, timer = null;
  let currentRoom = String(room || '').replace(/\D/g, '').slice(0, 25);
  const status = (s) => { try { onStatus?.(s); } catch { /* 忽略 */ } };

  // 和打印页面一样：告诉数据桥"现在该采哪个房间"，桥会跟着切房。
  // 不发这条，桥可能还在采上一个房间 → 页面显示已连接却一条弹幕都没有。
  function sendRoom(id) {
    const roomId = String(id || '').replace(/\D/g, '').slice(0, 25);
    if (!roomId) return;
    currentRoom = roomId;
    try {
      if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type: 'set-room', room: roomId }));
    } catch { /* 忽略发送失败 */ }
  }

  async function resolveUrl() {
    try {
      const res = await fetch('/__bridge-status', { signal: AbortSignal.timeout(4000) });
      const json = await res.json();
      if (json?.ok && json.url) return json.url;
    } catch { /* 用 python -m http.server 打开时没有这个接口 */ }
    return 'ws://127.0.0.1:8765';
  }

  async function connect() {
    if (stopped) return;
    const url = await resolveUrl();
    status({ state: 'connecting', url });
    try { socket = new WebSocket(url); } catch (e) { status({ state: 'offline' }); return schedule(); }
    socket.onopen = () => {
      status({ state: 'live', url });
      if (currentRoom) sendRoom(currentRoom);
    };
    socket.onmessage = (event) => {
      let msg; try { msg = JSON.parse(event.data); } catch { return; }
      if ((msg.type === 'hello' || msg.type === 'ping') && Array.isArray(msg.people)) {
        onPeople?.(msg.people);
        if (msg.type === 'ping' && msg.stats) onStatus?.({ state: 'live', stats: msg.stats, room: msg.room });
      }
      if (['comment', 'like', 'gift', 'join', 'follow'].includes(msg.type)) onEvent?.(msg);
    };
    socket.onclose = () => { status({ state: 'offline' }); schedule(); };
    socket.onerror = () => status({ state: 'error' });
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(connect, 3000); }

  connect();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      try { socket?.close(); } catch { /* 已关闭 */ }
    },
    // 手动重连：页面上「开始抓取」成功后立刻用，不用等 3 秒重试
    reconnect() {
      if (stopped) return;
      clearTimeout(timer);
      try { socket?.close(); } catch { /* 忽略 */ }
      connect();
    },
    // 房间号变了：立刻通知数据桥切房间
    setRoom(roomId) { sendRoom(roomId); }
  };
}
