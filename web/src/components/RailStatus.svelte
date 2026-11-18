<script lang="ts">
  // Top of the tab rail: the DSP picker (the DSP this tab controls: status dot, name, model;
  // the server's other DSPs, if any) and the active preset (unsaved changes, demo).
  // Folded, it shows the preset slot; expanded, the full text.
  import { app } from "../lib/app.svelte";
  import { nav } from "../lib/nav.svelte";
  import DevicePicker from "./DevicePicker.svelte";

  interface Props {
    expanded: boolean;
    onpick?: () => void; // called after a tap that navigates (folds the rail on a phone)
  }

  let { expanded, onpick }: Props = $props();

  const device = $derived(app.device);
  const slot = $derived(
    device ? (device.active_slot === 0 ? "F00" : `U${String(device.active_slot).padStart(2, "0")}`) : "—",
  );
  const presetTitle = $derived(
    [
      `DSP ${app.deviceId ?? ""}`,
      device ? `preset ${slot} ${device.preset_name}` : "",
      device?.modified ? "unsaved changes" : "",
      app.hello?.demo ? "demo (simulated DSP)" : "",
    ]
      .filter(Boolean)
      .join(" · "),
  );

  function openPresets() {
    nav.select("presets");
    onpick?.();
  }
</script>

<div class="status" class:expanded>
  <DevicePicker {expanded} {onpick} />
  <button class="preset" onclick={openPresets} title={presetTitle} aria-label={presetTitle}>
    <span class="icon">
      {#if device?.modified}<span class="unsaved-dot"></span>{/if}
      <span class="slot">{slot}</span>
    </span>
    <span class="text">
      <strong>{device?.preset_name || "—"}</strong>
      <small>
        {#if device?.modified}<span class="unsaved">● unsaved</span>{/if}
        {#if app.hello?.demo}<span class="demo">DEMO</span>{/if}
        <span class="muted">Preset {slot}</span>
      </small>
    </span>
  </button>
</div>

<style>
  .status {
    display: grid;
    gap: 4px;
    padding-bottom: 6px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--line);
  }
  button {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    margin: 0 6px;
    padding: 0 6px;
    border: none;
    border-radius: 8px;
    background: none;
    text-align: left;
    white-space: nowrap;
    min-width: 0;
  }
  .icon {
    position: relative;
    flex: 0 0 32px;
    display: grid;
    justify-items: center;
    gap: 2px;
    font-size: 1.15rem;
    line-height: 1;
  }
  .text {
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
    display: flex;
    flex-wrap: wrap;
    gap: 2px 6px;
    font-size: 0.75rem;
  }
  .slot {
    font-size: 0.8rem;
    font-weight: 700;
  }
  /* above the slot (the DSP's status dot is on the picker) */
  .unsaved-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--warn);
  }
  .unsaved {
    color: var(--warn);
    font-weight: 600;
  }
  .demo {
    padding: 0 4px;
    border-radius: 4px;
    background: var(--info);
    color: #000;
    font-weight: 700;
  }
</style>
