import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let store: Map<string, string>;

function stubPage(origin: string) {
  const url = new URL(origin);
  vi.stubGlobal("location", { origin: url.origin, protocol: url.protocol, host: url.host });
}

async function fresh() {
  vi.resetModules();
  return import("./backend");
}

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
  stubPage("http://192.168.1.20:8080");
});

afterEach(() => vi.unstubAllGlobals());

describe("normalise", () => {
  it("accepts what people type", async () => {
    const { normalise } = await fresh();
    expect(normalise("192.168.1.30:8080")).toBe("http://192.168.1.30:8080");
    expect(normalise(" dsp.local ")).toBe("http://dsp.local");
    expect(normalise("https://dsp.local:8443/some/path")).toBe("https://dsp.local:8443");
    expect(normalise("[fd00::2]:8080")).toBe("http://[fd00::2]:8080");
  });

  it("refuses what is not a server address", async () => {
    const { normalise } = await fresh();
    expect(normalise("")).toBeNull();
    expect(normalise("ftp://dsp.local")).toBeNull();
    expect(normalise("http://")).toBeNull();
  });

  it("takes the page's scheme by default", async () => {
    stubPage("https://dsp.example");
    const { normalise } = await fresh();
    expect(normalise("dsp.local")).toBe("https://dsp.local");
  });
});

describe("the backend", () => {
  it("is the page's own server by default: cookie, same-origin URLs", async () => {
    const b = await fresh();
    expect(b.backend()).toBe("http://192.168.1.20:8080");
    expect(b.isRemote()).toBe(false);
    expect(b.apiUrl("/api/session")).toBe("/api/session");
    expect(b.fetchInit()).toEqual({ credentials: "same-origin" });
    expect(b.wsUrl("/ws")).toBe("ws://192.168.1.20:8080/ws");
    expect(b.wsProtocols()).toBeUndefined();
    b.setToken("ignored"); // the cookie does the job here
    expect(store.get("dsp408.tokens")).toBeUndefined();
  });

  it("is reached with the token on another origin", async () => {
    const b = await fresh();
    b.setBackend("https://other.lan:8443");
    expect(b.isRemote()).toBe(true);
    expect(b.apiUrl("/api/login")).toBe("https://other.lan:8443/api/login");
    expect(b.wsUrl("/ws?device=a")).toBe("wss://other.lan:8443/ws?device=a");
    expect(b.wsProtocols()).toBeUndefined(); // not logged in yet
    b.setToken("abc-_1");
    const init = b.fetchInit({ method: "POST" });
    expect(init.credentials).toBe("omit");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer abc-_1");
    expect(b.wsProtocols()).toEqual(["tdsp", "tdsp.token.abc-_1"]);
    b.setToken(null);
    expect(b.wsProtocols()).toBeUndefined();
  });

  it("is remembered with the recent ones, and each its token", async () => {
    let b = await fresh();
    b.setBackend("http://a.lan:8080");
    b.setToken("ta");
    b.setBackend("http://b.lan:8080");
    b.setBackend("http://a.lan:8080");
    expect(b.recentBackends()).toEqual(["http://a.lan:8080", "http://b.lan:8080"]);
    b = await fresh(); // the app reopened
    expect(b.backend()).toBe("http://a.lan:8080");
    expect(b.wsProtocols()).toEqual(["tdsp", "tdsp.token.ta"]);
  });

  it("has none in an app never connected (no web origin)", async () => {
    vi.stubGlobal("location", { origin: "null", protocol: "file:", host: "" });
    const b = await fresh();
    expect(b.backend()).toBeNull();
    expect(b.label(b.backend())).toBe("");
  });

  it("knows mixed content and versions", async () => {
    stubPage("https://dsp.example");
    const b = await fresh();
    expect(b.blockedAsMixedContent("http://192.168.1.30:8080")).toBe(true);
    expect(b.blockedAsMixedContent("https://192.168.1.30:8443")).toBe(false);
    expect(b.sameMinor("0.12.1", "0.12.4")).toBe(true);
    expect(b.sameMinor("0.12.1", "0.13.0")).toBe(false);
    expect(b.label("http://dsp.local:8080")).toBe("dsp.local:8080");
    expect(b.label("https://dsp.local")).toBe("https://dsp.local");
  });
});
