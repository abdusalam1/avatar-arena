// 头像大乱斗引擎单测（node --test ideas/arena/engine.test.mjs）
import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, WORLD, BASE_MASS, radiusOf, giftKeyOf, hueOf, maxMassOf, DEFAULTS } from './arena-engine.mjs';

const fresh = (opts = {}) => new Arena({ seed: 7, smarts: 0, ...opts });

test('速度设置：基础移动速度可调，速度高就跑得远', () => {
  const travel = (speed) => {
    const a = new Arena({ seed: 5, smarts: 0, speed, hypeBoost: 0 });
    a.feed({ type: 'like', name: '甲' });
    const me = a.avatars.get('甲');
    const x0 = me.x, y0 = me.y;
    for (let i = 0; i < 60; i++) a.tick(1 / 60);   // 跑 1 秒
    return Math.hypot(me.x - x0, me.y - y0);
  };
  const slow = travel(60);
  const fast = travel(240);
  assert.ok(slow > 0, '慢速也应该在动');
  assert.ok(fast > slow * 2, `fast=${fast.toFixed(1)} slow=${slow.toFixed(1)}`);
});

test('互动越多节奏越快，停手后平滑回落', () => {
  const a = new Arena({ seed: 3, smarts: 0 });
  a.feed({ type: 'like', name: '甲' });
  for (let i = 0; i < 120; i++) a.feed({ type: 'like', name: '甲', count: 1 });   // 一瞬间灌满热度
  for (let i = 0; i < 120; i++) a.tick(1 / 60);   // 2 秒
  const hot = a.snapshot();
  assert.ok(hot.heat > 0.8, `heat=${hot.heat}`);
  assert.ok(hot.pace > 1.2, `pace=${hot.pace}`);
  assert.ok(hot.pace <= 1 + DEFAULTS.hypeBoost + 0.01, '节奏不应超过上限');
  for (let i = 0; i < 900; i++) a.tick(1 / 60);   // 静默 15 秒
  const cold = a.snapshot();
  assert.ok(cold.pace < 1.05, `pace 应回落，实际 ${cold.pace}`);
});

test('hypeBoost=0 时可以完全关掉互动加速', () => {
  const a = new Arena({ seed: 3, smarts: 0, hypeBoost: 0 });
  a.feed({ type: 'like', name: '甲' });
  for (let i = 0; i < 200; i++) a.feed({ type: 'like', name: '甲', count: 1 });
  for (let i = 0; i < 120; i++) a.tick(1 / 60);
  assert.ok(Math.abs(a.snapshot().pace - 1) < 0.02, `pace=${a.snapshot().pace}`);
});



test('贴墙会弹开：塞进角落也能自己出来', () => {
  const a = new Arena({ seed: 2, smarts: 0, hypeBoost: 0 });
  a.feed({ type: 'like', name: '角落' });
  const me = a.avatars.get('角落');
  const r = radiusOf(me.mass);
  me.x = r + 0.5; me.y = r + 0.5; me.vx = 0; me.vy = 0; me.angle = Math.PI * 1.25; // 正对角落
  for (let i = 0; i < 240; i++) a.tick(1 / 60);   // 4 秒
  const gap = Math.hypot(me.x - r, me.y - r);
  assert.ok(gap > 150, `4 秒后仍离角落太近: ${gap.toFixed(0)}`);
});

test('靠墙不会黏住：沿墙滑行并离开墙面', () => {
  const a = new Arena({ seed: 4, smarts: 0, hypeBoost: 0 });
  a.feed({ type: 'like', name: '贴墙' });
  const me = a.avatars.get('贴墙');
  const r = radiusOf(me.mass);
  me.x = r; me.y = WORLD.h / 2; me.vx = -200; me.vy = 0; a.tick(1 / 60);
  for (let i = 0; i < 120; i++) a.tick(1 / 60);   // 2 秒
  assert.ok(me.x > r + 40, `贴墙后没有离开墙面: x=${me.x.toFixed(0)} r=${r.toFixed(0)}`);
  assert.ok(me.x >= r - 0.001 && me.x <= WORLD.w - r + 0.001, '不能越界');
});

test('一堆头像挤在角落也会散开，不会堆死', () => {
  const a = new Arena({ seed: 6, smarts: 0, hypeBoost: 0 });
  for (let i = 0; i < 8; i++) a.feed({ type: 'like', name: '挤' + i });
  const r = radiusOf(BASE_MASS);
  for (const me of a.avatars.values()) {
    me.x = r + 4 + Math.random() * 20;
    me.y = r + 4 + Math.random() * 20;
    me.vx = 0; me.vy = 0;
  }
  for (let i = 0; i < 360; i++) a.tick(1 / 60);   // 6 秒
  const gaps = [...a.avatars.values()].map((me) => Math.hypot(me.x - r, me.y - r));
  const avg = gaps.reduce((s, v) => s + v, 0) / gaps.length;
  assert.ok(avg > 120, `平均离角落只有 ${avg.toFixed(0)}`);
  for (const me of a.avatars.values()) {
    assert.ok(me.x >= r - 0.5 && me.x <= WORLD.w - r + 0.5);
    assert.ok(me.y >= r - 0.5 && me.y <= WORLD.h - r + 0.5);
  }
});

