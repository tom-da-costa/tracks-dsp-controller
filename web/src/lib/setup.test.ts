import { describe, expect, it } from "vitest";
import {
  addAmp,
  addSpeaker,
  addWay,
  AMPLIFIERS,
  ampPowerAt,
  autoAssignWays,
  boundaries,
  buildPlan,
  connect,
  countOf,
  disconnect,
  type Draft,
  duplicateSpeaker,
  ensureFilters,
  filterErrors,
  findWay,
  gainFromSensitivity,
  inputErrors,
  mainWays,
  moveWay,
  newDraft,
  outputNames,
  parsePort,
  planErrors,
  portKey,
  proposeCrossover,
  typicalCrossover,
  removeNode,
  removeWay,
  setAmpChannels,
  setOutputWay,
  storeErrors,
  type Topology,
  type Wire,
  wayById,
  wayFilters,
  wayForLabel,
  wayGains,
  wayLevel,
  wireBetween,
  wiring,
} from "./setup";

const SLOPES = ["Off", "BW-6", "BL-6", "BW-12", "BL-12", "LR-12", "BW-18", "BL-18", "BW-24",
  "BL-24", "LR-24", "BW-30", "BL-30", "BW-36", "BL-36", "LR-36", "BW-42", "BL-42", "BW-48",
  "BL-48", "LR-48"];
const DSP408: Topology = { inputs: 4, outputs: 8, presets: 20, slopes: SLOPES };
const BW24 = 8;
const LR24 = 10;
const ad42 = AMPLIFIERS.find((a) => a.id === "admark-ad42")!;

/** The owner's system: four TH1821 on an AD42 (two per channel, two outputs, mono), MKH-230
 * kicks and bi-amped T24N clones in stereo on two AD416. */
function ownerStack(): Draft {
  const d = newDraft(SLOPES);
  const sub = addAmp(d, "admark-ad42", 300, 0);
  const mid = addAmp(d, "admark-ad416", 300, 200);
  const high = addAmp(d, "admark-ad416", 300, 400);
  const feed = (output: number, amp: number, channel: number) =>
    connect(d, { type: "feed", output, amp, channel });
  const drive = (amp: number, channel: number, speaker: number, section = 0) =>
    connect(d, { type: "drive", amp, channel, speaker, section });
  for (let n = 0; n < 4; n++) drive(sub.id, n >> 1, addSpeaker(d, "th1821", 600, n * 60).id);
  const kicks = [addSpeaker(d, "mkh230", 600, 300), addSpeaker(d, "mkh230", 600, 360)];
  const tops = [addSpeaker(d, "t24n-clone", 600, 420), addSpeaker(d, "t24n-clone", 600, 500)];
  // The kicks and the tops are a stereo pair: one left, one right; the subs play L+R.
  kicks[0]!.side = tops[0]!.side = "L";
  kicks[1]!.side = tops[1]!.side = "R";
  const amps = [sub, sub, mid, mid, mid, mid, high, high];
  const channels = [0, 1, 0, 1, 2, 3, 0, 1];
  for (let o = 0; o < 8; o++) feed(o, amps[o]!.id, channels[o]!);
  drive(mid.id, 0, kicks[0]!.id);
  drive(mid.id, 1, kicks[1]!.id);
  drive(mid.id, 2, tops[0]!.id, 0);
  drive(mid.id, 3, tops[1]!.id, 0);
  drive(high.id, 0, tops[0]!.id, 1);
  drive(high.id, 1, tops[1]!.id, 1);
  autoAssignWays(d, DSP408); // nothing to do: library sections pick their ways
  d.slot = 5;
  d.presetName = "Owner";
  return d;
}

const wayNamed = (d: Draft, name: string) => wiring(d, DSP408).ways.find((w) => w.name === name)!;
const idOf = (d: Draft, name: string) => findWay(d, name)!.id;
const levelOf = (d: Draft, name: string) => wayLevel(d, wayNamed(d, name), wiring(d, DSP408).sideOf);

