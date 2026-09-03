export type DurationCode = "w" | "h" | "q" | "e" | "hd" | "qd";

export type HymnToken =
  | { pitch: string; dur: DurationCode }
  | { rest: DurationCode }
  | { bar: true };

export interface Hymn {
  id: string;
  title: string;
  subtitle: string;
  key: "C" | "G" | "D" | "A" | "F" | "Bb" | "Eb";
  time: [number, number];
  tempo: number;
  tokens: HymnToken[];
}

export const durationQuarters: Record<DurationCode, number> = {
  w: 4,
  h: 2,
  q: 1,
  e: 0.5,
  hd: 3,
  qd: 1.5,
};

export const HYMNS: Hymn[] = [
  {
    id: "c-scale",
    title: "C major scale",
    subtitle: "A clean practice staff — use this to hear the reader lock onto pitches.",
    key: "C",
    time: [4, 4],
    tempo: 80,
    tokens: [
      { pitch: "C4", dur: "q" },
      { pitch: "D4", dur: "q" },
      { pitch: "E4", dur: "q" },
      { pitch: "F4", dur: "q" },
      { bar: true },
      { pitch: "G4", dur: "q" },
      { pitch: "A4", dur: "q" },
      { pitch: "B4", dur: "q" },
      { pitch: "C5", dur: "q" },
    ],
  },
  {
    id: "amazing-grace",
    title: "Amazing Grace",
    subtitle: "New Britain, public domain. Melody in C, 3/4.",
    key: "C",
    time: [3, 4],
    tempo: 72,
    tokens: [
      { pitch: "G4", dur: "q" },
      { bar: true },
      { pitch: "C5", dur: "h" },
      { pitch: "E5", dur: "q" },
      { bar: true },
      { pitch: "C5", dur: "h" },
      { pitch: "A4", dur: "q" },
      { bar: true },
      { pitch: "G4", dur: "h" },
      { pitch: "A4", dur: "q" },
      { bar: true },
      { pitch: "C5", dur: "h" },
      { pitch: "C5", dur: "q" },
      { bar: true },
      { pitch: "E5", dur: "h" },
      { pitch: "D5", dur: "q" },
      { bar: true },
      { pitch: "C5", dur: "h" },
      { pitch: "A4", dur: "q" },
      { bar: true },
      { pitch: "G4", dur: "hd" },
      { bar: true },
      { pitch: "G4", dur: "q" },
      { bar: true },
      { pitch: "C5", dur: "h" },
      { pitch: "E5", dur: "q" },
      { bar: true },
      { pitch: "C5", dur: "h" },
      { pitch: "A4", dur: "q" },
      { bar: true },
      { pitch: "G4", dur: "h" },
      { pitch: "A4", dur: "q" },
      { bar: true },
      { pitch: "C5", dur: "h" },
      { pitch: "C5", dur: "q" },
      { bar: true },
      { pitch: "E5", dur: "h" },
      { pitch: "D5", dur: "q" },
      { bar: true },
      { pitch: "C5", dur: "h" },
      { pitch: "A4", dur: "q" },
      { bar: true },
      { pitch: "G4", dur: "hd" },
    ],
  },
  {
    id: "old-hundredth",
    title: "Old Hundredth",
    subtitle: "The Doxology tune. Long metre, public domain.",
    key: "C",
    time: [4, 4],
    tempo: 88,
    tokens: [
      { pitch: "G4", dur: "q" },
      { pitch: "G4", dur: "q" },
      { pitch: "B4", dur: "q" },
      { pitch: "A4", dur: "q" },
      { bar: true },
      { pitch: "G4", dur: "q" },
      { pitch: "E4", dur: "q" },
      { pitch: "F4", dur: "q" },
      { pitch: "D4", dur: "q" },
      { bar: true },
      { pitch: "G4", dur: "q" },
      { pitch: "G4", dur: "q" },
      { pitch: "A4", dur: "q" },
      { pitch: "B4", dur: "q" },
      { bar: true },
      { pitch: "C5", dur: "q" },
      { pitch: "A4", dur: "q" },
      { pitch: "G4", dur: "q" },
      { pitch: "F4", dur: "q" },
      { bar: true },
      { pitch: "G4", dur: "h" },
    ],
  },
  {
    id: "psalm-tone",
    title: "Psalm tone",
    subtitle: "A simple chanting formula: reciting note, then a cadence.",
    key: "C",
    time: [4, 4],
    tempo: 64,
    tokens: [
      { pitch: "A4", dur: "h" },
      { pitch: "A4", dur: "h" },
      { bar: true },
      { pitch: "A4", dur: "h" },
      { pitch: "A4", dur: "q" },
      { pitch: "G4", dur: "q" },
      { bar: true },
      { pitch: "A4", dur: "q" },
      { pitch: "B4", dur: "q" },
      { pitch: "A4", dur: "h" },
      { bar: true },
      { pitch: "G4", dur: "h" },
      { pitch: "A4", dur: "h" },
    ],
  },
];

export function getHymn(id: string): Hymn | undefined {
  return HYMNS.find((h) => h.id === id);
}
