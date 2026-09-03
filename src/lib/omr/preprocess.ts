import type { BinaryImage, GrayImage, RgbaImage } from "./types";
import { createRgba, toGray } from "./image";

function percentile(values: Uint8Array, p: number): number {
  const copy = Array.from(values);
  copy.sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(copy.length - 1, Math.floor(p * (copy.length - 1))));
  return copy[idx];
}

function stretchContrast(gray: GrayImage): GrayImage {
  const lo = percentile(gray.data, 0.02);
  const hi = percentile(gray.data, 0.98);
  const span = Math.max(1, hi - lo);
  const data = new Uint8Array(gray.data.length);
  for (let i = 0; i < gray.data.length; i++) {
    const v = ((gray.data[i] - lo) / span) * 255;
    data[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return { width: gray.width, height: gray.height, data };
}

function otsuThreshold(gray: GrayImage): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.data.length; i++) hist[gray.data[i]]++;
  const total = gray.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 140;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between >= max) {
      max = between;
      threshold = t;
    }
  }
  return threshold;
}

function integralImage(gray: GrayImage): Float64Array {
  const { width, height, data } = gray;
  const integral = new Float64Array((width + 1) * (height + 1));
  const row = width + 1;
  for (let y = 1; y <= height; y++) {
    let run = 0;
    for (let x = 1; x <= width; x++) {
      run += data[(y - 1) * width + (x - 1)];
      integral[y * row + x] = integral[(y - 1) * row + x] + run;
    }
  }
  return integral;
}

function localMean(
  integral: Float64Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): number {
  const row = width + 1;
  const x0 = Math.max(0, x - radius);
  const y0 = Math.max(0, y - radius);
  const x1 = Math.min(width, x + radius + 1);
  const y1 = Math.min(height, y + radius + 1);
  const sum =
    integral[y1 * row + x1] -
    integral[y0 * row + x1] -
    integral[y1 * row + x0] +
    integral[y0 * row + x0];
  const area = Math.max(1, (x1 - x0) * (y1 - y0));
  return sum / area;
}

export function binarize(gray: GrayImage): BinaryImage {
  const stretched = stretchContrast(gray);
  let otsu = otsuThreshold(stretched);
  if (otsu < 16) otsu = 128;
  const integral = integralImage(stretched);
  const radius = Math.max(12, Math.round(Math.min(stretched.width, stretched.height) / 40));
  const data = new Uint8Array(stretched.data.length);
  let ink = 0;
  for (let y = 0; y < stretched.height; y++) {
    for (let x = 0; x < stretched.width; x++) {
      const i = y * stretched.width + x;
      const mean = localMean(integral, stretched.width, stretched.height, x, y, radius);
      const localT = Math.min(Math.max(otsu, 32), mean * 0.9 + 8);
      const isInk = stretched.data[i] < localT;
      data[i] = isInk ? 1 : 0;
      if (isInk) ink++;
    }
  }
  const ratio = ink / data.length;
  if (ratio > 0.55) {
    ink = 0;
    for (let i = 0; i < data.length; i++) {
      data[i] = data[i] ? 0 : 1;
      if (data[i]) ink++;
    }
  }
  if (ink === 0) {
    for (let i = 0; i < data.length; i++) {
      data[i] = stretched.data[i] < 160 ? 1 : 0;
    }
  }
  return { width: stretched.width, height: stretched.height, data };
}

function sampleGray(gray: GrayImage, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(gray.width - 1, x0 + 1);
  const y1 = Math.min(gray.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const v00 = gray.data[y0 * gray.width + Math.max(0, Math.min(gray.width - 1, x0))];
  const v10 = gray.data[y0 * gray.width + x1];
  const v01 = gray.data[y1 * gray.width + Math.max(0, Math.min(gray.width - 1, x0))];
  const v11 = gray.data[y1 * gray.width + x1];
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}

function projectionSharpness(gray: GrayImage): number {
  const proj = new Float64Array(gray.height);
  for (let y = 0; y < gray.height; y++) {
    let sum = 0;
    for (let x = 0; x < gray.width; x++) {
      sum += 255 - gray.data[y * gray.width + x];
    }
    proj[y] = sum;
  }
  let mean = 0;
  for (let y = 0; y < proj.length; y++) mean += proj[y];
  mean /= proj.length;
  let varSum = 0;
  for (let y = 0; y < proj.length; y++) {
    const d = proj[y] - mean;
    varSum += d * d;
  }
  return varSum / proj.length;
}

function rotateGray(gray: GrayImage, angleDeg: number): GrayImage {
  if (Math.abs(angleDeg) < 0.05) return gray;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = (gray.width - 1) / 2;
  const cy = (gray.height - 1) / 2;
  const data = new Uint8Array(gray.data.length);
  data.fill(255);
  for (let y = 0; y < gray.height; y++) {
    for (let x = 0; x < gray.width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const sx = cos * dx + sin * dy + cx;
      const sy = -sin * dx + cos * dy + cy;
      if (sx < 0 || sy < 0 || sx >= gray.width - 1 || sy >= gray.height - 1) continue;
      data[y * gray.width + x] = sampleGray(gray, sx, sy);
    }
  }
  return { width: gray.width, height: gray.height, data };
}

function downscaleGray(gray: GrayImage, maxWidth: number): GrayImage {
  if (gray.width <= maxWidth) return gray;
  const scale = maxWidth / gray.width;
  const width = Math.max(1, Math.round(gray.width * scale));
  const height = Math.max(1, Math.round(gray.height * scale));
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(gray.height - 1, (y + 0.5) / scale - 0.5);
    for (let x = 0; x < width; x++) {
      const sx = Math.min(gray.width - 1, (x + 0.5) / scale - 0.5);
      data[y * width + x] = sampleGray(gray, sx, sy);
    }
  }
  return { width, height, data };
}

export function estimateSkew(gray: GrayImage): number {
  const small = downscaleGray(gray, 480);
  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let angle = -6; angle <= 6; angle += 0.5) {
    const rotated = rotateGray(small, angle);
    const score = projectionSharpness(rotated);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  return bestAngle;
}

export function rotateRgba(image: RgbaImage, angleDeg: number): RgbaImage {
  if (Math.abs(angleDeg) < 0.05) return image;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = (image.width - 1) / 2;
  const cy = (image.height - 1) / 2;
  const out = createRgba(image.width, image.height, 255, 252, 245, 255);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const sx = cos * dx + sin * dy + cx;
      const sy = -sin * dx + cos * dy + cy;
      if (sx < 0 || sy < 0 || sx >= image.width - 1 || sy >= image.height - 1) continue;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(image.width - 1, x0 + 1);
      const y1 = Math.min(image.height - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const dst = (y * image.width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = image.data[(y0 * image.width + x0) * 4 + c];
        const v10 = image.data[(y0 * image.width + x1) * 4 + c];
        const v01 = image.data[(y1 * image.width + x0) * 4 + c];
        const v11 = image.data[(y1 * image.width + x1) * 4 + c];
        out.data[dst + c] =
          v00 * (1 - fx) * (1 - fy) +
          v10 * fx * (1 - fy) +
          v01 * (1 - fx) * fy +
          v11 * fx * fy;
      }
    }
  }
  return out;
}

export function prepareBinary(image: RgbaImage): { binary: BinaryImage; gray: GrayImage; angle: number; prepared: RgbaImage } {
  const gray0 = toGray(image);
  const angle = estimateSkew(gray0);
  const prepared = rotateRgba(image, angle);
  const gray = stretchContrast(toGray(prepared));
  const binary = binarize(gray);
  return { binary, gray, angle, prepared };
}