describe("library", () => {
  it("gives an amplifier's power at a load, on the safe side", () => {
    expect(ampPowerAt(ad42.power_w, 8)).toBe(4200);
    expect(ampPowerAt(ad42.power_w, 4)).toBe(7800);
    expect(ampPowerAt(ad42.power_w, 5.3)).toBe(4200); // between 4 and 8 Ω: the 8 Ω rating
    expect(ampPowerAt(ad42.power_w, 16)).toBe(2100); // above 8 Ω: constant voltage
    expect(ampPowerAt(ad42.power_w, 1)).toBeNull(); // below its lowest rated load
    expect(ampPowerAt({ "8": NaN }, 8)).toBeNull(); // not rated
  });

  it("pre-fills the highest listed gain and the ratings", () => {
    const d = newDraft(SLOPES);
    const amp = addAmp(d, "admark-ad42", 0, 0);
    expect([amp.gainDb, amp.channels, amp.powerW["4"]]).toEqual(["41", 2, "7800"]);
    expect(addAmp(d, null, 0, 0).gainDb).toBe("");
  });

  it("turns an input sensitivity into a gain", () => {
    // 1.4 V for 1600 W into 8 Ω: √12800 = 113 V, i.e. 38.15 dB
    expect(gainFromSensitivity(1.4, 1600, 8)).toBeCloseTo(38.15, 2);
  });

  it("gives every cabinet its own specs", () => {
    const d = newDraft(SLOPES);
    const a = addSpeaker(d, "t24n-clone", 0, 0);
    const b = addSpeaker(d, "t24n-clone", 0, 0);
    expect(a.sections.map((s) => wayById(d, s.way)?.name)).toEqual(["Mid", "High"]);
    expect(b.sections.map((s) => s.way)).toEqual(a.sections.map((s) => s.way));
    a.sections[0]!.aesW = "600";
    expect(b.sections[0]!.aesW).toBe("800");
    a.side = "L";
    const c = duplicateSpeaker(d, a);
    expect([c.side, c.sections[0]!.aesW]).toEqual(["R", "600"]); // a copy, on the other side
    c.sections[0]!.aesW = "700";
    expect(a.sections[0]!.aesW).toBe("600");
  });
});

