"use client";

import { useEffect, useRef } from "react";
import type { RecognitionResult } from "@/lib/omr/types";

interface SheetStageProps {
  src: string;
  result: RecognitionResult | null;
  activeIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function SheetStage({
  src,
  result,
  activeIds,
  selectedId,
  onSelect,
}: SheetStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const staff of result.staves) {
      ctx.strokeStyle = "rgba(180, 92, 42, 0.35)";
      ctx.lineWidth = Math.max(1, staff.space * 0.08);
      for (const line of staff.lines) {
        ctx.beginPath();
        ctx.moveTo(staff.x0, line.y);
        ctx.lineTo(staff.x1, line.y);
        ctx.stroke();
      }
    }

    for (const note of result.notes) {
      const staff = result.staves[note.staffIndex];
      const r = (staff?.space ?? 14) * 0.55;
      const active = activeIds.includes(note.id);
      const selected = selectedId === note.id;
      ctx.beginPath();
      ctx.ellipse(note.x, note.y, r * 1.15, r * 0.85, -0.25, 0, Math.PI * 2);
      if (note.muted) {
        ctx.strokeStyle = "rgba(80,70,60,0.45)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (active) {
        ctx.fillStyle = "rgba(196, 92, 42, 0.85)";
        ctx.fill();
      } else if (selected) {
        ctx.fillStyle = "rgba(59, 107, 156, 0.75)";
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(47, 107, 78, 0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.font = `${Math.max(11, (staff?.space ?? 14) * 0.7)}px ui-sans-serif, system-ui`;
      ctx.fillStyle = active ? "#3f1f12" : "#2b4a38";
      ctx.fillText(note.name, note.x + r * 1.1, note.y - r * 0.8);
    }
  }, [result, activeIds, selectedId]);

  function handleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!result || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * result.width;
    const y = ((event.clientY - rect.top) / rect.height) * result.height;
    let best: { id: string; d: number } | null = null;
    for (const note of result.notes) {
      const d = Math.hypot(note.x - x, note.y - y);
      const staff = result.staves[note.staffIndex];
      const limit = (staff?.space ?? 14) * 0.9;
      if (d < limit && (!best || d < best.d)) best = { id: note.id, d };
    }
    onSelect(best?.id ?? null);
  }

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-xl border border-[oklch(0.72_0.04_70)] bg-[#f7f1e3] shadow-[0_20px_50px_-28px_rgba(70,40,20,0.45)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Sheet music" className="block h-auto w-full" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-pointer"
        onClick={handleClick}
      />
    </div>
  );
}
