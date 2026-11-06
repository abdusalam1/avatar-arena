// 渲染层冒烟测试：用一个假的 Canvas 上下文把画面跑几十帧，
// 目的是在没有浏览器的环境里抓出画笔调用的拼写/参数错误，以及空快照崩溃。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Town } from './engine.mjs';
import { TownView, project } from './view.mjs';

const METHODS = ['clearRect', 'save', 'restore', 'setTransform', 'fillRect', 'strokeRect', 'beginPath',
  'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'roundRect', 'fill', 'stroke', 'clip',
  'fillText', 'drawImage', 'translate', 'scale', 'rotate', 'quadraticCurveTo', 'bezierCurveTo'];

function stubCanvas() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'measureText') return (text) => ({ width: String(text).length * 7 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'canvas') return null;
      if (typeof prop === 'string' && METHODS.includes(prop)) {
        return (...args) => { calls.push([prop, args]); };
      }
      return undefined;
    },
    set() { return true; }
  });
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
  return { canvas, calls };
}

test('project：世界坐标落进画面安全区', () => {
  const a = project(0, 0, 1000, 600);
  const b = project(100, 80, 1000, 600);
  assert.ok(a.sx > 0 && a.sx < 1000 && a.sy > 0 && a.sy < 600);
  assert.ok(b.sx > a.sx && b.sy > a.sy);
  assert.ok(b.sx <= 1000 && b.sy <= 600);
});

test('连续 60 帧绘制不抛异常，且确实画了东西', () => {
  const town = new Town({ seed: 42, autoFill: false });
  town.addViewer({ name: '测试甲' });
  town.addViewer({ name: '测试乙' });
  town.feed({ type: 'gift', name: '测试甲', raw: '火箭', gift: 'other', count: 1 });
  town.feed({ type: 'like', name: '测试乙', count: 100 });
  const { canvas, calls } = stubCanvas();
  const view = new TownView(canvas);
  view.resize(1080, 1920, 1);
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1920);

  let snap = town.snapshot();
  for (let i = 0; i < 60; i++) {
    town.tick(1 / 60);
    view.spawnEffects(town.takeEffects());
    snap = town.snapshot();
    view.frame(1 / 60, snap);
  }
  assert.ok(calls.length > 200, `绘制调用过少: ${calls.length}`);
  assert.ok(calls.some(([name]) => name === 'fillText'), '没画文字');
  assert.ok(calls.some(([name]) => name === 'arc'), '没画头像圆');
});

test('空小镇与空快照都不会崩', () => {
  const { canvas } = stubCanvas();
  const view = new TownView(canvas);
  view.resize(800, 450, 2);
  assert.equal(canvas.width, 1600);
  view.frame(0.016, null);
  const empty = new Town({ seed: 1, autoFill: false }).snapshot();
  view.frame(0.016, empty);
});

test('竖屏 9:16 尺寸按高度换算', () => {
  const { canvas } = stubCanvas();
  const view = new TownView(canvas);
  const dpr = 2;
  const height = 1000;
  view.resize((height * 9) / 16, height, dpr);
  const cssWidth = Math.round((height * 9) / 16);
  assert.equal(canvas.width, Math.round(cssWidth * dpr));
  assert.equal(canvas.height, Math.round(height * dpr));
  assert.equal(canvas.style.width, cssWidth + 'px');
});
