import type { BinaryImage, Staff, StaffLine } from "./types";
import { cloneBinary } from "./image";

function horizontalProjection(image: BinaryImage): Float64Array {
  const proj = new Float64Array(image.height);
  for (let y = 0; y < image.height; y++) {
    let sum = 0;
    const row = y * image.width;
    for (let x = 0; x < image.width; x++) sum += image.data[row + x];
    proj[y] = sum;
  }
  return proj;
}

function clusterPeaks(proj: Float64Array, width: number, inkRatio: number): StaffLine[] {
  const threshold = Math.max(width * inkRatio, 8);
  const lines: StaffLine[] = [];
  let y = 0;
  while (y < proj.length) {
    if (proj[y] < threshold) {
      y++;
      continue;
    }
    let y1 = y;
    let weighted = 0;
    let mass = 0;
    while (y1 < proj.length && proj[y1] >= threshold * 0.65) {
      weighted += y1 * proj[y1];
      mass += proj[y1];
      y1++;
    }
    if (mass > 0 && y1 - y <= 8) {
      lines.push({
        y: weighted / mass,
        thickness: Math.max(1, y1 - y),
      });
    }
    y = Math.max(y1, y + 1);
  }
  return lines;
}

function spacingScore(ys: number[], maxCv: number): { space: number; ok: boolean } {
  if (ys.length !== 5) return { space: 0, ok: false };
  const gaps: number[] = [];
  for (let i = 1; i < 5; i++) gaps.push(ys[i] - ys[i - 1]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (mean < 6 || mean > 80) return { space: mean, ok: false };
  let varSum = 0;
  for (const g of gaps) varSum += (g - mean) ** 2;
  const cv = Math.sqrt(varSum / gaps.length) / mean;
  return { space: mean, ok: cv < maxCv };
}

export function detectStaves(
  image: BinaryImage,
  options: { inkRatio?: number; maxCv?: number } = {},
): Staff[] {
  const inkRatio = options.inkRatio ?? 0.18;
  const maxCv = options.maxCv ?? 0.22;
  const proj = horizontalProjection(image);
  const peaks = clusterPeaks(proj, image.width, inkRatio);
  const used = new Set<number>();
  const staves: Staff[] = [];

  for (let i = 0; i < peaks.length; i++) {
    if (used.has(i)) continue;
    let best: { idxs: number[]; space: number } | null = null;
    for (let j = i + 4; j < Math.min(peaks.length, i + 14); j++) {
      const group = peaks.slice(i, j + 1);
      if (group.length < 5) continue;
      if (group.length === 5) {
        const ys = group.map((g) => g.y);
        const scored = spacingScore(ys, maxCv);
        if (scored.ok) {
          best = { idxs: [i, i + 1, i + 2, i + 3, i + 4], space: scored.space };
          break;
        }
      } else {
        // Try every combination of 5 from a slightly larger cluster by stepping.
        for (let a = i; a <= j - 4; a++) {
          const idxs = [a, a + 1, a + 2, a + 3, a + 4];
          if (idxs.some((k) => used.has(k))) continue;
          const ys = idxs.map((k) => peaks[k].y);
          const scored = spacingScore(ys, maxCv);
          if (scored.ok && (!best || scored.space > 8)) {
            best = { idxs, space: scored.space };
          }
        }
      }
    }
    if (!best) continue;
    for (const idx of best.idxs) used.add(idx);
    const lines = best.idxs.map((k) => peaks[k]);
    const yTop = lines[0].y;
    const yBot = lines[4].y;
    const band = (yBot - yTop) * 0.15 + best.space;
    const colInk = new Float64Array(image.width);
    for (let x = 0; x < image.width; x++) {
      let ink = 0;
      const y0 = Math.max(0, Math.floor(yTop - band));
      const y1 = Math.min(image.height - 1, Math.ceil(yBot + band));
      for (let y = y0; y <= y1; y++) ink += image.data[y * image.width + x];
      colInk[x] = ink;
    }
    const colThresh = ((yBot - yTop) + 2 * band) * 0.08;
    let x0 = 0;
    while (x0 < image.width && colInk[x0] < colThresh) x0++;
    let x1 = image.width - 1;
    while (x1 > x0 && colInk[x1] < colThresh) x1--;

    // Clef guess: dense ink at the left that extends above/below the staff → treble.
    let above = 0;
    let below = 0;
    let onStaff = 0;
    const clefRight = Math.min(image.width, x0 + Math.round(best.space * 4.5));
    for (let x = x0; x < clefRight; x++) {
      for (let y = Math.max(0, Math.floor(yTop - 3 * best.space)); y < yTop; y++) {
        above += image.data[y * image.width + x];
      }
      for (let y = Math.ceil(yBot) + 1; y <= Math.min(image.height - 1, yBot + 3 * best.space); y++) {
        below += image.data[y * image.width + x];
      }
      for (let y = Math.floor(yTop); y <= yBot; y++) {
        onStaff += image.data[y * image.width + x];
      }
    }
    const trebleLike = above > best.space * 8 && below > best.space * 4;
    const bassLike = !trebleLike && onStaff > 0 && above < below * 0.6;

    staves.push({
      lines,
      space: best.space,
      x0,
      x1: Math.max(x0 + 10, x1),
      clef: bassLike ? "bass" : "treble",
      index: staves.length,
    });
  }

  // If two staves are close, the lower is often bass in a hymnal grand staff.
  for (let i = 1; i < staves.length; i++) {
    const gap = staves[i].lines[0].y - staves[i - 1].lines[4].y;
    const space = (staves[i].space + staves[i - 1].space) / 2;
    if (gap < space * 3.2 && staves[i].clef === "treble") {
      const lowerExtent =
        staves[i].lines[4].y - staves[i].lines[0].y;
      if (lowerExtent > 0) staves[i].clef = "bass";
    }
  }

  return staves;
}

export function removeStaffLines(image: BinaryImage, staves: Staff[]): BinaryImage {
  const out = cloneBinary(image);
  for (const staff of staves) {
    for (const line of staff.lines) {
      const yCenter = Math.round(line.y);
      const half = Math.max(1, Math.ceil(line.thickness / 2) + 1);
      for (let x = Math.max(0, staff.x0 - 4); x <= Math.min(image.width - 1, staff.x1 + 4); x++) {
        for (let dy = -half; dy <= half; dy++) {
          const y = yCenter + dy;
          if (y < 0 || y >= image.height) continue;
          if (!image.data[y * image.width + x]) continue;
          let y0 = y;
          while (y0 > 0 && image.data[(y0 - 1) * image.width + x]) y0--;
          let y1 = y;
          while (y1 < image.height - 1 && image.data[(y1 + 1) * image.width + x]) y1++;
          const run = y1 - y0 + 1;
          if (run <= line.thickness + 2) {
            out.data[y * image.width + x] = 0;
          }
        }
      }
    }
  }
  return out;
}

export function groupSystems(staves: Staff[]): Staff[][] {
  if (staves.length === 0) return [];
  const systems: Staff[][] = [[staves[0]]];
  for (let i = 1; i < staves.length; i++) {
    const prev = staves[i - 1];
    const cur = staves[i];
    const gap = cur.lines[0].y - prev.lines[4].y;
    const space = (cur.space + prev.space) / 2;
    if (gap < space * 3.4) systems[systems.length - 1].push(cur);
    else systems.push([cur]);
  }
  return systems;
}
