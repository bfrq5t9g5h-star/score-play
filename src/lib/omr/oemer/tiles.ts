export interface TilePos {
  x: number;
  y: number;
}

/** Sliding-window positions matching oemer/inference.py (last tile flush to the edge). */
export function tilePositions(width: number, height: number, win: number, step: number): TilePos[] {
  if (width <= 0 || height <= 0 || win <= 0) return [];
  const ys: number[] = [];
  const xs: number[] = [];
  if (height <= win) ys.push(0);
  else {
    for (let y = 0; y < height; y += step) {
      ys.push(y + win > height ? height - win : y);
    }
  }
  if (width <= win) xs.push(0);
  else {
    for (let x = 0; x < width; x += step) {
      xs.push(x + win > width ? width - win : x);
    }
  }
  const uniq = (arr: number[]) => [...new Set(arr)];
  const tiles: TilePos[] = [];
  for (const y of uniq(ys)) {
    for (const x of uniq(xs)) tiles.push({ x, y });
  }
  return tiles;
}

/** BGR uint8 NHWC patch, matching oemer’s cv2.imread → PIL path. */
export function extractBgrPatch(
  rgba: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
  win: number,
): Uint8Array {
  const out = new Uint8Array(win * win * 3);
  for (let py = 0; py < win; py++) {
    const sy = Math.min(imgH - 1, Math.max(0, y + py));
    for (let px = 0; px < win; px++) {
      const sx = Math.min(imgW - 1, Math.max(0, x + px));
      const si = (sy * imgW + sx) * 4;
      const di = (py * win + px) * 3;
      out[di] = rgba[si + 2];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si];
    }
  }
  return out;
}

export function argmaxChannels(accum: Float32Array, counts: Float32Array, size: number, channels: number): Uint8Array {
  const map = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const count = counts[i] || 1;
    let best = 0;
    let bestV = -Infinity;
    for (let c = 0; c < channels; c++) {
      const v = accum[i * channels + c] / count;
      if (v > bestV) {
        bestV = v;
        best = c;
      }
    }
    map[i] = best;
  }
  return map;
}
