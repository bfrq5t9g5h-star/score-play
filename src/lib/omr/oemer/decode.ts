import { applyKeySignature, midiFromStaffSteps, midiToName } from "../../music/pitch";
import { sequenceNotes } from "../sequence";
import { detectStaves, groupSystems } from "../staff";
import { KEY_ACCIDENTALS } from "../types";
import type { BinaryImage, DetectedNote, KeyName, Staff } from "../types";
import { closeRect, connectedBlobs, countPositive, fillHole, sliceRect } from "./morph";
import type { OemerStats } from "./messages";

export interface OemerMaps {
  width: number;
  height: number;
  staff: Uint8Array;
  symbols: Uint8Array;
  notehead: Uint8Array;
  stems: Uint8Array;
  clefs: Uint8Array;
}

export interface DecodeResult {
  staves: Staff[];
  notes: DetectedNote[];
  events: ReturnType<typeof sequenceNotes>;
  warnings: string[];
  stats: OemerStats;
}

function toBinary(data: Uint8Array, width: number, height: number): BinaryImage {
  return { width, height, data };
}

function splitStackedBoxes(
  box: { x0: number; y0: number; x1: number; y1: number; area: number; cx: number; cy: number },
  unit: number,
): { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number; area: number }[] {
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const noteW = unit * 1.29;
  const noteH = unit;
  const out: typeof box[] = [];

  if (Math.abs(w - noteW) > Math.abs(w - noteW * 2) && w > noteW * 1.45) {
    const mid = Math.round((box.x0 + box.x1) / 2);
    out.push(
      ...splitStackedBoxes({ ...box, x1: mid, cx: (box.x0 + mid) / 2, area: Math.max(1, box.area / 2) }, unit),
      ...splitStackedBoxes({ ...box, x0: mid, cx: (mid + box.x1) / 2, area: Math.max(1, box.area / 2) }, unit),
    );
    return out;
  }

  const n = Math.max(1, Math.round(h / Math.max(4, noteH)));
  if (n > 1 && h > noteH * 1.45) {
    const sub = h / n;
    for (let i = 0; i < n; i++) {
      const y0 = box.y0 + i * sub;
      const y1 = box.y0 + (i + 1) * sub;
      out.push({
        x0: box.x0,
        y0,
        x1: box.x1,
        y1,
        cx: box.cx,
        cy: (y0 + y1) / 2,
        area: Math.max(1, box.area / n),
      });
    }
    return out;
  }
  return [box];
}

function guessClef(staff: Staff, clefs: Uint8Array, width: number, height: number): Staff {
  const space = staff.space;
  const x0 = Math.max(0, Math.floor(staff.x0));
  const x1 = Math.min(width, Math.floor(staff.x0 + space * 4.8));
  const yTop = Math.max(0, Math.floor(staff.lines[0].y - space * 3));
  const yBot = Math.min(height - 1, Math.ceil(staff.lines[4].y + space * 2));
  let above = 0;
  let on = 0;
  for (let y = yTop; y <= yBot; y++) {
    for (let x = x0; x < x1; x++) {
      if (!clefs[y * width + x]) continue;
      if (y < staff.lines[0].y) above++;
      else if (y <= staff.lines[4].y) on++;
    }
  }
  const trebleLike = above > on * 0.35 && above > space * 2;
  const bassLike = !trebleLike && on > above * 1.4;
  return { ...staff, clef: bassLike ? "bass" : trebleLike ? "treble" : staff.clef };
}

function stemNear(
  stems: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  space: number,
): boolean {
  const x0 = Math.max(0, Math.round(cx - space * 1.2));
  const x1 = Math.min(width - 1, Math.round(cx + space * 1.2));
  const y0 = Math.max(0, Math.round(cy - space * 3.2));
  const y1 = Math.min(height - 1, Math.round(cy + space * 3.2));
  let hits = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (stems[y * width + x]) hits++;
    }
  }
  return hits > space * 1.2;
}

