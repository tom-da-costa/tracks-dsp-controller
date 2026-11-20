<script lang="ts">
  import { t } from "../lib/i18n/index.svelte";
  // "Live" tab: one strip per channel for running a show (meters, gain, mute, indicators).
  // The channels shown are picked in the top row and remembered in this browser, shared with
  // Params (same choice, same strip width).
  import { ChannelSelection } from "../lib/selection.svelte";
  import { stripSpace } from "../lib/stripfit";
  import { stripPx, stripWidth } from "../lib/stripwidth.svelte";
  import ChannelPicker from "./ChannelPicker.svelte";
  import LiveStrip from "./LiveStrip.svelte";
  import SideDivider from "./SideDivider.svelte";

  const selection = new ChannelSelection("dsp408.live.hidden");
  const shown = $derived(selection.shown);
  // Strip width, set in the folded picker's panel on a phone: LiveStrip is 132 px, its content
  // narrows down to 60 px.
  const LIVE = { base: 132, min: 60 };
  let rowWidth = $state(0);
  const px = $derived(stripPx(stripWidth, LIVE, stripSpace(rowWidth, shown), shown.length));
  $effect(() => {
    if (stripWidth.fit && px !== undefined) stripWidth.fitted = Math.round((px * 100) / LIVE.base);
  });
</script>

<div class="live">
  <ChannelPicker {selection} fold width={stripWidth} />

  <div class="strips" style:--strip-w={px === undefined ? undefined : `${px}px`} bind:clientWidth={rowWidth}>
    {#each shown as path, i (path)}
      {#if i > 0 && path.startsWith("outputs.") && shown[i - 1]?.startsWith("inputs.")}
        <SideDivider />
      {/if}
      <LiveStrip {path} />
    {:else}
      <p class="muted">{t("common.no_channel")}</p>
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
