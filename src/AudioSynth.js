/**
 * Web Audio API — 全てプログラム合成
 */
export class AudioSynth {
  constructor() {
    this.ctx = null;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    return this.ctx;
  }

  resume() {
    const c = this.ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  /** 選択：高い「コン」 */
  playSelect() {
    const c = this.ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, t0);
    osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.06);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  }

  /** 注ぎ：ピッチ変化するノイズバースト（トポトポ） */
  startPour() {
    const c = this.ensure();
    if (!c) return { stop() {} };
    const t0 = c.currentTime;
    const noiseBuf = this._makeNoiseBuffer(c, 1.2);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(520, t0);
    const lfo = c.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = 14;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.04);
    src.connect(bp);
    bp.connect(g);
    g.connect(c.destination);
    lfo.start(t0);
    src.start(t0);
    return {
      stop: () => {
        const t = c.currentTime;
        try {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        } catch {
          /* ignore */
        }
        src.stop(t + 0.1);
        lfo.stop(t + 0.1);
      },
    };
  }

  /** クリア / ステージ移行：キラキラ */
  playClear() {
    const c = this.ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const master = c.createGain();
    master.gain.value = 0.09;
    master.connect(c.destination);
    for (let i = 0; i < 6; i++) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      const f = 880 * Math.pow(1.5, i);
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 1.25, t0 + 0.45);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.03);
      g.gain.exponentialRampToValueAtTime(1, t0 + i * 0.03 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      osc.connect(g);
      g.connect(master);
      osc.start(t0 + i * 0.03);
      osc.stop(t0 + 0.65);
    }
  }

  _makeNoiseBuffer(ctx, durSec) {
    const len = Math.floor(ctx.sampleRate * durSec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
}
