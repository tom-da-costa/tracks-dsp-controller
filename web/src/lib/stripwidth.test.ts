import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal localStorage (node has none).
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { StripWidth, stripPx } = await import("./stripwidth.svelte");
const { stripSpace } = await import("./stripfit");

const LIVE = { base: 132, min: 60 };

describe("strip width setting", () => {
  beforeEach(() => store.clear());

  it("is unset by default: the usual width", () => {
    const w = new StripWidth("k");
    expect(w.percent).toBeNull();
    expect(w.shown).toBe(100);
    expect(stripPx(w, LIVE, 1000, 10)).toBeUndefined();
  });

  it("clamps, snaps to the step and remembers", () => {
    const w = new StripWidth("k");
    w.set(77);
    expect(w.percent).toBe(75);
    expect(new StripWidth("k").percent).toBe(75);
    w.set(5);
    expect(w.percent).toBe(40);
    w.set(999);
    expect(w.percent).toBe(150);
  });

  it("nudges from 100 % while unset, and resets", () => {
    const w = new StripWidth("k");
    w.nudge(-1);
    expect(w.percent).toBe(95);
    w.reset();
    expect(w.percent).toBeNull();
    expect(store.has("k")).toBe(false);
  });

  it("ignores a stored value that is not a number", () => {
    store.set("k", "wide");
    expect(new StripWidth("k").percent).toBeNull();
  });

  it("fits the screen until set otherwise, remembered", () => {
    const w = new StripWidth("k");
    w.fitScreen();
    expect(new StripWidth("k").fit).toBe(true);
    w.fitted = 60;
    expect(w.shown).toBe(60);
    w.nudge(1);
    expect(w.fit).toBe(false);
    expect(w.percent).toBe(65);
    w.fitScreen();
    w.reset();
    expect(w.fit).toBe(false);
    expect(store.has("k")).toBe(false);
  });
});

describe("fixed strips (Live, Gain)", () => {
  beforeEach(() => store.clear());

  it("scale the usual width, never under the content's minimum", () => {
    const w = new StripWidth("k");
    w.set(50);
    expect(stripPx(w, LIVE, 0, 0)).toBe(66);
    w.set(40);
    expect(stripPx(w, LIVE, 0, 0)).toBe(60);
  });

  it("share the row when fitting, between the minimum and 150 %", () => {
    const w = new StripWidth("k");
    w.fitScreen();
    expect(stripPx(w, LIVE, 1000, 10)).toBe(100);
    expect(stripPx(w, LIVE, 1000, 30)).toBe(60); // too many: the strips scroll
    expect(stripPx(w, LIVE, 1000, 2)).toBe(198);
    expect(stripPx(w, LIVE, 1000, 0)).toBeUndefined();
  });
});

describe("strip space", () => {
  it("takes off the gaps, and the divider when both sides are shown", () => {
    expect(stripSpace(600, ["inputs.0", "inputs.1"])).toBe(594);
    expect(stripSpace(600, ["inputs.0", "outputs.0"])).toBe(600 - 2 * 6 - 32);
    expect(stripSpace(600, [])).toBe(600);
  });
});
