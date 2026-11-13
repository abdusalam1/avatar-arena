// 头像大乱斗 · 设置（默认值 + 校验 + 面板渲染）
// 与 print-settings.mjs 同一套思路：纯函数负责校验，DOM 只负责长什么样，
// 页面负责存 localStorage。这样"参数被写坏"这件事可以在 Node 里单测。

import { t } from './arena-i18n.mjs';

export const ARENA_DEFAULTS = {
  v: 1,
  lang: 'zh',
  voice: true,
  demo: true,
  portrait: false,
  maxAlive: 60,
  eatGain: 0.62,
  decayPerSec: 0.004,
  decayTo: 2,
  smarts: 0.65,
  speed: 118,
  hypeBoost: 0.9,
  roundMinutes: 10
};

const RANGES = {
  maxAlive: [10, 120],
  eatGain: [0.2, 1],
  decayPerSec: [0, 0.02],
  decayTo: [1, 2.5],
  smarts: [0, 1],
  speed: [40, 260],
  hypeBoost: [0, 2],
  roundMinutes: [1, 60]
};

const clampNumber = (value, [lo, hi], fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

// 任何来源（localStorage、手改、旧版本）的数据都被夹到合法区间
export function sanitizeArenaSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...ARENA_DEFAULTS };
  out.lang = src.lang === 'en' ? 'en' : 'zh';
  out.voice = src.voice !== false;
  out.demo = src.demo !== false;
  out.portrait = src.portrait === true;
  for (const [key, range] of Object.entries(RANGES)) {
    out[key] = clampNumber(src[key], range, ARENA_DEFAULTS[key]);
  }
  return out;
}

export function serializeArenaSettings(settings) {
  return JSON.stringify(sanitizeArenaSettings(settings));
}

// 设置 → 引擎 / 局管理器（页面调用一次，之后滑块改动再调）
export function applyArenaSettings(settings, arena, rounds) {
  if (arena?.cfg) {
    arena.cfg.maxAlive = Math.round(settings.maxAlive);
    arena.cfg.eatGain = settings.eatGain;
    arena.cfg.decayPerSec = settings.decayPerSec;
    arena.cfg.decayTo = settings.decayTo;
    arena.cfg.smarts = settings.smarts;
    arena.cfg.speed = settings.speed;
    arena.cfg.hypeBoost = settings.hypeBoost;
  }
  if (rounds?.cfg) rounds.cfg.roundSeconds = Math.round(settings.roundMinutes * 60);
  return settings;
}

// 面板：滑杆 + 开关，改动即时保存（与打印规则面板一致的交互习惯）
export function renderArenaSettings(body, settings, save) {
  if (!body) return;
  const lang = settings.lang || 'zh';
  body.replaceChildren();

  const row = (label, input) => {
    const wrap = document.createElement('label');
    wrap.className = 'arena-setting-row';
    const span = document.createElement('span');
    span.textContent = label;
    const value = document.createElement('b');
    value.textContent = input.value;
    const head = document.createElement('div');
    head.className = 'arena-setting-head';
    head.append(span, value);
    input.addEventListener('input', () => { value.textContent = input.value; });
    wrap.append(head, input);
    body.append(wrap);
    return input;
  };

  const slider = (key, min, max, step) => {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(settings[key]);
    input.addEventListener('change', () => {
      settings[key] = Number(input.value);
      save();
    });
    return row(t(lang, 'settings.' + keyKey(key)), input);
  };

  const keyKey = (key) => ({
    eatGain: 'eatGain', decayPerSec: 'decay', smarts: 'smarts', decayTo: 'decayTo',
    maxAlive: 'maxAlive', roundMinutes: 'roundMinutes',
    speed: 'speed', hypeBoost: 'hype'
  }[key] || key);

  slider('speed', 40, 260, 5);
  slider('hypeBoost', 0, 2, 0.1);
  slider('eatGain', 0.2, 1, 0.02);
  slider('decayPerSec', 0, 0.02, 0.001);
  slider('decayTo', 1, 2.5, 0.1);
  slider('smarts', 0, 1, 0.05);
  slider('maxAlive', 10, 120, 5);
  slider('roundMinutes', 1, 60, 1);

  const toggle = (key, labelKey) => {
    const wrap = document.createElement('label');
    wrap.className = 'arena-setting-row';
    const head = document.createElement('div');
    head.className = 'arena-setting-head';
    const span = document.createElement('span');
    span.textContent = t(lang, labelKey);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!settings[key];
    input.addEventListener('change', () => {
      settings[key] = input.checked;
      save();
    });
    head.append(span, input);
    wrap.append(head);
    body.append(wrap);
  };
  toggle('voice', 'settings.voice');
  toggle('demo', 'settings.demo');

  const note = document.createElement('p');
  note.className = 'arena-setting-note';
  note.textContent = t(lang, 'settings.note');
  body.append(note);
}
