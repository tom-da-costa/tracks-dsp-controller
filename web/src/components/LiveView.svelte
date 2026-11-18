<script lang="ts">
  // "Live" tab: one strip per channel for running a show (meters, gain, mute, indicators).
  // The channels shown are picked in the top row and remembered in this browser.
  import { ChannelSelection } from "../lib/selection.svelte";
  import { stripSpace } from "../lib/stripfit";
  import { StripWidth } from "../lib/stripwidth.svelte";
  import ChannelPicker from "./ChannelPicker.svelte";
  import LiveStrip from "./LiveStrip.svelte";
  import SideDivider from "./SideDivider.svelte";

  const selection = new ChannelSelection("dsp408.live.hidden");
  const shown = $derived(selection.shown);
  // Set in the folded picker's panel on a phone (LiveStrip's default: 132 px).
  const width = new StripWidth("dsp408.live.width", { min: 60, max: 180, step: 4, default: 132 });
  let rowWidth = $state(0);
  $effect(() => width.measure(stripSpace(rowWidth, shown), shown.length));
</script>

<div class="live">
  <ChannelPicker {selection} fold {width} />

  <div class="strips" style:--strip-w={width.css} bind:clientWidth={rowWidth}>
    {#each shown as path, i (path)}
      {#if i > 0 && path.startsWith("outputs.") && shown[i - 1]?.startsWith("inputs.")}
        <SideDivider />
      {/if}
      <LiveStrip {path} />
    {:else}
      <p class="muted">No channel selected: pick some above.</p>
    {/each}
  </div>
</div>

<style>
  .live {
    height: 100%;
    display: flex;
    flex-direction: column;
    /* Picker + a strip with its fader at its minimum height: below that, the page scrolls. */
    min-height: 480px;
  }
  .strips {
    flex: 1;
    display: flex;
    gap: 6px; /* STRIP_GAP in lib/stripfit.ts */
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding-bottom: 6px;
    min-height: 0;
  }
  /* Phone: the picker folds into a mini button over the strips (ChannelPicker), which then
     start at the top and gain its height. */
  @media (max-width: 699px), (max-height: 499px) {
    .live {
      position: relative;
      min-height: 434px;
    }
  }
  /* Short screen (a phone in landscape): the strips are tighter (LiveStrip, Strip, Fader). */
  @media (max-height: 499px) {
    .live {
      min-height: 300px;
    }
  }
</style>
