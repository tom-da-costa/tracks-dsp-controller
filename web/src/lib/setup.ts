// Setup wizard (Setup tab, issue #36): from the sources and a plan of the system (the DSP's
// outputs wired to amplifier channels, the channels to speakers) to the whole DSP
// configuration. Pure functions over a draft the wizard edits; the server validates and
// quantises the plan again (state/setup.py), then loads it with the preset sequence (outputs
// muted while it is written, inputs left muted at the end).
//
//   speakers     each cabinet placed has its own specs (a library model's are copied in), a
//                side (left, right, or mono L+R) and one section per band it plays (two for a
//                bi-amped cabinet); a section's label ("Sub", "High") is only a hint
//   bridging     a speaker's link output feeds another speaker (daisy chain): it plays the
//                same signal, in parallel on the same amplifier channel
//   ways         a list the user orders from low to high (main ways), plus auxiliary ones; each
//                DSP output picks its way (wiring an output to sections labelled "Sub" picks or
//                makes the Sub way). Cabinets of different kinds can play the same way
//   groups       the outputs of a way that drive the same load (same amplifier gain and
//                ratings, same cabinets per channel) are linked: one limiter, one gain. An
//                output with another load gets the same filters, but its own limiter and a
//                trim, so that each kind of cabinet plays at the same level
//   routing      each output plays a source; its side comes from its speakers' (left, right or
//                both, L+R)
//   crossovers   between two consecutive main ways, at √(top of the lower × bottom of the
//                upper range) (usual values without ranges), LR-24; a subsonic high-pass at the
//                bottom of the lowest way, BW-24; the auxiliary ways are filtered to their
//                speakers' range, BW-24
//   limiters     the limiter calculator (lib/limiter.ts) per amplifier channel, with the
//                cabinets wired to it (in parallel); a group takes its lowest threshold
//   gains        each group's SPL for the same mono programme: the cabinets' powers added up
//                (sensitivity + 10·log10(power of the cabinet), +6 dB on an output that sums
//                both sides of a stereo source); within a way, each group is trimmed to the
//                quietest kind of cabinet (per cabinet); the output gains then turn the louder
//                main ways down to the quietest

import {
  computeLimiter,
  validate as validateLimiter,
  type Load,
  type LimiterResult,
  type Mode,
  type Rounding,
} from "./limiter";
import amplifierData from "../data/amplifiers.json";
import speakerData from "../data/speakers.json";

const DBU_REF_V = 0.775;
const SUM_DB = 20 * Math.log10(2); // L + R of a mono programme
export const DEFAULT_SENSITIVITY_DB = 102;
export const DEFAULT_SHELF_HZ = 100;
export const DEFAULT_SHELF_DB = 9;
export const DEFAULT_SHELF_Q = 0.71;
export const CHANNEL_NAME_LENGTH = 8;
export const PRESET_NAME_LENGTH = 14;
export const RATED_LOADS = ["8", "4", "2"] as const;
/** Slopes proposed, by name in the profile's list. */
export const CROSSOVER_SLOPE = "LR-24";
export const PROTECTION_SLOPE = "BW-24";

// --- library -------------------------------------------------------------------------------------

export interface LibrarySection {
  name: string;
  drivers: string;
  impedance_ohm: number;
  aes_w: number;
  sensitivity_db: number;
  low_hz: number;
  high_hz: number;
  load: Load;
  estimated: string[];
  source: string;
}

export interface SpeakerModel {
  id: string;
  name: string;
  description: string;
  sections: LibrarySection[];
}

export interface AmplifierModel {
  id: string;
  name: string;
  channels: number;
  power_w: Record<string, number>;
  bridge_power_w: Record<string, number>;
  gains_db: number[];
  rating: string;
}

export const SPEAKERS = speakerData.speakers as SpeakerModel[];
export const AMPLIFIERS = amplifierData.amplifiers as AmplifierModel[];

export function amplifierModel(id: string | null): AmplifierModel | null {
  return AMPLIFIERS.find((a) => a.id === id) ?? null;
}

export function speakerModel(id: string | null): SpeakerModel | null {
  return SPEAKERS.find((m) => m.id === id) ?? null;
}

/** Power per channel into `ohm`, from the ratings by load: the rating at the nearest listed load
 * at or above `ohm` (the safe side); above every listed load, the highest one scaled at constant
 * voltage. null below the lowest rated load, or with no rating. */
export function ampPowerAt(ratings: Record<string, number>, ohm: number): number | null {
  const rated = (load: number) => ratings[String(load)] ?? NaN;
  const loads = Object.keys(ratings)
    .map(Number)
    .filter((load) => rated(load) > 0)
    .sort((a, b) => a - b);
  const lowest = loads[0];
  if (lowest === undefined || ohm < lowest - 0.05) return null;
  const at = loads.find((load) => load >= ohm - 0.05);
  if (at !== undefined) return rated(at);
  const top = loads[loads.length - 1]!;
  return Math.round((rated(top) * top) / ohm);
}

/** Gain of an amplifier from its input sensitivity: `volts` in gives `powerW` into `ohm`. */
export function gainFromSensitivity(volts: number, powerW: number, ohm: number): number {
  return 20 * Math.log10(Math.sqrt(powerW * ohm) / volts);
}

// --- draft ---------------------------------------------------------------------------------------

/** Number fields stay text while typed (empty = not set). */
export type Num = string;

export type Side = "L" | "R" | "LR";

export interface Source {
  id: number;
  name: string;
  stereo: boolean;
}

/** One section of a cabinet (one band it plays). */
export interface Section {
  /** Label ("Sub", "High"; may be empty): wiring an output to it picks the way of that name. */
  name: string;
  lowHz: Num;
  highHz: Num;
  aesW: Num;
  impedanceOhm: Num;
  sensitivityDb: Num;
  load: Load;
}

/** A cabinet on the plan, with its own specs. */
export interface SpeakerNode {
  id: number;
  /** Library speaker it was taken from, null for a generic one. */
  ref: string | null;
  model: string;
  /** Left, right, or both sides (mono). */
  side: Side;
  sections: Section[];
  x: number;
  y: number;
}

export interface AmpNode {
  id: number;
  /** Library amplifier, null for a generic one. */
  ref: string | null;
  model: string;
  channels: number;
  gainMode: "gain" | "sensitivity";
  gainDb: Num;
  sensitivityV: Num;
  sensitivityPowerW: Num;
  sensitivityOhm: Num;
  /** Power per channel by load ("8", "4", "2" Ω). */
  powerW: Record<string, Num>;
  x: number;
  y: number;
}

