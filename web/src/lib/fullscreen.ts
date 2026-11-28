// What the ⛶ button of the tab rail does in this browser.
//
// - "api": the Fullscreen API (Android, desktop browsers, iPad).
// - "install": iPhone. Safari puts only videos in full screen; the way to lose its bars is to add
//   the app to the home screen, so the button says how.
// - "none": already an installed app (no browser bars), or no way at all: no button.

export type FullscreenMode = "api" | "install" | "none";

export interface FullscreenEnv {
  fullscreenEnabled: boolean;
  standalone: boolean; // display-mode fullscreen / standalone, or iOS navigator.standalone
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}

export function isIos(env: Pick<FullscreenEnv, "userAgent" | "platform" | "maxTouchPoints">): boolean {
  // iPadOS asks for the desktop site and says "MacIntel", but a Mac has no touch screen.
  return /iPhone|iPad|iPod/.test(env.userAgent) || (env.platform === "MacIntel" && env.maxTouchPoints > 1);
}

export function fullscreenMode(env: FullscreenEnv): FullscreenMode {
  if (env.standalone) return "none";
  if (env.fullscreenEnabled) return "api";
  return isIos(env) ? "install" : "none";
}

export function browserFullscreenMode(): FullscreenMode {
  if (typeof document === "undefined") return "none";
  const nav = navigator as Navigator & { standalone?: boolean };
  return fullscreenMode({
    fullscreenEnabled: document.fullscreenEnabled === true,
    standalone:
      nav.standalone === true ||
      window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}
