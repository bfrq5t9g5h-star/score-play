import { applyKeySignature, midiFromStaffSteps, midiToName } from "../music/pitch";
import { paintCMajorScale, paintOpenNotes } from "./paint";
import { recognizeSheet } from "./recognize";
import { runOemerDecodeSelfTest } from "./oemer/decode-self-test";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

export function runSelfTest(): string[] {
  const logs: string[] = [];

  assert(midiFromStaffSteps(0, "treble") === 64, `E4 expected 64, got ${midiFromStaffSteps(0, "treble")}`);
  assert(midiFromStaffSteps(2, "treble") === 67, `G4 expected 67, got ${midiFromStaffSteps(2, "treble")}`);
  assert(midiFromStaffSteps(-2, "treble") === 60, `C4 expected 60, got ${midiFromStaffSteps(-2, "treble")}`);
  assert(midiFromStaffSteps(5, "treble") === 72, `C5 expected 72, got ${midiFromStaffSteps(5, "treble")}`);
  assert(midiFromStaffSteps(0, "bass") === 43, `G2 expected 43, got ${midiFromStaffSteps(0, "bass")}`);
  assert(midiToName(60) === "C4", `name C4, got ${midiToName(60)}`);
  assert(applyKeySignature(65, { 5: 1 }) === 66, "F should become F# in G major");
  logs.push("pitch math ok");

  const painted = paintCMajorScale();
  const result = recognizeSheet(painted.image, { deskew: false, key: "C" });
  assert(result.staves.length >= 1, `expected a staff, got ${result.staves.length}`);
  logs.push(`staves ${result.staves.length}, notes ${result.notes.length}`);

  const expected = painted.expected.map((n) => n.midi);
  const got = result.notes.map((n) => n.midi);
  const missing = expected.filter((m) => !got.includes(m));
  assert(
    missing.length === 0,
    `missing pitches ${missing.map(midiToName).join(", ")} (got ${got.map(midiToName).join(" ")})`,
  );

  const sequence = result.notes
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((n) => n.midi);
  assert(
    expected.every((m, i) => sequence[i] === m),
    `order mismatch: expected ${expected.map(midiToName).join(" ")} got ${sequence.map(midiToName).join(" ")}`,
  );
  assert(
    result.notes.every((n) => n.quarters === 1),
    `expected quarters, got ${result.notes.map((n) => n.quarters).join(",")}`,
  );

  const open = paintOpenNotes();
  const openResult = recognizeSheet(open.image, { deskew: false, key: "C" });
  assert(openResult.notes.length >= 2, `open notes: got ${openResult.notes.length}`);
  const openSorted = openResult.notes.slice().sort((a, b) => a.x - b.x);
  assert(openSorted[0].name === "G4", `first open ${openSorted[0]?.name}`);
  assert(openSorted[0].quarters >= 2, `half note duration ${openSorted[0]?.quarters}`);
  logs.push(`open ${openSorted.map((n) => `${n.name}:${n.quarters}`).join(" ")}`);
  logs.push(`scale ${sequence.map(midiToName).join(" ")}`);
  logs.push(...runOemerDecodeSelfTest());
  return logs;
}