describe("wiring", () => {
  it("joins ports in either order, and only the right ones", () => {
    const out = { node: "dsp", port: 2 } as const;
    const ampIn = { node: "amp-in", id: 7, port: 1 } as const;
    expect(wireBetween(ampIn, out)).toEqual({ type: "feed", output: 2, amp: 7, channel: 1 });
    expect(wireBetween(out, { node: "spk", id: 9, port: 0 })?.type).toBe("direct");
    expect(wireBetween(ampIn, { node: "spk", id: 9, port: 0 })).toBeNull();
    expect(parsePort(portKey(ampIn))).toEqual(ampIn);
  });

  it("deduces the ways from the wiring", () => {
    const d = ownerStack();
    const { ways, errors } = wiring(d, DSP408);
    expect(errors).toEqual([]);
    expect(mainWays(ways).map((w) => [w.name, w.outputs, w.cabinets])).toEqual([
      ["Sub", [0, 1], 4],
      ["Kick", [2, 3], 2],
      ["Mid", [4, 5], 2],
      ["High", [6, 7], 2],
    ]);
    const { sideOf } = wiring(d, DSP408);
    expect([...sideOf.values()]).toEqual(["LR", "LR", "L", "R", "L", "R", "L", "R"]);
    expect([...outputNames(wayNamed(d, "Sub"), sideOf).values()]).toEqual(["Sub1", "Sub2"]);
    expect([...outputNames(wayNamed(d, "Kick"), sideOf).values()]).toEqual(["Kick L", "Kick R"]);
  });

  it("gives an amplifier input or a speaker one signal", () => {
    const d = ownerStack();
    const amp = d.amps[0]!.id;
    connect(d, { type: "feed", output: 7, amp, channel: 0 });
    expect(d.wires.filter((w) => w.type === "feed" && w.amp === amp && w.channel === 0)).toEqual([
      { type: "feed", output: 7, amp, channel: 0 },
    ]);
    disconnect(d, { type: "feed", output: 7, amp, channel: 0 });
    expect(wayNamed(d, "Sub").outputs).toEqual([1]);
  });

  it("refuses an output on both sides, or with no way", () => {
    const e = ownerStack();
    connect(e, { type: "feed", output: 3, amp: e.amps[1]!.id, channel: 0 }); // Kick L and R on Out 4
    expect(wiring(e, DSP408).errors).toContain(
      "Out 4 drives speakers of different sides: give each side its own output.",
    );
    const d = ownerStack();
    setOutputWay(d, DSP408, 1, null);
    expect(wiring(d, DSP408).errors).toEqual(["Out 2: pick the way of the speakers it drives."]);
    expect(wiring(d, DSP408).unassigned.get(1)).toBe("pick a way");
  });

  it("gives each speaker section a way: from the library, the wiring or a pick", () => {
    const d = ownerStack();
    // Library sections make their ways, ordered from low to high by the speakers' ranges.
    expect(d.ways.map((w) => w.name)).toEqual(["Sub", "Kick", "Mid", "High"]);
    expect(wiring(d, DSP408).wayOf.get(0)).toBe(idOf(d, "Sub"));
    // A generic section has none until it is picked or wired with sections that have one.
    const e = newDraft(SLOPES);
    const amp = addAmp(e, "admark-ad42", 0, 0);
    const generic = addSpeaker(e, null, 0, 0);
    expect(generic.sections[0]!.way).toBeNull();
    connect(e, { type: "feed", output: 0, amp: amp.id, channel: 0 });
    connect(e, { type: "drive", amp: amp.id, channel: 0, speaker: generic.id, section: 0 });
    autoAssignWays(e, DSP408);
    expect(wiring(e, DSP408).unassigned.get(0)).toBe("pick a way");
    const sub = addSpeaker(e, "th1821", 0, 0);
    connect(e, { type: "drive", amp: amp.id, channel: 0, speaker: sub.id, section: 0 });
    autoAssignWays(e, DSP408); // the generic one joins the Sub way of its channel
    expect(generic.sections[0]!.way).toBe(idOf(e, "Sub"));
    expect(wiring(e, DSP408).errors).toEqual([]);
    // Picked on the output: every section it drives takes it.
    const top = addWay(e, "Top");
    setOutputWay(e, DSP408, 0, top.id);
    expect([generic, sub].map((s) => s.sections[0]!.way)).toEqual([top.id, top.id]);
    // Two ways on one output are refused.
    sub.sections[0]!.way = idOf(e, "Sub");
    expect(wiring(e, DSP408).errors).toEqual([
      "Out 1 drives speakers of different ways (Top, Sub): one way per output.",
    ]);
    autoAssignWays(e, DSP408); // not changed: the user decides
    expect(wiring(e, DSP408).unassigned.get(0)).toBe("several ways");
    // A way removed leaves its sections without one.
    removeWay(e, top.id);
    expect(generic.sections[0]!.way).toBeNull();
    // A way made from a label goes among the main ways by its range.
    expect(wayForLabel(e, "Low", { lowHz: 20, highHz: 60 }).name).toBe("Low");
    expect(e.ways.map((w) => w.name)).toEqual(["Low", "Sub"]);
  });

  it("counts a speaker standing for several identical cabinets", () => {
    const build = (count: number) => {
      const d = newDraft(SLOPES);
      const amp = addAmp(d, "admark-ad42", 0, 0);
      connect(d, { type: "feed", output: 0, amp: amp.id, channel: 0 });
      for (let n = 0; n < (count > 1 ? 1 : 2); n++) {
        const sub = addSpeaker(d, "th1821", 0, 0);
        sub.count = count;
        connect(d, { type: "drive", amp: amp.id, channel: 0, speaker: sub.id, section: 0 });
      }
      return d;
    };
    const two = build(1); // two speakers on the channel
    const x2 = build(2); // one speaker ×2
    expect(wayNamed(x2, "Sub").cabinets).toBe(2);
    const result = (d: Draft) => {
      const c = levelOf(d, "Sub").channels[0]!;
      return [c.impedanceOhm, c.aesW, c.limiter?.compThresholdDbu, levelOf(d, "Sub").splAt0Db];
    };
    expect(result(x2)).toEqual(result(two));
    expect(result(x2).slice(0, 2)).toEqual([4, 3400]); // 2 × 1700 W AES, 8 Ω ∥ 8 Ω
    expect(buildPlan(x2, DSP408).outputs[0]).toEqual(buildPlan(two, DSP408).outputs[0]);
    expect(countOf({ ...x2.speakers[0]!, count: 0 })).toBe(1);
  });

  it("orders the main ways as the list", () => {
    const d = ownerStack();
    moveWay(d, idOf(d, "Kick"), 1);
    expect(mainWays(wiring(d, DSP408).ways).map((w) => w.name)).toEqual(["Sub", "Mid", "Kick", "High"]);
    expect(boundaries(wiring(d, DSP408).ways)[1]!.reversed).toBe(true);
    findWay(d, "Kick")!.aux = true;
    expect(mainWays(wiring(d, DSP408).ways).map((w) => w.name)).toEqual(["Sub", "Mid", "High"]);
  });

  it("drops the wires of a removed amplifier or channel", () => {
    const d = ownerStack();
    const mid = d.amps[1]!;
    setAmpChannels(d, mid, 2);
    const onAmp = (w: Wire) => "amp" in w && w.amp === mid.id;
    expect(d.wires.some((w) => onAmp(w) && "channel" in w && w.channel >= 2)).toBe(false);
    removeNode(d, "amp", mid.id);
    expect(d.wires.some(onAmp)).toBe(false);
  });

  it("bridges a speaker from another one, in parallel on the same channel", () => {
    const d = ownerStack();
    const subs = d.speakers.filter((s) => s.ref === "th1821");
    const amp = d.amps[0]!.id;
    // Sub 2 bridged from sub 1 instead of its own wire to the amplifier.
    disconnect(d, { type: "drive", amp, channel: 0, speaker: subs[1]!.id, section: 0 });
    const chain = wireBetween(
      { node: "spk-out", id: subs[0]!.id, port: 0 },
      { node: "spk", id: subs[1]!.id, port: 0 },
    )!;
    expect(chain).toEqual({
      type: "chain",
      from: subs[0]!.id,
      fromSection: 0,
      speaker: subs[1]!.id,
      section: 0,
    });
    expect(connect(d, chain)).toBe(true);
    const [first] = levelOf(d, "Sub").channels;
    expect([first!.load.cabinets.length, first!.impedanceOhm]).toEqual([2, 4]);
    // A loop is refused; a speaker cannot be bridged to itself.
    const back: Wire = {
      type: "chain",
      from: subs[1]!.id,
      fromSection: 0,
      speaker: subs[0]!.id,
      section: 0,
    };
    expect(connect(d, back)).toBe(false);
    const self = { node: "spk-out", id: 5, port: 0 } as const;
    expect(wireBetween(self, { node: "spk", id: 5, port: 1 })).toBeNull();
    // Removing the first one drops the bridge.
    removeNode(d, "speaker", subs[0]!.id);
    expect(d.wires.some((w) => w.type === "chain")).toBe(false);
  });

  it("treats speakers wired straight to an output as active", () => {
    const d = newDraft(SLOPES);
    const spk = addSpeaker(d, null, 0, 0);
    connect(d, { type: "direct", output: 0, speaker: spk.id, section: 0 });
    spk.sections[0]!.way = addWay(d, "Top").id;
    const w = wiring(d, DSP408);
    expect(w.ways[0]?.active).toBe(true);
    expect(wayLevel(d, w.ways[0]!, w.sideOf).groups[0]!.limiter).toBeNull();
  });
});

