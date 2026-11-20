import { describe, expect, it } from "vitest";
import { en, type Plural } from "./en";
import { browserLang, CATALOGUES, i18n, LANGS, t, th, tn, type Key } from "./index.svelte";

const KEYS = Object.keys(en) as Key[];
const HTML_LANG: Record<string, string> = { zh: "zh-Hans" };

function texts(value: string | Plural): string[] {
  return typeof value === "string" ? [value] : Object.values(value);
}

/** The {placeholders} of a message (n excepted: a plural form may leave the count out). */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").filter((p) => p !== "n");
}

function tags(text: string): string[] {
  return [...text.matchAll(/<\/?(\w+)>/g)].map((m) => m[0]).sort();
}

describe("catalogues", () => {
  for (const lang of LANGS) {
    const catalogue = CATALOGUES[lang];

    it(`${lang}: has every key, and only those`, () => {
      expect(Object.keys(catalogue).sort()).toEqual([...KEYS].sort());
    });

    it(`${lang}: keeps the placeholders and the markup of English`, () => {
      for (const key of KEYS) {
        const reference = texts(en[key]);
        const wanted = new Set(reference.flatMap(placeholders));
        for (const text of texts(catalogue[key])) {
          expect(text.trim(), `${lang} ${key}`).not.toBe("");
          for (const name of placeholders(text)) expect(wanted, `${lang} ${key}`).toContain(name);
          expect(tags(text), `${lang} ${key}`).toEqual(tags(reference[0] ?? ""));
        }
        // Every placeholder of English is used (in at least one form).
        const used = new Set(texts(catalogue[key]).flatMap(placeholders));
        for (const name of wanted) expect(used, `${lang} ${key}: {${name}}`).toContain(name);
      }
    });

    it(`${lang}: plural messages have the forms the language needs`, () => {
      const rules = new Intl.PluralRules(HTML_LANG[lang] ?? lang);
      for (const key of KEYS) {
        const value = catalogue[key];
        expect(typeof value, `${lang} ${key}`).toBe(typeof en[key]);
        if (typeof value === "string") continue;
        for (let n = 0; n <= 1000; n++) {
          const category = rules.select(n);
          expect(value[category], `${lang} ${key}: ${category} (${n})`).toBeDefined();
        }
      }
    });
  }
});

describe("language", () => {
  it("follows the browser's first known language", () => {
    expect(browserLang(["de-AT", "en"])).toBe("de");
    expect(browserLang(["es-ES", "fr-FR"])).toBe("fr");
    expect(browserLang(["zh-Hans-CN"])).toBe("zh");
    expect(browserLang(["ja"])).toBe("en");
    expect(browserLang([])).toBe("en");
  });

  it("fills placeholders, picks plural forms, escapes values in markup", () => {
    i18n.lang = "en";
    expect(t("presets.recalled", { slot: "U03" })).toBe("U03 recalled");
    expect(tn("changes.count", 1)).toBe("1 unsaved change");
    expect(tn("changes.count", 3)).toBe("3 unsaved changes");
    expect(th("settings.connected_as", { name: "<b>&" })).toBe(
      "Connected as <strong>&lt;b&gt;&amp;</strong>.",
    );
    i18n.lang = "ru";
    expect(tn("changes.count", 1)).not.toBe(tn("changes.count", 3));
    expect(tn("changes.count", 3)).not.toBe(tn("changes.count", 5));
    i18n.lang = "en";
  });
});
