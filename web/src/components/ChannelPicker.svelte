<script lang="ts">
  // The row that picks the channels a multi-channel view shows (Live, All-in-one, Params):
  // shortcuts all / inputs / outputs, then one toggle per channel. With `side`, only that side's
  // channels are listed (a setting that exists on inputs or outputs only).
  // With `fold` (Live, Params strips), on a phone (narrow, or short in landscape) the row folds
  // into a mini button floating over the top right corner of the strips, so that they start at
  // the top of the page and keep the whole width; a tap on it opens the row as a panel under
  // it. The parent is the positioning box (position: relative). With `width`, the panel also
  // sets the width of the strips (Live, Params › Gain).
  import { app } from "../lib/app.svelte";
  import { links } from "../lib/links.svelte";
  import type { ChannelSelection } from "../lib/selection.svelte";
  import type { StripWidth } from "../lib/stripwidth.svelte";

  interface Props {
    selection: ChannelSelection;
    side?: "inputs" | "outputs";
    /** Fold into a vertical tab on a phone. */
    fold?: boolean;
    /** Strip width set in the folded panel. */
    width?: StripWidth;
  }

  let { selection, side, fold = false, width }: Props = $props();
  let open = $state(false);

  const prefix = $derived(side ? (`${side}.` as const) : "");
  const all = $derived(selection.entries.filter((c) => c.path.startsWith(prefix)));
  const allShown = $derived(all.every((c) => selection.isShown(c.path)));
  const locked = $derived(app.screenLocked); // the locked screen keeps the channels shown
  const count = $derived(all.filter((c) => selection.isShown(c.path)).length);
  $effect(() => {
    if (locked) open = false;
  });
</script>

<svelte:window onkeydown={(e) => open && e.key === "Escape" && (open = false)} />