/** A way: a band of the system, played by the outputs that pick it. */
export interface Way {
  id: number;
  /** Channel name of its outputs (" L", " R" or a number is added when it has several). */
  name: string;
  /** Index in WAY_COLORS. */
  color: number;
  /** Auxiliary (monitor, fill…): outside the crossover chain and the level matching. */
  aux: boolean;
  phase: boolean;
  mode: Mode;
  rounding: Rounding;
  /** Output gain typed over the computed one. */
  gainDb: Num;
}

export const WAY_COLORS = [
  "#3ddc97",
  "#4da3ff",
  "#ffb020",
  "#c38bff",
  "#ff7a59",
  "#5ad1e6",
  "#e6d75a",
  "#ff5fa2",
];

export const wayColor = (way: Way | null | undefined): string =>
  way ? WAY_COLORS[way.color % WAY_COLORS.length]! : "#888";

/** A link of the plan: DSP output → amplifier channel, amplifier channel → speaker section,
 * DSP output → section of an active speaker, or a speaker's link output → another speaker
 * (bridged: the same signal, in parallel). */
export type Wire =
  | { type: "feed"; output: number; amp: number; channel: number }
  | { type: "drive"; amp: number; channel: number; speaker: number; section: number }
  | { type: "direct"; output: number; speaker: number; section: number }
  | { type: "chain"; from: number; fromSection: number; speaker: number; section: number };

export interface FilterSetting {
  enabled: boolean;
  /** Empty = the proposed frequency. */
  freqHz: Num;
  slope: number;
}

export interface Draft {
  sources: Source[];
  speakers: SpeakerNode[];
  amps: AmpNode[];
  wires: Wire[];
  /** The source each DSP output plays, by output index. */
  routes: Record<number, number | null>;
  /** The ways: the main ones from low to high (in this order), the auxiliary ones anywhere. */
  ways: Way[];
  /** The way each DSP output plays, by output index (not set yet: picked from the labels of
   * the sections it drives; null: none, chosen so). */
  outputWays: Record<number, number | null>;
  lowShelf: { enabled: boolean; freqHz: Num; gainDb: Num; q: Num };
  /** Crossovers between two main ways, by "lower|upper" way ids. */
  crossovers: Record<string, FilterSetting>;
  subsonic: FilterSetting;
  /** Filters of the auxiliary ways, by way id. */
  aux: Record<number, { hpf: FilterSetting; lpf: FilterSetting }>;
  slot: number;
  presetName: string;
  nextId: number;
}

export interface Topology {
  inputs: number;
  outputs: number;
  presets: number;
  slopes: string[];
}

export function slopeIndex(slopes: string[], name: string): number {
  return Math.max(1, slopes.indexOf(name));
}

export function newDraft(slopes: string[]): Draft {
  return {
    sources: [{ id: 1, name: "Main", stereo: true }],
    speakers: [],
    amps: [],
    wires: [],
    routes: {},
    ways: [],
    outputWays: {},
    lowShelf: {
      enabled: false,
      freqHz: String(DEFAULT_SHELF_HZ),
      gainDb: String(DEFAULT_SHELF_DB),
      q: String(DEFAULT_SHELF_Q),
    },
    crossovers: {},
    subsonic: { enabled: true, freqHz: "", slope: slopeIndex(slopes, PROTECTION_SLOPE) },
    aux: {},
    slot: 0,
    presetName: "Setup",
    nextId: 2,
  };
}

// --- ways ----------------------------------------------------------------------------------------

/** A new way, at `at` in the list (the end by default), in a colour not used yet if any. */
export function addWay(draft: Draft, name: string, at = draft.ways.length): Way {
  const used = new Set(draft.ways.map((w) => w.color % WAY_COLORS.length));
  const free = WAY_COLORS.findIndex((_, i) => !used.has(i));
  const way: Way = {
    id: draft.nextId++,
    name,
    color: free >= 0 ? free : draft.ways.length,
    aux: false,
    phase: false,
    mode: "hard",
    rounding: "up",
    gainDb: "",
  };
  draft.ways.splice(Math.max(0, Math.min(draft.ways.length, at)), 0, way);
  return way;
}

/** A name for a new way: "Way 1", "Way 2"… (not taken). */
export function freshWayName(draft: Draft): string {
  for (let n = draft.ways.length + 1; ; n++) {
    const name = `Way${n}`;
    if (!findWay(draft, name)) return name;
  }
}

export function removeWay(draft: Draft, id: number): void {
  draft.ways = draft.ways.filter((w) => w.id !== id);
  for (const [o, way] of Object.entries(draft.outputWays))
    if (way === id) draft.outputWays[Number(o)] = null;
  for (const key of Object.keys(draft.crossovers))
    if (key.split("|").includes(String(id))) delete draft.crossovers[key];
  delete draft.aux[id];
}

/** One place lower (-1) or higher (+1) in the list. */
export function moveWay(draft: Draft, id: number, delta: number): void {
  const i = draft.ways.findIndex((w) => w.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= draft.ways.length) return;
  const [way] = draft.ways.splice(i, 1);
  draft.ways.splice(j, 0, way!);
}

export function findWay(draft: Draft, name: string): Way | null {
  const key = name.trim().toLowerCase();
  return draft.ways.find((w) => w.name.trim().toLowerCase() === key) ?? null;
}

/** The way an output plays, null when none is picked. */
export function wayOfOutput(draft: Draft, output: number): Way | null {
  const id = draft.outputWays[output];
  return id == null ? null : (draft.ways.find((w) => w.id === id) ?? null);
}

export function newSection(): Section {
  return {
    name: "",
    lowHz: "",
    highHz: "",
    aesW: "",
    impedanceOhm: "8",
    sensitivityDb: String(DEFAULT_SENSITIVITY_DB),
    load: "open",
  };
}

function librarySectionSpec(s: LibrarySection): Section {
  return {
    name: s.name.slice(0, 6),
    lowHz: String(s.low_hz),
    highHz: String(s.high_hz),
    aesW: String(s.aes_w),
    impedanceOhm: String(s.impedance_ohm),
    sensitivityDb: String(s.sensitivity_db),
    load: s.load,
  };
}

export function librarySection(node: SpeakerNode, index: number): LibrarySection | null {
  return speakerModel(node.ref)?.sections[index] ?? null;
}

/** Place a cabinet, of a library model (its specs copied in) or generic. */
export function addSpeaker(draft: Draft, ref: string | null, x: number, y: number): SpeakerNode {
  const model = speakerModel(ref);
  const node: SpeakerNode = {
    id: draft.nextId++,
    ref: model?.id ?? null,
    model: model?.name ?? "Generic",
    side: "LR",
    sections: model ? model.sections.map(librarySectionSpec) : [newSection()],
    x,
    y,
  };
  draft.speakers.push(node);
  return node;
}

