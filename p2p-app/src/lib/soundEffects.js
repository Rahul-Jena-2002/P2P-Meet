/*
 * p2pmeet - Decentralized Privacy-First Video Meetings
 * Web Audio API Sound Synthesizer for Emojis & Meeting Alerts
 * Zero external audio files required - pristine, zero-latency synthesis
 */

class SoundSynth {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playEmojiSound(emoji) {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Hands & Claps
      if (emoji === '👏' || emoji === '🙌') {
        this.playClap(ctx, now);
        return;
      }
      if (emoji === '👍' || emoji === '✌️' || emoji === '🤙') {
        this.playPop(ctx, now);
        return;
      }
      if (emoji === '👎') {
        this.playThud(ctx, now);
        return;
      }

      // 2. Celebrations & Sparks
      if (emoji === '🎉' || emoji === '🥳' || emoji === '🚀' || emoji === '💯') {
        this.playFanfare(ctx, now);
        return;
      }
      if (emoji === '🔥' || emoji === '⚡') {
        this.playSizzle(ctx, now);
        return;
      }
      if (emoji === '✨' || emoji === '⭐' || emoji === '🌈') {
        this.playMagicChime(ctx, now);
        return;
      }

      // 3. Hearts & Affection
      if (emoji === '❤️' || emoji === '💖' || emoji === '😍' || emoji === '🫶') {
        this.playHeartChime(ctx, now);
        return;
      }

      // 4. Laugh & Joy
      if (emoji === '😂' || emoji === '🤣') {
        this.playChuckle(ctx, now);
        return;
      }

      // 5. Animals
      if (emoji === '🐶') {
        this.playDogBark(ctx, now);
        return;
      }
      if (emoji === '🐱') {
        this.playCatMeow(ctx, now);
        return;
      }
      if (emoji === '🦁') {
        this.playLionRoar(ctx, now);
        return;
      }
      if (emoji === '🐸') {
        this.playFrogRibbit(ctx, now);
        return;
      }
      if (emoji === '🐵' || emoji === '🦊' || emoji === '🐼' || emoji === '🦄' || emoji === '🐝' || emoji === '🦉') {
        this.playAnimalChirp(ctx, now);
        return;
      }

      // Default playful chime
      this.playDefaultChime(ctx, now);
    } catch (e) {
      console.warn('Sound synthesis error:', e);
    }
  }

  // Clap synthesis using noise bursts
  playClap(ctx, now) {
    for (let i = 0; i < 3; i++) {
      const offset = now + i * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 + Math.random() * 60, offset);
      osc.frequency.exponentialRampToValueAtTime(60, offset + 0.06);

      gain.gain.setValueAtTime(0.25, offset);
      gain.gain.exponentialRampToValueAtTime(0.001, offset + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(offset);
      osc.stop(offset + 0.07);
    }
  }

  // Pop / Bubble
  playPop(ctx, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // Thud / Down
  playThud(ctx, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  // Fanfare / Celebration
  playFanfare(ctx, now) {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const time = now + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.25);
    });
  }

  // Sizzle / Electricity
  playSizzle(ctx, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  // Magic Chime
  playMagicChime(ctx, now) {
    const notes = [880, 1174.66, 1396.91, 1760];
    notes.forEach((freq, idx) => {
      const time = now + idx * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.32);
    });
  }

  // Heart / Love warm harmonic
  playHeartChime(ctx, now) {
    [523.25, 659.25, 783.99].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.47);
    });
  }

  // Joy / Chuckle
  playChuckle(ctx, now) {
    const pitches = [400, 480, 420, 520];
    pitches.forEach((freq, idx) => {
      const time = now + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq + 60, time + 0.05);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.08);
    });
  }

  // Dog bark synthesis
  playDogBark(ctx, now) {
    for (let i = 0; i < 2; i++) {
      const offset = now + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, offset);
      osc.frequency.exponentialRampToValueAtTime(160, offset + 0.09);

      gain.gain.setValueAtTime(0.25, offset);
      gain.gain.exponentialRampToValueAtTime(0.001, offset + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(offset);
      osc.stop(offset + 0.11);
    }
  }

  // Cat meow synthesis
  playCatMeow(ctx, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.linearRampToValueAtTime(780, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.35);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.37);
  }

  // Lion roar / low growl
  playLionRoar(ctx, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.45);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  // Frog ribbit
  playFrogRibbit(ctx, now) {
    for (let i = 0; i < 2; i++) {
      const offset = now + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, offset);
      osc.frequency.exponentialRampToValueAtTime(260, offset + 0.07);

      gain.gain.setValueAtTime(0.22, offset);
      gain.gain.exponentialRampToValueAtTime(0.001, offset + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(offset);
      osc.stop(offset + 0.09);
    }
  }

  // Bird / animal chirp
  playAnimalChirp(ctx, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(2200, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Default pleasant chime
  playDefaultChime(ctx, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }
}

export const soundSynth = new SoundSynth();
