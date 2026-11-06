// 设置校验 / i18n 单测（node --test arena-settings.test.mjs）
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_DEFAULTS, sanitizeArenaSettings, serializeArenaSettings, applyArenaSettings } from './arena-settings.mjs';
import { t, STRINGS } from './arena-i18n.mjs';
import { Arena } from './arena-engine.mjs';
import { RoundManager } from './arena-rounds.mjs';

test('空数据回落到默认值', () => {
  assert.deepEqual(sanitizeArenaSettings(null), ARENA_DEFAULTS);
  assert.deepEqual(sanitizeArenaSettings(undefined), ARENA_DEFAULTS);
  assert.deepEqual(sanitizeArenaSettings('坏的'), ARENA_DEFAULTS);
});

test('越界参数被夹回合法区间（手改 localStorage 也不会把游戏搞坏）', () => {
  const s = sanitizeArenaSettings({ maxAlive: 9999, eatGain: 5, decayPerSec: -1, smarts: 9, roundMinutes: 0 });
  assert.equal(s.maxAlive, 120);
  assert.equal(s.eatGain, 1);
  assert.equal(s.decayPerSec, 0);
  assert.equal(s.smarts, 1);
  assert.equal(s.roundMinutes, 1);
});

test('非数字 / 乱码参数回落到默认值', () => {
  const s = sanitizeArenaSettings({ maxAlive: 'abc', eatGain: NaN, decayPerSec: {}, smarts: 'x' });
  assert.equal(s.maxAlive, ARENA_DEFAULTS.maxAlive);
  assert.equal(s.eatGain, ARENA_DEFAULTS.eatGain);
  assert.equal(s.decayPerSec, ARENA_DEFAULTS.decayPerSec);
  assert.equal(s.smarts, ARENA_DEFAULTS.smarts);
});

test('语言只接受 zh / en', () => {
  assert.equal(sanitizeArenaSettings({ lang: 'en' }).lang, 'en');
  assert.equal(sanitizeArenaSettings({ lang: 'fr' }).lang, 'zh');
  assert.equal(sanitizeArenaSettings({ lang: 'EN' }).lang, 'zh');
});

test('布尔开关可关不可乱', () => {
  const s = sanitizeArenaSettings({ voice: false, demo: false, portrait: true });
  assert.equal(s.voice, false);
  assert.equal(s.demo, false);
  assert.equal(s.portrait, true);
  assert.equal(sanitizeArenaSettings({ voice: 'no' }).voice, true);
});

test('序列化往返一致', () => {
  const s = sanitizeArenaSettings({ maxAlive: 44, smarts: 0.3, lang: 'en' });
  const back = sanitizeArenaSettings(JSON.parse(serializeArenaSettings(s)));
  assert.deepEqual(back, s);
});

test('设置能落到引擎和局管理器上', () => {
  const arena = new Arena({ seed: 1 });
  const rounds = new RoundManager({ roundSeconds: 60 });
  const s = sanitizeArenaSettings({ maxAlive: 42, eatGain: 0.5, decayPerSec: 0.01, smarts: 0.2, roundMinutes: 3, speed: 200, hypeBoost: 1.4 });
  applyArenaSettings(s, arena, rounds);
  assert.equal(arena.cfg.maxAlive, 42);
  assert.equal(arena.cfg.eatGain, 0.5);
  assert.equal(arena.cfg.decayPerSec, 0.01);
  assert.equal(arena.cfg.smarts, 0.2);
  assert.equal(arena.cfg.speed, 200);
  assert.equal(arena.cfg.hypeBoost, 1.4);
  assert.equal(rounds.cfg.roundSeconds, 180);
});

test('移动速度与互动加速也在合法区间内被夹住', () => {
  const tooFast = sanitizeArenaSettings({ speed: 9999, hypeBoost: 99 });
  assert.equal(tooFast.speed, 260);
  assert.equal(tooFast.hypeBoost, 2);
  const tooSlow = sanitizeArenaSettings({ speed: 1, hypeBoost: -5 });
  assert.equal(tooSlow.speed, 40);
  assert.equal(tooSlow.hypeBoost, 0);
  assert.equal(sanitizeArenaSettings({}).speed, ARENA_DEFAULTS.speed);
  assert.equal(sanitizeArenaSettings({}).hypeBoost, ARENA_DEFAULTS.hypeBoost);
});

test('文案：变量替换与缺键回落', () => {
  assert.match(t('zh', 'toast.welcome', { name: '小明' }), /小明/);
  assert.match(t('en', 'toast.welcome', { name: 'Amy' }), /Amy/);
  assert.equal(t('zh', '不存在的键'), '不存在的键');
  assert.equal(t('fr', 'app.title'), STRINGS.zh['app.title']);
  // 缺变量时保留占位符，而不是显示 undefined
  assert.match(t('zh', 'toast.welcome'), /\{name\}/);
});

test('中英两套文案键一致', () => {
  const zh = Object.keys(STRINGS.zh).sort();
  const en = Object.keys(STRINGS.en).sort();
  assert.deepEqual(en, zh);
});
