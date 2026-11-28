<script lang="ts">
  // Top of the tab rail: a framed selector with the DSP this tab controls (its status dot, name
  // and model; the preset row below shows only the preset), and a panel with every DSP of the
  // server at a glance (status, preset) to switch to another. One DSP is just the case n = 1.
  import { app } from "../lib/app.svelte";
  import { statusText, t, tn } from "../lib/i18n/index.svelte";
  import { portal } from "../lib/portal";
  import type { DeviceEntry } from "../lib/types";

  interface Props {
    expanded: boolean;
    onpick?: () => void; // called after a DSP is picked (folds the rail on a phone)
  }

  let { expanded, onpick }: Props = $props();
  let open = $state(false);

  const current = $derived(app.currentDevice);
  const index = $derived(app.devices.findIndex((d) => d.id === app.deviceId) + 1);
  // Under the name: the model when online, else what is wrong.
  const detail = $derived(
    !app.connected
      ? t("rail.no_server")
      : current?.status === "online"
        ? (app.status?.model ?? current.model)
        : `DSP ${statusText(current?.status ?? "connecting")}`,
  );
  // The folded rail has room for a few letters of the name.
  const short = $derived((app.deviceId ?? "?").slice(0, 3));

  function slot(entry: DeviceEntry): string {
    return entry.active_slot === 0 ? "F00" : `U${String(entry.active_slot).padStart(2, "0")}`;
  }

  function dotClass(entry: DeviceEntry | undefined): string {
    if (!app.connected) return "disconnected";
    return entry?.status ?? "connecting";
  }

  function pick(id: string) {
    open = false;
    app.selectDevice(id);
    onpick?.();
  }

  function onkeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") open = false;
  }

  const title = $derived(tn("rail.dsp_title", app.devices.length, { name: app.deviceId ?? "" }));
</script>

<svelte:window {onkeydown} />

<button
  class="current"
  class:expanded
  onclick={() => (open = !open)}
  aria-expanded={open}
  aria-haspopup="dialog"
  disabled={app.screenLocked}
  {title}
  aria-label={title}
>
  <span class="icon">
    <span class="dot {dotClass(current)}"></span>
    <span class="short">{short}<span class="caret">▾</span></span>
  </span>
  <span class="text">
    <strong>{app.deviceId ?? "DSP"}</strong>
    <small class="muted">{detail} · DSP {index}/{app.devices.length}</small>
  </span>
  <span class="caret big" aria-hidden="true">▾</span>
</button>

<!-- Moved to <body>: out of the rail, which clips it on iOS (see portal.ts). -->
{#if open}
  <div use:portal>
    <button class="backdrop" aria-label={t("rail.dsp_close")} onclick={() => (open = false)}></button>
    <div class="panel" role="dialog" aria-label={t("rail.dsp_list")}>
      <h2>DSPs</h2>
      <ul>
        {#each app.devices as entry (entry.id)}
          <li>
            <button
              class="row"
              class:selected={entry.id === app.deviceId}
              aria-current={entry.id === app.deviceId}
              onclick={() => pick(entry.id)}
            >
              <span class="dot {dotClass(entry)}"></span>
              <span class="main">
                <span class="line">
                  <strong>{entry.id}</strong>
                  <span class="muted">{entry.model || entry.target}</span>
                  {#if entry.demo}<span class="demo">DEMO</span>{/if}
                </span>
                <span class="line small">
                  {#if entry.status === "online"}
                    <span>{slot(entry)} {entry.preset_name}</span>
                    {#if entry.modified}<span class="unsaved">{t("rail.unsaved")}</span>{/if}
                  {:else}
                    <span class="muted"
                      >{statusText(entry.status)}{entry.error
                        ? `: ${entry.error}`
                        : ""}</span
                    >
                  {/if}
                </span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  /* Framed like a select, so that it does not read as one more status line. */
  .current {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    margin: 0 6px;
    padding: 0 5px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel-2);
    text-align: left;
    white-space: nowrap;
    min-width: 0;
  }
  .icon {
    flex: 0 0 32px;
    display: grid;
    justify-items: center;
    gap: 3px;
    line-height: 1;
  }
  .short {
    max-width: 32px;
    overflow: hidden;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text);
  }
  .caret {
    margin-left: 1px;
    color: var(--muted);
  }
  .caret.big {
    display: none;
    margin-left: auto;
    font-size: 0.9rem;
  }
  .expanded .caret.big {
    display: block;
  }
  .expanded .short .caret {
    display: none;
  }
  .text {
    flex: 1 1 auto;
    min-width: 0;
    display: grid;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .expanded .text {
    opacity: 1;
  }
  .text strong,
  .text small {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .text small {
    font-size: 0.75rem;
  }
  .dot {
    flex: 0 0 auto;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--muted);
  }
  .dot.online {
    background: var(--accent);
  }
  .dot.offline,
  .dot.disconnected {
    background: var(--danger);
  }
  .dot.connecting,
  .dot.initialising {
    background: var(--warn);
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    min-height: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    background: #0006;
  }
  .panel {
    position: fixed;
    z-index: 21;
    top: calc(8px + env(safe-area-inset-top));
    left: calc(64px + env(safe-area-inset-left));
    width: min(360px, calc(100vw - 80px));
    max-height: calc(100vh - 16px);
    overflow: auto;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--panel);
    box-shadow: 0 8px 24px #0009;
  }
  h2 {
    margin: 4px 8px 8px;
    font-size: 0.9rem;
    color: var(--muted);
  }
  ul {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 52px;
    padding: 6px 10px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    text-align: left;
  }
  .row.selected {
    border-color: var(--accent);
    background: var(--panel-2);
  }
  .main {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .line {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    align-items: baseline;
  }
  .small {
    font-size: 0.8rem;
  }
  .demo {
    padding: 0 4px;
    border-radius: 4px;
    background: var(--info);
    color: #000;
    font-size: 0.7rem;
    font-weight: 700;
  }
  .unsaved {
    color: var(--warn);
    font-weight: 600;
  }
  /* Phone: the panel spans the screen width. */
  @media (max-width: 699px) {
    .panel {
      left: calc(8px + env(safe-area-inset-left));
      right: calc(8px + env(safe-area-inset-right));
      width: auto;
    }
  }
</style>
