import type { Clef, DetectedNote, KeyName, ScoreEvent, Staff } from "../types";

export interface OemerRecognizeRequest {
  type: "recognize";
  id: number;
  width: number;
  height: number;
  rgba: ArrayBuffer;
  key: KeyName;
  modelBase: string;
}

export interface OemerCancelRequest {
  type: "cancel";
  id: number;
}

export type OemerRequest = OemerRecognizeRequest | OemerCancelRequest;

export interface OemerProgressMessage {
  type: "progress";
  id: number;
  message: string;
  percent: number;
}

export interface OemerStats {
  staffPixels: number;
  symbolPixels: number;
  noteheadPixels: number;
  stemPixels: number;
  clefPixels: number;
  noteCount: number;
  staffCount: number;
  tiles: number;
}

export interface OemerResultPayload {
  width: number;
  height: number;
  staves: Staff[];
  notes: DetectedNote[];
  events: ScoreEvent[];
  warnings: string[];
  stats: OemerStats;
  engine: "oemer";
}

export interface OemerResultMessage {
  type: "result";
  id: number;
  payload: OemerResultPayload;
}

export interface OemerErrorMessage {
  type: "error";
  id: number;
  message: string;
}

export type OemerResponse = OemerProgressMessage | OemerResultMessage | OemerErrorMessage;

export type { Clef };
