import { applyKeySignature, midiFromStaffSteps, midiToName } from "@/lib/music/pitch";
import { detectNotes } from "./notes";
import { binarize, prepareBinary } from "./preprocess";
import { toGray, scaleRgba } from "./image";
import { detectStaves, groupSystems, removeStaffLines } from "./staff";
import type {
  DetectedNote,
  KeyName,
  RecognitionResult,
  RgbaImage,
  ScoreEvent,
} from "./types";
import { KEY_ACCIDENTALS } from "./types";

export function sequenceNotes(
  notes: DetectedNote[],
  systems: number[][],
  spaceByStaff: number[],
): ScoreEvent[] {
  const events: ScoreEvent[] = [];
  let time = 0;
  for (const staffIds of systems) {
    const idSet = new Set(staffIds);
    const systemNotes = notes.filter((n) => idSet.has(n.staffIndex)).sort((a, b) => a.x - b.x);
    if (systemNotes.length === 0) continue;
    const avgSpace =
      staffIds.reduce((s, id) => s + (spaceByStaff[id] || 12), 0) / staffIds.length;
    const columns: DetectedNote[][] = [];
    for (const note of systemNotes) {
      const last = columns[columns.length - 1];
      if (last && Math.abs(note.x - last.reduce((s, n) => s + n.x, 0) / last.length) < avgSpace * 0.48) {
        last.push(note);
      } else {
        columns.push([note]);
      }
    }
    for (const column of columns) {
      const quarters = Math.min(...column.map((n) => n.quarters));
      events.push({ time, quarters, notes: column });
      time += quarters;
    }
  }
  return events;
}

export function recognizeSheet(
  image: RgbaImage,
  options: { key?: KeyName; deskew?: boolean } = {},
): RecognitionResult {
  const key = options.key ?? "C";
  const scaled = scaleRgba(image, 1600);
  const warnings: string[] = [];

  let binary;
  let prepared = scaled;
  if (options.deskew === false) {
    binary = binarize(toGray(scaled));
  } else {
    const preparedResult = prepareBinary(scaled);
    binary = preparedResult.binary;
    prepared = preparedResult.prepared;
    if (Math.abs(preparedResult.angle) >= 0.5) {
      warnings.push(`Straightened the page by ${preparedResult.angle.toFixed(1)}°.`);
    }
  }

  const staves = detectStaves(binary);
  if (staves.length === 0) {
    return {
      width: prepared.width,
      height: prepared.height,
      image: prepared,
      staves: [],
      notes: [],
      events: [],
      warnings: [
        "No staff lines found. Try a flatter, higher-contrast scan with the full staff in frame.",
      ],
    };
  }

  const cleaned = removeStaffLines(binary, staves);
  const notes = detectNotes(binary, cleaned, staves, key);
  if (notes.length === 0) {
    warnings.push("Found the staff, but could not lock onto note heads. A cleaner scan helps.");
  }

  const systems = groupSystems(staves).map((s) => s.map((staff) => staff.index));
  const spaceByStaff = staves.map((s) => s.space);
  const events = sequenceNotes(notes, systems, spaceByStaff);

  return {
    width: prepared.width,
    height: prepared.height,
    image: prepared,
    staves,
    notes,
    events,
    warnings,
  };
}

export function retune(result: RecognitionResult, key: KeyName): RecognitionResult {
  const notes = result.notes.map((n) => {
    const staff = result.staves[n.staffIndex];
    let midi = midiFromStaffSteps(n.stepsFromBottom, staff?.clef ?? "treble");
    midi = applyKeySignature(midi, KEY_ACCIDENTALS[key]);
    return { ...n, midi, name: midiToName(midi) };
  });
  const systems = groupSystems(result.staves).map((s) => s.map((staff) => staff.index));
  const spaceByStaff = result.staves.map((s) => s.space);
  return {
    ...result,
    notes,
    events: sequenceNotes(notes, systems, spaceByStaff),
  };
}
