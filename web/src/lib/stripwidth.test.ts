import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal localStorage (node has none).
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { StripWidth } = await import("./stripwidth.svelte");

const RANGE = { min: 80, max: 180, step: 4, default: 132 };

describe("strip width", () => {
  beforeEach(() => store.clear());

  it("is unset by default: the view keeps its own width", () => {
    const w = new StripWidth("k", RANGE);
    expect(w.value).toBeNull();
    expect(w.css).toBeUndefined();
    expect(w.px).toBe(132);
  });

  it("clamps, snaps to the step and remembers", () => {
    const w = new StripWidth("k", RANGE);
    w.set(97);
    expect(w.value).toBe(96);
    expect(w.css).toBe("96px");
    expect(new StripWidth("k", RANGE).value).toBe(96);
    w.set(10);
    expect(w.value).toBe(80);
    w.set(999);
    expect(w.value).toBe(180);
  });

  it("nudges from the default while unset, and resets", () => {
    const w = new StripWidth("k", RANGE);
    w.nudge(-1);
    expect(w.value).toBe(128);
    w.reset();
    expect(w.value).toBeNull();
    expect(store.has("k")).toBe(false);
  });

  it("ignores a stored value that is not a number", () => {
    store.set("k", "wide");
    expect(new StripWidth("k", RANGE).value).toBeNull();
  });

  it("fits the screen: shares the measured width, remembered, left by a set width", () => {
    const w = new StripWidth("k", RANGE);
    w.fitScreen();
    expect(w.css).toBeUndefined(); // not measured yet
    w.measure(1000, 10);
    expect(w.px).toBe(100);
    expect(w.css).toBe("100px");
    w.measure(1000, 30); // too many: the minimum, the strips scroll
    expect(w.px).toBe(80);
    w.measure(1000, 2); // few: at most the maximum
    expect(w.px).toBe(180);
    expect(new StripWidth("k", RANGE).fit).toBe(true);
    w.nudge(1);
    expect(w.fit).toBe(false);
    expect(w.value).toBe(180);
    expect(store.get("k")).toBe("180");
  });

  it("resets out of fit", () => {
    const w = new StripWidth("k", RANGE);
    w.fitScreen();
    w.reset();
    expect(w.fit).toBe(false);
    expect(store.has("k")).toBe(false);
  });
});

describe("strip space", async () => {
  const { stripSpace } = await import("./stripfit");

  it("takes off the gaps, and the divider when both sides are shown", () => {
    expect(stripSpace(600, ["inputs.0", "inputs.1"])).toBe(594);
    expect(stripSpace(600, ["inputs.0", "outputs.0"])).toBe(600 - 2 * 6 - 32);
    expect(stripSpace(600, [])).toBe(600);
  });
});
