#!/usr/bin/env node
/**
 * Download oemer ONNX checkpoints into public/oemer (gitignored).
 * GitHub Pages then serves them same-origin so the browser can load them
 * without CORS issues on github.com release redirects.
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "oemer");
const FILES = [
  {
    file: "1st_model.onnx",
    url: "https://github.com/BreezeWhite/oemer/releases/download/checkpoints/1st_model.onnx",
    bytes: 70_767_752,
  },
  {
    file: "2nd_model.onnx",
    url: "https://github.com/BreezeWhite/oemer/releases/download/checkpoints/2nd_model.onnx",
    bytes: 38_448_467,
  },
];

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`GET ${url} → ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

mkdirSync(DIR, { recursive: true });

for (const item of FILES) {
  const dest = path.join(DIR, item.file);
  if (existsSync(dest) && statSync(dest).size === item.bytes) {
    console.log(`have ${item.file}`);
    continue;
  }
  console.log(`downloading ${item.file}`);
  await download(item.url, dest);
  const size = statSync(dest).size;
  if (size < 1_000_000) throw new Error(`${item.file} too small (${size})`);
  console.log(`wrote ${item.file} ${size}`);
}
