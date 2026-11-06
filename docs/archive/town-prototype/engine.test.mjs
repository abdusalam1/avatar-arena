// 头像小镇引擎单测（node --test ideas/town/engine.test.mjs）
import test from 'node:test';
import assert from 'node:assert/strict';
import { Town, PLACES, parseCommand, matchGift, rankOf, nameColor, AUTO_NAMES, interactionScore, COMMAND_KEYWORDS } from './engine.mjs';

test('命令解析：中文 / 英文 / 无关文本', () => {
  assert.equal(parseCommand('去钓鱼吧').intent, 'fish');
  assert.equal(parseCommand('上班！').intent, 'work');
  assert.equal(parseCommand('go work').intent, 'work');
  assert.equal(parseCommand('666'), null);
  assert.equal(parseCommand(''), null);
  assert.equal(parseCommand(null), null);
});

test('礼物匹配：具体礼物优先，未知礼物落到 other', () => {
  assert.equal(matchGift('小心心').key, 'heart');
  assert.equal(matchGift('啤酒').key, 'beer');
  assert.equal(matchGift('棒棒糖').key, 'lollipop');
  assert.equal(matchGift('火箭').key, 'rocket');
  assert.equal(matchGift('Rocket').key, 'rocket');
  assert.equal(matchGift('某个没见过的礼物').key, 'other');
  assert.equal(matchGift(undefined).key, 'other');
});

test('出场即入住：头像/坐标/初始状态', () => {
  const town = new Town({ seed: 7, autoFill: false });
  const r = town.feed({ type: 'join', name: '小明', avatar: 'http://x/a.png' });
  assert.ok(r.accepted);
  const me = town.snapshot().residents.find((x) => x.name === '小明');
  assert.ok(me);
  assert.equal(me.avatar, 'http://x/a.png');
  assert.equal(me.color, nameColor('小明'));
  assert.ok(me.x > 0 && me.y > 0);
});

test('弹幕命令会改变动作（1 帧内可见）', () => {
  const town = new Town({ seed: 3, autoFill: false });
  town.feed({ type: 'join', name: '阿桃' });
  for (let i = 0; i < 10; i++) town.tick(0.1);
  const res = town.feed({ type: 'comment', name: '阿桃', text: '去钓鱼' });
  assert.equal(res.parsed.intent, 'fish');
  town.tick(0.1);
  const me = town.snapshot().residents.find((x) => x.name === '阿桃');
  // 已经在往河边走（目标点接近河边），或已经到位开始钓
  assert.ok(me.state === 'walk' || me.state === 'fish' || me.walking);
  const snapshotLog = town.snapshot().log.map((l) => l.text).join('\n');
  assert.match(snapshotLog, /钓鱼/);
});

test('同一观众 4 秒内只能下一条指令（防刷）', () => {
  const town = new Town({ seed: 5, autoFill: false });
  town.feed({ type: 'join', name: '刷屏哥' });
  town.tick(1);
  const first = town.feed({ type: 'comment', name: '刷屏哥', text: '上班' });
  town.tick(0.5);
  const second = town.feed({ type: 'comment', name: '刷屏哥', text: '钓鱼' });
  assert.equal(first.parsed.intent, 'work');
  assert.equal(second.throttled, true);
});

test('礼物：加币、加好感、触发动作、大礼物上头条', () => {
  const town = new Town({ seed: 11, autoFill: false });
  town.feed({ type: 'join', name: '榜一大哥' });
  const before = town.snapshot().residents.find((x) => x.name === '榜一大哥').coins;
  town.tick(1);
  town.feed({ type: 'gift', name: '榜一大哥', raw: '啤酒', gift: 'beer', count: 2 });
  let snap = town.snapshot();
  const after = snap.residents.find((x) => x.name === '榜一大哥');
  assert.equal(after.coins, before + 4 * 2);
  assert.ok(after.gifts === 2);
  town.feed({ type: 'gift', name: '榜一大哥', raw: '火箭', gift: 'other', count: 1 });
  snap = town.snapshot();
  assert.match(snap.headline, /火箭/);
  assert.equal(snap.log.at(-1).kind, 'headline');
  assert.ok(town.takeEffects().some((e) => e.kind === 'fireworks'));
});

test('点赞是公共进度条：充满触发全城事件', () => {
  const town = new Town({ seed: 2, autoFill: false });
  town.feed({ type: 'join', name: '点赞党' });
  town.tick(0.5);
  for (let i = 0; i < 10; i++) town.feed({ type: 'like', name: '点赞党', count: 10 });
  const snap = town.snapshot();
  assert.ok(snap.log.some((l) => l.kind === 'city'));
  assert.equal(snap.energy, 0);
  // 全城心情被抬起来
  assert.ok(snap.residents.every((r) => r.mood >= 80));
});

