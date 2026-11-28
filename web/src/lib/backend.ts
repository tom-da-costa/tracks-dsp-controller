// The backend (server) this frontend talks to.
//
// By default the server that served the page: same origin, cookie session. Another one can be
// chosen at login, for a frontend embedded in an app or served by another server: it is reached
// cross-origin, with the login's token ("Authorization: Bearer", and on the WebSocket the
// subprotocol "tdsp.token.<token>"; server/app.py). The choice, the recent servers and each
// server's token are remembered in this browser.

const BACKEND_KEY = "dsp408.backend";
const RECENT_KEY = "dsp408.backends";
const TOKENS_KEY = "dsp408.tokens";
const RECENT_MAX = 8;
const WS_PROTOCOL = "tdsp";
const WS_TOKEN_PREFIX = "tdsp.token.";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered: fine
  }
}

function readJson<T>(key: string, check: (value: unknown) => value is T, fallback: T): T {
  try {
    const value = JSON.parse(read(key) ?? "null") as unknown;
    return check(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === "string");
const isTokens = (v: unknown): v is Record<string, string> =>
  typeof v === "object" && v !== null && Object.values(v).every((s) => typeof s === "string");

/** The page's origin when it is a web origin (not an app's file:// or custom scheme). */
export function pageOrigin(): string | null {
  const origin = typeof location === "undefined" ? undefined : location.origin;
  return typeof origin === "string" && /^https?:\/\//.test(origin) ? origin : null;
}

/** "192.168.1.20:8080", "dsp.local", "https://host:8443/" → an origin; null if not an address.
 * Without a scheme: the page's own (http in an app). */
export function normalise(input: string): string | null {
  let text = input.trim();
  if (!text) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    const scheme = typeof location !== "undefined" && location.protocol === "https:" ? "https" : "http";
    text = `${scheme}://${text}`;
  }
  try {
    const url = new URL(text);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** The origin without "http://", as typed in the login field. */
export function label(origin: string | null): string {
  return origin === null ? "" : origin.replace(/^http:\/\//, "");
}

let current: string | null = normalise(read(BACKEND_KEY) ?? "") ?? pageOrigin();

/** The chosen backend's origin (null: none yet, in an app never connected). */
export function backend(): string | null {
  return current;
}

/** Another origin than the page's: token instead of cookie. */
export function isRemote(): boolean {
  return current !== null && current !== pageOrigin();
}

export function setBackend(origin: string): void {
  current = origin;
  write(BACKEND_KEY, origin);
  const recent = recentBackends().filter((o) => o !== origin);
  write(RECENT_KEY, JSON.stringify([origin, ...recent].slice(0, RECENT_MAX)));
}

/** The servers used before, most recent first. */
export function recentBackends(): string[] {
  return readJson(RECENT_KEY, isStrings, []);
}

/** A page served over https cannot reach an http server (mixed content). */
export function blockedAsMixedContent(origin: string): boolean {
  return typeof location !== "undefined" && location.protocol === "https:" && origin.startsWith("http:");
}

function token(): string | null {
  if (!isRemote() || current === null) return null;
  return readJson(TOKENS_KEY, isTokens, {})[current] ?? null;
}

/** Remember (or forget, with null) the token for the chosen backend. */
export function setToken(value: string | null): void {
  if (!isRemote() || current === null) return;
  const tokens = readJson(TOKENS_KEY, isTokens, {});
  if (value === null) delete tokens[current];
  else tokens[current] = value;
  write(TOKENS_KEY, JSON.stringify(tokens));
}

export function apiUrl(path: string): string {
  return isRemote() ? `${current}${path}` : path;
}

/** fetch() options: the cookie on the same origin, the token elsewhere. */
export function fetchInit(init: RequestInit = {}): RequestInit {
  if (!isRemote()) return { ...init, credentials: "same-origin" };
  const headers = new Headers(init.headers);
  const value = token();
  if (value) headers.set("authorization", `Bearer ${value}`);
  return { ...init, credentials: "omit", headers };
}

export function wsUrl(path: string): string {
  if (isRemote() && current !== null) return current.replace(/^http/, "ws") + path;
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${location.host}${path}`;
}

/** WebSocket subprotocols: the token, when the cookie cannot be used. */
export function wsProtocols(): string[] | undefined {
  const value = token();
  return value ? [WS_PROTOCOL, WS_TOKEN_PREFIX + value] : undefined;
}

/** "0.12.1" → "0.12": versions that differ there may not understand each other. */
export function sameMinor(a: string, b: string): boolean {
  const minor = (v: string) => v.split(".").slice(0, 2).join(".");
  return minor(a) === minor(b);
}
