import { midiToName } from "../../music/pitch";
import { paintCMajorScale, paintSatbPhrase } from "../paint";
import { decodeOemerMaps } from "./decode";
import { tilePositions } from "./tiles";
import type { OemerMaps } from "./decode";

function stampEllipse(data: Uint8Array, width: number, height: number, cx: number, cy: number, rx: number, ry: number) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(height - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) data[y * width + x] = 1;
    }
  }
}

function staffFromLines(
  width: number,
  height: number,
  lines: number[],
  x0: number,
  x1: number,
  thickness = 2,
): Uint8Array {
  const data = new Uint8Array(width * height);
  for (const y of lines) {
    for (let t = -1; t < thickness; t++) {
      const yy = Math.round(y + t);
      if (yy < 0 || yy >= height) continue;
      for (let x = x0; x <= x1; x++) data[yy * width + x] = 1;
    }
  }
  return data;
}

function empty(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height);
}

export function runOemerDecodeSelfTest(): string[] {
  const logs: string[] = [];

  const tiles = tilePositions(500, 400, 256, 160);
  const corners = tiles.filter((t) => t.x === 0 || t.y === 0 || t.x === 500 - 256 || t.y === 400 - 256);
  if (tiles.length < 4) throw new Error(`expected several tiles, got ${tiles.length}`);
  if (corners.length < 4) throw new Error("tile grid missed an edge");
  logs.push(`tiles ${tiles.length}`);

  const emptyMaps: OemerMaps = {
    width: 120,
    height: 80,
    staff: empty(120, 80),
    symbols: empty(120, 80),
    notehead: empty(120, 80),
    stems: empty(120, 80),
    clefs: empty(120, 80),
  };
  const emptyResult = decodeOemerMaps(emptyMaps);
  if (emptyResult.staves.length !== 0 || emptyResult.notes.length !== 0) {
    throw new Error("empty heatmaps should not invent music");
  }
  if (!emptyResult.warnings.some((w) => w.includes("0 staff pixels") || w.includes("staff pixels"))) {
    throw new Error(`empty warning missing counts: ${emptyResult.warnings.join(" | ")}`);
  }
  logs.push("empty heatmap reports counts");

  const painted = paintCMajorScale();
  const scaleStaff = staffFromLines(painted.image.width, painted.image.height, painted.staff.y, 40, 1160);
  const notehead = empty(painted.image.width, painted.image.height);
  const stems = empty(painted.image.width, painted.image.height);
  const symbols = empty(painted.image.width, painted.image.height);
  const rx = painted.staff.space * 0.62;
  const ry = painted.staff.space * 0.42;
  for (const n of painted.expected) {
    stampEllipse(notehead, painted.image.width, painted.image.height, n.x, n.y, rx, ry);
    stampEllipse(symbols, painted.image.width, painted.image.height, n.x, n.y, rx, ry);
    const x = Math.round(n.x + rx);
    for (let i = 0; i < painted.staff.space * 3; i++) {
      const y = Math.round(n.y - i);
      if (y >= 0) stems[y * painted.image.width + x] = 1;
    }
  }
  const scaleMaps: OemerMaps = {
    width: painted.image.width,
    height: painted.image.height,
    staff: scaleStaff,
    symbols,
    notehead,
    stems,
    clefs: empty(painted.image.width, painted.image.height),
  };
  const scale = decodeOemerMaps(scaleMaps, "C");
  if (scale.staves.length < 1) throw new Error("scale heatmap missed the staff");
  const got = scale.notes.map((n) => n.midi).sort((a, b) => a - b);
  const want = painted.expected.map((n) => n.midi).sort((a, b) => a - b);
  const missing = want.filter((m) => !got.includes(m));
  if (missing.length) {
    throw new Error(
      `oemer decode missed ${missing.map(midiToName).join(", ")} (got ${scale.notes.map((n) => n.name).join(" ")})`,
    );
  }
  if (scale.events.length === 0) throw new Error("scale heatmap produced no playable events");
  logs.push(`oemer scale ${scale.notes.map((n) => n.name).join(" ")}`);

  const satbPaint = paintSatbPhrase();
  const treble = [0, 1, 2, 3, 4].map((i) => 72 + i * 14);
  const bass = [0, 1, 2, 3, 4].map((i) => 72 + 14 * 4 + 14 * 2.6 + i * 14);
  const satbStaff = staffFromLines(satbPaint.image.width, satbPaint.image.height, [...treble, ...bass], 36, 860);
  const satbHeads = empty(satbPaint.image.width, satbPaint.image.height);
  const satbSymbols = empty(satbPaint.image.width, satbPaint.image.height);
  const satbStems = empty(satbPaint.image.width, satbPaint.image.height);
  for (const n of satbPaint.expected) {
    stampEllipse(satbHeads, satbPaint.image.width, satbPaint.image.height, n.x, n.y, 14 * 0.62, 14 * 0.42);
    stampEllipse(satbSymbols, satbPaint.image.width, satbPaint.image.height, n.x, n.y, 14 * 0.62, 14 * 0.42);
    const x = Math.round(n.x + 8);
    for (let i = 0; i < 30; i++) {
      const y = Math.round(n.y - i);
      if (y >= 0) satbStems[y * satbPaint.image.width + x] = 1;
    }
  }
  const satb = decodeOemerMaps(
    {
      width: satbPaint.image.width,
      height: satbPaint.image.height,
      staff: satbStaff,
      symbols: satbSymbols,
      notehead: satbHeads,
      stems: satbStems,
      clefs: empty(satbPaint.image.width, satbPaint.image.height),
    },
    "C",
  );
  if (satb.staves.length < 2) throw new Error(`SATB heatmap expected 2 staves, got ${satb.staves.length}`);
  const chordNames = ["C3", "G3", "E4", "C5"];
  for (const name of chordNames) {
    if (!satb.notes.some((n) => n.name === name)) {
      throw new Error(`SATB decode missed ${name} (got ${satb.notes.map((n) => n.name).join(" ")})`);
    }
  }
  const chordEvent = satb.events.find((e) => e.notes.length >= 4);
  if (!chordEvent) throw new Error("SATB decode did not form a playable SATB chord");
  logs.push(`oemer SATB ${satb.staves.length} staves, ${satb.notes.length} notes, chord ${chordEvent.notes.map((n) => n.name).join("+")}`);

  return logs;
}
