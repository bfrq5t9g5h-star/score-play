import type { DetectedNote, ScoreEvent } from "./types";

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
      staffIds.reduce((s, id) => s + (spaceByStaff[id] || 12), 0) / Math.max(1, staffIds.length);
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