/** Another cabinet like this one (its specs copied; the other side when it has one). */
export function duplicateSpeaker(draft: Draft, node: SpeakerNode): SpeakerNode {
  const copy: SpeakerNode = {
    ...node,
    id: draft.nextId++,
    side: node.side === "L" ? "R" : node.side === "R" ? "L" : "LR",
    sections: node.sections.map((s) => ({ ...s })),
    x: node.x + 24,
    y: node.y + 24,
  };
  draft.speakers.push(copy);
  return copy;
}

export function addAmp(draft: Draft, ref: string | null, x: number, y: number): AmpNode {
  const model = amplifierModel(ref);
  const node: AmpNode = {
    id: draft.nextId++,
    ref: model?.id ?? null,
    model: model?.name ?? "Generic",
    channels: model?.channels ?? 2,
    gainMode: "gain",
    gainDb: model ? String(Math.max(...model.gains_db)) : "",
    sensitivityV: "",
    sensitivityPowerW: model?.power_w["8"] ? String(model.power_w["8"]) : "",
    sensitivityOhm: "8",
    powerW: Object.fromEntries(
      RATED_LOADS.map((load) => [load, model?.power_w[load] ? String(model.power_w[load]) : ""]),
    ),
    x,
    y,
  };
  draft.amps.push(node);
  return node;
}

export function removeNode(draft: Draft, type: "amp" | "speaker", id: number): void {
  if (type === "amp") {
    draft.amps = draft.amps.filter((a) => a.id !== id);
    draft.wires = draft.wires.filter((w) => !("amp" in w) || w.amp !== id);
  } else {
    draft.speakers = draft.speakers.filter((s) => s.id !== id);
    draft.wires = draft.wires.filter(
      (w) => w.type === "feed" || (w.speaker !== id && !(w.type === "chain" && w.from === id)),
    );
  }
}

/** Fewer channels on an amplifier: the wires of the channels gone go too. */
export function setAmpChannels(draft: Draft, amp: AmpNode, channels: number): void {
  amp.channels = Math.max(1, Math.min(16, Math.round(channels) || 1));
  draft.wires = draft.wires.filter(
    (w) => !("amp" in w) || w.amp !== amp.id || w.channel < amp.channels,
  );
}

/** One section fewer on a generic speaker: its wires go, the next sections' move up. */
export function removeSection(draft: Draft, node: SpeakerNode, index: number): void {
  if (node.sections.length <= 1) return;
  node.sections.splice(index, 1);
  const gone = (id: number, section: number) => id === node.id && section === index;
  const shift = (id: number, section: number) =>
    id === node.id && section > index ? section - 1 : section;
  draft.wires = draft.wires
    .filter(
      (w) =>
        w.type === "feed" ||
        !(gone(w.speaker, w.section) || (w.type === "chain" && gone(w.from, w.fromSection))),
    )
    .map((w) => {
      if (w.type === "feed") return w;
      const moved = { ...w, section: shift(w.speaker, w.section) };
      return moved.type === "chain"
        ? { ...moved, fromSection: shift(moved.from, moved.fromSection) }
        : moved;
    });
}

export function removeSource(draft: Draft, id: number): void {
  draft.sources = draft.sources.filter((s) => s.id !== id);
  for (const [o, source] of Object.entries(draft.routes))
    if (source === id) draft.routes[Number(o)] = null;
}

/** The source an output plays (the first one until it is chosen). */
export function routeOf(draft: Draft, output: number): number | null {
  const chosen = draft.routes[output];
  return chosen === undefined ? (draft.sources[0]?.id ?? null) : chosen;
}

// --- ports and wiring ----------------------------------------------------------------------

/** A connection point of the plan. */
export type Port =
  | { node: "dsp"; port: number } // a DSP output
  | { node: "amp-in"; id: number; port: number }
  | { node: "amp-out"; id: number; port: number }
  | { node: "spk"; id: number; port: number } // a speaker section's input
  | { node: "spk-out"; id: number; port: number }; // its link output (bridging)

export function portKey(p: Port): string {
  return p.node === "dsp" ? `dsp:${p.port}` : `${p.node}:${p.id}:${p.port}`;
}

export function parsePort(key: string): Port | null {
  const [node, a, b] = key.split(":");
  if (node === "dsp" && a !== undefined) return { node, port: Number(a) };
  if (
    (node === "amp-in" || node === "amp-out" || node === "spk" || node === "spk-out") &&
    a !== undefined &&
    b !== undefined
  )
    return { node, id: Number(a), port: Number(b) };
  return null;
}

/** The wire joining two ports (in either order), or null when they cannot be joined. */
export function wireBetween(a: Port, b: Port): Wire | null {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    if (x.node === "dsp" && y.node === "amp-in")
      return { type: "feed", output: x.port, amp: y.id, channel: y.port };
    if (x.node === "amp-out" && y.node === "spk")
      return { type: "drive", amp: x.id, channel: x.port, speaker: y.id, section: y.port };
    if (x.node === "dsp" && y.node === "spk")
      return { type: "direct", output: x.port, speaker: y.id, section: y.port };
    if (x.node === "spk-out" && y.node === "spk" && x.id !== y.id)
      return { type: "chain", from: x.id, fromSection: x.port, speaker: y.id, section: y.port };
  }
  return null;
}

