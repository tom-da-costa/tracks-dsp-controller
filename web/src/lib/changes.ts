// Unsaved changes: what differs between the stored preset and the live setup, as the server
// lists them (state/changes.py), put in words and physical units for the Presets page.

import { formatDb, formatGeqFreq, formatHz, formatQ, GEQ_FREQS } from "./scale";
import type { Profile } from "./types";

export interface UnsavedChange {
  path: string; // "outputs.2.peq.3.freq_hz"
  before: unknown; // in the stored preset
  after: unknown; // live
  revert: { path: string; value: unknown } | null; // the "set" that restores `before`
}

/** One change in words: the setting, and the stored and live values. */
export interface ChangeText {
  setting: string;
  before: string;
  after: string;
}

/** The channel of a change ("outputs.2"). */
export function channelOf(path: string): string {
  return path.split(".").slice(0, 2).join(".");
}

const FIELDS: Record<string, string> = {
  gain_db: "Gain",
  mute: "Mute",
  phase: "Phase",
  delay_ms: "Delay",
  name: "Name",
  peq_bypass: "PEQ bypass",
  matrix: "Matrix",
  linked: "Link",
  crosspoints_db: "Matrix levels",
};
const PARTS: Record<string, string> = {
  gate: "Gate",
  compressor: "Compressor",
  limiter: "Limiter",
  hpf: "High-pass",
  lpf: "Low-pass",
};
const KEYS: Record<string, string> = {
  threshold_db: "threshold",
  attack_ms: "attack",
  release_ms: "release",
  hold_ms: "hold",
  knee_db: "knee",
  ratio: "ratio",
  freq_hz: "frequency",
  slope: "slope",
  enabled: "on",
  gain_db: "gain",
  q: "Q",
  type: "type",
  bypass: "bypass",
};

function inputName(i: number): string {
  return `In ${String.fromCharCode(65 + i)}`;
}

function onOff(v: unknown): string {
  return v ? "on" : "off";
}

function number(v: unknown, digits: number, unit: string): string {
  return typeof v === "number" ? `${Number(v.toFixed(digits))} ${unit}` : String(v);
}

/** A value of `key` (the last part of the path) in physical units. */
function value(key: string, v: unknown, profile: Profile | undefined, part = ""): string {
  if (typeof v === "boolean") return onOff(v);
  switch (key) {
    case "gain_db":
    case "threshold_db":
      return typeof v === "number" ? `${formatDb(v)} ${key === "gain_db" ? "dB" : "dBu"}` : "—";
    case "knee_db":
      return number(v, 0, "dB");
    case "delay_ms":
      return number(v, 3, "ms");
    case "attack_ms":
    case "release_ms":
    case "hold_ms":
      return number(v, 0, "ms");
    case "freq_hz":
      return typeof v === "number" ? `${formatHz(v)} Hz` : "—";
    case "q":
      return typeof v === "number" ? formatQ(v) : "—";
    case "slope":
      return profile?.slopes[v as number] ?? String(v);
    case "ratio":
      return profile?.ratios[v as number] ?? String(v);
    case "type":
      return profile?.peq_types[v as number] ?? String(v);
    case "matrix":
      return Array.isArray(v)
        ? v.map((on, i) => (on ? inputName(i) : "")).filter(Boolean).join(" + ") || "none"
        : "—";
    case "linked":
      return Array.isArray(v) && v.length > 0 ? `with ${v.length} other` : "not linked";
    case "crosspoints_db":
      return Array.isArray(v) ? v.map((db) => formatDb(db as number)).join(" / ") : "—";
    case "name":
      return `"${String(v)}"`;
    default:
      return part === "geq" && typeof v === "number" ? `${formatDb(v)} dB` : String(v);
  }
}

/** A change in words, e.g. {setting: "PEQ band 2 · frequency", before: "250 Hz", after: …}. */
export function describe(change: UnsavedChange, profile?: Profile): ChangeText {
  const [, , field = "", ...rest] = change.path.split(".");
  const say = (setting: string, key: string, part = ""): ChangeText => ({
    setting,
    before: value(key, change.before, profile, part),
    after: value(key, change.after, profile, part),
  });
  if (field === "peq" && rest.length === 2) {
    const [band = "0", key = ""] = rest;
    return say(`PEQ band ${Number(band) + 1} · ${KEYS[key] ?? key}`, key);
  }
  if (field === "geq" && rest.length === 1) {
    const hz = GEQ_FREQS[Number(rest[0])];
    return say(`GEQ ${hz === undefined ? Number(rest[0]) + 1 : `${formatGeqFreq(hz)} Hz`}`, "", "geq");
  }
  if (field === "crossover" && rest.length === 2) {
    const [which = "", key = ""] = rest;
    return say(`${PARTS[which] ?? which} · ${KEYS[key] ?? key}`, key);
  }
  if (field in PARTS && rest.length === 1) {
    const key = rest[0] ?? "";
    return say(`${PARTS[field]} · ${KEYS[key] ?? key}`, key);
  }
  return say(FIELDS[field] ?? change.path, field);
}
