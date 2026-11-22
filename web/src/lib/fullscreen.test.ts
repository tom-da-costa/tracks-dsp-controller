import { describe, expect, it } from "vitest";
import { fullscreenMode, isIos, type FullscreenEnv } from "./fullscreen";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const PIXEL =
  "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";

function env(overrides: Partial<FullscreenEnv>): FullscreenEnv {
  return {
    fullscreenEnabled: false,
    standalone: false,
    userAgent: PIXEL,
    platform: "Linux armv81",
    maxTouchPoints: 5,
    ...overrides,
  };
}

describe("fullscreenMode", () => {
  it("uses the Fullscreen API where there is one", () => {
    expect(fullscreenMode(env({ fullscreenEnabled: true }))).toBe("api");
  });

  it("explains the home screen on an iPhone", () => {
    expect(fullscreenMode(env({ userAgent: IPHONE, platform: "iPhone" }))).toBe("install");
  });

  it("shows nothing in an installed app", () => {
    expect(fullscreenMode(env({ standalone: true, fullscreenEnabled: true }))).toBe("none");
    expect(fullscreenMode(env({ standalone: true, userAgent: IPHONE, platform: "iPhone" }))).toBe("none");
  });

  it("shows nothing where neither works", () => {
    expect(fullscreenMode(env({}))).toBe("none");
  });
});

describe("isIos", () => {
  it("knows an iPad that asks for the desktop site from a Mac", () => {
    expect(isIos({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
  });
});
