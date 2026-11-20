<script lang="ts">
  // Mute all (issue #72), pinned to the bottom of the tab rail when Settings › Display shows
  // it: held for half a second (a bar fills up; letting go earlier does nothing), it mutes
  // every output of every DSP. Works without Control and behind the screen lock: safety first.
  import { app } from "../lib/app.svelte";
  import { t } from "../lib/i18n/index.svelte";
  import { PANIC_HOLD_MS } from "../lib/panic.svelte";

  let { expanded }: { expanded: boolean } = $props();

  let holding = $state(false);
  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function begin() {
    cancel();
    holding = true;
    timer = setTimeout(fire, PANIC_HOLD_MS);
  }

  function cancel() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    holding = false;
  }

  async function fire() {
    timer = null;
    holding = false;
    busy = true;
    navigator.vibrate?.(80);
    const result = await app.call({ type: "panic" });
    busy = false;
    if (result.ok) app.toast(t("panic.done"));
  }

  function pointerdown(e: PointerEvent) {
    if (e.button !== 0 || busy) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    begin();
  }

  const isKey = (e: KeyboardEvent) => e.key === "Enter" || e.key === " ";

  function keydown(e: KeyboardEvent) {
    if (!isKey(e)) return;
    e.preventDefault();
    if (!e.repeat && !busy) begin();
  }

  function keyup(e: KeyboardEvent) {
    if (isKey(e)) cancel();
  }
</script>

<button
  class="panic"
  class:holding
  class:expanded
  disabled={!app.connected || busy}
  style="--hold: {PANIC_HOLD_MS}ms"
  title={t("panic.title")}
  onpointerdown={pointerdown}
  onpointerup={cancel}
  onpointercancel={cancel}
  onlostpointercapture={cancel}
  onkeydown={keydown}
  onkeyup={keyup}
  onblur={cancel}
  oncontextmenu={(e) => e.preventDefault()}
>
  <span class="icon" aria-hidden="true">🔇</span>
  <span class="text">{t("panic.button")}<small>{t("panic.hold")}</small></span>
</button>

<style>
  .panic {
    position: sticky; /* at the bottom of the rail, even when it scrolls */
    bottom: 4px;
    flex: none;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    margin: 4px 6px;
    padding: 0 6px;
    border: 2px solid var(--danger);
    border-radius: 8px;
    background: var(--panel);
    box-shadow: 0 6px 0 4px var(--panel); /* hides what scrolls under it */
    color: var(--danger);
    text-align: left;
    white-space: nowrap;
    min-width: 0;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  /* The hold: a bar fills the button; letting go earlier empties it at once. */
  .panic::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--danger);
    transform: scaleX(0);
    transform-origin: left;
  }
  .panic.holding::before {
    transform: scaleX(1);
    transition: transform var(--hold) linear;
  }
  .panic.holding {
    color: #fff;
  }
  .icon,
  .text {
    position: relative; /* above the bar */
  }
  .icon {
    flex: 0 0 28px;
    display: grid;
    justify-items: center;
    font-size: 1.15rem;
    line-height: 1;
  }
  .text {
    display: grid;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 700;
    line-height: 1.15;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .text small {
    font-size: 0.7rem;
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .expanded .text {
    opacity: 1;
  }
</style>
