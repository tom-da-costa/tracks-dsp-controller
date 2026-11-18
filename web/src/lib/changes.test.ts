import { describe as group, expect, it } from "vitest";
import { channelOf, describe, type UnsavedChange } from "./changes";
import type { Profile } from "./types";

const profile = {
  slopes: ["Off", "BW-6", "BW-12", "LR-12"],
  ratios: ["1:1", "1.1:1", "Limit"],
  peq_types: ["Peak", "Low shelf"],
} as unknown as Profile;

function change(path: string, before: unknown, after: unknown): UnsavedChange {
  return { path, before, after, revert: null };
}

group("unsaved changes in words", () => {
  it("names the channel of a change", () => {
    expect(channelOf("outputs.2.peq.3.freq_hz")).toBe("outputs.2");
  });

  it("puts each kind of parameter in words and units", () => {
    expect(describe(change("outputs.2.gain_db", -2, -6))).toEqual({
      setting: "Gain",
      before: "-2.0 dB",
      after: "-6.0 dB",
    });
    expect(describe(change("inputs.0.peq.1.freq_hz", 250, 315))).toEqual({
      setting: "PEQ band 2 · frequency",
      before: "250 Hz",
      after: "315 Hz",
    });
    expect(describe(change("inputs.0.peq.1.type", 0, 1), profile).after).toBe("Low shelf");
    expect(describe(change("inputs.1.geq.12", 0, 3))).toEqual({
      setting: "GEQ 315 Hz",
      before: "0.0 dB",
      after: "+3.0 dB",
    });
    expect(describe(change("outputs.3.crossover.hpf.slope", 2, 3), profile)).toEqual({
      setting: "High-pass · slope",
      before: "BW-12",
      after: "LR-12",
    });
    expect(describe(change("outputs.3.crossover.lpf.enabled", false, true)).after).toBe("on");
    expect(describe(change("outputs.0.compressor.ratio", 0, 2), profile).after).toBe("Limit");
    expect(describe(change("outputs.0.limiter.threshold_db", 4, 2)).setting).toBe(
      "Limiter · threshold",
    );
    expect(describe(change("inputs.2.gate.hold_ms", 100, 250)).after).toBe("250 ms");
    expect(describe(change("outputs.1.matrix", [true, false], [true, true])).after).toBe(
      "In A + In B",
    );
    expect(describe(change("outputs.1.matrix", [true], [false])).after).toBe("none");
    expect(describe(change("outputs.1.delay_ms", 0, 1.5)).after).toBe("1.5 ms");
    expect(describe(change("outputs.1.name", "Sub", "SubL")).after).toBe('"SubL"');
    expect(describe(change("outputs.1.mute", false, true)).after).toBe("on");
    expect(describe(change("outputs.4.linked", [], [5])).after).toBe("with 1 other");
  });
});