function hasDot(
  symbols: Uint8Array,
  width: number,
  height: number,
  x1: number,
  cy: number,
  space: number,
): boolean {
  const x0 = Math.round(x1 + space * 0.15);
  const x2 = Math.min(width - 1, Math.round(x1 + space * 1.15));
  const y0 = Math.max(0, Math.round(cy - space * 0.45));
  const y1 = Math.min(height - 1, Math.round(cy + space * 0.45));
  let ink = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x2; x++) ink += symbols[y * width + x];
  }
  return ink > 4 && ink < space * space * 0.55;
}

function isHollow(
  symbols: Uint8Array,
  width: number,
  height: number,
  box: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  const region = sliceRect(symbols, width, height, box.x0, box.y0, box.x1 + 1, box.y1 + 1);
  if (region.w < 3 || region.h < 3) return false;
  const count = countPositive(region.data);
  if (count === 0) return false;
  const filled = fillHole(region.data, region.w, region.h);
  const fCount = countPositive(filled);
  return fCount / count > 1.28;
}

export function mapsFromClassMaps(
  staffMap: Uint8Array,
  symbolMap: Uint8Array,
  width: number,
  height: number,
): OemerMaps {
  const staff = new Uint8Array(width * height);
  const symbols = new Uint8Array(width * height);
  const notehead = new Uint8Array(width * height);
  const stems = new Uint8Array(width * height);
  const clefs = new Uint8Array(width * height);
  for (let i = 0; i < staffMap.length; i++) {
    if (staffMap[i] === 1) staff[i] = 1;
    if (staffMap[i] === 2) symbols[i] = 1;
  }
  for (let i = 0; i < symbolMap.length; i++) {
    if (symbolMap[i] === 1) stems[i] = 1;
    if (symbolMap[i] === 2) notehead[i] = 1;
    if (symbolMap[i] === 3) clefs[i] = 1;
    if (symbolMap[i] > 0) symbols[i] = 1;
  }
  return { width, height, staff, symbols, notehead, stems, clefs };
}

