/** Published oemer checkpoints (BreezeWhite). Fetched at runtime; not committed. */
export const OEMER_RELEASE = "https://github.com/BreezeWhite/oemer/releases/download/checkpoints";

export const OEMER_MODELS = {
  staff: {
    file: "1st_model.onnx",
    bytes: 70_767_752,
    win: 256,
    classes: 3,
    /** Background, staff lines, other symbols. */
    labels: { background: 0, staff: 1, symbols: 2 },
  },
  symbols: {
    file: "2nd_model.onnx",
    bytes: 38_448_467,
    win: 288,
    classes: 4,
    /** Background, stems/rests, noteheads, clefs/keys/accidentals. */
    labels: { background: 0, stems: 1, notehead: 2, clefs: 3 },
  },
} as const;

export const ORT_VERSION = "1.29.0";
export const ORT_CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
export const ORT_SCRIPT = `${ORT_CDN}ort.min.js`;

export const CACHE_NAME = "cantor-oemer-v1";

/** oemer resizes toward ~3.7M pixels; browsers need a smaller working set. */
export const TARGET_PIXELS = 1_900_000;
export const TILE_STEP = 160;
export const INFERENCE_TIMEOUT_MS = 180_000;

export function githubModelUrl(file: string): string {
  return `${OEMER_RELEASE}/${file}`;
}

export function localModelUrl(basePath: string, file: string): string {
  const base = basePath.replace(/\/$/, "");
  return `${base}/oemer/${file}`;
}