/** The speaker sections bridged from this one, further and further down the chain. */
export function bridged(
  draft: Draft,
  speaker: number,
  section: number,
): { speaker: number; section: number }[] {
  const found: { speaker: number; section: number }[] = [];
  const seen = new Set([`${speaker}:${section}`]);
  const queue = [{ speaker, section }];
  while (queue.length) {
    const at = queue.shift()!;
    for (const w of draft.wires) {
      if (w.type !== "chain" || w.from !== at.speaker || w.fromSection !== at.section) continue;
      const key = `${w.speaker}:${w.section}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const next = { speaker: w.speaker, section: w.section };
      found.push(next);
      queue.push(next);
    }
  }
  return found;
}

/** Add a wire; an amplifier input or a speaker section takes one signal: its previous wire
 * goes. A bridge that would loop back is refused (returns false). */
export function connect(draft: Draft, wire: Wire): boolean {
  if (
    wire.type === "chain" &&
    bridged(draft, wire.speaker, wire.section).some(
      (b) => b.speaker === wire.from && b.section === wire.fromSection,
    )
  )
    return false;
  draft.wires = draft.wires.filter((w) => {
    if (wire.type === "feed")
      return !(w.type === "feed" && w.amp === wire.amp && w.channel === wire.channel);
    if (w.type === "feed") return true;
    return !(w.speaker === wire.speaker && w.section === wire.section);
  });
  draft.wires.push(wire);
  return true;
}

export function sameWire(a: Wire, b: Wire): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function disconnect(draft: Draft, wire: Wire): void {
  draft.wires = draft.wires.filter((w) => !sameWire(w, wire));
}

// --- wiring ----------------------------------------------------------------------------------

export function num(text: Num): number {
  return text.trim() === "" ? NaN : Number(text.replace(",", "."));
}

const positive = (v: number) => Number.isFinite(v) && v > 0;

/** A cabinet section wired on the plan. */
export interface Cabinet {
  node: SpeakerNode;
  section: Section;
}

/** One amplifier channel (or an output's active speakers) of a way. */
export interface ChannelLoad {
  output: number;
  amp: AmpNode | null; // null: active speakers, fed directly
  channel: number;
  cabinets: Cabinet[];
}

/** Outputs of a way that drive the same load: linked, one limiter, one gain. */
export interface OutputGroup {
  outputs: number[];
  channels: ChannelLoad[];
  cabinets: number;
  /** The speaker models it is made of. */
  models: string[];
}

export interface WayInfo {
  id: number;
  name: string;
  /** The way itself (in the draft: its settings can be changed through it). */
  props: Way;
  outputs: number[];
  channels: ChannelLoad[];
  groups: OutputGroup[];
  cabinets: number;
  active: boolean;
  /** Its range: where its cabinets' known ranges overlap (NaN when unknown). */
  lowHz: number;
  highHz: number;
  /** The speaker models it is made of. */
  models: string[];
}

export interface Wiring {
  /** The ways played by an output, in the draft's order. */
  ways: WayInfo[];
  /** Way (id) of each used output. */
  wayOf: Map<number, number>;
  /** Side each used output plays, from its speakers. */
  sideOf: Map<number, Side>;
  /** Way (id) of each speaker section reached by an output, by "speaker:section". */
  sectionWay: Map<string, number>;
  errors: string[];
}

/** What each DSP output drives: per amplifier channel (or its active speakers), the cabinets,
 * the bridged ones included. */
export function outputLoads(draft: Draft, topo: Topology): Map<number, ChannelLoad[]> {
  const speakers = new Map(draft.speakers.map((s) => [s.id, s]));
  const amps = new Map(draft.amps.map((a) => [a.id, a]));
  const cabinet = (speaker: number, section: number): Cabinet | null => {
    const node = speakers.get(speaker);
    const spec = node?.sections[section];
    return node && spec ? { node, section: spec } : null;
  };
  const withBridged = (speaker: number, section: number): Cabinet[] =>
    [{ speaker, section }, ...bridged(draft, speaker, section)]
      .map((b) => cabinet(b.speaker, b.section))
      .filter((c): c is Cabinet => c !== null);
  const driven = new Map<string, Cabinet[]>();
  for (const w of draft.wires) {
    if (w.type !== "drive") continue;
    const key = `${w.amp}:${w.channel}`;
    driven.set(key, [...(driven.get(key) ?? []), ...withBridged(w.speaker, w.section)]);
  }
  const result = new Map<number, ChannelLoad[]>();
  for (let o = 0; o < topo.outputs; o++) {
    const loads: ChannelLoad[] = [];
    const direct: Cabinet[] = [];
    for (const w of draft.wires) {
      if (w.type === "feed" && w.output === o) {
        const list = driven.get(`${w.amp}:${w.channel}`) ?? [];
        if (list.length)
          loads.push({ output: o, amp: amps.get(w.amp) ?? null, channel: w.channel, cabinets: list });
      } else if (w.type === "direct" && w.output === o) {
        direct.push(...withBridged(w.speaker, w.section));
      }
    }
    if (direct.length) loads.push({ output: o, amp: null, channel: 0, cabinets: direct });
    if (loads.length) result.set(o, loads);
  }
  return result;
}

/** The range where the known ranges of these cabinets overlap (NaN where unknown). */
function rangeOf(cabinets: Cabinet[]): { lowHz: number; highHz: number } {
  const lows = cabinets.map((c) => num(c.section.lowHz)).filter(positive);
  const highs = cabinets.map((c) => num(c.section.highHz)).filter(positive);
  return {
    lowHz: lows.length ? Math.max(...lows) : NaN,
    highHz: highs.length ? Math.min(...highs) : NaN,
  };
}

/** Roughly where a range plays: its centre, or near its one known end (NaN when unknown). */
function centreHz(range: { lowHz: number; highHz: number }): number {
  const low = positive(range.lowHz);
  const high = positive(range.highHz);
  if (low && high) return Math.sqrt(range.lowHz * range.highHz);
  if (low) return range.lowHz * 2;
  if (high) return range.highHz / 2;
  return NaN;
}

/** What makes two outputs' loads the same (then they can be linked). */
function loadSignature(loads: ChannelLoad[]): string {
  return JSON.stringify(
    loads
      .map((l) => ({
        amp: l.amp
          ? [ampGain(l.amp), Object.entries(ampRatings(l.amp)).sort(([a], [b]) => a.localeCompare(b))]
          : null,
        cabinets: l.cabinets
          .map((c) =>
            [c.section.aesW, c.section.impedanceOhm, c.section.sensitivityDb, c.section.load]
              .map((v) => v.trim())
              .join("|"),
          )
          .sort(),
      }))
      .map((l) => JSON.stringify(l))
      .sort(),
  );
}

/** Give a way to each output wired to speakers that has none yet: the one named like the
 * labels of the sections it drives (when they all agree), made if needed and placed among the
 * main ways by its range. From an event handler (it changes the draft). */
export function autoAssignWays(draft: Draft, topo: Topology): void {
  const loads = outputLoads(draft, topo);
  const cabinetsOf = (o: number) => (loads.get(o) ?? []).flatMap((l) => l.cabinets);
  for (const [o] of loads) {
    if (draft.outputWays[o] !== undefined && wayOfOutput(draft, o)) continue;
    if (draft.outputWays[o] === null) continue; // left without a way on purpose
    const labels = [...new Set(cabinetsOf(o).map((c) => c.section.name.trim()))];
    if (labels.length !== 1 || labels[0] === "") continue;
    const name = labels[0]!.slice(0, CHANNEL_NAME_LENGTH - 2);
    let way = findWay(draft, name);
    if (!way) {
      // Among the main ways, before the first one that plays higher.
      const centre = centreHz(rangeOf(cabinetsOf(o)));
      let at = draft.ways.length;
      if (Number.isFinite(centre)) {
        const index = draft.ways.findIndex((w) => {
          if (w.aux) return false;
          const cabinets = [...loads.keys()]
            .filter((p) => draft.outputWays[p] === w.id)
            .flatMap(cabinetsOf);
          return centreHz(rangeOf(cabinets)) > centre;
        });
        if (index >= 0) at = index;
      }
      way = addWay(draft, name, at);
    }
    draft.outputWays[o] = way.id;
  }
}

/** The ways the plan's wiring makes, and what is wrong with it. */
export function wiring(draft: Draft, topo: Topology): Wiring {
  const errors: string[] = [];
  const infos = new Map<number, WayInfo>();
  const wayOf = new Map<number, number>();
  const sideOf = new Map<number, Side>();
  const sectionWay = new Map<string, number>();
  const signatures = new Map<number, string>();
  for (const [o, loads] of outputLoads(draft, topo)) {
    const all = loads.flatMap((l) => l.cabinets);
    const sides = [...new Set(all.map((c) => c.node.side))];
    if (sides.length > 1) {
      errors.push(`Out ${o + 1} drives speakers of different sides: give each side its own output.`);
      continue;
    }
    const way = wayOfOutput(draft, o);
    if (!way) {
      errors.push(`Out ${o + 1}: pick its way.`);
      continue;
    }
    let info = infos.get(way.id);
    if (!info) {
      info = {
        id: way.id,
        name: way.name,
        props: way,
        outputs: [],
        channels: [],
        groups: [],
        cabinets: 0,
        active: false,
        lowHz: NaN,
        highHz: NaN,
        models: [],
      };
      infos.set(way.id, info);
    }
    info.outputs.push(o);
    info.channels.push(...loads);
    info.cabinets += all.length;
    wayOf.set(o, way.id);
    sideOf.set(o, sides[0]!);
    signatures.set(o, loadSignature(loads));
    for (const c of all) {
      const index = c.node.sections.indexOf(c.section);
      sectionWay.set(`${c.node.id}:${index}`, way.id);
    }
  }
  for (const info of infos.values()) {
    const direct = info.channels.filter((c) => c.amp === null).length;
    if (direct && direct < info.channels.length)
      errors.push(`${info.name}: some cabinets have an amplifier, some are fed directly (active).`);
    info.active = direct === info.channels.length;
    const sections = info.channels.flatMap((c) => c.cabinets);
    Object.assign(info, rangeOf(sections));
    info.models = [...new Set(sections.map((c) => c.node.model))];
    const bySignature = new Map<string, OutputGroup>();
    for (const o of info.outputs) {
      const key = signatures.get(o)!;
      let group = bySignature.get(key);
      if (!group) {
        group = { outputs: [], channels: [], cabinets: 0, models: [] };
        bySignature.set(key, group);
        info.groups.push(group);
      }
      const channels = info.channels.filter((c) => c.output === o);
      group.outputs.push(o);
      group.channels.push(...channels);
      group.cabinets += channels.reduce((n, c) => n + c.cabinets.length, 0);
      group.models = [...new Set([...group.models, ...channels.flatMap((c) => c.cabinets.map((k) => k.node.model))])];
    }
  }
  const ways = draft.ways.map((w) => infos.get(w.id)).filter((w): w is WayInfo => w !== undefined);
  return { ways, wayOf, sideOf, sectionWay, errors };
}

/** Channel names of a way's outputs: its name, plus " L" / " R" when its outputs play one side
 * each, or a number when there are several of the same side. */
export function outputNames(way: WayInfo, sideOf: Map<number, Side>): Map<number, string> {
  const names = new Map<number, string>();
  const sides = way.outputs.map((o) => sideOf.get(o) ?? "LR");
  const distinct = new Set(sides).size === sides.length;
  way.outputs.forEach((o, i) => {
    const side = sides[i]!;
    if (way.outputs.length === 1) names.set(o, way.name);
    else if (distinct) names.set(o, side === "LR" ? way.name : `${way.name} ${side}`);
    else names.set(o, `${way.name}${i + 1}`);
  });
  return names;
}

// --- loads, limiters, levels -------------------------------------------------------------------

export function ampGain(amp: AmpNode): number {
  if (amp.gainMode === "gain") return num(amp.gainDb);
  return gainFromSensitivity(num(amp.sensitivityV), num(amp.sensitivityPowerW), num(amp.sensitivityOhm));
}

export function ampRatings(amp: AmpNode): Record<string, number> {
  return Object.fromEntries(Object.entries(amp.powerW).map(([load, w]) => [load, num(w)]));
}

export interface ChannelResult {
  load: ChannelLoad;
  /** The cabinets in parallel. */
  impedanceOhm: number;
  aesW: number;
  powerW: number | null;
  limiter: LimiterResult | null;
  error: string | null;
}

/** The load and the limiter of one amplifier channel (its cabinets in parallel; a closed box
 * among them makes the load closed, the safe side). */
export function channelResult(props: Pick<Way, "mode" | "rounding">, load: ChannelLoad): ChannelResult {
  const zs = load.cabinets.map((c) => num(c.section.impedanceOhm));
  const aes = load.cabinets.map((c) => num(c.section.aesW));
  const z = zs.every(positive) ? 1 / zs.reduce((sum, v) => sum + 1 / v, 0) : NaN;
  const total = aes.every(positive) ? aes.reduce((sum, v) => sum + v, 0) : NaN;
  const base = { load, impedanceOhm: z, aesW: total, powerW: null, limiter: null };
  if (load.amp === null) return { ...base, error: null };
  if (!positive(z) || !positive(total)) return { ...base, error: "speaker power and impedance are needed" };
  const power = ampPowerAt(ampRatings(load.amp), z);
  const input = {
    speakerAesW: total,
    impedanceOhm: z,
    ampGainDb: ampGain(load.amp),
    ampPowerW: power,
    load: (load.cabinets.some((c) => c.section.load === "closed") ? "closed" : "open") as Load,
    mode: props.mode,
    rounding: props.rounding,
  };
  const error = validateLimiter(input);
  return { ...base, powerW: power, limiter: error ? null : computeLimiter(input), error };
}

export interface GroupLevel {
  group: OutputGroup;
  channels: ChannelResult[];
  /** The lowest of its channels' (its outputs are linked); null for active speakers. */
  limiter: LimiterResult | null;
  /** SPL at 1 m of its cabinets at the limiter threshold. */
  splMaxDb: number | null;
  /** SPL for a mono programme at 0 dBu on the source, before any gain. */
  splAt0Db: number | null;
  /** Gain that brings its kind of cabinet to the way's quietest (0 or below). */
  trimDb: number;
}

export interface WayLevel {
  channels: ChannelResult[];
  groups: GroupLevel[];
  error: string | null;
  /** SPL at 1 m of all its cabinets at their limiter thresholds. */
  splMaxDb: number | null;
  /** SPL for a mono programme at 0 dBu on the source, with the groups' trims, before the
   * way's output gain. */
  splAt0Db: number | null;
}

const powerSum = (dbs: number[]) => 10 * Math.log10(dbs.reduce((sum, db) => sum + 10 ** (db / 10), 0));

export function wayLevel(draft: Draft, way: WayInfo, sideOf: Map<number, Side>): WayLevel {
  const channels = way.channels.map((c) => channelResult(way.props, c));
  const noLevel = (limiterOf: (g: OutputGroup) => LimiterResult | null) =>
    way.groups.map((group) => ({
      group,
      channels: channels.filter((c) => group.outputs.includes(c.load.output)),
      limiter: limiterOf(group),
      splMaxDb: null,
      splAt0Db: null,
      trimDb: 0,
    }));
  const empty = { channels, splMaxDb: null, splAt0Db: null };
  if (way.active || channels.length === 0) return { ...empty, groups: noLevel(() => null), error: null };
  const error = channels.find((c) => c.error)?.error ?? null;
  if (error) return { ...empty, groups: noLevel(() => null), error };
  const lowest = (results: ChannelResult[]) =>
    results.map((c) => c.limiter!).reduce((low, l) => (l.compThresholdDbu < low.compThresholdDbu ? l : low));
  const limiterOf = (g: OutputGroup) => lowest(channels.filter((c) => g.outputs.includes(c.load.output)));
  const all = channels.flatMap((c) => c.load.cabinets);
  if (!all.every((c) => Number.isFinite(num(c.section.sensitivityDb))))
    return { ...empty, groups: noLevel(limiterOf), error: null };
  const sources = new Map(draft.sources.map((s) => [s.id, s]));
  // Power sum of the cabinets of some channels, each output at `level(output)` dBu (cabinets
  // in parallel: each takes the channel's voltage).
  const spl = (results: ChannelResult[], level: (output: number) => number) => {
    const dbs: number[] = [];
    for (const c of results) {
      const volts = DBU_REF_V * 10 ** ((level(c.load.output) + ampGain(c.load.amp!)) / 20);
      for (const cab of c.load.cabinets) {
        const power = volts ** 2 / num(cab.section.impedanceOhm);
        dbs.push(num(cab.section.sensitivityDb) + 10 * Math.log10(power));
      }
    }
    return powerSum(dbs);
  };
  const boost = (output: number) =>
    (sideOf.get(output) ?? "LR") === "LR" && sources.get(routeOf(draft, output) ?? -1)?.stereo
      ? SUM_DB
      : 0;
  const groups: GroupLevel[] = way.groups.map((group) => {
    const own = channels.filter((c) => group.outputs.includes(c.load.output));
    const limiter = lowest(own);
    return {
      group,
      channels: own,
      limiter,
      splMaxDb: spl(own, () => limiter.compThresholdDbu),
      splAt0Db: spl(own, boost),
      trimDb: 0,
    };
  });
  // Each kind of cabinet at the level of the quietest one (per cabinet).
  const perCabinet = (g: GroupLevel) => g.splAt0Db! - 10 * Math.log10(g.group.cabinets);
  const quietest = Math.min(...groups.map(perCabinet));
  for (const g of groups) g.trimDb = Math.round((quietest - perCabinet(g)) * 10) / 10;
  return {
    channels,
    groups,
    error: null,
    splMaxDb: powerSum(groups.map((g) => g.splMaxDb!)),
    splAt0Db: powerSum(groups.map((g) => g.splAt0Db! + g.trimDb)),
  };
}

/** Output gain of each way (by id): the main ways matched to the quietest one, the others at
 * 0 dB; a gain typed by hand wins. */
export function wayGains(
  draft: Draft,
  wired: Wiring,
): Map<number, { gainDb: number; computed: number }> {
  const levels = new Map(wired.ways.map((w) => [w.id, wayLevel(draft, w, wired.sideOf)]));
  const aligned = wired.ways
    .filter((w) => !w.props.aux)
    .map((w) => levels.get(w.id)?.splAt0Db ?? null)
    .filter((v): v is number => v !== null);
  const reference = aligned.length ? Math.min(...aligned) : 0;
  const gains = new Map<number, { gainDb: number; computed: number }>();
  for (const way of wired.ways) {
    const at0 = levels.get(way.id)?.splAt0Db ?? null;
    const computed = !way.props.aux && at0 !== null ? Math.round((reference - at0) * 10) / 10 : 0;
    const typed = num(way.props.gainDb);
    gains.set(way.id, { gainDb: Number.isFinite(typed) ? typed : computed, computed });
  }
  return gains;
}

// --- filters -----------------------------------------------------------------------------------

/** Main ways from low to high: in the order of the list. */
export function mainWays(ways: WayInfo[]): WayInfo[] {
  return ways.filter((w) => !w.props.aux);
}

/** Main ways from low to high, then the auxiliary ones. */
export function orderedWays(ways: WayInfo[]): WayInfo[] {
  return [...mainWays(ways), ...ways.filter((w) => w.props.aux)];
}

export interface Boundary {
  key: string;
  lower: WayInfo;
  upper: WayInfo;
  proposedHz: number;
  /** The two speakers' ranges do not meet. */
  gap: boolean;
  /** The upper way's range sits below the lower one's: check the order of the ways. */
  reversed: boolean;
}

/** Crossover proposed between two ranges: the geometric mean of where they meet. */
export function proposeCrossover(lowerTopHz: number, upperBottomHz: number): number {
  return Math.round(Math.sqrt(lowerTopHz * upperBottomHz));
}

/** The subsonic high-pass when the lowest way does not give its range. */
export const SUBSONIC_HZ = 30;

/** A usual crossover when the ranges are not given: the `i`-th of `count`, spread from 100 Hz
 * (sub / top) to 2 kHz (mid / high) on a log scale. */
export function typicalCrossover(i: number, count: number): number {
  if (count <= 1) return 100;
  const hz = 100 * 20 ** (i / (count - 1));
  const step = 10 ** Math.max(0, Math.floor(Math.log10(hz)) - 1);
  return Math.round(hz / step) * step;
}

export function boundaries(ways: WayInfo[]): Boundary[] {
  const main = mainWays(ways);
  const result: Boundary[] = [];
  for (let i = 0; i + 1 < main.length; i++) {
    const lower = main[i]!;
    const upper = main[i + 1]!;
    const top = positive(lower.highHz);
    const bottom = positive(upper.lowHz);
    const lowerCentre = centreHz(lower);
    const upperCentre = centreHz(upper);
    result.push({
      key: `${lower.id}|${upper.id}`,
      lower,
      upper,
      proposedHz:
        top && bottom
          ? proposeCrossover(lower.highHz, upper.lowHz)
          : top
            ? Math.round(lower.highHz)
            : bottom
              ? Math.round(upper.lowHz)
              : typicalCrossover(i, main.length - 1),
      gap: top && bottom && upper.lowHz > lower.highHz,
      reversed: upperCentre < lowerCentre,
    });
  }
  return result;
}

function defaultCrossover(slopes: string[]): FilterSetting {
  return { enabled: true, freqHz: "", slope: slopeIndex(slopes, CROSSOVER_SLOPE) };
}

function defaultAux(slopes: string[]): { hpf: FilterSetting; lpf: FilterSetting } {
  const protection = slopeIndex(slopes, PROTECTION_SLOPE);
  return {
    hpf: { enabled: true, freqHz: "", slope: protection },
    lpf: { enabled: true, freqHz: "", slope: protection },
  };
}

/** Give every crossover and auxiliary way its own editable setting (from an event handler:
 * the computations only read the draft). */
export function ensureFilters(draft: Draft, ways: WayInfo[], slopes: string[]): void {
  for (const b of boundaries(ways)) draft.crossovers[b.key] ??= defaultCrossover(slopes);
  for (const way of ways.filter((w) => w.props.aux)) draft.aux[way.id] ??= defaultAux(slopes);
}

export interface Filter {
  freq_hz: number;
  slope: number;
}

function resolved(setting: FilterSetting, proposedHz: number): Filter | null {
  if (!setting.enabled) return null;
  const typed = num(setting.freqHz);
  return { freq_hz: positive(typed) ? typed : proposedHz, slope: setting.slope };
}

/** The high-pass and low-pass of every way, by way id. */
export function wayFilters(
  draft: Draft,
  ways: WayInfo[],
  slopes: string[],
): Map<number, { hpf: Filter | null; lpf: Filter | null }> {
  const filters = new Map<number, { hpf: Filter | null; lpf: Filter | null }>();
  const main = mainWays(ways);
  for (const way of main) filters.set(way.id, { hpf: null, lpf: null });
  const lowest = main[0];
  if (lowest)
    filters.get(lowest.id)!.hpf = resolved(
      draft.subsonic,
      positive(lowest.lowHz) ? lowest.lowHz : SUBSONIC_HZ,
    );
  for (const b of boundaries(ways)) {
    const filter = resolved(draft.crossovers[b.key] ?? defaultCrossover(slopes), b.proposedHz);
    filters.get(b.lower.id)!.lpf = filter;
    filters.get(b.upper.id)!.hpf = filter;
  }
  for (const way of ways.filter((w) => w.props.aux)) {
    const setting = draft.aux[way.id] ?? defaultAux(slopes);
    // Without a range, an auxiliary way is filtered only at a frequency typed for it.
    const typed = (s: FilterSetting) => positive(num(s.freqHz));
    filters.set(way.id, {
      hpf: positive(way.lowHz) || typed(setting.hpf) ? resolved(setting.hpf, way.lowHz) : null,
      lpf:
        (positive(way.highHz) && way.highHz < 20000) || typed(setting.lpf)
          ? resolved(setting.lpf, way.highHz)
          : null,
    });
  }
  return filters;
}

// --- checks --------------------------------------------------------------------------------------

const PRINTABLE = /^[\x20-\x7e]*$/;

export function nameError(name: string, max: number): string {
  if (name.trim() === "") return "a name is required";
  if (name.length > max) return `${max} characters at most`;
  if (!PRINTABLE.test(name)) return "plain ASCII characters only";
  return "";
}

/** Inputs of each source (indices), in order; a stereo source takes two. */
export function sourceInputs(draft: Draft): Map<number, number[]> {
  const map = new Map<number, number[]>();
  let next = 0;
  for (const source of draft.sources) {
    const count = source.stereo ? 2 : 1;
    map.set(source.id, Array.from({ length: count }, (_, k) => next + k));
    next += count;
  }
  return map;
}

export function inputsNeeded(draft: Draft): number {
  return draft.sources.reduce((sum, s) => sum + (s.stereo ? 2 : 1), 0);
}

export function sourceChannelNames(source: Source): string[] {
  return source.stereo ? [`${source.name} L`, `${source.name} R`] : [source.name];
}

/** Problems that keep the wizard from going on, per step (the input EQ is set at the last). */
export function inputErrors(draft: Draft, topo: Topology): string[] {
  const errors: string[] = [];
  if (draft.sources.length === 0) errors.push("Add a source.");
  if (inputsNeeded(draft) > topo.inputs)
    errors.push(`The sources need ${inputsNeeded(draft)} inputs, this DSP has ${topo.inputs}.`);
  for (const s of draft.sources) {
    for (const name of sourceChannelNames(s)) {
      const e = nameError(name, CHANNEL_NAME_LENGTH);
      if (e) errors.push(`Source "${s.name}": ${e} (channel name "${name}").`);
    }
  }
  return errors;
}

export function planErrors(draft: Draft, topo: Topology): string[] {
  const w = wiring(draft, topo);
  const errors = [...w.errors];
  if (w.ways.length === 0)
    errors.push(
      "Wire at least one DSP output to a speaker, through an amplifier channel (or directly for an active speaker).",
    );
  const sources = new Set(draft.sources.map((s) => s.id));
  const amps = new Set<AmpNode>();
  const names = new Map<string, number>();
  for (const way of w.ways) {
    const key = way.name.trim().toLowerCase();
    names.set(key, (names.get(key) ?? 0) + 1);
    if (names.get(key) === 2) errors.push(`Two ways are called "${way.name}": rename one.`);
    for (const [o, name] of outputNames(way, w.sideOf)) {
      const e = nameError(name, CHANNEL_NAME_LENGTH);
      if (e) errors.push(`Out ${o + 1}: ${e} (channel name "${name}").`);
      const source = routeOf(draft, o);
      if (source === null || !sources.has(source)) errors.push(`Out ${o + 1}: pick what it plays.`);
    }
    for (const { node, section: s } of way.channels.flatMap((c) => c.cabinets)) {
      const label = s.name.trim() ? `${node.model} (${s.name})` : node.model;
      // The range is optional: without it the crossovers get usual values.
      const low = num(s.lowHz);
      const high = num(s.highHz);
      if (s.lowHz.trim() !== "" && !positive(low)) errors.push(`${label}: the range's bottom is not a frequency.`);
      if (s.highHz.trim() !== "" && !positive(high)) errors.push(`${label}: the range's top is not a frequency.`);
      if (positive(low) && positive(high) && low >= high)
        errors.push(`${label}: the range's bottom must be below its top.`);
      if (way.active) continue;
      if (!positive(num(s.aesW))) errors.push(`${label}: the AES power is needed.`);
      if (!positive(num(s.impedanceOhm))) errors.push(`${label}: the impedance is needed.`);
      if (!Number.isFinite(num(s.sensitivityDb))) errors.push(`${label}: the sensitivity is needed.`);
    }
    for (const c of way.channels) if (c.amp) amps.add(c.amp);
  }
  for (const amp of amps) if (!Number.isFinite(ampGain(amp))) errors.push(`${amp.model}: its gain is needed.`);
  if (errors.length === 0) {
    for (const way of w.ways) {
      const error = wayLevel(draft, way, w.sideOf).error;
      if (error) errors.push(`${way.name}: ${error}.`);
    }
  }
  return [...new Set(errors)];
}

