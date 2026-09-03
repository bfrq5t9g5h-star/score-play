import { nameToMidi } from "@/lib/music/pitch";
import type { RgbaImage } from "@/lib/omr/types";
import { fromImageData } from "@/lib/omr/image";
import { durationQuarters, type DurationCode, type Hymn, type HymnToken } from "./hymns";

function drawTrebleClef(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  space: number,
) {
  const s = space / 9;
  ctx.save();
  ctx.translate(x, top);
  ctx.scale(s, s);
  ctx.strokeStyle = "#1c1917";
  ctx.fillStyle = "#1c1917";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(10, 52);
  ctx.bezierCurveTo(4, 40, 18, 28, 18, 18);
  ctx.bezierCurveTo(18, 6, 4, 6, 6, 16);
  ctx.bezierCurveTo(8, 28, 22, 34, 22, 46);
  ctx.bezierCurveTo(22, 60, 4, 62, 6, 50);
  ctx.bezierCurveTo(8, 70, 16, 74, 12, 86);
  ctx.bezierCurveTo(8, 96, 0, 88, 6, 80);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(10, 36, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function isPitch(token: HymnToken): token is { pitch: string; dur: DurationCode } {
  return "pitch" in token;
}

function isBar(token: HymnToken): token is { bar: true } {
  return "bar" in token;
}

function pitchY(pitch: string, bottom: number, space: number): number {
  nameToMidi(pitch);
  const names = ["C", "D", "E", "F", "G", "A", "B"];
  const match = pitch.match(/^([A-G])([#b]?)(-?\d+)$/)!;
  const letter = match[1];
  const octave = Number(match[3]);
  const degree = names.indexOf(letter) + octave * 7;
  const e4 = names.indexOf("E") + 4 * 7;
  const steps = degree - e4;
  return bottom - steps * (space / 2);
}

export function renderHymn(hymn: Hymn): { canvas: HTMLCanvasElement; image: RgbaImage } {
  const space = 18;
  const width = 1280;
  const left = 36;
  const right = width - 36;
  const startX = left + space * 6.2;
  const quarterW = 50;
  const systems: { tokens: HymnToken[] }[] = [];
  let current: HymnToken[] = [];
  let xCursor = startX;

  const flush = () => {
    if (current.length) systems.push({ tokens: current });
    current = [];
    xCursor = startX;
  };

  for (const token of hymn.tokens) {
    if (isBar(token)) {
      current.push(token);
      xCursor += 14;
      if (xCursor > right - quarterW * hymn.time[0] - 20) flush();
      continue;
    }
    if (isPitch(token)) {
      const w = durationQuarters[token.dur] * quarterW;
      if (xCursor + w > right - 8 && current.length) flush();
      current.push(token);
      xCursor += w;
    }
  }
  flush();
  if (systems.length === 0) systems.push({ tokens: hymn.tokens });

  const header = 92;
  const systemGap = space * 5.6;
  const height = Math.ceil(header + systems.length * systemGap + 56);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#f7f1e3";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(40, 24, 12, 0.035)";
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }

  ctx.fillStyle = "#3f2a1d";
  ctx.font = "600 28px 'Cormorant Garamond', 'Times New Roman', serif";
  ctx.fillText(hymn.title, left, 42);
  ctx.font = "16px 'Source Sans 3', sans-serif";
  ctx.fillStyle = "#6b5748";
  ctx.fillText(`${hymn.subtitle}   ·   ${hymn.time[0]}/${hymn.time[1]}`, left, 66);

  systems.forEach((system, s) => {
    const top = header + s * systemGap;
    const lines = [0, 1, 2, 3, 4].map((i) => top + i * space);
    const bottom = lines[4];
    const middle = lines[2];
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 1.6;
    for (const y of lines) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }

    drawTrebleClef(ctx, left + 6, top - space * 0.2, space);

    ctx.fillStyle = "#1c1917";
    ctx.font = `700 ${space * 1.45}px 'Cormorant Garamond', serif`;
    ctx.textAlign = "center";
    ctx.fillText(String(hymn.time[0]), left + space * 4.3, lines[1] + space * 0.35);
    ctx.fillText(String(hymn.time[1]), left + space * 4.3, lines[3] + space * 0.35);
    ctx.textAlign = "left";

    let x = startX;
    for (const token of system.tokens) {
      if (isBar(token)) {
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, lines[0]);
        ctx.lineTo(x, lines[4]);
        ctx.stroke();
        x += 14;
        continue;
      }
      if (!isPitch(token)) continue;
      const y = pitchY(token.pitch, bottom, space);
      const rx = space * 0.62;
      const ry = space * 0.42;
      const quarters = durationQuarters[token.dur];
      const filled = quarters <= 1.5 && token.dur !== "h" && token.dur !== "hd" && token.dur !== "w";
      const hasStem = token.dur !== "w";
      const dotted = token.dur === "hd" || token.dur === "qd";

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.12);
      if (filled) {
        ctx.fillStyle = "#1c1917";
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = "#1c1917";
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      if (hasStem) {
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        if (y >= middle - 0.5) {
          ctx.moveTo(x + rx - 1, y);
          ctx.lineTo(x + rx - 1, y - space * 3.15);
        } else {
          ctx.moveTo(x - rx + 1, y);
          ctx.lineTo(x - rx + 1, y + space * 3.15);
        }
        ctx.stroke();
      }

      if (dotted) {
        ctx.beginPath();
        ctx.arc(x + space * 0.95, y, Math.max(1.6, space * 0.12), 0, Math.PI * 2);
        ctx.fillStyle = "#1c1917";
        ctx.fill();
      }

      x += Math.max(quarterW * 0.85, quarters * quarterW);
    }
  });

  const image = fromImageData(ctx.getImageData(0, 0, width, height));
  return { canvas, image };
}
