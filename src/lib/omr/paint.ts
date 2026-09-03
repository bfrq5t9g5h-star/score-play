import { midiFromStaffSteps, midiToName } from "@/lib/music/pitch";
import { createRgba } from "./image";
import type { RgbaImage } from "./types";

function setPixel(img: RgbaImage, x: number, y: number, r: number, g: number, b: number) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= img.width || py >= img.height) return;
  const i = (py * img.width + px) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = 255;
}

export function fillEllipse(
  img: RgbaImage,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color = [20, 18, 16] as [number, number, number],
) {
  const x0 = Math.floor(cx - rx - 1);
  const x1 = Math.ceil(cx + rx + 1);
  const y0 = Math.floor(cy - ry - 1);
  const y1 = Math.ceil(cy + ry + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(img, x, y, color[0], color[1], color[2]);
    }
  }
}

export function strokeEllipse(
  img: RgbaImage,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  t = 2,
  color = [20, 18, 16] as [number, number, number],
) {
  const x0 = Math.floor(cx - rx - t);
  const x1 = Math.ceil(cx + rx + t);
  const y0 = Math.floor(cy - ry - t);
  const y1 = Math.ceil(cy + ry + t);
  const outer = 1;
  const inner = 1 - t / Math.min(rx, ry);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d <= outer && d >= inner * inner) setPixel(img, x, y, color[0], color[1], color[2]);
    }
  }
}

export function drawHLine(
  img: RgbaImage,
  x0: number,
  x1: number,
  y: number,
  thickness: number,
  color = [20, 18, 16] as [number, number, number],
) {
  const half = Math.floor(thickness / 2);
  for (let x = Math.round(x0); x <= Math.round(x1); x++) {
    for (let dy = -half; dy < thickness - half; dy++) {
      setPixel(img, x, y + dy, color[0], color[1], color[2]);
    }
  }
}

export function drawVLine(
  img: RgbaImage,
  x: number,
  y0: number,
  y1: number,
  thickness: number,
  color = [20, 18, 16] as [number, number, number],
) {
  const a = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  const half = Math.floor(thickness / 2);
  for (let y = Math.round(a); y <= Math.round(b); y++) {
    for (let dx = -half; dx < thickness - half; dx++) {
      setPixel(img, x + dx, y, color[0], color[1], color[2]);
    }
  }
}

export interface PaintedScore {
  image: RgbaImage;
  expected: { midi: number; name: string; x: number; y: number; quarters: number }[];
  staff: { y: number[]; space: number };
}

/** Clean treble-clef C major scale used to verify the reader. */
export function paintCMajorScale(): PaintedScore {
  const space = 16;
  const x0 = 40;
  const x1 = 1160;
  const top = 100;
  const lines = [0, 1, 2, 3, 4].map((i) => top + i * space);
  const img = createRgba(1200, 360, 255, 255, 255, 255);
  for (const y of lines) drawHLine(img, x0, x1, y, 2);

  const bottom = lines[4];
  const notes = [0, 1, 2, 3, 4, 5, 6, 7].map((stepFromC4) => {
    // C4 is 2 steps below the bottom line (E4).
    const stepsFromBottom = -2 + stepFromC4;
    const y = bottom - stepsFromBottom * (space / 2);
    const x = 220 + stepFromC4 * 110;
    return { stepsFromBottom, x, y };
  });

  const expected: PaintedScore["expected"] = [];
  const rx = space * 0.62;
  const ry = space * 0.42;
  for (const note of notes) {
    fillEllipse(img, note.x, note.y, rx, ry);
    const middle = lines[2];
    if (note.y >= middle) {
      drawVLine(img, note.x + rx - 1, note.y, note.y - space * 3.1, 2);
    } else {
      drawVLine(img, note.x - rx + 1, note.y, note.y + space * 3.1, 2);
    }
    const midi = midiFromStaffSteps(note.stepsFromBottom, "treble");
    expected.push({
      midi,
      name: midiToName(midi),
      x: note.x,
      y: note.y,
      quarters: 1,
    });
  }

  return { image: img, expected, staff: { y: lines, space } };
}

export function paintOpenNotes(): PaintedScore {
  const space = 16;
  const x0 = 40;
  const x1 = 900;
  const top = 100;
  const lines = [0, 1, 2, 3, 4].map((i) => top + i * space);
  const img = createRgba(960, 360, 255, 255, 255, 255);
  for (const y of lines) drawHLine(img, x0, x1, y, 2);
  const bottom = lines[4];
  const rx = space * 0.62;
  const ry = space * 0.42;
  const g4 = { x: 260, y: bottom - 2 * (space / 2), quarters: 2 };
  const a4 = { x: 460, y: bottom - 3 * (space / 2), quarters: 4 };
  strokeEllipse(img, g4.x, g4.y, rx, ry, 3);
  drawVLine(img, g4.x + rx - 1, g4.y, g4.y - space * 3.1, 2);
  strokeEllipse(img, a4.x, a4.y, rx * 1.05, ry * 1.05, 3);
  const expected = [
    { midi: 67, name: "G4", x: g4.x, y: g4.y, quarters: 2 },
    { midi: 69, name: "A4", x: a4.x, y: a4.y, quarters: 4 },
  ];
  return { image: img, expected, staff: { y: lines, space } };
}