test('半径随质量单调增长', () => {
  assert.ok(radiusOf(BASE_MASS) > 0);
  assert.ok(radiusOf(BASE_MASS * 4) > radiusOf(BASE_MASS));
  assert.ok(radiusOf(BASE_MASS * 25) > radiusOf(BASE_MASS * 4));
});

test('礼物分档：火箭 > 玫瑰 > 啤酒 > 小心心 > 未知', () => {
  assert.equal(giftKeyOf('火箭'), 'rocket');
  assert.equal(giftKeyOf('Rose'), 'rose');
  assert.equal(giftKeyOf('啤酒'), 'beer');
  assert.equal(giftKeyOf('小心心'), 'heart');
  assert.equal(giftKeyOf('没见过的礼物'), 'other');
  assert.ok(DEFAULTS.giftMass.rocket > DEFAULTS.giftMass.rose);
  assert.ok(DEFAULTS.giftMass.rose > DEFAULTS.giftMass.beer);
  assert.ok(DEFAULTS.giftMass.beer > DEFAULTS.giftMass.heart);
});

test('点赞让新观众进地图（免费行为也能玩）', () => {
  const a = fresh();
  const res = a.feed({ type: 'like', name: '路人甲', count: 3 });
  assert.ok(res.accepted);
  const snap = a.snapshot();
  assert.equal(snap.alive.length, 1);
  assert.equal(snap.alive[0].name, '路人甲');
  assert.ok(snap.alive[0].mass > BASE_MASS);
});

test('评论“稍微变大”，并有冷却防刷', () => {
  const a = fresh();
  a.feed({ type: 'like', name: '话痨' });
  const before = a.snapshot().alive[0].mass;
  a.feed({ type: 'comment', name: '话痨', text: '666' });
  const after = a.snapshot().alive[0].mass;
  assert.equal(after, before + DEFAULTS.commentMass);
  // 冷却内不再增长
  a.feed({ type: 'comment', name: '话痨', text: '666' });
  assert.equal(a.snapshot().alive[0].mass, after);
});

test('礼物比评论涨得多（礼物只是“更快”）', () => {
  const a = fresh();
  a.feed({ type: 'like', name: '土豪' });
  const base = a.snapshot().alive[0].mass;
  a.feed({ type: 'gift', name: '土豪', raw: '玫瑰', gift: 'other', count: 1 });
  const afterGift = a.snapshot().alive[0].mass - base;
  assert.equal(afterGift, DEFAULTS.giftMass.rose);
  assert.ok(afterGift > DEFAULTS.commentMass);
});

test('大吃小：被吃的出局，赢家变大但只吸收一部分（防滚雪球）', () => {
  const a = fresh();
  a.feed({ type: 'like', name: '大块头' });
  a.feed({ type: 'like', name: '小豆丁' });
  const big = a.avatars.get('大块头');
  const small = a.avatars.get('小豆丁');
  big.mass = BASE_MASS * 9;
  small.mass = BASE_MASS;
  big.x = 800; big.y = 450; big.vx = 0; big.vy = 0;
  small.x = 802; small.y = 451; small.vx = 0; small.vy = 0;
  const before = big.mass;
  a.tick(1 / 60);
  assert.equal(small.alive, false);
  assert.equal(small.killedBy, '大块头');
  const gained = big.mass - before;
  assert.ok(gained > 0);
  // 只吸收 62%，而且大号开始衰减 → 增长小于被吃者总量
  assert.ok(gained < BASE_MASS * DEFAULTS.eatGain + 1, `gained=${gained}`);
  assert.ok(a.snapshot().log.some((l) => l.kind === 'eat'));
});

test('同级相碰弹开，不会互相吃掉', () => {
  const a = fresh();
  a.feed({ type: 'like', name: '甲' });
  a.feed({ type: 'like', name: '乙' });
  const x = a.avatars.get('甲'), y = a.avatars.get('乙');
  x.mass = y.mass = BASE_MASS * 2;
  x.x = 800; x.y = 450; x.vx = 60; x.vy = 0;
  y.x = 820; y.y = 450; y.vx = -60; y.vy = 0;
  a.tick(1 / 60);
  assert.equal(x.alive, true);
  assert.equal(y.alive, true);
  const dist = Math.hypot(x.x - y.x, x.y - y.y);
  assert.ok(dist > 0.1);
  assert.equal(a.snapshot().stats.eats, 0);
});

test('大号会自然衰减，质量有上限', () => {
  const a = fresh();
  a.feed({ type: 'like', name: '巨无霸' });
  const big = a.avatars.get('巨无霸');
  big.mass = BASE_MASS * 20;
  const before = big.mass;
  for (let i = 0; i < 60; i++) a.tick(1 / 60);   // 1 秒
  assert.ok(big.mass < before, '大号应该慢慢缩水');
  // 上限
  for (let i = 0; i < 200; i++) a.feed({ type: 'gift', name: '巨无霸', raw: '火箭', gift: 'other', count: 50 });
  assert.ok(big.mass <= maxMassOf(DEFAULTS));
});