test('空场不造假：默认不补假观众（平台禁止机器人）', () => {
  const town = new Town({ seed: 9 });
  for (let i = 0; i < 400; i++) town.tick(0.1);   // 40 秒没人
  assert.equal(town.snapshot().residents.length, 0);
});

test('演示补位：只有显式 autoFill 才补“自动邻居”，且最多 5 个', () => {
  const town = new Town({ seed: 9, autoFill: true });
  for (let i = 0; i < 400; i++) town.tick(0.1); // 40 秒
  const autos = town.snapshot().residents.filter((r) => r.auto);
  assert.ok(autos.length >= 1 && autos.length <= 5, `auto=${autos.length}`);
  assert.ok(autos.every((r) => AUTO_NAMES.includes(r.name)));
});

test('互动积分：点赞/评论和礼物都算分，胜负不用随机数', () => {
  const town = new Town({ seed: 12, autoFill: false });
  town.feed({ type: 'join', name: '白嫖党' });
  town.feed({ type: 'join', name: '榜一大哥' });
  town.tick(1);
  for (let i = 0; i < 5; i++) town.feed({ type: 'like', name: '白嫖党', count: 10 });
  town.feed({ type: 'comment', name: '白嫖党', text: '666' });
  town.feed({ type: 'gift', name: '榜一大哥', raw: '啤酒', gift: 'beer', count: 1 });
  const snap = town.snapshot();
  const free = snap.residents.find((r) => r.name === '白嫖党');
  const paid = snap.residents.find((r) => r.name === '榜一大哥');
  assert.ok(free.score > 0 && paid.score > 0);
  // 免费互动能堆出比分，不只是付费才有效果
  assert.ok(free.score > paid.score, `free=${free.score} paid=${paid.score}`);
  assert.ok(snap.ranking.length > 0);
  // 同一局面跑两次，结果必须一致（确定性）
  const town2 = new Town({ seed: 12, autoFill: false });
  town2.feed({ type: 'join', name: '白嫖党' });
  town2.feed({ type: 'join', name: '榜一大哥' });
  town2.tick(1);
  for (let i = 0; i < 5; i++) town2.feed({ type: 'like', name: '白嫖党', count: 10 });
  town2.feed({ type: 'comment', name: '白嫖党', text: '666' });
  town2.feed({ type: 'gift', name: '榜一大哥', raw: '啤酒', gift: 'beer', count: 1 });
  assert.deepEqual(town2.snapshot().ranking, snap.ranking);
});

test('一天结束会结算日报与称号', () => {
  const town = new Town({ seed: 4, daySeconds: 60 });
  town.feed({ type: 'join', name: '甲' });
  town.feed({ type: 'join', name: '乙' });
  for (let i = 0; i < 700; i++) town.tick(0.1); // 70 秒 = 跨天
  const snap = town.snapshot();
  assert.ok(snap.day >= 2);
  assert.match(snap.settlement, /日报/);
  assert.ok(snap.log.some((l) => l.kind === 'day'));
});

test('往返持久化：分身、金币、段位保留，并带离线收益', () => {
  const town = new Town({ seed: 6, autoFill: false });
  town.feed({ type: 'join', name: '老观众' });
  town.tick(1);
  town.feed({ type: 'gift', name: '老观众', raw: '玫瑰', gift: 'heart', count: 1 });
  const saved = town.save();
  assert.equal(saved.residents.length, 1);

  const fresh = new Town({ seed: 6, autoFill: false });
  const n = fresh.load(saved, 3600); // 离线 1 小时
  assert.equal(n, 1);
  const me = fresh.snapshot().residents.find((r) => r.name === '老观众');
  assert.ok(me.coins >= saved.residents[0].coins + 4);
});

test('段位随经验推进', () => {
  assert.equal(rankOf(0).name, '路过的');
  assert.equal(rankOf(70).name, '小店主');
  assert.equal(rankOf(9999).name, '镇长');
});

test('容错：缺名字/未知事件类型不炸，也不产生假居民', () => {
  const town = new Town({ seed: 1, autoFill: false });
  assert.equal(town.feed({ type: 'gift' }).accepted, false);
  assert.equal(town.feed({ type: 'wat', name: 'x' }).accepted, false);
  assert.equal(town.residents.size, 0);
  assert.ok(PLACES.river.x > 0);
});