export function filterErrors(draft: Draft, topo: Topology): string[] {
  const { ways } = wiring(draft, topo);
  const errors: string[] = [];
  const name = new Map(ways.map((w) => [w.id, w.name]));
  for (const [id, f] of wayFilters(draft, ways, topo.slopes)) {
    if (f.hpf && f.lpf && f.hpf.freq_hz >= f.lpf.freq_hz)
      errors.push(`${name.get(id)}: the high-pass is above the low-pass.`);
  }
  return errors;
}

export function storeErrors(draft: Draft, topo: Topology): string[] {
  const errors: string[] = [];
  if (!(draft.slot >= 1 && draft.slot <= topo.presets)) errors.push("Pick a preset slot.");
  const e = nameError(draft.presetName, PRESET_NAME_LENGTH);
  if (e) errors.push(`Preset name: ${e}.`);
  if (draft.lowShelf.enabled) {
    const f = num(draft.lowShelf.freqHz);
    const g = num(draft.lowShelf.gainDb);
    if (!positive(f)) errors.push("Low shelf: a frequency is needed.");
    if (!Number.isFinite(g) || g < -12 || g > 12) errors.push("Low shelf: gain between −12 and +12 dB.");
    if (!positive(num(draft.lowShelf.q))) errors.push("Low shelf: a Q above 0 is needed.");
  }
  return errors;
}

