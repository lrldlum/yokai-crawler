'use strict';
/* Original synthesized stings. No sampled music. A quiet in-scale pluck pattern. */
(function () {
  const AudioBus = {
    ctx: null,
    master: null,
    muted: false,
    music: false,
    ensure: function () {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    },
    resume: function () {
      this.ensure();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.music) this.startMusic();
    },
    toggle: function () {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
      return this.muted;
    },
    env: function (dur, peak, type, freq, slide) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    noise: function (dur, peak, freq) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const n = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = this.ctx.createBufferSource();
      src.buffer = n;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq || 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t);
    },
    play: function (name) {
      if (name === 'slash') {
        this.noise(0.09, 0.22, 1400);
        this.env(0.12, 0.08, 'sawtooth', 540, 180);
      } else if (name === 'hit') {
        this.noise(0.06, 0.28, 600);
        this.env(0.08, 0.1, 'square', 220, 80);
      } else if (name === 'die') {
        this.noise(0.2, 0.2, 400);
        this.env(0.28, 0.08, 'triangle', 360, 70);
      } else if (name === 'dash') {
        this.noise(0.1, 0.12, 1800);
        this.env(0.14, 0.06, 'sine', 420, 860);
      } else if (name === 'seal') {
        this.env(0.35, 0.1, 'triangle', 220, 660);
        this.env(0.4, 0.05, 'sine', 440, 880);
      } else if (name === 'kunai') {
        this.noise(0.05, 0.12, 2200);
        this.env(0.07, 0.05, 'square', 880, 440);
      } else if (name === 'heal') {
        this.env(0.22, 0.07, 'sine', 523, 784);
        this.env(0.28, 0.05, 'triangle', 659, 1046);
      } else if (name === 'hurt') {
        this.env(0.16, 0.1, 'sawtooth', 160, 70);
      } else if (name === 'pick') {
        this.env(0.1, 0.06, 'sine', 880, 1320);
      } else if (name === 'shrine') {
        this.env(0.5, 0.07, 'sine', 392, 784);
        this.env(0.7, 0.04, 'triangle', 494, 988);
      } else if (name === 'boss') {
        this.env(0.6, 0.1, 'sawtooth', 90, 50);
        this.noise(0.4, 0.18, 200);
      } else if (name === 'join') {
        this.env(0.2, 0.06, 'sine', 660, 990);
      }
    },
    startMusic: function () {
      if (!this.ctx || this.music) return;
      this.music = true;
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.gain.value = 0.045;
      g.connect(this.master);
      /* miyako-bushi flavored degrees, original slow pattern, not a quotation */
      const scale = [196, 207.65, 261.63, 311.13, 349.23, 392, 415.3, 523.25];
      const pattern = [0, 2, 4, 2, 5, 3, 4, 1, 2, 6, 4, 0];
      let step = 0;
      const tick = () => {
        if (!this.ctx) return;
        if (!this.muted) {
          const o = ctx.createOscillator();
          const eg = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = scale[pattern[step % pattern.length]];
          const t = ctx.currentTime;
          eg.gain.setValueAtTime(0.0001, t);
          eg.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
          eg.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
          o.connect(eg);
          eg.connect(g);
          o.start(t);
          o.stop(t + 1.2);
          if (step % 4 === 0) {
            const b = ctx.createOscillator();
            const bg = ctx.createGain();
            b.type = 'sine';
            b.frequency.value = 98;
            bg.gain.setValueAtTime(0.5, t);
            bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
            b.connect(bg);
            bg.connect(g);
            b.start(t);
            b.stop(t + 0.45);
          }
        }
        step++;
        this.musicTimer = setTimeout(tick, 680);
      };
      tick();
    },
  };
  window.AudioBus = AudioBus;
})();