describe("filters", () => {
  it("proposes the crossovers between the main ways", () => {
    const d = ownerStack();
    const { ways } = wiring(d, DSP408);
    expect(boundaries(ways).map((b) => b.proposedHz)).toEqual([105, 180, 1200]);
    expect(proposeCrossover(143, 77)).toBe(105);
    const f = wayFilters(d, ways, SLOPES);
    expect(f.get(idOf(d, "Sub"))).toEqual({
      hpf: { freq_hz: 38, slope: BW24 },
      lpf: { freq_hz: 105, slope: LR24 },
    });
    expect(f.get(idOf(d, "High"))).toEqual({
      hpf: { freq_hz: 1200, slope: LR24 },
      lpf: null,
    });
  });

  it("uses a crossover typed by hand on both sides", () => {
    const d = ownerStack();
    const { ways } = wiring(d, DSP408);
    ensureFilters(d, ways, SLOPES);
    const b = boundaries(ways)[1]!;
    d.crossovers[b.key]!.freqHz = "130";
    const f = wayFilters(d, ways, SLOPES);
    expect(f.get(b.lower.id)!.lpf?.freq_hz).toBe(130);
    expect(f.get(b.upper.id)!.hpf?.freq_hz).toBe(130);
  });

  it("filters an auxiliary way to its speaker's range", () => {
    const d = ownerStack();
    const amp = addAmp(d, "admark-ad42", 0, 0);
    const mon = addSpeaker(d, null, 0, 0);
    Object.assign(mon.sections[0]!, { way: addWay(d, "Mon").id, lowHz: "80", highHz: "18000", aesW: "300" });
    // The DSP 408 has 8 outputs: the monitor takes Out 8 from High R.
    disconnect(d, { type: "feed", output: 7, amp: d.amps[2]!.id, channel: 1 });
    connect(d, { type: "feed", output: 7, amp: amp.id, channel: 0 });
    connect(d, { type: "drive", amp: amp.id, channel: 0, speaker: mon.id, section: 0 });
    findWay(d, "Mon")!.aux = true;
    const { ways } = wiring(d, DSP408);
    expect(wayFilters(d, ways, SLOPES).get(idOf(d, "Mon"))).toEqual({
      hpf: { freq_hz: 80, slope: BW24 },
      lpf: { freq_hz: 18000, slope: BW24 },
    });
    expect(mainWays(ways).map((w) => w.name)).not.toContain("Mon");
  });
  it("works without the speakers' ranges: output order and usual crossovers", () => {
    const d = newDraft(SLOPES);
    const amp = addAmp(d, "admark-ad416", 0, 0);
    // Three generic speakers, no range given: the ways in the order they are made.
    const names = ["Sub", "Mid", "High"];
    names.forEach((name, i) => {
      const spk = addSpeaker(d, null, 0, i * 60);
      Object.assign(spk.sections[0]!, {
        way: wayForLabel(d, name, { lowHz: NaN, highHz: NaN }).id,
        aesW: "500",
        impedanceOhm: "8",
        sensitivityDb: "100",
      });
      connect(d, { type: "feed", output: i, amp: amp.id, channel: i });
      connect(d, { type: "drive", amp: amp.id, channel: i, speaker: spk.id, section: 0 });
    });
    autoAssignWays(d, DSP408);
    expect(planErrors(d, DSP408)).toEqual([]);
    const { ways } = wiring(d, DSP408);
    expect(mainWays(ways).map((w) => w.name)).toEqual(names);
    ensureFilters(d, ways, SLOPES);
    const f = wayFilters(d, ways, SLOPES);
    expect(f.get(idOf(d, "Sub"))!.hpf?.freq_hz).toBe(30);
    expect(f.get(idOf(d, "Sub"))!.lpf?.freq_hz).toBe(100);
    expect(f.get(idOf(d, "High"))!.hpf?.freq_hz).toBe(2000);
    expect(f.get(idOf(d, "High"))!.lpf).toBeNull();
    expect(filterErrors(d, DSP408)).toEqual([]);

    // One known end is enough to propose from it; a typed range is still checked.
    d.speakers[1]!.sections[0]!.lowHz = "150";
    expect(boundaries(wiring(d, DSP408).ways)[0]!.proposedHz).toBe(150);
    d.speakers[1]!.sections[0]!.highHz = "abc";
    d.speakers[2]!.sections[0]!.lowHz = "5000";
    d.speakers[2]!.sections[0]!.highHz = "1000";
    expect(planErrors(d, DSP408)).toEqual([
      "Generic (Mid): the range's top is not a frequency.",
      "Generic (High): the range's bottom must be below its top.",
    ]);
  });

  it("spreads usual crossovers from 100 Hz to 2 kHz", () => {
    expect([0].map((i) => typicalCrossover(i, 1))).toEqual([100]);
    expect([0, 1].map((i) => typicalCrossover(i, 2))).toEqual([100, 2000]);
    expect([0, 1, 2].map((i) => typicalCrossover(i, 3))).toEqual([100, 450, 2000]);
  });
});

