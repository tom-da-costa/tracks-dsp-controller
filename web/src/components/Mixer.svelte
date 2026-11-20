<script lang="ts">
  import { t } from "../lib/i18n/index.svelte";
  // Params › Gain: one strip per channel picked in the row above (meter, fader, mute, phase).
  import { app } from "../lib/app.svelte";
  import type { ChannelSelection } from "../lib/selection.svelte";
  import { stripSpace } from "../lib/stripfit";
  import { stripPx, stripWidth } from "../lib/stripwidth.svelte";
  import ChannelPicker from "./ChannelPicker.svelte";
  import Strip from "./Strip.svelte";
  import SideDivider from "./SideDivider.svelte";

  interface Props {
    /** The Params tab's channel choice. */
    selection: ChannelSelection;
    /** Channels to show, in order. */
    paths: string[];
  }

  let { selection, paths }: Props = $props();

  const device = $derived(app.device);
  // Strip width, set in the folded picker's panel on a phone (shared with Live): unset, a
  // strip takes 80 to 120 px (Strip, 100 % = 100 px); its content narrows down to 60 px.
  const GAIN = { base: 100, min: 60 };
  let rowWidth = $state(0);
  const px = $derived(stripPx(stripWidth, GAIN, stripSpace(rowWidth, paths), paths.length));
  $effect(() => {
    if (stripWidth.fit && px !== undefined) stripWidth.fitted = Math.round((px * 100) / GAIN.base);
  });
</script>

{#if device}
<div class="view">
  <ChannelPicker {selection} fold width={stripWidth} />
  <div class="strips" style:--strip-w={px === undefined ? undefined : `${px}px`} bind:clientWidth={rowWidth}>
    {#each paths as path, i (path)}
      {@const [side, n] = path.split(".")}
      {@const index = Number(n)}
      {@const channel = side === "inputs" ? device.inputs[index] : device.outputs[index]}
      {#if channel}
        {#if i > 0 && side === "outputs" && paths[i - 1]?.startsWith("inputs.")}
          <SideDivider />
        {/if}
        <Strip {channel} {path} />
      {/if}
    {:else}
      <p class="muted">{t("common.no_channel")}</p>
    {/each}
  </div>
</div>
{/if}

<style>
  /* The page minus the setting row above (as in ParamStrips). Below the minimum height (the
     picker and a strip with its fader at its minimum height), the page scrolls. */
  .view {
    height: calc(100% - 46px);
    min-height: 484px;
    display: flex;
    flex-direction: column;
  }
  .strips {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 6px; /* STRIP_GAP in lib/stripfit.ts */
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding-bottom: 6px;
  }
  /* Phone: the picker folds into a mini button over the strips (ChannelPicker), which then
     start at the top and gain its height. */
  @media (max-width: 699px), (max-height: 499px) {
    .view {
      position: relative;
      min-height: 438px;
    }
  }
  /* Short screen (a phone in landscape): the strips are tighter (LiveStrip, Strip, Fader). */
  @media (max-height: 499px) {
    .view {
      min-height: 260px;
    }
  }
</style>
