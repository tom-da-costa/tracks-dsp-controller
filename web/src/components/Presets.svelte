<script lang="ts">
  import { app } from "../lib/app.svelte";
  import { t, tn } from "../lib/i18n/index.svelte";
  import { describe, type UnsavedChange } from "../lib/changes";
  import { links } from "../lib/links.svelte";
  import {
    asciiName,
    download,
    fromBase64,
    readPresetFile,
    toBase64,
    type PresetFileInfo,
  } from "../lib/presetfile";
  import UnsavedChanges from "./UnsavedChanges.svelte";

  const device = $derived(app.device);
  // The unsaved changes (UnsavedChanges keeps them up to date); null = not known.
  let changes = $state<UnsavedChange[] | null>(null);
  const SHOWN_CHANGES = 8; // in a confirmation, then "… and n more"
  let storing = $state<number | null>(null);
  let name = $state("");
  let busy = $state(false);
  // Import of a preset file: the file picked, then where it goes (0 = live setup only).
  let picker = $state<HTMLInputElement>();
  let importing = $state<{
    file: string;
    bytes: Uint8Array;
    info: PresetFileInfo;
    unsaved: boolean; // the live setup had unsaved changes when the file was picked
  } | null>(null);
  let importSlot = $state(0);
  let importName = $state("");

  // Errors of a request refused before anything reached the DSP.
  const REFUSED = new Set(["invalid", "locked", "screen_locked", "experimental"]);

  function checkName(value: string): string {
    return value.length === 0
      ? t("presets.name_required")
      : value.length > 14
        ? t("presets.name_long")
        : /^[\x20-\x7e]*$/.test(value)
          ? ""
          : t("presets.name_ascii");
  }
  const nameError = $derived(checkName(name));
  const importNameError = $derived(importSlot > 0 ? checkName(importName) : "");
  const exportable = $derived(app.connected && app.status?.status === "online" && !app.screenLocked);

  function label(slot: number): string {
    return slot === 0 ? "F00" : `U${String(slot).padStart(2, "0")}`;
  }

  /** The unsaved changes as lines of text, for a confirmation. */
  function changeLines(list: UnsavedChange[]): string {
    const lines = list.slice(0, SHOWN_CHANGES).map((change) => {
      const channel = change.path.split(".").slice(0, 2).join(".");
      const text = describe(change, app.hello?.profile);
      return `• ${links.slot(channel)} ${text.setting}: ${text.before} → ${text.after}`;
    });
    const more = list.length - SHOWN_CHANGES;
    return [...lines, ...(more > 0 ? [t("presets.more", { n: more })] : [])].join("\n");
  }

  /** What a recall loses, for its confirmation. */
  function lostText(): string {
    if (device?.modified === null) return `\n\n${t("presets.lost_unknown")}`;
    if (device?.modified !== true) return "";
    if (!changes || changes.length === 0) return `\n\n${t("presets.lost")}`;
    return `\n\n${tn("presets.lost_n", changes.length)}\n${changeLines(changes)}`;
  }

  async function recall(slot: number, presetName: string) {
    const lost = lostText();
    if (!confirm(t("presets.recall_confirm", { slot: label(slot), name: presetName }) + lost)) return;
    busy = true;
    if (await app.run({ type: "preset.recall", slot })) app.toast(t("presets.recalled", { slot: label(slot) }));
    busy = false;
  }

  function startStore(slot: number, current: string) {
    storing = slot;
    name = current === "Default Preset" ? (device?.preset_name ?? "") : current;
  }

  async function exportPreset() {
    busy = true;
    const result = await app.call({ type: "preset.export" });
    busy = false;
    if (!result.ok || !result.data || !result.filename) return;
    download(fromBase64(result.data), result.filename);
    app.toast(t("presets.exported", { file: result.filename }));
    for (const note of result.notes ?? []) app.toast(note);
  }

  async function pickFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // the same file can be picked again
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = readPresetFile(bytes);
    if (typeof info === "string") {
      app.toast(`${file.name}: ${info}`, "error");
      return;
    }
    const model = device?.info.model.replace(/^DSP/, "");
    if (model && info.model !== model) {
      app.toast(
        t("presets.wrong_model", { file: file.name, file_model: info.model, model }),
        "error",
      );
      return;
    }
    importing = { file: file.name, bytes, info, unsaved: device?.modified === true };
    importSlot = 0;
    importName = asciiName(info.name) || "Imported";
  }

  async function importPreset(event: SubmitEvent) {
    event.preventDefault();
    if (importing === null || importNameError) return;
    const stored = importSlot > 0 ? label(importSlot) : null;
    busy = true;
    const result = await app.call({
      type: "preset.import",
      data: toBase64(importing.bytes),
      ...(importSlot > 0 ? { slot: importSlot, name: importName } : {}),
    });
    busy = false;
    if (!result.ok) {
      // Refused before anything was sent: the dialog stays, to fix and retry. Otherwise the
      // file may have been loaded (the toast says what happened): the DSP's state is shown.
      if (!REFUSED.has(result.error ?? "")) importing = null;
      return;
    }
    const name = importing.info.name;
    app.toast(
      stored === null
        ? t("presets.loaded", { name })
        : t("presets.loaded_stored", { name, slot: stored }),
    );
    for (const note of result.notes ?? []) app.toast(note, "error");
    importing = null;
  }

  async function store(event: SubmitEvent) {
    event.preventDefault();
    if (storing === null || nameError) return;
    busy = true;
    if (await app.run({ type: "preset.store", slot: storing, name })) {
      app.toast(t("presets.stored", { slot: label(storing) }));
      storing = null;
    }
    busy = false;
  }
