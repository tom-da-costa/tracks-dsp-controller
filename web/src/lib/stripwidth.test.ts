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
});
