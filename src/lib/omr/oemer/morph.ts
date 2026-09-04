/** Binary morphology and connected components for oemer heatmaps. */

export function countPositive(data: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < data.length; i++) if (data[i]) n++;
  return n;
}

export function dilateRect(src: Uint8Array, width: number, height: number, kx: number, ky: number): Uint8Array {
  const rx = Math.max(0, Math.floor(kx / 2));
  const ry = Math.max(0, Math.floor(ky / 2));
  const tmp = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 0;
      for (let dx = -rx; dx <= rx; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        if (src[y * width + xx]) {
          v = 1;
          break;
        }
      }
      tmp[y * width + x] = v;
    }
  }
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 0;
      for (let dy = -ry; dy <= ry; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        if (tmp[yy * width + x]) {
          v = 1;
          break;
        }
      }
      out[y * width + x] = v;
    }
  }
  return out;
}

export function erodeRect(src: Uint8Array, width: number, height: number, kx: number, ky: number): Uint8Array {
  const rx = Math.max(0, Math.floor(kx / 2));
  const ry = Math.max(0, Math.floor(ky / 2));
  const tmp = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 1;
      for (let dx = -rx; dx <= rx; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= width || !src[y * width + xx]) {
          v = 0;
          break;
        }
      }
      tmp[y * width + x] = v;
    }
  }
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 1;
      for (let dy = -ry; dy <= ry; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height || !tmp[yy * width + x]) {
          v = 0;
          break;
        }
      }
      out[y * width + x] = v;
    }
  }
  return out;
}

export function closeRect(src: Uint8Array, width: number, height: number, kx: number, ky: number): Uint8Array {
  return erodeRect(dilateRect(src, width, height, kx, ky), width, height, kx, ky);
}

export interface Blob {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  area: number;
}

export function connectedBlobs(src: Uint8Array, width: number, height: number, minArea = 4): Blob[] {
  const seen = new Uint8Array(src.length);
  const blobs: Blob[] = [];
  const stack: number[] = [];

  for (let i = 0; i < src.length; i++) {
    if (!src[i] || seen[i]) continue;
    stack.length = 0;
    stack.push(i);
    seen[i] = 1;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;

    while (stack.length) {
      const p = stack.pop()!;
      const x = p % width;
      const y = (p - x) / width;
      area++;
      sumX += x;
      sumY += y;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
      const neigh = [p - 1, p + 1, p - width, p + width, p - width - 1, p - width + 1, p + width - 1, p + width + 1];
      for (const n of neigh) {
        if (n < 0 || n >= src.length || seen[n] || !src[n]) continue;
        const nx = n % width;
        const ny = (n - nx) / width;
        if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }

    if (area < minArea) continue;
    blobs.push({
      x0,
      y0,
      x1,
      y1,
      cx: sumX / area,
      cy: sumY / area,
      area,
    });
  }
  return blobs;
}

/** Port of oemer.notehead_extraction.fill_hole — fills interior gaps of hollow heads. */
export function fillHole(region: Uint8Array, w: number, h: number): Uint8Array {
  const tar = new Uint8Array(region);
  for (let yi = 0; yi < h; yi++) {
    let cur = 0;
    while (cur < w && tar[yi * w + cur] === 0) cur++;
    while (cur < w && tar[yi * w + cur] > 0) cur++;
    const cand: number[] = [];
    while (cur < w && tar[yi * w + cur] === 0) {
      cand.push(cur);
      cur++;
    }
    if (cur < w) {
      for (const x of cand) tar[yi * w + x] = 1;
    }
  }
  for (let xi = 0; xi < w; xi++) {
    let cur = 0;
    while (cur < h && tar[cur * w + xi] === 0) cur++;
    while (cur < h && tar[cur * w + xi] > 0) cur++;
    const cand: number[] = [];
    while (cur < h && tar[cur * w + xi] === 0) {
      cand.push(cur);
      cur++;
    }
    if (cur < h) {
      for (const y of cand) tar[y * w + xi] = 1;
    }
  }
  return tar;
}

export function sliceRect(
  src: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { data: Uint8Array; w: number; h: number } {
  const sx0 = Math.max(0, Math.floor(x0));
  const sy0 = Math.max(0, Math.floor(y0));
  const sx1 = Math.min(width, Math.ceil(x1));
  const sy1 = Math.min(height, Math.ceil(y1));
  const w = Math.max(0, sx1 - sx0);
  const h = Math.max(0, sy1 - sy0);
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const srcOff = (sy0 + y) * width + sx0;
    data.set(src.subarray(srcOff, srcOff + w), y * w);
  }
  return { data, w, h };
}
