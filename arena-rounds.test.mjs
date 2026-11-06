// 局 / 称号 / 王者墙 单测（node --test arena-rounds.test.mjs）
import test from 'node:test';
import assert from 'node:assert/strict';
import { RoundManager, TITLES, ROUND_DEFAULTS } from './arena-rounds.mjs';

const fakeStore = () => {
  let value = null;
  return { read: () => value, write: (v) => { value = v; }, peek: () => value };
};

const snapOf = (list) => ({ alive: list.map(([name, mass]) => ({ name, mass })) });

test('局内计时：没到时间不结算，到了就结算并开下一局', () => {
  const rm = new RoundManager({ roundSeconds: 60 });
  rm.start(1000);
  assert.equal(rm.round, 1);
  assert.equal(rm.tick(30_000, snapOf([['甲', 500]])), null);
  assert.ok(rm.remaining(30_000) > 0);
  const result = rm.tick(62_000, snapOf([['甲', 900], ['乙', 300]]));
  assert.ok(result);
  assert.equal(result.round, 1);
  assert.equal(result.winner.name, '甲');
  assert.equal(rm.round, 2);
});

test('结算给出王者 / 巨物 / 首杀 / 连吃王', () => {
  const rm = new RoundManager({ roundSeconds: 60, comboKills: 3 });
  rm.start(0);
  rm.observe({ kind: 'eat', predator: '甲', prey: '乙' });
  rm.observe({ kind: 'eat', predator: '甲', prey: '丙' });
  rm.observe({ kind: 'eat', predator: '甲', prey: '丁' });
  const result = rm.settle(snapOf([['甲', 1200], ['戊', 200]]), 60_000);
  const keys = new Set(result.titles.map((t) => t.key));
  assert.ok(keys.has('king'));
  assert.ok(keys.has('giant'));
  assert.ok(keys.has('firstBlood'));
  assert.ok(keys.has('combo'));
  const king = result.titles.find((t) => t.key === 'king');
  assert.equal(king.name, '甲');
});

test('复仇：吃掉曾经吃过自己的人会拿「复仇成功」', () => {
  const rm = new RoundManager({ roundSeconds: 60 });
  rm.start(0);
  rm.observe({ kind: 'eat', predator: '恶霸', prey: '小豆丁' });
  rm.observe({ kind: 'eat', predator: '小豆丁', prey: '恶霸' });
  const result = rm.settle(snapOf([['小豆丁', 900]]), 60_000);
  assert.ok(result.titles.some((t) => t.key === 'revenge' && t.name === '小豆丁'));
});

test('王者墙写盘并能读回，最多保留 hallMax 条', () => {
  const store = fakeStore();
  const rm = new RoundManager({ roundSeconds: 10, hallMax: 3, storage: store });
  rm.start(0);
  for (let i = 0; i < 5; i++) {
    rm.settle(snapOf([[`王者${i}`, 500 + i]]), 10_000 * (i + 1));
  }
  assert.ok(store.peek());
  assert.equal(store.peek().hall.length, 3);
  const again = new RoundManager({ roundSeconds: 10, storage: store });
  again.start(0);
  assert.equal(again.hall.length, 3);
  assert.equal(again.hall[0].name, '王者4');
});

test('王者墙容忍脏数据（手改 localStorage 也不炸）', () => {
  const rm = new RoundManager({
    roundSeconds: 10,
    storage: { read: () => ({ hall: [{ name: 123 }, null, { name: 'ok', mass: 'x', titles: ['king', '不存在的称号'] }] }), write() {} }
  });
  rm.start(0);
  assert.equal(rm.hall.length, 1);
  assert.equal(rm.hall[0].name, 'ok');
  assert.deepEqual(rm.hall[0].titles, ['king']);
  assert.equal(rm.hall[0].mass, 0);
});

test('没有真人时结算不崩，也不产生假王者', () => {
  const rm = new RoundManager({ roundSeconds: 10 });
  rm.start(0);
  const result = rm.settle(snapOf([]), 10_000);
  assert.equal(result.winner, null);
  assert.equal(result.titles.length, 0);
  assert.equal(rm.hall.length, 0);
});

test('称号表里每个键都有中英标签', () => {
  for (const [key, label] of Object.entries(TITLES)) {
    assert.ok(label.zh && label.en, key + ' 缺标签');
  }
  assert.ok(ROUND_DEFAULTS.roundSeconds > 0);
});
