/*
 * p2pmeet - Decentralized Privacy-First Video Meetings
 * High-Fidelity UI Audio Player & Web Audio Synthesizer for Emojis
 */

class SoundPlayer {
  constructor() {
    this.enabled = true;
    this.audioCtx = null;
  }

  getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  play(fileName) {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      const audio = new Audio(`/sounds/${fileName}`);
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // Hilarious funny cartoon laugh synth ("ha-ha-ha-he-he-ho-ho!")
  playFunnyLaughSynth() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const pitches = [380, 440, 410, 480, 520, 460, 540, 490, 420];
    const now = ctx.currentTime;

    pitches.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + idx * 0.11 + 0.09);

      gain.gain.setValueAtTime(0, now + idx * 0.11);
      gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.10);
    });
  }

  // Party horn celebration fanfare
  playFanfareSynth() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + (i === 3 ? 0.6 : 0.15));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + (i === 3 ? 0.65 : 0.2));
    });
  }

  // Realistic synthesized double dog bark ("Woof! Woof!") using Web Audio
  playDogBarkSynth() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Two rapid dog barks: first higher, second slightly lower
    const barks = [
      { start: now, freqStart: 460, freqEnd: 240, duration: 0.11, vol: 0.35 },
      { start: now + 0.15, freqStart: 420, freqEnd: 210, duration: 0.13, vol: 0.4 }
    ];

    barks.forEach(b => {
      // Body oscillator (pitch drop creates characteristic "woof" formant)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(b.freqStart, b.start);
      osc.frequency.exponentialRampToValueAtTime(b.freqEnd, b.start + b.duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, b.start);
      filter.frequency.exponentialRampToValueAtTime(600, b.start + b.duration);

      gain.gain.setValueAtTime(0.001, b.start);
      gain.gain.linearRampToValueAtTime(b.vol, b.start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, b.start + b.duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(b.start);
      osc.stop(b.start + b.duration + 0.02);

      // Throat formant harmonic
      const harm = ctx.createOscillator();
      const harmGain = ctx.createGain();
      harm.type = 'sawtooth';
      harm.frequency.setValueAtTime(b.freqStart * 0.75, b.start);
      harm.frequency.exponentialRampToValueAtTime(b.freqEnd * 0.75, b.start + b.duration);

      harmGain.gain.setValueAtTime(0.001, b.start);
      harmGain.gain.linearRampToValueAtTime(b.vol * 0.3, b.start + 0.015);
      harmGain.gain.exponentialRampToValueAtTime(0.001, b.start + b.duration);

      harm.connect(harmGain);
      harmGain.connect(gain);

      harm.start(b.start);
      harm.stop(b.start + b.duration + 0.02);
    });
  }

  playEmojiSound(emoji) {
    if (!this.enabled) return;

    // 1. Hands & Claps
    if (['👏', '🙌'].includes(emoji)) {
      this.play('clap.mp3');
      return;
    }
    if (['👍', '✌️', '🤙', '✊', '🤝', '🙏', '👎'].includes(emoji)) {
      this.play('pop.mp3');
      return;
    }

    // 2. Celebrations & Vibes
    if (['🎉', '🥳', '🚀', '💯', '✨', '🌈'].includes(emoji)) {
      this.play('celebrate.mp3');
      this.playFanfareSynth();
      return;
    }
    if (['🔥', '⚡', '🍕', '☕'].includes(emoji)) {
      this.play('fire.mp3');
      return;
    }

    // 3. Love & Hearts
    if (['❤️', '💖', '😍', '🫶', '😇', '🤩'].includes(emoji)) {
      this.play('heart.mp3');
      return;
    }

    // 4. Laugh & ROFL Joy (Audio file + Funny Laugh Synth)
    if (['😂', '🤣', '😎', '🤯'].includes(emoji)) {
      this.play('laugh.mp3');
      this.playFunnyLaughSynth();
      return;
    }

    // 5. Dog Bark (Pixabay style bark effect!)
    if (['🐶', '🐕', '🦮', '🐩', '🐾'].includes(emoji)) {
      this.play('dog-bark.mp3');
      this.playDogBarkSynth();
      return;
    }

    // 6. Animals & Nature
    if (['🐱', '🦁', '🐼', '🦊', '🐸', '🐵', '🦄', '🐝', '🦉'].includes(emoji)) {
      this.play('animal.mp3');
      return;
    }

    // Default pop
    this.play('pop.mp3');
  }
}

export const soundSynth = new SoundPlayer();