</script>

{#if device}
  <div class="card">
    <h2>{t("presets.title")}</h2>
    <p class="live">
      <span class="muted"
        >{t("presets.live", { slot: label(device.active_slot), name: device.preset_name })}</span
      >
      {#if device.modified}
        <span class="unsaved">{t("presets.unsaved")}</span>
        {#if device.active_slot > 0}
          <button
            class="primary"
            disabled={app.readOnly || busy}
            onclick={() => startStore(device.active_slot, device.preset_name)}
            >{t("presets.save_to", { slot: label(device.active_slot) })}</button
          >
        {/if}
      {/if}
    </p>
    <UnsavedChanges bind:changes />
    <ul>
      <li class:active={device.active_slot === 0}>
        <span class="slot">F00</span><span class="name">{t("presets.factory")}</span>
        <button disabled={app.readOnly || busy} onclick={() => recall(0, t("presets.factory"))}
          >{t("presets.recall")}</button
        >
        <span class="spacer"></span>
      </li>
      {#each device.presets as preset (preset.slot)}
        <li class:active={device.active_slot === preset.slot}>
          <span class="slot">{label(preset.slot)}</span>
          <span class="name">{preset.name}</span>
          <button disabled={app.readOnly || busy} onclick={() => recall(preset.slot, preset.name)}
            >{t("presets.recall")}</button
          >
          <button
            disabled={app.readOnly || busy}
            onclick={() => startStore(preset.slot, preset.name)}>{t("presets.store")}</button
          >
        </li>
      {/each}
    </ul>
    <div class="files">
      <button disabled={!exportable || busy} onclick={exportPreset}>{t("presets.export")}</button>
      <button disabled={app.readOnly || busy} onclick={() => picker?.click()}>{t("presets.import")}</button>
      <input bind:this={picker} type="file" accept=".prs" hidden onchange={pickFile} />
    </div>
    <p class="muted hint">{t("presets.files_help")}</p>
  </div>

  {#if storing !== null}
    <div class="backdrop" role="presentation" onclick={() => (storing = null)}></div>
    <form class="card dialog" onsubmit={store}>
      <h2>{t("presets.store_title", { slot: label(storing) })}</h2>
      <p class="muted">{t("presets.overwrite")}</p>
      {#if storing === device.active_slot && changes && changes.length > 0}
        <p class="muted">{tn("presets.keeps", changes.length)}</p>
      {/if}
      <label>
        {t("presets.name")}
        <input type="text" maxlength="14" bind:value={name} />
      </label>
      {#if nameError}<p class="error">{nameError}</p>{/if}
      <div class="actions">
        <button type="button" onclick={() => (storing = null)}>{t("common.cancel")}</button>
        <button class="primary" type="submit" disabled={!!nameError || busy}
          >{t("presets.store")}</button
        >
      </div>
    </form>
  {/if}
{/if}

{#if importing !== null}
  <div class="backdrop" role="presentation" onclick={() => (busy ? null : (importing = null))}></div>
  <form class="card dialog" onsubmit={importPreset}>
    <h2>{t("presets.import_title", { name: importing.info.name })}</h2>
    <p class="muted">
      {t("presets.import_help", { file: importing.file })}
      {#if importing.unsaved}<strong class="unsaved">{t("presets.lost")}</strong>{/if}
    </p>
    <label>
      {t("presets.then")}
      <select bind:value={importSlot}>
        <option value={0}>{t("presets.keep_live")}</option>
        {#each device?.presets ?? [] as preset (preset.slot)}
          <option value={preset.slot}
            >{t("presets.store_it", { slot: label(preset.slot), name: preset.name })}</option
          >
        {/each}
      </select>
    </label>
    {#if importSlot > 0}
      <p class="muted">{t("presets.overwrite_slot", { slot: label(importSlot) })}</p>
      <label>
        {t("presets.name")}
        <input type="text" maxlength="14" bind:value={importName} />
      </label>
      {#if importNameError}<p class="error">{importNameError}</p>{/if}
    {/if}
    <div class="actions">
      <button type="button" disabled={busy} onclick={() => (importing = null)}
        >{t("common.cancel")}</button
      >
      <button class="primary" type="submit" disabled={!!importNameError || busy || app.readOnly}
        >{busy ? t("presets.loading") : t("presets.load")}</button
      >
    </div>
  </form>
{/if}

<style>
  .files {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .files button {
    padding: 0 12px;
  }
  .hint {
    margin: 8px 0 0;
    font-size: 0.85em;
  }
  .dialog select {
    width: 100%;
  }
  /* Rows are separated, so it is clear which preset a Recall / Store button belongs to. */
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
  }
  li {
    display: grid;
    /* fixed button columns: every row lines up, F00 (no Store) included */
    grid-template-columns: 3.2em minmax(0, 1fr) 5.4em 5.4em;
    gap: 8px;
    align-items: center;
    padding: 6px;
    border-bottom: 1px solid var(--line);
  }
  li:last-child {
    border-bottom: none;
  }
  li > button {
    padding: 0 8px;
  }
  /* Narrow (phone): the full name on the first line, the buttons right under it. */
  ul {
    container-type: inline-size;
  }
  @container (max-width: 380px) {
    li {
      grid-template-columns: 3.2em 1fr 5.4em 5.4em;
      grid-template-areas: "slot name name name" ". . recall store";
      row-gap: 4px;
    }
    li > .slot {
      grid-area: slot;
    }
    li > .name {
      grid-area: name;
      white-space: normal;
    }
    li > button:nth-of-type(1) {
      grid-area: recall;
    }
    li > button:nth-of-type(2),
    li > .spacer {
      grid-area: store;
    }
  }
  li:nth-child(even):not(.active) {
    background: rgba(255, 255, 255, 0.025);
  }
  li:hover:not(.active) {
    background: rgba(255, 255, 255, 0.06);
  }
  li.active {
    background: rgba(61, 220, 151, 0.12);
    outline: 1px solid var(--accent);
    outline-offset: -1px;
    border-radius: 6px;
  }
  .slot {
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 10;
  }
  .dialog {
    position: fixed;
    z-index: 11;
    left: 50%;
    top: 20%;
    transform: translateX(-50%);
    width: min(360px, calc(100% - 32px));
    display: grid;
    gap: 12px;
  }
  .dialog label {
    display: grid;
    gap: 6px;
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .error {
    color: var(--danger);
    margin: 0;
  }
  .live {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
  }
  .unsaved {
    color: var(--warn);
    font-weight: 600;
  }
</style>