<div class="wrap" class:fold class:open>
  {#if fold}
    <button
      class="tab"
      class:filtered={!allShown}
      aria-expanded={open}
      disabled={locked}
      title="Channels shown"
      onclick={() => (open = !open)}
    >
      {count}/{all.length} {open ? "▴" : "▾"}
    </button>
    {#if open}
      <button class="scrim" aria-label="Close" tabindex="-1" onclick={() => (open = false)}></button>
    {/if}
  {/if}
<div class="picker" role="group" aria-label="Channels shown">
  <button class="quick" class:on={allShown} disabled={locked} onclick={() => selection.showAll(prefix)}
    >All</button
  >
  {#if !side}
    <button
      class="quick"
      class:on={!allShown && selection.isOnly("inputs.")}
      disabled={locked}
      onclick={() => selection.only("inputs.")}>In</button
    >
    <button
      class="quick"
      class:on={!allShown && selection.isOnly("outputs.")}
      disabled={locked}
      onclick={() => selection.only("outputs.")}>Out</button
    >
  {/if}
  <span class="sep"></span>
  {#each all as c (c.path)}
    <button
      class="chan ch-bar"
      style:--ch={app.color(c.path)}
      class:on={selection.isShown(c.path)}
      aria-pressed={selection.isShown(c.path)}
      disabled={locked}
      title={`${links.slot(c.path)} ${links.name(c.path)}`}
      onclick={() => selection.toggle(c.path)}
    >
      <span>{links.shortSlot(c.path)}</span>
      <small>{links.name(c.path)}</small>
    </button>
  {/each}
  {#if fold && width}
    <div class="width" role="group" aria-label="Strip width">
      <span class="label">Width</span>
      <button
        class="fit"
        class:on={width.fit}
        aria-pressed={width.fit}
        title="Share the screen's width between the channels shown"
        onclick={() => width.fitScreen()}>Fit screen</button
      >
      <span class="break"></span>
      <button class="step" aria-label="Narrower" onclick={() => width.nudge(-1)}>−</button>
      <input
        type="range"
        min={width.range.min}
        max={width.range.max}
        step={width.range.step}
        value={width.px}
        aria-label="Strip width"
        oninput={(e) => width.set(Number(e.currentTarget.value))}
      />
      <button class="step" aria-label="Wider" onclick={() => width.nudge(1)}>+</button>
      <button
        class="step"
        aria-label="Default width"
        title="Default width"
        disabled={width.value === null && !width.fit}
        onclick={() => width.reset()}>↺</button
      >
    </div>
  {/if}
</div>
</div>

<style>
  .wrap {
    display: contents;
  }
  .tab,
  .scrim,
  .width {
    display: none;
  }
  .picker {
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    padding-bottom: 8px;
  }
  .picker::-webkit-scrollbar {
    display: none;
  }
  .picker button {
    flex: 0 0 auto;
    min-height: 38px;
    padding: 0 8px;
    border-radius: 8px;
    line-height: 1.05;
  }
  .quick {
    font-weight: 600;
    font-size: 0.85rem;
  }
  .chan {
    display: grid;
    justify-items: center;
    min-width: 42px;
    color: var(--muted);
  }
  .chan span {
    font-weight: 700;
    font-size: 0.85rem;
  }
  .chan small {
    max-width: 7ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.65rem;
  }
  .picker .chan:not(.on) {
    border-color: color-mix(in srgb, var(--ch) 60%, var(--line));
  }
  .picker .chan:not(.on) span,
  .picker .chan:not(.on) small {
    color: var(--ch);
  }
  .picker .on:disabled {
    opacity: 1;
  }
  .picker .on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }
  .sep {
    flex: 0 0 1px;
    align-self: stretch;
    margin: 4px 4px;
    background: var(--line);
  }

  /* Phone, folded: a mini button over the strips' top right corner; the row opens under it
     as a panel. Keep the media query in step with the parents' (LiveView, Mixer, ParamStrips). */
  @media (max-width: 699px), (max-height: 499px) {
    /* The whole width of the strips (the parent), so that the panel never goes past their
       left edge (under the rail); the band itself lets taps through to the strips. */
    .fold {
      display: flex;
      justify-content: flex-end;
      position: absolute;
      z-index: 3;
      top: 4px;
      left: 4px;
      right: 4px;
      pointer-events: none;
    }
    .fold .tab,
    .fold .picker,
    .fold .scrim {
      pointer-events: auto;
    }
    .fold .tab {
      display: block;
      position: relative;
      z-index: 3;
      min-height: 30px;
      padding: 0 8px;
      border-radius: 15px;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text);
      background: color-mix(in srgb, var(--panel-2) 85%, transparent);
      box-shadow: 0 2px 8px #0008;
    }
    .fold .tab.filtered,
    .fold.open .tab {
      border-color: var(--accent);
      color: var(--accent);
    }
    .fold .picker {
      display: none;
    }
    .fold.open .picker {
      display: flex;
      position: absolute;
      z-index: 3;
      top: calc(100% + 6px);
      right: 0;
      width: max-content;
      max-width: 100%;
      flex-wrap: wrap;
      align-content: flex-start;
      padding: 8px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: 4px 4px 16px #0008;
    }
    .fold.open .picker .sep {
      display: none;
    }
    .fold.open .width {
      flex: 1 0 100%;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      padding-top: 8px;
      border-top: 1px solid var(--line);
    }
    .fold.open .width {
      flex-wrap: wrap;
    }
    .width .label {
      flex: 1;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--muted);
    }
    .width .break {
      flex: 0 0 100%; /* − slider + ↺ on their own line: the slider gets the width */
    }
    .picker .width .fit {
      min-height: 32px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .width input {
      flex: 1;
      width: 0; /* no intrinsic width: the row fits the panel */
      min-width: 60px;
      accent-color: var(--accent);
    }
    .picker .width .step {
      min-width: 38px;
      padding: 0;
      font-size: 1.05rem;
    }
    .fold.open .scrim {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 2;
      min-height: 0;
      padding: 0;
      border: none;
      border-radius: 0;
      background: #0004;
    }
  }
</style>