describe("levels", () => {
  it("computes each channel's limiter, the way taking the lowest", () => {
    const d = ownerStack();
    const level = levelOf(d, "Sub");
    // Two TH1821 per AD42 channel: 3400 W AES / 1.56 into 4 Ω at 41 dB, 0.6 dBu, rounded up
    expect(level.channels.map((c) => [c.impedanceOhm, c.aesW, c.powerW])).toEqual([
      [4, 3400, 7800],
      [4, 3400, 7800],
    ]);
    expect(level.groups.map((g) => g.group.outputs)).toEqual([[0, 1]]);
    expect(level.groups[0]!.limiter?.compThresholdDbu).toBe(1);
    expect(level.groups[0]!.limiter?.limitThresholdDbu).toBe(7);
    // 1 dBu + 41 dB = 97.6 V: 1190 W per cabinet, 104.8 + 30.8 dB, four cabinets +6 dB
    expect(level.splMaxDb).toBeCloseTo(141.58, 1);
    // A mono programme: L + R summed on the sub outputs, +6 dB
    expect(level.splAt0Db).toBeCloseTo(146.59, 1);
  });

  it("puts different cabinets of one channel in parallel", () => {
    const d = ownerStack();
    d.speakers.find((s) => s.ref === "th1821")!.sections[0]!.impedanceOhm = "4";
    const [first] = levelOf(d, "Sub").channels;
    expect(first!.impedanceOhm).toBeCloseTo(8 / 3, 2); // 4 Ω ∥ 8 Ω
  });

  it("turns the louder main ways down to the quietest", () => {
    const d = ownerStack();
    const wired = wiring(d, DSP408);
    const gains = wayGains(d, wired);
    const levels = wired.ways.map(
      (w) => wayLevel(d, w, wired.sideOf).splAt0Db! + gains.get(w.id)!.gainDb,
    );
    for (const level of levels) expect(level).toBeCloseTo(Math.min(...levels), 0);
    expect(Math.max(...[...gains.values()].map((g) => g.gainDb))).toBe(0);
  });

  it("keeps a gain typed by hand and leaves auxiliary ways at 0 dB", () => {
    const d = ownerStack();
    findWay(d, "Sub")!.gainDb = "-2";
    findWay(d, "Kick")!.aux = true;
    const gains = wayGains(d, wiring(d, DSP408));
    expect(gains.get(idOf(d, "Sub"))!.gainDb).toBe(-2);
    expect(gains.get(idOf(d, "Kick"))!.gainDb).toBe(0);
  });

  it("plays different cabinets on one way: linked by load, trimmed per kind", () => {
    const d = newDraft(SLOPES);
    const ad42 = addAmp(d, "admark-ad42", 0, 0);
    const ad416 = addAmp(d, "admark-ad416", 0, 0);
    // Out 1 and 2: a TH1821 each on the AD42; Out 3: another sub on the AD416, 6.8 dB less
    // sensitive (both amplifiers at 41 dB: the same voltage).
    for (const channel of [0, 1]) {
      const sub = addSpeaker(d, "th1821", 0, 0);
      connect(d, { type: "feed", output: channel, amp: ad42.id, channel });
      connect(d, { type: "drive", amp: ad42.id, channel, speaker: sub.id, section: 0 });
    }
    const other = addSpeaker(d, null, 0, 0);
    Object.assign(other.sections[0]!, { way: idOf(d, "Sub"), aesW: "1000", impedanceOhm: "8", sensitivityDb: "98" });
    connect(d, { type: "feed", output: 2, amp: ad416.id, channel: 0 });
    connect(d, { type: "drive", amp: ad416.id, channel: 0, speaker: other.id, section: 0 });
    autoAssignWays(d, DSP408);
    expect(d.ways.map((w) => w.name)).toEqual(["Sub"]);
    const wired = wiring(d, DSP408);
    const level = wayLevel(d, wired.ways[0]!, wired.sideOf);
    expect(level.groups.map((g) => [g.group.outputs, g.trimDb])).toEqual([
      [[0, 1], -6.8],
      [[2], 0],
    ]);
    const plan = buildPlan(d, DSP408);
    expect(plan.output_links).toEqual([[0, 1]]);
    expect(plan.outputs.slice(0, 3).map((o) => [o.name, o.gain_db])).toEqual([
      ["Sub1", -6.8],
      ["Sub2", -6.8],
      ["Sub3", 0],
    ]);
    expect(plan.outputs[2]!.dynamics).not.toEqual(plan.outputs[0]!.dynamics);
  });
});

