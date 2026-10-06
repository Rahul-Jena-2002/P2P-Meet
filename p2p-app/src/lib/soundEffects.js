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

    // 5. Animals & Nature
    if (['🐶', '🐱', '🦁', '🐼', '🦊', '🐸', '🐵', '🦄', '🐝', '🦉'].includes(emoji)) {
      this.play('animal.mp3');
      return;
    }

    // Default pop
    this.play('pop.mp3');
  }
}

export const soundSynth = new SoundPlayer();