// --- plan ----------------------------------------------------------------------------------------

/** What `setup.apply` sends (state/setup.py SetupPlan). */
export interface SetupPlan {
  inputs: {
    name: string;
    gain_db: number;
    low_shelf: { freq_hz: number; gain_db: number; q: number } | null;
  }[];
  outputs: {
    name: string;
    used: boolean;
    sources: boolean[];
    gain_db: number;
    phase: boolean;
    hpf: Filter | null;
    lpf: Filter | null;
    dynamics: { compressor_threshold_db: number; limiter_threshold_db: number } | null;
  }[];
  input_links: number[][];
  output_links: number[][];
}

const letter = (i: number) => String.fromCharCode(65 + i);

/** The inputs an output plays (its matrix): its source, on its side. */
export function outputMatrix(draft: Draft, output: number, side: Side, inputs: number): boolean[] {
  const id = routeOf(draft, output);
  const source = draft.sources.find((s) => s.id === id);
  const ins = sourceInputs(draft).get(id ?? -1) ?? [];
  const picked = source?.stereo && side !== "LR" ? [ins[side === "L" ? 0 : 1]] : ins;
  const matrix = Array<boolean>(inputs).fill(false);
  for (const i of picked) if (i !== undefined && i < inputs) matrix[i] = true;
  return matrix;
}

