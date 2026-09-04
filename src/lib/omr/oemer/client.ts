import { INFERENCE_TIMEOUT_MS } from "./constants";
import type { OemerRequest, OemerResponse, OemerResultPayload } from "./messages";
import type { KeyName, RgbaImage } from "../types";

export interface OemerProgress {
  message: string;
  percent: number;
}

let worker: Worker | null = null;
let nextId = 1;

function workerSrc(): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${base}/oemer-worker.js`;
}

function modelBase(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(workerSrc());
  }
  return worker;
}

export function cancelOemer() {
  if (!worker) return;
  try {
    worker.postMessage({ type: "cancel", id: nextId } satisfies OemerRequest);
  } catch {
    /* ignore */
  }
  worker.terminate();
  worker = null;
}

export function runOemer(
  image: RgbaImage,
  key: KeyName,
  options: {
    onProgress?: (progress: OemerProgress) => void;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<OemerResultPayload> {
  const timeoutMs = options.timeoutMs ?? INFERENCE_TIMEOUT_MS;
  const id = nextId++;
  const w = getWorker();
  const copy = new Uint8ClampedArray(image.data);
  const rgbaCopy = copy.buffer;

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      finish(new Error("The neural reader timed out. Falling back to the classic reader."));
    }, timeoutMs);

    const onAbort = () => finish(new Error("cancelled"));
    options.signal?.addEventListener("abort", onAbort);

    const onMessage = (event: MessageEvent<OemerResponse>) => {
      const msg = event.data;
      if (!msg || msg.id !== id) return;
      if (msg.type === "progress") {
        options.onProgress?.({ message: msg.message, percent: msg.percent });
        return;
      }
      if (msg.type === "result") {
        finish(null, msg.payload);
        return;
      }
      if (msg.type === "error") {
        finish(new Error(msg.message));
      }
    };

    function finish(error: Error | null, payload?: OemerResultPayload) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      w.removeEventListener("message", onMessage);
      if (error) {
        if (error.message === "cancelled" || error.message.includes("timed out")) {
          cancelOemer();
        }
        reject(error);
      } else if (payload) {
        resolve(payload);
      } else {
        reject(new Error("Neural reading failed."));
      }
    }

    w.addEventListener("message", onMessage);
    w.addEventListener("error", (event) => {
      finish(new Error(event.message || "Neural worker crashed."));
    });
    const req: OemerRequest = {
      type: "recognize",
      id,
      width: image.width,
      height: image.height,
      rgba: rgbaCopy,
      key,
      modelBase: modelBase(),
    };
    w.postMessage(req, [rgbaCopy]);
  });
}