export function decodeOemerMaps(maps: OemerMaps, key: KeyName = "C"): DecodeResult {
  const { width, height } = maps;
  const warnings: string[] = [];
  const stats: OemerStats = {
    staffPixels: countPositive(maps.staff),
    symbolPixels: countPositive(maps.symbols),
    noteheadPixels: countPositive(maps.notehead),
    stemPixels: countPositive(maps.stems),
    clefPixels: countPositive(maps.clefs),
    noteCount: 0,
    staffCount: 0,
    tiles: 0,
  };

  const closedStaff = closeRect(maps.staff, width, height, 15, 3);
  let staves = detectStaves(toBinary(closedStaff, width, height), { inkRatio: 0.1, maxCv: 0.32 });
  if (staves.length === 0) {
    staves = detectStaves(toBinary(closedStaff, width, height), { inkRatio: 0.045, maxCv: 0.4 });
  }
  if (staves.length === 0) {
    staves = detectStaves(toBinary(maps.staff, width, height), { inkRatio: 0.03, maxCv: 0.45 });
  }

  staves = staves.map((s, i) => guessClef({ ...s, index: i }, maps.clefs, width, height));
  const systemsForClef = groupSystems(staves);
  staves = staves.map((s) => ({ ...s }));
  for (const sys of systemsForClef) {
    if (sys.length === 2 || sys.length === 4) {
      for (let i = 0; i < sys.length; i++) {
        const idx = sys[i].index;
        staves[idx] = { ...staves[idx], clef: i % 2 === 0 ? "treble" : "bass" };
      }
    }
  }
  stats.staffCount = staves.length;

  if (staves.length === 0) {
    warnings.push(
      `oemer found ${stats.staffPixels} staff pixels and ${stats.noteheadPixels} note-head pixels, but could not group staff lines.`,
    );
    return { staves: [], notes: [], events: [], warnings, stats };
  }

  const unit =
    staves.reduce((s, st) => s + st.space, 0) / Math.max(1, staves.length) || 12;
  const morphW = Math.max(3, Math.round(unit * 0.5));
  const morphH = Math.max(3, Math.round(unit * 0.4));
  const closedHeads = closeRect(maps.notehead, width, height, Math.max(3, Math.round(unit / 3)), Math.max(3, Math.round(unit / 3)));
  const eroded = closeRect(closedHeads, width, height, morphW, morphH);
  const blobs = connectedBlobs(eroded, width, height, Math.max(4, Math.round(unit * 0.25)));

  const boxes = blobs.flatMap((b) => {
    const local = staves.reduce((best, st) => {
      const d = Math.abs(st.lines[2].y - b.cy);
      return d < best.d ? { d, space: st.space } : best;
    }, { d: Infinity, space: unit });
    return splitStackedBoxes(b, local.space);
  });

  const accidentals = KEY_ACCIDENTALS[key];
  const notes: DetectedNote[] = [];
  const taken: { x: number; y: number; r: number }[] = [];

  for (const box of boxes) {
    const w = box.x1 - box.x0 + 1;
    const h = box.y1 - box.y0 + 1;
    let nearest: Staff | null = null;
    let nearestDist = Infinity;
    for (const st of staves) {
      const top = st.lines[0].y - st.space * 5;
      const bot = st.lines[4].y + st.space * 5;
      if (box.cy < top || box.cy > bot) continue;
      const d = Math.abs(st.lines[2].y - box.cy);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = st;
      }
    }
    if (!nearest) continue;
    const space = nearest.space;
    if (h < space * 0.28 || h > space * 5) continue;
    if (w < space * 0.28 || w > space * 4) continue;
    if (box.cx < nearest.x0 + space * 3.6) continue;
    if (box.cx > nearest.x1 + space) continue;

    const tooClose = taken.some((t) => Math.hypot(t.x - box.cx, t.y - box.cy) < t.r);
    if (tooClose) continue;
    taken.push({ x: box.cx, y: box.cy, r: space * 0.55 });

    const bottom = nearest.lines[4].y;
    const stepsFromBottom = Math.round((bottom - box.cy) / (space / 2));
    const hollow = isHollow(maps.symbols, width, height, box);
    const hasStem = stemNear(maps.stems, width, height, box.cx, box.cy, space);
    const dotted = hasDot(maps.symbols, width, height, box.x1, box.cy, space);
    let quarters = 1;
    if (hollow && !hasStem) quarters = 4;
    else if (hollow && hasStem) quarters = 2;
    else quarters = 1;
    if (dotted) quarters *= 1.5;

    let midi = midiFromStaffSteps(stepsFromBottom, nearest.clef);
    midi = applyKeySignature(midi, accidentals);

    notes.push({
      id: `o${notes.length}`,
      x: box.cx,
      y: box.cy,
      staffIndex: nearest.index,
      stepsFromBottom,
      midi,
      name: midiToName(midi),
      quarters,
      filled: !hollow,
      hasStem,
      dotted,
      confidence: Math.max(0.2, Math.min(1, box.area / (space * space * 1.2))),
    });
  }

  notes.sort((a, b) => a.staffIndex - b.staffIndex || a.x - b.x || a.y - b.y);
  stats.noteCount = notes.length;

  if (notes.length === 0) {
    warnings.push(
      `oemer found ${staves.length} staff${staves.length === 1 ? "" : "s"} and ${stats.noteheadPixels} note-head pixels, but could not lock onto playable heads.`,
    );
  } else {
    warnings.push(`oemer found ${notes.length} note head${notes.length === 1 ? "" : "s"} on ${staves.length} staff${staves.length === 1 ? "" : "s"}.`);
  }

  const systems = groupSystems(staves).map((s) => s.map((staff) => staff.index));
  const events = sequenceNotes(
    notes,
    systems,
    staves.map((s) => s.space),
  );

  return { staves, notes, events, warnings, stats };
}
