<script lang="ts">
  // "Help" tab: how to use the app (tabs, buttons, control, presets, settings) and what the
  // audio settings do, in the app's language (lib/i18n: the buttons at the top change it for the
  // whole app). The contents jump to a section by scrolling (the URL hash is the app's
  // navigation, so no #anchors).
  import type { Component } from "svelte";
  import { i18n, LANG_SHORT, LANGS, t, type Lang } from "../lib/i18n/index.svelte";
  import HelpDe from "./HelpDe.svelte";
  import HelpEn from "./HelpEn.svelte";
  import HelpFr from "./HelpFr.svelte";
  import HelpRu from "./HelpRu.svelte";
  import HelpZh from "./HelpZh.svelte";

  /** Section ids, in order; each language's HelpXx.svelte has a section `help-<id>` per id. */
  const IDS = [
    "start",
    "rail",
    "tabs",
    "channels",
    "controls",
    "together",
    "presets",
    "settings",
    "audio",
    "safety",
  ] as const;

  interface LangInfo {
    title: string;
    contents: string; // accessible name of the contents row
    content: Component;
    toc: string[]; // section titles, in the order of IDS
  }

  const LANGS_INFO: Record<Lang, LangInfo> = {
    en: {
      title: "Help",
      contents: "Contents",
      content: HelpEn,
      toc: [
        "Getting started",
        "The side bar",
        "The tabs",
        "Choosing the channels shown",
        "Faders, fields and buttons",
        "Several people at once",
        "Presets",
        "Settings",
        "Audio settings explained",
        "Good habits",
      ],
    },
    fr: {
      title: "Aide",
      contents: "Sommaire",
      content: HelpFr,
      toc: [
        "Prise en main",
        "La barre latérale",
        "Les onglets",
        "Choisir les voies affichées",
        "Faders, champs et boutons",
        "À plusieurs en même temps",
        "Presets",
        "Réglages",
        "Les réglages audio expliqués",
        "Bonnes habitudes",
      ],
    },
    de: {
      title: "Hilfe",
      contents: "Inhalt",
      content: HelpDe,
      toc: [
        "Erste Schritte",
        "Die Seitenleiste",
        "Die Tabs",
        "Angezeigte Kanäle wählen",
        "Fader, Felder und Tasten",
        "Zu mehreren gleichzeitig",
        "Presets",
        "Einstellungen",
        "Die Audio-Einstellungen erklärt",
        "Gute Gewohnheiten",
      ],
    },
    ru: {
      title: "Справка",
      contents: "Содержание",
      content: HelpRu,
      toc: [
        "Начало работы",
        "Боковая панель",
        "Вкладки",
        "Выбор отображаемых каналов",
        "Фейдеры, поля и кнопки",
        "Совместная работа",
        "Пресеты",
        "Настройки",
        "Звуковые настройки: пояснения",
        "Полезные привычки",
      ],
    },
    zh: {
      title: "帮助",
      contents: "目录",
      content: HelpZh,
      toc: [
        "入门",
        "侧边栏",
        "标签页",
        "选择显示的通道",
        "推子、数值框和按钮",
        "多人同时使用",
        "预设",
        "设置",
        "音频设置说明",
        "良好习惯",
      ],
    },
  };
  const current = $derived(LANGS_INFO[i18n.lang]);

  function go(id: string) {
    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
</script>

<article class="help">
  <div class="top">
    <h1>{current.title}</h1>
    <div class="lang" role="group" aria-label={t("common.language")}>
      {#each LANGS as code (code)}
        <button
          class:on={i18n.lang === code}
          aria-pressed={i18n.lang === code}
          onclick={() => i18n.set(code)}>{LANG_SHORT[code]}</button
        >
      {/each}
    </div>
  </div>
  <nav class="toc" aria-label={current.contents}>
    {#each IDS as id, i (id)}
      <button onclick={() => go(id)}>{current.toc[i]}</button>
    {/each}
  </nav>
  <current.content />
</article>

<style>
  .help {
    max-width: 860px;
    margin: 0 auto;
    line-height: 1.5;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  .lang {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .lang button {
    min-height: 36px;
    min-width: 48px;
    font-weight: 700;
  }
  .lang button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }
  .toc {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }
  .toc button {
    min-height: 36px;
    border-radius: 18px;
    font-size: 0.85rem;
  }
  .help :global(section) {
    margin-bottom: 14px;
    padding: 12px 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    scroll-margin-top: 8px;
  }
  .help :global(h2) {
    margin: 0 0 8px;
    font-size: 1.15rem;
  }
  .help :global(p),
  .help :global(ul) {
    margin: 0 0 8px;
  }
  .help :global(ul) {
    padding-left: 20px;
  }
  .help :global(li) {
    margin-bottom: 4px;
  }
  .help :global(dl) {
    margin: 0;
    display: grid;
    gap: 2px 16px;
    grid-template-columns: minmax(0, 12rem) minmax(0, 1fr);
  }
  .help :global(dt) {
    font-weight: 700;
    padding-top: 6px;
  }
  .help :global(dd) {
    margin: 0;
    padding-top: 6px;
    color: var(--text);
  }
  @media (max-width: 600px) {
    .help :global(dl) {
      grid-template-columns: 1fr;
    }
    .help :global(dd) {
      padding-top: 0;
      margin-bottom: 6px;
    }
  }
  .help :global(code) {
    font-size: 0.85em;
  }
</style>
