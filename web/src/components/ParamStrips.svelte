<script lang="ts">
  // A setting of the Params tab (delay, filters, dynamics) as one strip per channel, like the
  // mixer: the fields stand up as vertical sliders (lib/layout.ts). With a strip width set in
  // the folded picker's panel on a phone (shared with Live), a strip gets that width and its
  // fields share it (`.sized`); unset, a strip follows its content.
  import { MediaQuery } from "svelte/reactivity";
  import { app } from "../lib/app.svelte";
  import { links } from "../lib/links.svelte";
  import { setStripLayout } from "../lib/layout";
  import { nav, type Param } from "../lib/nav.svelte";
  import type { ChannelSelection } from "../lib/selection.svelte";
  import { stripSpace } from "../lib/stripfit";
  import { stripPx, stripWidth, type FixedStrips } from "../lib/stripwidth.svelte";
  import ChannelPicker from "./ChannelPicker.svelte";
  import ParamBlock from "./ParamBlock.svelte";
  import SideDivider from "./SideDivider.svelte";

  interface Props {
    param: Param;
    /** Channels to show, in order. */
    paths: string[];
    /** The Params tab's channel choice, picked in the row above the strips. */
    selection: ChannelSelection;
    /** The setting exists on that side only. */
    side?: "inputs" | "outputs";
  }

  let { param, paths, selection, side }: Props = $props();

  setStripLayout();

  // A strip's usual width per setting (its fields' columns, 74 px each, or the two filters),
  // and the narrowest its fields allow (about 40 px a column). On a short screen the four
  // fields of the compressor and the gate stand on one row (app.css).
  const WIDTHS: Partial<Record<Param, FixedStrips>> = {
    delay: { base: 170, min: 100 },
    filters: { base: 260, min: 140 },
    comp: { base: 170, min: 100 },
    limit: { base: 252, min: 150 },
    gate: { base: 170, min: 100 },
  };
  const ONE_ROW: FixedStrips = { base: 334, min: 198 };
  const short = new MediaQuery("max-height: 499px");
  let rowWidth = $state(0);
  const view = $derived(
    short.current && (param === "comp" || param === "gate")
      ? ONE_ROW
      : (WIDTHS[param] ?? { base: 170, min: 100 }),
  );
  const px = $derived(stripPx(stripWidth, view, stripSpace(rowWidth, paths), paths.length));
  $effect(() => {
    if (stripWidth.fit && px !== undefined) stripWidth.fitted = Math.round((px * 100) / view.base);
  });

  function channelOf(path: string) {
    const [side, n] = path.split(".");
    return (side === "inputs" ? app.device?.inputs : app.device?.outputs)?.[Number(n)];
  }
</script>

<div class="view">
<ChannelPicker {selection} {side} fold width={stripWidth} />

<div
  class="strips"
  class:sized={px !== undefined}
  style:--strip-w={px === undefined ? undefined : `${px}px`}
  bind:clientWidth={rowWidth}
>
  {#each paths as path, i (path)}
    {@const channel = channelOf(path)}
    {#if channel}
      {#if i > 0 && path.startsWith("outputs.") && paths[i - 1]?.startsWith("inputs.")}
        <SideDivider />
      {/if}
      <section
        class="strip"
        class:muted={channel.mute}
        style:--ch={app.color(path)}
      >
        <button class="name" onclick={() => nav.open(path)} title="Open this channel">
          <span class="slot">{links.slot(path)}{links.mark(path)}</span>
          <strong>{links.name(path)}</strong>
        </button>
        <ParamBlock {param} {path} />
      </section>
    {/if}
  {:else}
    <p class="muted">No channel selected: pick some above.</p>
  {/each}
</div>
</div>

<style>
  /* The page minus the setting row above: the strips take all the height, like the mixer's. */
  .view {
    height: calc(100% - 46px);
    min-height: 460px;
    display: flex;
    flex-direction: column;
  }
  .strips {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding-bottom: 6px;
  }
  .strip {
    flex: 0 0 auto;
    min-width: 150px;
    min-height: 100%; /* all the height, more when the page is too short (it then scrolls) */
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 6px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .strip.muted {
    /* Muted: red diagonal hatching, as in the mixer. */
    background-image: repeating-linear-gradient(
      -45deg,
      rgb(255 77 94 / 0.3) 0 4px, /* --danger at 30 % */
      transparent 4px 16px
    );
  }
  .name {
    border: 2px solid var(--ch);
    color: var(--ch);
    display: grid;
    min-height: 40px;
    padding: 2px 6px;
    line-height: 1.15;
    text-align: center;
  }
  .name span,
  .name strong {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .slot {
    font-size: 0.7rem;
  }
  p {
    font-size: 0.85rem;
    text-align: center;
  }
  /* A width set on a phone (--strip-w): exactly that, the fields share it. */
  .sized .strip {
    flex: 0 0 var(--strip-w);
    min-width: 0;
    overflow-x: clip; /* a select's or a value's own width must not widen it */
  }
  /* Phone: the picker folds into a mini button over the strips (ChannelPicker), which then
     start at the top and gain its height. */
  @media (max-width: 699px), (max-height: 499px) {
    .view {
      position: relative;
      min-height: 414px;
    }
  }
  /* Short screen (a phone in landscape): tighter, so that the fields stay on screen. */
  @media (max-height: 499px) {
    .view {
      min-height: 260px;
    }
    .strip {
      gap: 4px;
      padding-block: 4px;
    }
    .name {
      flex: none;
      min-height: 0;
      padding: 1px 4px;
    }
  }
</style>
