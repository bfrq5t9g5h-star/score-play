import type { BinaryImage, GrayImage, RgbaImage } from "./types";

export function createRgba(
  width: number,
  height: number,
  r = 255,
  g = 255,
  b = 255,
  a = 255,
): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { width, height, data };
}

export function fromImageData(image: ImageData): RgbaImage {
  return {
    width: image.width,
    height: image.height,
    data: new Uint8ClampedArray(image.data),
  };
}

export function toImageData(image: RgbaImage): ImageData {
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}

export function toGray(image: RgbaImage): GrayImage {
  const data = new Uint8Array(image.width * image.height);
  const src = image.data;
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    const a = src[i + 3] / 255;
    const r = src[i] * a + 255 * (1 - a);
    const g = src[i + 1] * a + 255 * (1 - a);
    const b = src[i + 2] * a + 255 * (1 - a);
    data[p] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return { width: image.width, height: image.height, data };
}

export function resizeRgba(image: RgbaImage, width: number, height: number): RgbaImage {
  if (width === image.width && height === image.height) return image;
  const out = createRgba(width, height);
  const scaleX = image.width / width;
  const scaleY = image.height / height;
  for (let y = 0; y < height; y++) {
    const sy = Math.min(image.height - 1, (y + 0.5) * scaleY - 0.5);
    const y0 = Math.floor(sy);
    const y1 = Math.min(image.height - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.width - 1, (x + 0.5) * scaleX - 0.5);
      const x0 = Math.floor(sx);
      const x1 = Math.min(image.width - 1, x0 + 1);
      const fx = sx - x0;
      const dst = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = image.data[(y0 * image.width + x0) * 4 + c];
        const v10 = image.data[(y0 * image.width + x1) * 4 + c];
        const v01 = image.data[(y1 * image.width + x0) * 4 + c];
        const v11 = image.data[(y1 * image.width + x1) * 4 + c];
        const v0 = v00 * (1 - fx) + v10 * fx;
        const v1 = v01 * (1 - fx) + v11 * fx;
        out.data[dst + c] = v0 * (1 - fy) + v1 * fy;
      }
    }
  }
  return out;
}

export function scaleRgba(image: RgbaImage, maxWidth: number): RgbaImage {
  if (image.width <= maxWidth) return image;
  const scale = maxWidth / image.width;
  return resizeRgba(image, maxWidth, Math.max(1, Math.round(image.height * scale)));
}

export function scaleToMaxPixels(image: RgbaImage, maxPixels: number): RgbaImage {
  const pixels = image.width * image.height;
  if (pixels <= maxPixels) return image;
  const scale = Math.sqrt(maxPixels / pixels);
  return resizeRgba(
    image,
    Math.max(1, Math.round(image.width * scale)),
    Math.max(1, Math.round(image.height * scale)),
  );
}

export function inkAt(image: BinaryImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return 0;
  return image.data[y * image.width + x];
}

export function grayAt(image: GrayImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return 255;
  return image.data[y * image.width + x];
}

export function setInk(image: BinaryImage, x: number, y: number, value: 0 | 1) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  image.data[y * image.width + x] = value;
}

export function cloneBinary(image: BinaryImage): BinaryImage {
  return {
    width: image.width,
    height: image.height,
    data: new Uint8Array(image.data),
  };
}

export function ellipseInkRatio(
  image: BinaryImage,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): { ratio: number; samples: number } {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(image.width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(image.height - 1, Math.ceil(cy + ry));
  const invRx = 1 / Math.max(0.5, rx);
  const invRy = 1 / Math.max(0.5, ry);
  let ink = 0;
  let samples = 0;
  for (let y = y0; y <= y1; y++) {
    const ny = (y - cy) * invRy;
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) * invRx;
      if (nx * nx + ny * ny <= 1) {
        samples++;
        ink += image.data[y * image.width + x];
      }
    }
  }
  return { ratio: samples ? ink / samples : 0, samples };
}

export function ringInkRatio(
  image: BinaryImage,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  inner = 0.55,
): { ring: number; inner: number } {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(image.width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(image.height - 1, Math.ceil(cy + ry));
  const invRx = 1 / Math.max(0.5, rx);
  const invRy = 1 / Math.max(0.5, ry);
  let ringInk = 0;
  let ringN = 0;
  let innerInk = 0;
  let innerN = 0;
  const inner2 = inner * inner;
  for (let y = y0; y <= y1; y++) {
    const ny = (y - cy) * invRy;
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) * invRx;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const v = image.data[y * image.width + x];
      if (d <= inner2) {
        innerN++;
        innerInk += v;
      } else {
        ringN++;
        ringInk += v;
      }
    }
  }
  return {
    ring: ringN ? ringInk / ringN : 0,
    inner: innerN ? innerInk / innerN : 0,
  };
}
