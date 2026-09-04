# Cantor

Photograph or upload a page of simple sheet music — hymns, chants, doxologies — and Cantor will read the staff and play the notes.

You do **not** need to install it on your computer. It is a website.

## Live site (GitHub Pages)

**https://bfrq5t9g5h-star.github.io/score-play/**

Repo: https://github.com/bfrq5t9g5h-star/score-play

If the link 404s, open [Settings → Pages](https://github.com/bfrq5t9g5h-star/score-play/settings/pages), set **Source** to **GitHub Actions**, then re-run the [Pages workflow](https://github.com/bfrq5t9g5h-star/score-play/actions/workflows/pages.yml).

## Easiest in Cursor

Use **Preview** or the **Desktop** tab in this chat — no hosting account needed.

## GitHub Pages (your own account)

To host under your GitHub username instead:

1. Fork https://github.com/bfrq5t9g5h-star/score-play to your account (or create `score-play` and push this code).
2. **Settings → Pages → Source: GitHub Actions**.
3. Your URL: `https://<your-username>.github.io/score-play/`

The workflow is in `.github/workflows/pages.yml`.

## Run locally (optional)

You need **Node 20 or newer** (`node -v`). Then:

```bash
npm install
npm run models    # once: downloads oemer ONNX weights (~104 MB, gitignored)
npm run build
npm start
```

Open [http://localhost:38471](http://localhost:38471) — not port 3000.

`npm run build` downloads the weights automatically if they are missing.

## How the reader works

Photographs and uploads use **[oemer](https://github.com/BreezeWhite/oemer)** (MIT), a pretrained pair of ONNX U-Nets, entirely in the browser:

1. First visit fetches the two published checkpoints (about 67 MB + 37 MB) from this site, then caches them.
2. A Web Worker runs the networks with onnxruntime-web (WebGPU when the browser has it, otherwise single-thread WASM — GitHub Pages cannot set COOP/COEP).
3. Staff-line and note-head heatmaps are decoded into pitches and durations.
4. The existing Tone.js player sounds the notes.

If the neural reader cannot load, times out, or returns nothing, Cantor falls back to the classic projection reader. Sample hymns stay on that classic path so they play without a model download.

Dense SATB hymnals and warped photos are still hard. You can tap a detected head to mute or delete it before playing.

```bash
npm test
```

## Stack

Next.js (static export), TypeScript, Tailwind, shadcn/ui, Tone.js, onnxruntime-web, oemer ONNX checkpoints. Recognition runs in the browser with no backend.
