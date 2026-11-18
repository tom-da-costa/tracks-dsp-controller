<script lang="ts">
  // The row that picks the channels a multi-channel view shows (Live, All-in-one, Params):
  // shortcuts all / inputs / outputs, then one toggle per channel. With `side`, only that side's
  // channels are listed (a setting that exists on inputs or outputs only).
  // With `fold` (Live, Params strips), on a phone (narrow, or short in landscape) the row folds
  // into a narrow vertical tab beside the strips, so that they start at the top of the page; a
  // tap on it opens the row as a panel over the strips. The parent lays the tab and the strips
  // out side by side under the same media query.
  import { app } from "../lib/app.svelte";
  import { links } from "../lib/links.svelte";
  import type { ChannelSelection } from "../lib/selection.svelte";

  interface Props {
    selection: ChannelSelection;
    side?: "inputs" | "outputs";
    /** Fold into a vertical tab on a phone. */
    fold?: boolean;
  }

  let { selection, side, fold = false }: Props = $props();
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
      <span>Channels {count}/{all.length}</span>
      <span class="chev" aria-hidden="true">{open ? "◂" : "▸"}</span>
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
</div>
</div>

<style>
  .wrap {
    display: contents;
  }
  .tab,
  .scrim {
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

  /* Phone, folded: a narrow tab beside the strips; the row opens over them as a panel. Keep
     the media query in step with the parents' (LiveView, Mixer, ParamStrips). */
  @media (max-width: 699px), (max-height: 499px) {
    .fold {
      position: relative;
      flex: 0 0 26px;
      display: flex;
    }
    .fold .tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 0;
      padding: 8px 0;
      border-radius: var(--radius);
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--muted);
    }
    .fold .tab span {
      writing-mode: vertical-rl;
      white-space: nowrap;
    }
    .fold .tab .chev {
      writing-mode: horizontal-tb;
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
      top: 0;
      left: calc(100% + 6px);
      width: max-content;
      max-width: calc(100vw - var(--rail, 56px) - 70px);
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
