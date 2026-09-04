import { ORT_CDN, TILE_STEP } from "./constants";
import { argmaxChannels, extractBgrPatch, tilePositions } from "./tiles";

interface OrtTensor {
  data: Float32Array | Uint8Array | Int32Array;
  dims: number[];
  type?: string;
}

interface OrtSession {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensor>>;
}

interface OrtApi {
  env: { wasm: { numThreads: number; simd: boolean; proxy: boolean; wasmPaths: string } };
  Tensor: new (type: string, data: Uint8Array | Float32Array, dims: number[]) => unknown;
  InferenceSession: {
    create: (buf: ArrayBuffer, opts?: Record<string, unknown>) => Promise<OrtSession>;
  };
}

function ortApi(): OrtApi {
  const g = self as unknown as { ort?: OrtApi };
  if (!g.ort) throw new Error("onnxruntime-web did not load.");
  return g.ort;
}

export function configureOrt() {
  const ort = ortApi();
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = ORT_CDN;
}

export async function createSession(buffer: ArrayBuffer): Promise<OrtSession> {
  const ort = ortApi();
  const opts = { graphOptimizationLevel: "all" as const };
  const gpu = typeof navigator !== "undefined" && "gpu" in navigator;
  if (gpu) {
    try {
      return await ort.InferenceSession.create(buffer, {
        ...opts,
        executionProviders: ["webgpu", "wasm"],
      });
    } catch {
      // WebGPU missing or the model cannot run there — WASM is the Pages-safe path.
    }
  }
  return ort.InferenceSession.create(buffer, { ...opts, executionProviders: ["wasm"] });
}

function toFloat32(tensor: OrtTensor): Float32Array {
  if (tensor.data instanceof Float32Array) return tensor.data;
  const src = tensor.data;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i];
  return out;
}

function layoutInfo(dims: number[]): { nchw: boolean; win: number; channels: number } {
  if (dims.length === 4) {
    if (dims[1] <= 8 && dims[2] > 8) {
      return { nchw: true, channels: dims[1], win: dims[2] };
    }
    return { nchw: false, channels: dims[3], win: dims[1] };
  }
  if (dims.length === 3) {
    return { nchw: false, channels: dims[2], win: dims[0] };
  }
  throw new Error(`Unexpected ONNX output shape: ${dims.join("×")}`);
}

export async function runUnet(
  session: OrtSession,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  win: number,
  channels: number,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<Uint8Array> {
  const ort = ortApi();
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const paddedW = Math.max(width, win);
  const paddedH = Math.max(height, win);
  const tiles = tilePositions(paddedW, paddedH, win, TILE_STEP);
  const accum = new Float32Array(paddedW * paddedH * channels);
  const counts = new Float32Array(paddedW * paddedH);

  for (let t = 0; t < tiles.length; t++) {
    if (isCancelled()) throw new Error("cancelled");
    const { x, y } = tiles[t];
    const patch = extractBgrPatch(rgba, width, height, x, y, win);
    const tensor = new ort.Tensor("uint8", patch, [1, win, win, 3]);
    let out: OrtTensor;
    try {
      const result = await session.run({ [inputName]: tensor });
      out = result[outputName];
    } catch {
      const f32 = new Float32Array(patch.length);
      for (let i = 0; i < patch.length; i++) f32[i] = patch[i];
      const tensorF = new ort.Tensor("float32", f32, [1, win, win, 3]);
      const result = await session.run({ [inputName]: tensorF });
      out = result[outputName];
    }
    const dims = out.dims;
    const layout = layoutInfo(dims);
    const data = toFloat32(out);
    const c = layout.channels;
    const tw = layout.win;
    for (let py = 0; py < tw; py++) {
      const gy = y + py;
      if (gy >= paddedH) continue;
      for (let px = 0; px < tw; px++) {
        const gx = x + px;
        if (gx >= paddedW) continue;
        const gi = gy * paddedW + gx;
        counts[gi] += 1;
        for (let ch = 0; ch < c && ch < channels; ch++) {
          const vi = layout.nchw ? ch * tw * tw + py * tw + px : (py * tw + px) * c + ch;
          accum[gi * channels + ch] += data[vi];
        }
      }
    }
    onProgress(t + 1, tiles.length);
  }

  const classMap = argmaxChannels(accum, counts, paddedW * paddedH, channels);
  if (paddedW === width && paddedH === height) return classMap;
  const cropped = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    cropped.set(classMap.subarray(y * paddedW, y * paddedW + width), y * width);
  }
  return cropped;
}
