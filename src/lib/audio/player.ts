import type { ScoreEvent } from "@/lib/omr/types";

export type Voice = "organ" | "piano" | "choir";

type ToneModule = typeof import("tone");

export class ScorePlayer {
  private tone: ToneModule | null = null;
  private synth: import("tone").PolySynth | null = null;
  private playing = false;

  async ensure(): Promise<ToneModule> {
    if (!this.tone) this.tone = await import("tone");
    await this.tone.start();
    return this.tone;
  }

  isPlaying() {
    return this.playing;
  }

  private buildSynth(tone: ToneModule, voice: Voice) {
    this.synth?.dispose();
    if (voice === "piano") {
      this.synth = new tone.PolySynth(tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.8 },
      }).toDestination();
      this.synth.volume.value = -6;
    } else if (voice === "choir") {
      this.synth = new tone.PolySynth(tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.12, decay: 0.2, sustain: 0.85, release: 1.1 },
      }).toDestination();
      this.synth.volume.value = -8;
    } else {
      this.synth = new tone.PolySynth(tone.Synth, {
        oscillator: { type: "fatsine", spread: 18, count: 3 },
        envelope: { attack: 0.05, decay: 0.15, sustain: 0.8, release: 0.7 },
      }).toDestination();
      this.synth.volume.value = -10;
    }
  }

  async play(
    events: ScoreEvent[],
    tempo: number,
    voice: Voice,
    onEvent: (index: number, ids: string[]) => void,
    onDone: () => void,
  ) {
    const tone = await this.ensure();
    this.stopInternal(false);
    this.buildSynth(tone, voice);
    this.playing = true;
    const beat = 60 / Math.max(32, tempo);
    let lastEnd = 0;
    events.forEach((event, index) => {
      const start = event.time * beat;
      const dur = Math.max(0.12, event.quarters * beat * 0.92);
      lastEnd = Math.max(lastEnd, start + dur);
      tone.Draw.schedule(() => {
        if (!this.playing) return;
        onEvent(
          index,
          event.notes.filter((n) => !n.muted).map((n) => n.id),
        );
      }, tone.now() + start);
      const sounding = event.notes.filter((n) => !n.muted);
      if (sounding.length === 0) return;
      const freqs = sounding.map((n) => tone.Frequency(n.midi, "midi").toFrequency());
      this.synth?.triggerAttackRelease(freqs, dur, tone.now() + start);
    });
    window.setTimeout(
      () => {
        if (!this.playing) return;
        this.playing = false;
        onDone();
      },
      (lastEnd + 0.3) * 1000,
    );
  }

  stop() {
    this.stopInternal(true);
  }

  private stopInternal(release: boolean) {
    this.playing = false;
    if (release) {
      this.synth?.releaseAll();
    }
  }
}

export const scorePlayer = new ScorePlayer();
