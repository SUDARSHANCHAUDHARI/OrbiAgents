// E5 → E6 ascending two-note chime, played on agent state transitions.
// AudioContext is created lazily on first play() to satisfy browser autoplay policy.

const NOTE_E5 = 659.25;
const NOTE_E6 = 1318.51;
const NOTE_DURATION = 0.08;  // seconds per note
const NOTE_GAP = 0.04;       // gap between notes

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Call on first user interaction to unlock AudioContext on Safari/iOS
  unlock(): void {
    this.getContext();
  }

  play(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx || ctx.state === "suspended") return;

    const now = ctx.currentTime;
    this.playNote(ctx, NOTE_E5, now);
    this.playNote(ctx, NOTE_E6, now + NOTE_DURATION + NOTE_GAP);
  }

  private getContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined" || !window.AudioContext) return null;
    this.ctx = new AudioContext();
    return this.ctx;
  }

  private playNote(ctx: AudioContext, freq: number, startTime: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + NOTE_DURATION);

    osc.start(startTime);
    osc.stop(startTime + NOTE_DURATION);
  }
}
