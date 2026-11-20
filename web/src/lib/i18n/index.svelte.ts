// The UI's language: one catalogue of strings per language (en.ts, fr.ts …), bundled with the
// app (no request, no runtime dependency). English is the reference: the other catalogues have
// the same keys (enforced by their type, and by i18n.test.ts). The language follows the
// browser's until one is picked (Settings, the login screen or the Help page), then it is
// remembered in this browser. The in-app help follows the same choice.
//
// Messages are plain text with {name} placeholders. Plural messages have one form per
// Intl.PluralRules category of the language ({n} is the count). Units and DSP terms (PEQ, HPF,
// dBu, U01, CLIP…) are not translated, nor anything typed by the user (channel and preset names).

import { de } from "./de";
import { en, type Key, type Messages, type Plural, type PluralKey, type TextKey } from "./en";
import { fr } from "./fr";
import { ru } from "./ru";
import { zh } from "./zh";

export type { Key, PluralKey, TextKey };

export const LANGS = ["en", "fr", "de", "ru", "zh"] as const;
export type Lang = (typeof LANGS)[number];

/** Each language in its own words, for the language pickers. */
export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  ru: "Русский",
  zh: "中文",
};
/** Short label (the Help page's buttons). */
export const LANG_SHORT: Record<Lang, string> = { en: "EN", fr: "FR", de: "DE", ru: "RU", zh: "中文" };
const HTML_LANG: Record<Lang, string> = { en: "en", fr: "fr", de: "de", ru: "ru", zh: "zh-Hans" };

export const CATALOGUES: Record<Lang, Messages> = { en, fr, de, ru, zh };

const STORAGE_KEY = "dsp408.lang";
const OLD_HELP_KEY = "dsp408.help.lang"; // the Help page's own choice, before the UI was translated

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/** The first of the browser's languages that the app has, else English. */
export function browserLang(languages: readonly string[]): Lang {
  for (const tag of languages) {
    const code = tag.toLowerCase().split("-")[0];
    if (isLang(code)) return code;
  }
  return "en";
}

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function initialLang(): Lang {
  const saved = stored(STORAGE_KEY) ?? stored(OLD_HELP_KEY);
  if (isLang(saved)) return saved;
  if (typeof navigator === "undefined") return "en";
  return browserLang(navigator.languages?.length ? navigator.languages : [navigator.language ?? ""]);
}

class I18n {
  lang = $state<Lang>(initialLang());

  constructor() {
    this.apply();
  }

  /** The `lang` attribute of the page. */
  get html(): string {
    return HTML_LANG[this.lang];
  }

  set(lang: Lang): void {
    this.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // not persisted: fine
    }
    this.apply();
  }

  private apply(): void {
    if (typeof document !== "undefined" && document.documentElement)
      document.documentElement.lang = this.html;
  }
}

export const i18n = new I18n();

export type Params = Record<string, string | number>;

function fill(text: string, params: Params | undefined, escape: boolean): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    return escape ? escapeHtml(String(value)) : String(value);
  });
}

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

function message(key: Key, lang: Lang): string | Plural {
  return CATALOGUES[lang][key] ?? en[key];
}

function pluralForm(forms: Plural, n: number, lang: Lang): string {
  const category = new Intl.PluralRules(HTML_LANG[lang]).select(n);
  return forms[category] ?? forms.other;
}

/** A message in the current language. */
export function t(key: TextKey, params?: Params): string {
  return fill(message(key, i18n.lang) as string, params, false);
}

/** A message with a count: the plural form for `n`, with {n} filled in. */
export function tn(key: PluralKey, n: number, params?: Params): string {
  const lang = i18n.lang;
  return fill(pluralForm(message(key, lang) as Plural, n, lang), { n, ...params }, false);
}

/** A message with markup (<strong>, <em>, <code>), for {@html}: the parameters are escaped. */
export function th(key: TextKey, params?: Params): string {
  return fill(message(key, i18n.lang) as string, params, true);
}

/** `tn` with markup, for {@html}. */
export function thn(key: PluralKey, n: number, params?: Params): string {
  const lang = i18n.lang;
  return fill(pluralForm(message(key, lang) as Plural, n, lang), { n, ...params }, true);
}

/** The status of a DSP connection in words. */
export function statusText(status: string | undefined): string {
  switch (status) {
    case "online":
      return t("status.online");
    case "offline":
      return t("status.offline");
    case "connecting":
      return t("status.connecting");
    case "initialising":
      return t("status.initialising");
    case "stopped":
      return t("status.stopped");
    default:
      return status ?? "—";
  }
}
