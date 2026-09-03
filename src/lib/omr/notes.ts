import { applyKeySignature, midiFromStaffSteps, midiToName } from "@/lib/music/pitch";
import type { BinaryImage, DetectedNote, KeyName, Staff } from "./types";
import { KEY_ACCIDENTALS } from "./types";
import { ellipseInkRatio, inkAt, ringInkRatio } from "./image";

interface Candidate {
  x: number;
  y: number;
  staffIndex: number;
  stepsFromBottom: number;
  filled: boolean;
  score: number;
}

function findStem(
  image: BinaryImage,
  x: number,
  y: number,
  space: number,
): { found: boolean; flagged: boolean; beamed: boolean } {
  const stemLen = space * 2.8;
  const thickness = Math.max(1, Math.round(space * 0.2));

  const check = (dir: 1 | -1, sx: number) => {
    let hits = 0;
    let needed = 0;
    const yStart = dir === -1 ? y - space * 0.4 : y + space * 0.4;
    for (let i = 0; i < stemLen; i++) {
      const sy = Math.round(yStart + dir * i);
      needed++;
      let col = 0;
      for (let dx = -thickness; dx <= thickness; dx++) col += inkAt(image, Math.round(sx) + dx, sy);
      if (col > 0) hits++;
    }
    const found = needed > 0 && hits / needed > 0.34;
    let flagged = false;
    let beamed = false;
    if (found) {
      const tipY = Math.round(yStart + dir * stemLen);
      let diag = 0;
      for (let k = 0; k < space; k++) {
        diag += inkAt(image, Math.round(sx) + 2 + k, tipY + (dir === -1 ? k * 0.6 : -k * 0.6));
      }
      flagged = diag > space * 0.35;
      let beam = 0;
      for (let k = 1; k < space * 1.4; k++) {
        beam += inkAt(image, Math.round(sx) + k, tipY);
        beam += inkAt(image, Math.round(sx) + k, tipY + dir);
      }
      beamed = beam > space * 0.8;
    }
    return { found, flagged, beamed, hits };
  };

  let best = { found: false, flagged: false, beamed: false, hits: 0 };
  for (const dir of [-1, 1] as const) {
    for (const side of [-1, 1] as const) {
      for (let k = 0.35; k <= 0.85; k += 0.1) {
        const result = check(dir, x + side * space * k);
        if (result.hits > best.hits) best = result;
      }
    }
  }
  return { found: best.found, flagged: best.flagged, beamed: best.beamed };
}

function hasDot(image: BinaryImage, x: number, y: number, space: number): boolean {
  const dx = space * 0.95;
  const cx = x + dx;
  let ink = 0;
  let n = 0;
  const r = Math.max(1.5, space * 0.16);
  for (let yy = -r; yy <= r; yy++) {
    for (let xx = -r; xx <= r; xx++) {
      if (xx * xx + yy * yy > r * r) continue;
      n++;
      ink += inkAt(image, Math.round(cx + xx), Math.round(y + yy));
    }
  }
  return n > 0 && ink / n > 0.45;
}

export function detectNotes(
  original: BinaryImage,
  cleaned: BinaryImage,
  staves: Staff[],
  key: KeyName = "C",
): DetectedNote[] {
  const accidentals = KEY_ACCIDENTALS[key];
  const candidates: Candidate[] = [];

  for (const staff of staves) {
    const space = staff.space;
    const bottom = staff.lines[4].y;
    const rx = space * 0.68;
    const ry = space * 0.48;
    const xStart = Math.min(staff.x1 - space, staff.x0 + space * 4.2);
    const stepX = Math.max(2, Math.round(space / 6));

    for (let step = -5; step <= 12; step++) {
      const y = bottom - step * (space / 2);
      if (y < 2 || y >= cleaned.height - 2) continue;
      for (let x = xStart; x <= staff.x1 - space * 0.4; x += stepX) {
        const filled = ellipseInkRatio(cleaned, x, y, rx, ry);
        const open = ringInkRatio(cleaned, x, y, rx * 1.05, ry * 1.08, 0.52);
        let score = 0;
        let isFilled = false;
        if (filled.samples > 8 && filled.ratio >= 0.62) {
          score = 1 + filled.ratio;
          isFilled = true;
        } else if (
          filled.samples > 8 &&
          filled.ratio >= 0.18 &&
          filled.ratio < 0.62 &&
          open.ring >= 0.36 &&
          open.inner <= 0.28
        ) {
          score = open.ring * (1 - open.inner);
          isFilled = false;
        }
        if (score > 0) {
          candidates.push({
            x,
            y,
            staffIndex: staff.index,
            stepsFromBottom: step,
            filled: isFilled,
            score,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => Number(b.filled) - Number(a.filled) || b.score - a.score);
  const kept: Candidate[] = [];
  const taken = new Uint8Array(original.width * original.height);

  const mark = (c: Candidate, space: number) => {
    const r = Math.max(3, Math.round(space * 0.55));
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        const x = Math.round(c.x + xx);
        const y = Math.round(c.y + yy);
        if (x < 0 || y < 0 || x >= original.width || y >= original.height) continue;
        taken[y * original.width + x] = 1;
      }
    }
  };

  for (const c of candidates) {
    const staff = staves[c.staffIndex];
    const ix = Math.round(c.x);
    const iy = Math.round(c.y);
    if (ix < 0 || iy < 0 || ix >= original.width || iy >= original.height) continue;
    if (taken[iy * original.width + ix]) continue;
    kept.push(c);
    mark(c, staff.space);
  }

  const notes: DetectedNote[] = kept.map((c, i) => {
    const staff = staves[c.staffIndex];
    const stem = findStem(original, c.x, c.y, staff.space);
    const dotted = hasDot(cleaned, c.x, c.y, staff.space);
    let quarters = 1;
    if (!c.filled && !stem.found) quarters = 4;
    else if (!c.filled && stem.found) quarters = 2;
    else if (c.filled && (stem.flagged || stem.beamed)) quarters = 0.5;
    else quarters = 1;
    if (dotted) quarters *= 1.5;

    let midi = midiFromStaffSteps(c.stepsFromBottom, staff.clef);
    midi = applyKeySignature(midi, accidentals);

    return {
      id: `n${i}`,
      x: c.x,
      y: c.y,
      staffIndex: c.staffIndex,
      stepsFromBottom: c.stepsFromBottom,
      midi,
      name: midiToName(midi),
      quarters,
      filled: c.filled,
      hasStem: stem.found,
      dotted,
      confidence: Math.max(0.15, Math.min(1, c.score)),
    };
  });

  notes.sort((a, b) => a.staffIndex - b.staffIndex || a.x - b.x || a.y - b.y);
  return notes;
}
