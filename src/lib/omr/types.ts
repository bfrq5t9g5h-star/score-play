export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface GrayImage {
  width: number;
  height: number;
  /** 0 = black ink-ish, 255 = paper */
  data: Uint8Array;
}

export interface BinaryImage {
  width: number;
  height: number;
  /** 1 = ink, 0 = paper */
  data: Uint8Array;
}

export type Clef = "treble" | "bass";

export interface StaffLine {
  y: number;
  thickness: number;
}

export interface Staff {
  lines: StaffLine[];
  /** Distance between adjacent staff lines, in pixels. */
  space: number;
  x0: number;
  x1: number;
  clef: Clef;
  index: number;
}

export interface DetectedNote {
  id: string;
  x: number;
  y: number;
  staffIndex: number;
  /** Diatonic steps above the bottom staff line. */
  stepsFromBottom: number;
  midi: number;
  name: string;
  /** Length in quarter notes: 4 whole, 2 half, 1 quarter, 0.5 eighth. */
  quarters: number;
  filled: boolean;
  hasStem: boolean;
  dotted: boolean;
  confidence: number;
  muted?: boolean;
}

export interface ScoreEvent {
  time: number;
  quarters: number;
  notes: DetectedNote[];
}

export interface RecognitionResult {
  width: number;
  height: number;
  image: RgbaImage;
  staves: Staff[];
  notes: DetectedNote[];
  events: ScoreEvent[];
  warnings: string[];
}

export type KeyName =
  | "C"
  | "G"
  | "D"
  | "A"
  | "F"
  | "Bb"
  | "Eb";

export const KEY_ACCIDENTALS: Record<KeyName, Record<number, number>> = {
  C: {},
  G: { 5: 1 },
  D: { 5: 1, 0: 1 },
  A: { 5: 1, 0: 1, 7: 1 },
  F: { 11: -1 },
  Bb: { 11: -1, 4: -1 },
  Eb: { 11: -1, 4: -1, 9: -1 },
};
