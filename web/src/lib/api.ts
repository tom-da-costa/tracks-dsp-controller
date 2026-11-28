import { apiUrl, fetchInit, isRemote, pageOrigin, setToken } from "./backend";

export interface Me {
  client_id: string;
  name: string;
}

export class LoginError extends Error {
  constructor(
    message: string,
    readonly code: string,
    /** logins_blocked: the master's name. */
    readonly owner: string | null = null,
  ) {
    super(message);
  }
}

export async function currentSession(): Promise<Me | null> {
  const response = await fetch(apiUrl("/api/session"), fetchInit());
  if (!response.ok) return null;
  return (await response.json()) as Me;
}

/** Whether the session cookie is still valid ("unreachable": no answer from the server). */
export async function sessionState(): Promise<"valid" | "expired" | "unreachable"> {
  try {
    const response = await fetch(apiUrl("/api/session"), fetchInit());
    if (response.ok) return "valid";
    return response.status === 401 ? "expired" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function login(pin: string, name: string): Promise<Me> {
  const response = await fetch(
    apiUrl("/api/login"),
    fetchInit({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin, name: name || null }),
    }),
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      owner?: string | null;
    };
    throw new LoginError(body.message ?? "login failed", body.error ?? "error", body.owner ?? null);
  }
  const me = (await response.json()) as Me & { token?: string };
  if (me.token) setToken(me.token); // kept only for another origin (no cookie there)
  return { client_id: me.client_id, name: me.name };
}

export async function logout(): Promise<void> {
  try {
    await fetch(apiUrl("/api/logout"), fetchInit({ method: "POST" }));
  } finally {
    setToken(null);
  }
}

async function healthVersion(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

/** The version of this frontend, when talking to another server than its own: the app's build
 * (VITE_APP_VERSION) or the server that served the page. Null when it cannot be known. */
export async function frontendVersion(): Promise<string | null> {
  const built = import.meta.env.VITE_APP_VERSION as string | undefined;
  if (built) return built;
  const origin = pageOrigin();
  if (!isRemote() || origin === null) return null;
  return healthVersion(`${origin}/api/health`, { credentials: "same-origin" });
}