test('衰减会一路压到 200，不会停在 300', () => {
  // 回归：旧逻辑在 mass 掉回 decayFrom(300) 时就退出衰减，导致大号永远卡在 300
  const a = fresh();
  a.feed({ type: 'like', name: '大号' });
  const big = a.avatars.get('大号');
  big.mass = 1000;
  for (let i = 0; i < 60 * 320; i++) a.tick(1 / 60);   // 320 秒
  assert.ok(big.mass <= 205, `应该压到 200 附近，实际 ${big.mass.toFixed(1)}`);
  assert.ok(big.mass >= 199.9, `不应该低于下限，实际 ${big.mass.toFixed(1)}`);
});

test('衰减下限可配置（decayTo），并且不会越过它', () => {
  const a = fresh({ decayTo: 1.5 });
  a.feed({ type: 'like', name: '大号' });
  const big = a.avatars.get('大号');
  big.mass = 600;
  for (let i = 0; i < 60 * 400; i++) a.tick(1 / 60);
  assert.ok(Math.abs(big.mass - 150) < 0.5, `期望 150，实际 ${big.mass.toFixed(1)}`);
});

test('清屏：一键移除所有头像，之后还能重新进场', () => {
  const a = fresh();
  for (const name of ['甲', '乙', '丙']) a.feed({ type: 'like', name });
  assert.equal(a.snapshot().alive.length, 3);
  assert.equal(a.clear(), 3);
  assert.equal(a.snapshot().alive.length, 0);
  assert.equal(a.snapshot().king, '');
  assert.equal(a.snapshot().pace, 1);
  // 清屏不应影响统计/王者墙
  assert.ok(a.snapshot().log.some((line) => line.kind === 'clear'));
  // 之后新互动照常进场
  a.feed({ type: 'like', name: '新人' });
  assert.equal(a.snapshot().alive.length, 1);
});

test('人数上限：满了不再进场，但老玩家还能变大', () => {
  const a = fresh({ maxAlive: 5 });
  for (let i = 0; i < 5; i++) a.feed({ type: 'like', name: '玩家' + i });
  const res = a.feed({ type: 'like', name: '挤不进来' });
  assert.equal(res.accepted, false);
  assert.equal(a.snapshot().alive.length, 5);
  const again = a.feed({ type: 'like', name: '玩家0', count: 5 });
  assert.ok(again.accepted);
});

test('被吃掉后还能复活（死亡不是终点）', () => {
  const a = fresh({ reviveCooldownMs: 0 });
  a.feed({ type: 'like', name: '倒霉蛋' });
  a.feed({ type: 'like', name: '恶霸' });
  const prey = a.avatars.get('倒霉蛋'), pred = a.avatars.get('恶霸');
  pred.mass = BASE_MASS * 9;
  prey.mass = BASE_MASS;
  pred.x = 500; pred.y = 500; pred.vx = 0; prey.x = 502; prey.y = 500; prey.vx = 0;
  a.tick(1 / 60);
  assert.equal(prey.alive, false);
  a.feed({ type: 'comment', name: '倒霉蛋', text: '我不服' });
  assert.equal(prey.alive, true);
  // 复活回到基础体型，这次互动本身也会再给它一点质量
  assert.ok(prey.mass >= BASE_MASS && prey.mass <= BASE_MASS + DEFAULTS.commentMass);
});

test('空场不造假：没人就没有头像', () => {
  const a = fresh();
  for (let i = 0; i < 300; i++) a.tick(1 / 60);
  assert.equal(a.snapshot().alive.length, 0);
  assert.equal(a.snapshot().stats.joins, 0);
});

test('王者与榜单', () => {
  const a = fresh();
  a.feed({ type: 'like', name: '小明' });
  a.feed({ type: 'like', name: '大力' });
  a.avatars.get('大力').mass = BASE_MASS * 6;
  a.tick(1 / 60);
  const snap = a.snapshot();
  assert.equal(snap.king, '大力');
  assert.equal(snap.ranking[0].name, '大力');
  assert.ok(snap.ranking.length >= 1);
});

test('头像缺失也不崩，名字决定兜底色', () => {
  const a = fresh();
  a.feed({ type: 'join', name: '没头像', avatar: '' });
  const snap = a.snapshot();
  assert.equal(snap.alive[0].avatar, '');
  assert.equal(typeof snap.alive[0].hue, 'number');
  assert.equal(hueOf('没头像'), snap.alive[0].hue);
});

test('位置始终在世界内', () => {
  const a = fresh();
  for (let i = 0; i < 12; i++) a.feed({ type: 'like', name: '浪' + i });
  for (let i = 0; i < 600; i++) a.tick(1 / 60);
  for (const av of a.snapshot().alive) {
    assert.ok(av.x >= av.r - 1 && av.x <= WORLD.w - av.r + 1, `x=${av.x} r=${av.r}`);
    assert.ok(av.y >= av.r - 1 && av.y <= WORLD.h - av.r + 1, `y=${av.y} r=${av.r}`);
  }
});