export function buildPlan(draft: Draft, topo: Topology): SetupPlan {
  const inputsOf = sourceInputs(draft);
  const shelf = draft.lowShelf.enabled
    ? {
        freq_hz: num(draft.lowShelf.freqHz),
        gain_db: num(draft.lowShelf.gainDb),
        q: num(draft.lowShelf.q),
      }
    : null;
  const inputs: SetupPlan["inputs"] = Array.from({ length: topo.inputs }, (_, i) => ({
    name: `In${letter(i)}`,
    gain_db: 0,
    low_shelf: null,
  }));
  const inputLinks: number[][] = [];
  for (const source of draft.sources) {
    const ins = inputsOf.get(source.id) ?? [];
    sourceChannelNames(source).forEach((name, k) => {
      const i = ins[k];
      if (i !== undefined && i < topo.inputs) inputs[i] = { name, gain_db: 0, low_shelf: shelf };
    });
    if (ins.length > 1) inputLinks.push(ins);
  }

  const outputs: SetupPlan["outputs"] = Array.from({ length: topo.outputs }, (_, i) => ({
    name: `Out${i + 1}`,
    used: false,
    sources: Array<boolean>(topo.inputs).fill(false),
    gain_db: 0,
    phase: false,
    hpf: null,
    lpf: null,
    dynamics: null,
  }));
  const outputLinks: number[][] = [];
  const wired = wiring(draft, topo);
  const filters = wayFilters(draft, wired.ways, topo.slopes);
  const gains = wayGains(draft, wired);
  for (const way of wired.ways) {
    const level = wayLevel(draft, way, wired.sideOf);
    const names = outputNames(way, wired.sideOf);
    const f = filters.get(way.id);
    const gain = gains.get(way.id)?.gainDb ?? 0;
    for (const g of level.groups) {
      for (const o of g.group.outputs) {
        outputs[o] = {
          name: names.get(o) ?? way.name,
          used: true,
          sources: outputMatrix(draft, o, wired.sideOf.get(o) ?? "LR", topo.inputs),
          gain_db: Math.round((gain + g.trimDb) * 10) / 10,
          phase: way.props.phase,
          hpf: f?.hpf ?? null,
          lpf: f?.lpf ?? null,
          dynamics: g.limiter
            ? {
                compressor_threshold_db: g.limiter.compThresholdDbu,
                limiter_threshold_db: g.limiter.limitThresholdDbu,
              }
            : null,
        };
      }
      // The outputs of a group share everything: linked.
      if (g.group.outputs.length > 1) outputLinks.push([...g.group.outputs]);
    }
  }
  outputLinks.sort((a, b) => a[0]! - b[0]!);
  return { inputs, outputs, input_links: inputLinks, output_links: outputLinks };
}