describe("plan", () => {
  it("builds the plan the server loads", () => {
    const d = ownerStack();
    d.lowShelf.enabled = true;
    const plan = buildPlan(d, DSP408);
    expect(plan.inputs.map((i) => i.name)).toEqual(["Main L", "Main R", "InC", "InD"]);
    expect(plan.inputs[0]!.low_shelf).toEqual({ freq_hz: 100, gain_db: 9, q: 0.71 });
    expect(plan.inputs[2]!.low_shelf).toBeNull();
    expect(plan.input_links).toEqual([[0, 1]]);
    expect(plan.outputs.map((o) => o.name)).toEqual([
      "Sub1", "Sub2", "Kick L", "Kick R", "Mid L", "Mid R", "High L", "High R",
    ]);
    expect(plan.outputs.map((o) => o.sources.slice(0, 2))).toEqual([
      [true, true], [true, true], [true, false], [false, true], [true, false], [false, true],
      [true, false], [false, true],
    ]);
    expect(plan.output_links).toEqual([[0, 1], [2, 3], [4, 5], [6, 7]]);
    expect(plan.outputs[0]!.dynamics).toEqual({
      compressor_threshold_db: 1,
      limiter_threshold_db: 7,
    });
  });

  it("leaves the outputs not wired unused", () => {
    const d = ownerStack();
    removeNode(d, "amp", d.amps[2]!.id);
    const plan = buildPlan(d, DSP408);
    expect(plan.outputs.slice(6).map((o) => [o.name, o.used])).toEqual([
      ["Out7", false],
      ["Out8", false],
    ]);
  });

  it("checks every step", () => {
    const d = ownerStack();
    expect(inputErrors(d, DSP408)).toEqual([]);
    expect(planErrors(d, DSP408)).toEqual([]);
    expect(filterErrors(d, DSP408)).toEqual([]);
    expect(storeErrors(d, DSP408)).toEqual([]);

    d.sources.push(
      { id: 90, name: "Microphone", stereo: true },
      { id: 91, name: "DJ", stereo: false },
    );
    expect(inputErrors(d, DSP408)).toEqual([
      "The sources need 5 inputs, this DSP has 4.",
      'Source "Microphone": 8 characters at most (channel name "Microphone L").',
      'Source "Microphone": 8 characters at most (channel name "Microphone R").',
    ]);
    d.amps[0]!.gainDb = "";
    d.routes[2] = null;
    expect(planErrors(d, DSP408)).toEqual([
      "Out 3: pick what it plays.",
      "Admark AD42: its gain is needed.",
    ]);
    expect(planErrors(newDraft(SLOPES), DSP408)).toHaveLength(1);
    const twin = ownerStack();
    findWay(twin, "Kick")!.name = "sub";
    expect(planErrors(twin, DSP408)).toContain('Two ways are called "sub": rename one.');
    d.slot = 0;
    d.presetName = "";
    d.lowShelf = { enabled: true, freqHz: "", gainDb: "15", q: "0" };
    expect(storeErrors(d, DSP408)).toEqual([
      "Pick a preset slot.",
      "Preset name: a name is required.",
      "Low shelf: a frequency is needed.",
      "Low shelf: gain between −12 and +12 dB.",
      "Low shelf: a Q above 0 is needed.",
    ]);
  });
});
