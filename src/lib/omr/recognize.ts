import { applyKeySignature, midiFromStaffSteps, midiToName } from "@/lib/music/pitch";
import { detectNotes } from "./notes";
import { binarize, prepareBinary } from "./preprocess";
import { toGray, scaleRgba } from "./image";
import { detectStaves, groupSystems, removeStaffLines } from "./staff";
import type { KeyName, RecognitionResult, RgbaImage } from "./types";
import { KEY_ACCIDENTALS } from "./types";
import { sequenceNotes } from "./sequence";

export { sequenceNotes };

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
      engine: "classical",
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
    engine: "classical",
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
