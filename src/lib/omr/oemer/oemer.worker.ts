/// <reference lib="webworker" />

import { OEMER_MODELS } from "./constants";
import { decodeOemerMaps, mapsFromClassMaps } from "./decode";
import { configureOrt, createSession, runUnet } from "./infer";
import { fetchOemerModels } from "./models";
import type { OemerRequest, OemerResponse } from "./messages";

declare const self: DedicatedWorkerGlobalScope;

let staffSession: Awaited<ReturnType<typeof createSession>> | null = null;
let symbolSession: Awaited<ReturnType<typeof createSession>> | null = null;
let cancelledId = -1;
let activeId = -1;

function post(msg: OemerResponse) {
  self.postMessage(msg);
}

function isCancelled() {
  return cancelledId === activeId;
}

async function ensureSessions(
  modelBase: string,
  id: number,
) {
  if (staffSession && symbolSession) return;
  configureOrt();
  const buffers = await fetchOemerModels(modelBase, (message, percent) => {
    post({ type: "progress", id, message, percent: Math.round(percent * 0.35) });
  });
  post({ type: "progress", id, message: "Starting the staff network…", percent: 36 });
  staffSession = await createSession(buffers.staff);
  post({ type: "progress", id, message: "Starting the note network…", percent: 40 });
  symbolSession = await createSession(buffers.symbols);
}

async function recognize(req: Extract<OemerRequest, { type: "recognize" }>) {
  activeId = req.id;
  const rgba = new Uint8ClampedArray(req.rgba);
  await ensureSessions(req.modelBase, req.id);
  if (isCancelled()) return;
  if (!staffSession || !symbolSession) throw new Error("Models failed to load.");

  post({ type: "progress", id: req.id, message: "Reading staff lines…", percent: 42 });
  const staffMap = await runUnet(
    staffSession,
    rgba,
    req.width,
    req.height,
    OEMER_MODELS.staff.win,
    OEMER_MODELS.staff.classes,
    (done, total) => {
      const pct = 42 + Math.round((done / total) * 28);
      post({
        type: "progress",
        id: req.id,
        message: `Reading staff lines (${done}/${total})…`,
        percent: pct,
      });
    },
    isCancelled,
  );
  if (isCancelled()) return;

  post({ type: "progress", id: req.id, message: "Reading note heads…", percent: 72 });
  const symbolMap = await runUnet(
    symbolSession,
    rgba,
    req.width,
    req.height,
    OEMER_MODELS.symbols.win,
    OEMER_MODELS.symbols.classes,
    (done, total) => {
      const pct = 72 + Math.round((done / total) * 22);
      post({
        type: "progress",
        id: req.id,
        message: `Reading note heads (${done}/${total})…`,
        percent: pct,
      });
    },
    isCancelled,
  );
  if (isCancelled()) return;

  post({ type: "progress", id: req.id, message: "Turning marks into pitches…", percent: 95 });
  const maps = mapsFromClassMaps(staffMap, symbolMap, req.width, req.height);
  const decoded = decodeOemerMaps(maps, req.key);
  const tiles =
    Math.ceil(req.width / 160) * Math.ceil(req.height / 160);
  decoded.stats.tiles = tiles;

  post({
    type: "result",
    id: req.id,
    payload: {
      width: req.width,
      height: req.height,
      staves: decoded.staves,
      notes: decoded.notes,
      events: decoded.events,
      warnings: decoded.warnings,
      stats: decoded.stats,
      engine: "oemer",
    },
  });
}

self.onmessage = (event: MessageEvent<OemerRequest>) => {
  const data = event.data;
  if (data.type === "cancel") {
    cancelledId = data.id;
    return;
  }
  if (data.type === "recognize") {
    recognize(data).catch((err) => {
      if (String(err?.message) === "cancelled") return;
      post({
        type: "error",
        id: data.id,
        message: err instanceof Error ? err.message : "Neural reading failed.",
      });
    });
  }
};
