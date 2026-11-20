<script lang="ts">
  // Presets › the unsaved changes: what differs from the stored preset, one line per parameter
  // grouped by channel, each with a button that writes the stored value back. The server keeps
  // the stored preset as it last saw it (after a recall or a store): before that it is not
  // known, and the list cannot be made.
  import { app } from "../lib/app.svelte";
  import { t, tn } from "../lib/i18n/index.svelte";
  import { channelOf, describe, type UnsavedChange } from "../lib/changes";
  import { links } from "../lib/links.svelte";

  interface Props {
    /** The list, kept up to date for the parent (recall / store confirmations). */
    changes?: UnsavedChange[] | null;
  }

  let { changes = $bindable(null) }: Props = $props();

  const device = $derived(app.device);
  const profile = $derived(app.hello?.profile);
  let known = $state(true);
  let open = $state(true);

  // Re-read after each change of the state (a little later: a fader drag sends many).
  $effect(() => {
    const rev = app.rev;
    if (!device?.modified) {
      changes = device?.modified === false ? [] : null;
      return;
    }
    const timer = setTimeout(() => void load(rev), 300);
    return () => clearTimeout(timer);
  });

  async function load(rev: number) {
    const result = await app.request({ type: "changes" });
    if (!result.ok || rev !== app.rev) return; // failed, or out of date: the next one will do
    known = result.known ?? false;
    changes = known ? (result.changes ?? []) : null;
  }

  const groups = $derived.by(() => {
    const byChannel = new Map<string, UnsavedChange[]>();
    for (const change of changes ?? []) {
      const key = channelOf(change.path);
      byChannel.set(key, [...(byChannel.get(key) ?? []), change]);
    }
    return [...byChannel];
  });

  function revert(change: UnsavedChange) {
    if (change.revert) void app.set(change.revert.path, change.revert.value);
  }

  function revertAll() {
    const n = changes?.length ?? 0;
    if (!changes || !confirm(tn("changes.undo_confirm", n)))
      return;
    for (const change of changes) revert(change);
  }
</script>

{#if device?.modified}
  <section class="changes">
    <div class="head">
      <button class="toggle" aria-expanded={open} onclick={() => (open = !open)}>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        {#if !known}
          {t("changes.title")}
        {:else if changes === null}
          {t("changes.loading")}
        {:else}
          {tn("changes.count", changes.length)}
        {/if}
      </button>
      {#if known && changes && changes.some((c) => c.revert)}
        <button class="small" disabled={app.readOnly} onclick={revertAll}>{t("changes.undo_all")}</button>
      {/if}
    </div>
    {#if open}
      {#if !known}
        <p class="muted">{t("changes.unknown")}</p>
      {:else if changes !== null}
        {#each groups as [path, list] (path)}
          <div class="channel">
            <strong style:color={app.color(path)}>{links.slot(path)} · {links.name(path)}</strong>
            <ul>
              {#each list as change (change.path)}
                {@const text = describe(change, profile)}
                <li>
                  <span class="setting">{text.setting}</span>
                  <span class="values"
                    ><span class="before">{text.before}</span> → <span>{text.after}</span></span
                  >
                  {#if change.revert}
                    <button
                      class="small"
                      disabled={app.readOnly}
                      title={t("changes.back_to", { value: text.before })}
                      onclick={() => revert(change)}>{t("changes.undo")}</button
                    >
                  {:else}
                    <span></span>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      {/if}
    {/if}
  </section>
{/if}

<style>
  .changes {
    margin: 4px 0 12px;
    padding: 8px 10px;
    border: 1px solid var(--warn);
    border-radius: var(--radius);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .toggle {
    flex: 1;
    min-height: 36px;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    font-weight: 700;
    color: var(--warn);
  }
  .small {
    min-height: 32px;
    padding: 0 10px;
    font-size: 0.85rem;
  }
  .channel {
    margin-top: 8px;
  }
  .channel strong {
    font-size: 0.9rem;
  }
  ul {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 4.5em;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    font-size: 0.9rem;
  }
  .values {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .before {
    color: var(--muted);
  }
  /* Narrow (phone): the values under the setting. */
  .changes {
    container-type: inline-size;
  }
  @container (max-width: 380px) {
    li {
      grid-template-columns: minmax(0, 1fr) 4.5em;
      grid-template-areas: "setting undo" "values undo";
    }
    .setting {
      grid-area: setting;
    }
    .values {
      grid-area: values;
      white-space: normal;
    }
    li > button,
    li > span:last-child {
      grid-area: undo;
    }
  }
  p {
    margin: 6px 0 0;
    font-size: 0.85rem;
  }
</style>
