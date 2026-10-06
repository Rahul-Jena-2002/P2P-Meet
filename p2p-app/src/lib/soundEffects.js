/*
 * p2pmeet - Decentralized Privacy-First Video Meetings
 * High-Fidelity UI Audio Player for Emojis and Meeting Cues
 * Sourced from open-source CC0 sound library (uisfx)
 */

class SoundPlayer {
  constructor() {
    this.enabled = true;
    this.audioCache = {};
  }

  play(fileName) {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      // Create lightweight audio instance
      const audio = new Audio(`/sounds/${fileName}`);
      audio.volume = 0.75;
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
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

    // 2. Celebrations, Rockets & Vibes
    if (['🎉', '🥳', '🚀', '💯', '✨', '🌈'].includes(emoji)) {
      this.play('celebrate.mp3');
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

    // 4. Laugh & Joy
    if (['😂', '🤣', '😎', '🤯'].includes(emoji)) {
      this.play('laugh.mp3');
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
