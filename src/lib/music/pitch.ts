const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const DIATONIC = [0, 2, 4, 5, 7, 9, 11];

export function midiToName(midi: number): string {
  const clamped = Math.max(0, Math.min(127, Math.round(midi)));
  const pc = ((clamped % 12) + 12) % 12;
  const octave = Math.floor(clamped / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

export function nameToMidi(name: string): number {
  const match = name.trim().match(/^([A-G])([#b]?)(-?\d+)$/i);
  if (!match) {
    throw new Error(`Invalid note name: ${name}`);
  }
  const letter = match[1].toUpperCase();
  const accidental = match[2];
  const octave = Number(match[3]);
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = base[letter];
  if (accidental === "#") pc += 1;
  if (accidental === "b") pc -= 1;
  return (octave + 1) * 12 + pc;
}

export function midiFromStaffSteps(
  stepsFromBottom: number,
  clef: "treble" | "bass",
): number {
  const baseDegree = clef === "treble" ? 2 : 4;
  const baseOctave = clef === "treble" ? 4 : 2;
  let degree = baseDegree + stepsFromBottom;
  let octave = baseOctave;
  while (degree < 0) {
    degree += 7;
    octave -= 1;
  }
  while (degree >= 7) {
    degree -= 7;
    octave += 1;
  }
  return (octave + 1) * 12 + DIATONIC[degree];
}

export function applyKeySignature(midi: number, accidentalByPitchClass: Record<number, number>): number {
  const pc = ((midi % 12) + 12) % 12;
  const delta = accidentalByPitchClass[pc];
  return delta ? midi + delta : midi;
}

export function durationGlyph(quarters: number): string {
  if (quarters >= 4) return "\u{1D15D}";
  if (quarters >= 3) return "\u{1D15E}.";
  if (quarters >= 2) return "\u{1D15E}";
  if (quarters >= 1.5) return "\u2669.";
  if (quarters >= 1) return "\u2669";
  if (quarters >= 0.75) return "\u266A.";
  if (quarters >= 0.5) return "\u266A";
  return "\u266C";
}

export function durationLabel(quarters: number): string {
  if (quarters >= 4) return "whole";
  if (quarters >= 3) return "dotted half";
  if (quarters >= 2) return "half";
  if (quarters >= 1.5) return "dotted quarter";
  if (quarters >= 1) return "quarter";
  if (quarters >= 0.75) return "dotted eighth";
  if (quarters >= 0.5) return "eighth";
  return "sixteenth";
}
