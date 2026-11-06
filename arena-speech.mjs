// 头像大乱斗 · 语音播报（浏览器 TTS，与 gift-speech.mjs 同一条路子）
// 只播"大事"：进场欢迎、王者、称号、局结算。绝不逐条念弹幕——既吵，也是
// TikTok 明确归责创作者的第三方朗读风险区。

export const ARENA_LINES = {
  zh: {
    welcome: [
      '欢迎{name}进入直播间，点赞就能进场，评论还能变大！',
      '{name}来啦，先点个赞，让你的头像冲进地图。',
      '欢迎{name}，小心场上的大块头，先躲一躲。',
      '{name}进场了，现在最大的那位正在等你挑战。',
      '欢迎{name}，点个赞，你的头像马上出现在地图里。'
    ],
    king: ['本局王者是{name}，体型{mass}！', '{name}拿下本局王者，体型{mass}，谁来挑战？'],
    title: ['{name}获得{title}！', '{title}，属于{name}！'],
    round: ['第{round}局结算，王者{name}，下一局马上开始。'],
    revive: ['{name}又回来了，这次小心点。']
  },
  en: {
    welcome: [
      'Welcome {name}! Send a like and your avatar joins the map.',
      '{name} is here — like to join, comment to grow.',
      'Welcome {name}, watch out for the big ones.',
      '{name} just joined. The biggest avatar is waiting for a challenge.',
      'Welcome {name}! A single like puts you on the map.'
    ],
    king: ['{name} wins this round with size {mass}!', '{name} takes the crown at size {mass}. Who is next?'],
    title: ['{name} earns {title}!', '{title} goes to {name}!'],
    round: ['Round {round} settled. {name} is the king. Next round starts now.'],
    revive: ['{name} is back. Watch your back this time.']
  }
};

export class ArenaSpeech {
  constructor({ lang = 'zh', onStatus = () => {} } = {}) {
    this.lang = lang === 'en' ? 'en' : 'zh';
    this.enabled = true;
    this.volume = 0.9;
    this.rate = 1.06;
    this.onStatus = onStatus;
    this.queue = [];
    this.speaking = false;
    this.previous = -1;
    this.generation = 0;
    this.ready = typeof globalThis.speechSynthesis !== 'undefined';
  }

  setLang(lang) { this.lang = lang === 'en' ? 'en' : 'zh'; }

  get lines() { return ARENA_LINES[this.lang] || ARENA_LINES.zh; }

  #pick(list, key) {
    if (!list?.length) return '';
    let i = Math.floor(Math.random() * list.length);
    if (i === this.previous) i = (i + 1) % list.length;
    this.previous = i;
    return String(list[i]).replace(/\{(\w+)\}/g, (m, k) => (key[k] === undefined ? m : String(key[k])));
  }

  #preferredVoice() {
    if (!this.ready) return null;
    const voices = speechSynthesis.getVoices() || [];
    const lang = this.lang === 'en' ? /^en/i : /zh|cmn/i;
    return voices.find((v) => lang.test(v.lang) && /xiaoxiao|xiaoyi|huihui|female|女/i.test(v.name))
      || voices.find((v) => lang.test(v.lang)) || null;
  }

  say(text) {
    if (!this.enabled || !this.ready) return false;
    const clean = String(text || '').replace(/[<>\n\r]/g, '').slice(0, 70);
    if (!clean) return false;
    if (this.queue.length >= 8) this.queue.shift();
    this.queue.push(clean);
    this.pump();
    return true;
  }

  welcome(name) { return this.say(this.#pick(this.lines.welcome, { name })); }
  king(name, mass) { return this.say(this.#pick(this.lines.king, { name, mass })); }
  title(name, title) { return this.say(this.#pick(this.lines.title, { name, title })); }
  round(result) {
    return this.say(this.#pick(this.lines.round, { round: result?.round ?? '', name: result?.winner?.name ?? '' }));
  }
  revive(name) { return this.say(this.#pick(this.lines.revive, { name })); }

  pump() {
    if (!this.ready || !this.enabled || this.speaking || !this.queue.length) return;
    const text = this.queue.shift();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = this.#preferredVoice();
    if (voice) utter.voice = voice;
    utter.lang = voice?.lang || (this.lang === 'en' ? 'en-US' : 'zh-CN');
    utter.rate = this.rate;
    utter.pitch = 1.04;
    utter.volume = this.volume;
    const token = this.generation;
    this.speaking = true;
    this.onStatus(text);
    utter.onend = () => { if (token !== this.generation) return; this.speaking = false; this.pump(); };
    utter.onerror = () => { if (token !== this.generation) return; this.speaking = false; this.queue = []; };
    try { speechSynthesis.speak(utter); } catch { this.speaking = false; }
  }

  stop() {
    this.generation += 1;
    this.queue = [];
    this.speaking = false;
    if (this.ready) { try { speechSynthesis.cancel(); } catch { /* 忽略 */ } }
  }
}
