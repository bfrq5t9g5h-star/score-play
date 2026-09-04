import { CACHE_NAME, githubModelUrl, localModelUrl, OEMER_MODELS } from "./constants";

export type ProgressFn = (message: string, percent: number) => void;

async function readWithProgress(
  res: Response,
  expected: number,
  onChunk: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  if (!res.body) return res.arrayBuffer();
  const total = Number(res.headers.get("content-length") || expected || 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onChunk(loaded, total || expected);
    }
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out.buffer;
}

async function cachePut(key: string, buffer: ArrayBuffer, type = "application/octet-stream") {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, new Response(buffer.slice(0), { headers: { "Content-Type": type } }));
  } catch {
    // Private mode / missing Cache API — still return the buffer to the caller.
  }
}

async function cacheGet(key: string): Promise<ArrayBuffer | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(key);
    if (!hit) return null;
    return hit.arrayBuffer();
  } catch {
    return null;
  }
}

export async function fetchModelBuffer(
  file: string,
  expectedBytes: number,
  modelBase: string,
  onProgress: ProgressFn,
  label: string,
): Promise<ArrayBuffer> {
  const cacheKey = `https://cantor.local/oemer/${file}`;
  const cached = await cacheGet(cacheKey);
  if (cached && cached.byteLength > 1_000_000) {
    onProgress(`Using cached ${label}…`, 100);
    return cached;
  }

  const urls = [localModelUrl(modelBase, file), githubModelUrl(file)];
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      onProgress(`Downloading ${label}…`, 1);
      const res = await fetch(url, { mode: "cors", redirect: "follow" });
      if (!res.ok) {
        lastError = new Error(`${url} → ${res.status}`);
        continue;
      }
      const buffer = await readWithProgress(res, expectedBytes, (loaded, total) => {
        const pct = total ? Math.min(99, Math.round((loaded / total) * 100)) : 10;
        onProgress(`Downloading ${label} (${pct}%)…`, pct);
      });
      if (buffer.byteLength < 1_000_000) {
        lastError = new Error(`${url} too small (${buffer.byteLength} bytes)`);
        continue;
      }
      await cachePut(cacheKey, buffer);
      onProgress(`Loaded ${label}.`, 100);
      return buffer;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw new Error(
    lastError
      ? `Could not download the music reader (${file}): ${lastError.message}`
      : `Could not download the music reader (${file}).`,
  );
}

export async function fetchOemerModels(modelBase: string, onProgress: ProgressFn) {
  const staff = await fetchModelBuffer(
    OEMER_MODELS.staff.file,
    OEMER_MODELS.staff.bytes,
    modelBase,
    (msg, pct) => onProgress(msg, Math.round(pct * 0.5)),
    "staff reader",
  );
  const symbols = await fetchModelBuffer(
    OEMER_MODELS.symbols.file,
    OEMER_MODELS.symbols.bytes,
    modelBase,
    (msg, pct) => onProgress(msg, 50 + Math.round(pct * 0.5)),
    "note reader",
  );
  return { staff, symbols };
}
