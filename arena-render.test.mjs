// 渲染层冒烟测试：假 Canvas 上下文跑帧，抓画笔调用错误与空场崩溃
import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, WORLD } from './arena-engine.mjs';
import { ArenaRender, fitOf, project, tierOf } from './arena-render.mjs';
import { t } from './arena-i18n.mjs';

const zh = (k, v) => t('zh', k, v);

const METHODS = ['clearRect', 'save', 'restore', 'setTransform', 'fillRect', 'strokeRect', 'beginPath',
  'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'roundRect', 'fill', 'stroke', 'clip',
  'fillText', 'drawImage', 'translate', 'scale', 'rotate'];

function stubCanvas() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'measureText') return (text) => ({ width: String(text).length * 7 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (typeof prop === 'string' && METHODS.includes(prop)) return (...args) => { calls.push([prop, args]); };
      return undefined;
    },
    set() { return true; }
  });
  return { canvas: { width: 0, height: 0, style: {}, getContext: () => ctx }, calls };
}

test('世界等比缩放居中', () => {
  const f = fitOf(1000, 1000);
  assert.ok(f.s > 0);
  const a = project(0, 0, 1000, 1000);
  const b = project(WORLD.w, WORLD.h, 1000, 1000);
  assert.ok(a.sx >= 0 && a.sy >= 0);
  assert.ok(b.sx <= 1000 && b.sy <= 1000);
  assert.ok(Math.abs((b.sx - a.sx) / (b.sy - a.sy) - WORLD.w / WORLD.h) < 0.01);
});

test('体型档位随质量升级', () => {
  assert.equal(tierOf(100).label, '萌新');
  assert.equal(tierOf(200).label, '壮实');
  assert.equal(tierOf(400).label, '大块头');
  assert.equal(tierOf(1200).label, '霸主');
});

test('连续 90 帧绘制不抛异常，且画了头像和文字', () => {
  const arena = new Arena({ seed: 3, smarts: 0 });
  for (const n of ['甲', '乙', '丙', '丁']) arena.feed({ type: 'like', name: n, count: 2 });
  arena.feed({ type: 'gift', name: '甲', raw: '火箭', gift: 'other', count: 1 });
  const { canvas, calls } = stubCanvas();
  const view = new ArenaRender(canvas, { t: zh });
  view.resize(1280, 720, 1);
  view.toast('👋 欢迎 甲 进入直播间', 'join', 4);
  for (let i = 0; i < 90; i++) {
    arena.tick(1 / 60);
    view.spawnEffects(arena.takeEffects());
    view.frame(1 / 60, arena.snapshot());
  }
  assert.ok(calls.length > 400, `绘制调用过少: ${calls.length}`);
  assert.ok(calls.some(([n]) => n === 'fillText'), '没画文字');
  assert.ok(calls.some(([n]) => n === 'arc'), '没画头像');
});

test('空场与空快照都不崩，并给出引导文案', () => {
  const { canvas, calls } = stubCanvas();
  const view = new ArenaRender(canvas, { t: zh });
  view.resize(800, 450, 2);
  view.frame(1 / 60, null);
  const empty = new Arena({ seed: 1 }).snapshot();
  calls.length = 0;
  view.frame(1 / 60, empty);
  const texts = calls.filter(([n]) => n === 'fillText').map(([, a]) => a[0]);
  assert.ok(texts.some((t) => String(t).includes('空')));
});
