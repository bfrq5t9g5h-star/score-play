"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CircleStop,
  Loader2,
  Music2,
  Pause,
  Play,
  Trash2,
  Upload,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { scorePlayer, type Voice } from "@/lib/audio/player";
import { durationGlyph, durationLabel } from "@/lib/music/pitch";
import { dataUrlFromRgba, captureVideoFrame, rgbaFromFile } from "@/lib/omr/load";
import { recognizeSheet, retune, sequenceNotes } from "@/lib/omr/recognize";
import { groupSystems } from "@/lib/omr/staff";
import type { KeyName, RecognitionResult } from "@/lib/omr/types";
import { HYMNS } from "@/lib/sheet/hymns";
import { renderHymn } from "@/lib/sheet/render";
import { SheetStage } from "@/components/sheet-stage";
import { cn } from "@/lib/utils";

const KEYS: { id: KeyName; label: string }[] = [
  { id: "C", label: "C major" },
  { id: "G", label: "G major" },
  { id: "D", label: "D major" },
  { id: "A", label: "A major" },
  { id: "F", label: "F major" },
  { id: "Bb", label: "B♭ major" },
  { id: "Eb", label: "E♭ major" },
];

export function CantorApp() {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<KeyName>("C");
  const [tempo, setTempo] = useState(80);
  const [voice, setVoice] = useState<Voice>("organ");
  const [playing, setPlaying] = useState(false);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      scorePlayer.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOpen || !video || !stream) return;
    video.srcObject = stream;
    void video.play();
  }, [cameraOpen]);

  async function analyze(image: Parameters<typeof recognizeSheet>[0], deskew = true) {
    setBusy(true);
    setError(null);
    setActiveIds([]);
    setSelectedId(null);
    scorePlayer.stop();
    setPlaying(false);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const next = recognizeSheet(image, { key, deskew });
      setResult(next);
      setPreview(dataUrlFromRgba(next.image));
      if (next.notes.length === 0 && next.staves.length === 0) {
        setError(next.warnings[0] ?? "Could not read that page.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reading failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const image = await rgbaFromFile(file);
      await analyze(image, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that image.");
      setBusy(false);
    }
  }

  async function onSample(id: string) {
    const hymn = HYMNS.find((h) => h.id === id);
    if (!hymn) return;
    setBusy(true);
    setError(null);
    setKey(hymn.key);
    setTempo(hymn.tempo);
    await new Promise((r) => setTimeout(r, 20));
    try {
      const { image } = renderHymn(hymn);
      await analyze(image, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draw that sample.");
      setBusy(false);
    }
  }

  async function openCamera() {
    setCameraError(null);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("Camera permission is blocked. You can still upload a photo.");
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function snapCamera() {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    const image = captureVideoFrame(videoRef.current);
    closeCamera();
    await analyze(image, true);
  }

  function changeKey(next: KeyName) {
    setKey(next);
    if (result) setResult(retune(result, next));
  }

  function toggleMute(id: string) {
    if (!result) return;
    const notes = result.notes.map((n) => (n.id === id ? { ...n, muted: !n.muted } : n));
    const events = result.events.map((e) => ({
      ...e,
      notes: e.notes.map((n) => (n.id === id ? { ...n, muted: !n.muted } : n)),
    }));
    setResult({ ...result, notes, events });
  }

  function removeNote(id: string) {
    if (!result) return;
    const notes = result.notes.filter((n) => n.id !== id);
    const systems = groupSystems(result.staves).map((s) => s.map((staff) => staff.index));
    const events = sequenceNotes(
      notes,
      systems,
      result.staves.map((s) => s.space),
    );
    setResult({ ...result, notes, events });
    if (selectedId === id) setSelectedId(null);
  }

  async function play() {
    if (!result || result.events.length === 0) return;
    setPlaying(true);
    await scorePlayer.play(
      result.events,
      tempo,
      voice,
      (_index, ids) => setActiveIds(ids),
      () => {
        setPlaying(false);
        setActiveIds([]);
      },
    );
  }

  function stop() {
    scorePlayer.stop();
    setPlaying(false);
    setActiveIds([]);
  }

  const selected = result?.notes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[oklch(0.78_0.03_70)] bg-[oklch(0.975_0.015_85)]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Music2 className="size-4" />
            </span>
            <div>
              <p className="font-heading text-lg leading-none tracking-tight">Cantor</p>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Read the staff. Play the hymn.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload data-icon="inline-start" />
              Upload
            </Button>
            <Button size="sm" onClick={openCamera}>
              <Camera data-icon="inline-start" />
              Photograph
            </Button>
          </div>
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {!preview && !busy ? (
          <EmptyState onUpload={() => fileRef.current?.click()} onCamera={openCamera} onSample={onSample} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="min-w-0 space-y-3">
              {busy ? (
                <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-[oklch(0.72_0.04_70)] bg-[#f7f1e3]/70">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Finding the staff and note heads…
                  </div>
                </div>
              ) : preview ? (
                <SheetStage
                  src={preview}
                  result={result}
                  activeIds={activeIds}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : null}

              {error ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {result?.warnings.map((w) => (
                <p key={w} className="text-sm text-muted-foreground">
                  {w}
                </p>
              ))}

              {result && result.notes.length > 0 ? (
                <div className="sticky bottom-3 z-10 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={playing ? stop : play} disabled={!result.events.length}>
                      {playing ? (
                        <Pause data-icon="inline-start" />
                      ) : (
                        <Play data-icon="inline-start" />
                      )}
                      {playing ? "Stop" : "Play notes"}
                    </Button>
                    {playing ? (
                      <Button variant="outline" onClick={stop}>
                        <CircleStop data-icon="inline-start" />
                        Silence
                      </Button>
                    ) : null}
                    <Badge variant="secondary">
                      {result.notes.filter((n) => !n.muted).length} notes
                    </Badge>
                    <Badge variant="outline">{result.staves.length} staff</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Tempo {tempo} bpm
                      <Slider
                        className="mt-2"
                        min={48}
                        max={132}
                        value={[tempo]}
                        onValueChange={(v) => {
                          const n = Array.isArray(v) ? v[0] : v;
                          if (typeof n === "number") setTempo(n);
                        }}
                      />
                    </label>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Voice
                      <Select value={voice} onValueChange={(v) => v && setVoice(v as Voice)}>
                        <SelectTrigger className="mt-1.5 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="organ">Organ</SelectItem>
                          <SelectItem value="piano">Piano</SelectItem>
                          <SelectItem value="choir">Choir</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Key signature
                      <Select value={key} onValueChange={(v) => v && changeKey(v as KeyName)}>
                        <SelectTrigger className="mt-1.5 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KEYS.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              {k.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                </div>
              ) : null}
            </section>

            <aside className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle>Read notes</CardTitle>
                  <CardDescription>
                    Tap a head on the page to select it. Mute stray marks before you play.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selected ? (
                    <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-muted px-2.5 py-2 text-sm">
                      <span>
                        {selected.name} · {durationLabel(selected.quarters)}
                      </span>
                      <span className="flex gap-1">
                        <Button size="icon-xs" variant="ghost" onClick={() => toggleMute(selected.id)}>
                          <VolumeX />
                        </Button>
                        <Button size="icon-xs" variant="ghost" onClick={() => removeNote(selected.id)}>
                          <Trash2 />
                        </Button>
                      </span>
                    </div>
                  ) : null}
                  <ScrollArea className="h-72">
                    {result?.notes.length ? (
                      <ol className="space-y-1 pr-2">
                        {result.notes.map((note) => (
                          <li key={note.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(note.id)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                                selectedId === note.id && "bg-muted",
                                note.muted && "opacity-40",
                                activeIds.includes(note.id) && "bg-primary/10",
                              )}
                            >
                              <span className="font-medium">{note.name}</span>
                              <span className="text-muted-foreground">
                                {durationGlyph(note.quarters)} {durationLabel(note.quarters)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {busy ? "Reading…" : "No notes yet."}
                      </p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Best on a flat scan or a square photo of a hymn or chant: one staff, dark ink, even
                light. Fancy engravings, dense polyphony, and heavy perspective still confuse the
                reader.
              </p>
            </aside>
          </div>
        )}
      </main>

      <Dialog
        open={cameraOpen}
        onOpenChange={(open) => {
          if (!open) closeCamera();
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Photograph the staff</DialogTitle>
            <DialogDescription>
              Fill the frame with the hymn. Hold the page flat and avoid shadows across the lines.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
          </div>
          {cameraError ? <p className="text-sm text-destructive">{cameraError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeCamera}>
              Cancel
            </Button>
            <Button onClick={snapCamera} disabled={!!cameraError}>
              <Camera data-icon="inline-start" />
              Use this photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({
  onUpload,
  onCamera,
  onSample,
}: {
  onUpload: () => void;
  onCamera: () => void;
  onSample: (id: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8 py-4">
      <div className="max-w-2xl space-y-3">
        <p className="font-heading text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
          Get a scan of a hymn. Hear the notes.
        </p>
        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          Cantor looks for staff lines and note heads on a page of simple music — hymns, chants,
          doxologies — then plays what it read. Start with a sample, or use your own scan.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={onCamera}>
          <Camera data-icon="inline-start" />
          Photograph a page
        </Button>
        <Button size="lg" variant="outline" onClick={onUpload}>
          <Upload data-icon="inline-start" />
          Upload a scan
        </Button>
      </div>

      <Separator />

      <div>
        <h2 className="font-heading text-xl">Try a public-domain staff</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          These are drawn in the browser, then run through the same reader as a photograph.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {HYMNS.map((hymn) => (
            <button
              key={hymn.id}
              type="button"
              onClick={() => onSample(hymn.id)}
              className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <p className="font-heading text-lg leading-tight">{hymn.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{hymn.subtitle}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
