# Cantor

Photograph or upload a page of simple sheet music — hymns, chants, doxologies — and Cantor will read the staff and play the notes.

You do **not** need to install it on your computer. It is a website.

## Easiest: publish a link

In this Cursor chat, click **Publish**. That puts Cantor on Vercel. Open the URL it gives you on your phone or laptop — photograph a hymn, or try a sample, and hit Play.

The source is here (private; you can change that in settings):  
https://cursor.com/codebase/david-coppock/score-play

## GitHub Pages

This project is on Origin, not GitHub.com yet. To host it on GitHub:

1. Create a new GitHub repository (for example `score-play`).
2. Push this code to `main`.
3. GitHub → **Settings → Pages → Source: GitHub Actions**.
4. The workflow in `.github/workflows/pages.yml` builds the static site and publishes it to  
   `https://<your-username>.github.io/score-play/`

There is no “Run” button on GitHub that starts the app. Pages is just a public website. Codespaces would still be a cloud terminal.

## Downloadable files

A zip of HTML/JS cannot be double-clicked reliably: the camera and audio need `http://` or `https://`, not `file://`. Publish or GitHub Pages is the download-shaped option — a URL instead of an installer.

## Run locally (optional)

You need **Node 20 or newer** (`node -v`). Then:

```bash
npm install
npm run build
npm start
```

Open [http://localhost:38471](http://localhost:38471) — not port 3000.

It is built for **clear scans of straightforward notation**: five-line staves, filled and open note heads, stems. Dense piano scores, heavy perspective, and faint photocopies will miss notes. You can tap a detected head to mute or delete it before playing.

## How the reader works

1. Straighten the page and threshold the ink.
2. Find five evenly spaced staff lines.
3. Lift the staff lines off the note heads.
4. Score elliptical blobs sitting on lines and spaces as pitches.
5. Use stems, filled vs open heads, and dots for duration.
6. Play left-to-right, sounding simultaneous heads as chords.

```bash
npm test
```

## Stack

Next.js (static export), TypeScript, Tailwind, shadcn/ui, Tone.js. Recognition runs in the browser.
