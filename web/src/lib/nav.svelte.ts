// Navigation: main tab plus the sub-tab of "Params" (a setting) and "Channels" (a channel),
// mirrored in the URL hash (#params/gain, #channels/outputs.3, #aio …) so that reloads and the
// browser's back button (or a phone's back gesture) work. The screen lock freezes it. Link and
// Matrix, edited for a whole side or the whole system, have tabs of their own (#link, #matrix);
// #params/link and #params/matrix, their old addresses, lead there.

import { app } from "./app.svelte";
import type { TextKey } from "./i18n/index.svelte";

/** The tabs: key, label (i18n key), icon. */
export const TABS = [
  ["live", "tab.live", "🎛"],
  ["link", "tab.link", "🔗"],
  ["matrix", "tab.matrix", "🔀"],
  ["params", "tab.params", "🎚"],
  ["channels", "tab.channels", "🔈"],
  ["aio", "tab.aio", "▥"],
  ["loud", "tab.loud", "🚨"],
  ["limiter", "tab.limiter", "🧮"],
  ["presets", "tab.presets", "☰"],
  ["settings", "tab.settings", "⚙"],
  ["help", "tab.help", "❓"],
] as const satisfies readonly (readonly [string, TextKey, string])[];
export type Tab = (typeof TABS)[number][0];

/** The settings, as the blocks of the all-in-one view (Params shows those of PARAM_TABS):
 * key, label (i18n key). */
export const PARAMS = [
  ["gain", "param.gain"],
  ["delay", "param.delay"],
  ["eq", "param.eq"],
  ["filters", "param.filters"],
  ["comp", "param.comp"],
  ["limit", "param.limit"],
  ["gate", "param.gate"],
  ["geq", "param.geq"],
  ["matrix", "param.matrix"],
  ["link", "param.link"],
] as const satisfies readonly (readonly [string, TextKey])[];
export type Param = (typeof PARAMS)[number][0];

/** The sub-tabs of "Params": every setting but Matrix and Link, which have their own tabs. */
export type ParamTab = Exclude<Param, "matrix" | "link">;
type ParamTabEntry = Extract<(typeof PARAMS)[number], readonly [ParamTab, string]>;
export const PARAM_TABS = PARAMS.filter(
  (entry): entry is ParamTabEntry => entry[0] !== "matrix" && entry[0] !== "link",
);

/** Which channels a setting exists on. */
export const PARAM_SCOPE: Record<Param, "all" | "inputs" | "outputs"> = {
  gain: "all",
  delay: "all",
  eq: "all",
  filters: "all",
  comp: "outputs",
  limit: "outputs",
  gate: "inputs",
  geq: "inputs",
  matrix: "outputs",
  link: "all",
};

const CHANNEL = /^(inputs|outputs)\.(\d+)$/;

export function isChannelPath(text: string): boolean {
  return CHANNEL.test(text);
}

/** Label of a channel slot: "In A" for inputs.0, "Out 3" for outputs.2. */
export function slotLabel(path: string): string {
  const match = CHANNEL.exec(path);
  if (!match) return path;
  const n = Number(match[2]);
  return match[1] === "inputs" ? `In ${String.fromCharCode(65 + n)}` : `Out ${n + 1}`;
}

function isParamTab(text: string): text is ParamTab {
  return PARAM_TABS.some(([key]) => key === text);
}

function isTab(text: string): text is Tab {
  return TABS.some(([key]) => key === text);
}

class Nav {
  tab = $state<Tab>("live");
  param = $state<ParamTab>("gain");
  channel = $state("inputs.0");
  /** Open/closed state of collapsible sections, by section id. */
  sections = $state<Record<string, boolean>>({});

  constructor() {
    this.fromHash();
  }

  get hash(): string {
    if (this.tab === "params") return `params/${this.param}`;
    if (this.tab === "channels") return `channels/${this.channel}`;
    return this.tab;
  }

  /** Locked screen: the view stays as it is (tabs, sub-tabs, channel shown). */
  private get frozen(): boolean {
    return app.screenLocked;
  }

  fromHash(): void {
    if (this.frozen) {
      this.go(false); // back / forward while locked: put the current view's URL back
      return;
    }
    const [head = "", sub = ""] = location.hash.slice(1).split("/");
    if (head === "params" && (sub === "link" || sub === "matrix")) {
      this.tab = sub; // their address before they had tabs of their own
      this.go(false);
    } else if (isTab(head)) {
      this.tab = head;
      if (head === "params" && isParamTab(sub)) this.param = sub;
      if (head === "channels" && isChannelPath(sub)) this.channel = sub;
    } else if (isChannelPath(head)) {
      this.tab = "channels"; // links of the previous UI (#outputs.3)
      this.channel = head;
      this.go(false);
    } else if (head === "mixer") {
      this.tab = "params"; // link of the previous UI
      this.param = "gain";
      this.go(false);
    }
  }

  private go(push: boolean): void {
    const url = `#${this.hash}`;
    if (url === location.hash) return;
    if (push) history.pushState({ nav: true }, "", url);
    else history.replaceState(history.state, "", url);
  }

  select(tab: Tab): void {
    if (this.frozen) return;
    this.tab = tab;
    this.go(false);
  }

  selectParam(param: ParamTab): void {
    if (this.frozen) return;
    this.tab = "params";
    this.param = param;
    this.go(false);
  }

  selectChannel(path: string): void {
    if (this.frozen) return;
    this.tab = "channels";
    this.channel = path;
    this.go(false);
  }

  /** Jump to a channel from another view; "back" returns to that view. */
  open(path: string): void {
    if (this.frozen) return;
    this.tab = "channels";
    this.channel = path;
    this.go(true);
  }

  isOpen(id: string, fallback = true): boolean {
    return this.sections[id] ?? fallback;
  }

  toggle(id: string, fallback = true): void {
    this.sections[id] = !this.isOpen(id, fallback);
  }
}

export const nav = new Nav();
