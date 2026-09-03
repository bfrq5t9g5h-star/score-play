import type { RgbaImage } from "./types";
import { fromImageData, scaleRgba } from "./image";

function canvasFromBitmap(bitmap: ImageBitmap): RgbaImage {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return scaleRgba(fromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height)), 2000);
}

export async function rgbaFromFile(file: File): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  return canvasFromBitmap(bitmap);
}

export async function rgbaFromBlob(blob: Blob): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  return canvasFromBitmap(bitmap);
}

export function dataUrlFromRgba(image: RgbaImage): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return canvas.toDataURL("image/png");
}

export function captureVideoFrame(video: HTMLVideoElement): RgbaImage {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0);
  return scaleRgba(fromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height)), 2000);
}
