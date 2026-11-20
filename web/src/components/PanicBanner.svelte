<script lang="ts">
  // Shown to every client after a Mute all, until someone restores the outputs or closes it
  // (both need Control, like any change). Restoring unmutes only the outputs that were on.
  import { app } from "../lib/app.svelte";
  import { i18n, t, th } from "../lib/i18n/index.svelte";

  const panic = $derived(app.panic?.active ? app.panic : null);
  const time = $derived(
    panic?.at === undefined
      ? ""
      : new Date(panic.at * 1000).toLocaleTimeString(i18n.html, {
          hour: "2-digit",
          minute: "2-digit",
        }),
  );
  const several = $derived(app.devices.length > 1);
  /** The DSPs the mute has not reached yet. */
  const issues = $derived(
    (panic?.dsps ?? [])
      .filter((d) => d.status !== "muted")
      .map((d) => {
        const text = t(d.status === "pending" ? "panic.pending" : "panic.failed");
        return several ? `${d.id}: ${text}` : text;
      }),
  );
  const restorable = $derived((panic?.dsps ?? []).some((d) => d.restorable));
  const canChange = $derived(
    app.connected && !app.viewOnly && !app.screenLocked && !app.lockedByOther,
  );
  let busy = $state(false);

  const WHY = {
    offline: "panic.why_offline",
    changed: "panic.why_changed",
    failed: "panic.why_failed",
  } as const;

  async function restore() {
    if (!confirm(t("panic.restore_confirm"))) return;
    busy = true;
    const result = await app.call({ type: "panic.restore" });
    busy = false;
    if (!result.ok) return;
    const skipped = Object.entries(result.dsps ?? {}).filter(([, outcome]) => outcome in WHY);
    if (skipped.length === 0) {
      app.toast(t("panic.restored"));
      return;
    }
    const why = skipped.map(([id, outcome]) => {
      const text = t(WHY[outcome as keyof typeof WHY]);
      return several ? `${id}: ${text}` : text;
    });
    app.toast(t("panic.not_restored", { why: why.join("; ") }), "error");
  }

  async function dismiss() {
    busy = true;
    await app.run({ type: "panic.dismiss" });
    busy = false;
  }
</script>

{#if panic}
  <div class="banner" role="alert">
    <span class="tag" aria-hidden="true">🔇</span>
    <span class="text">
      <span>{@html th("panic.muted_by", { name: panic.by ?? "", time })}</span>
      {#each issues as issue (issue)}<span class="issue">{issue}</span>{/each}
    </span>
    <span class="actions">
      {#if restorable}
        <button
          class="primary"
          onclick={restore}
          disabled={!canChange || busy}
          title={t("panic.restore_title")}>{t("panic.restore")}</button
        >
      {/if}
      <button onclick={dismiss} disabled={!canChange || busy} title={t("panic.dismiss_title")}
        >{t("panic.dismiss")}</button
      >
    </span>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 10px;
    padding: 6px 12px;
    background: color-mix(in srgb, var(--danger) 22%, var(--panel));
    border-bottom: 2px solid var(--danger);
    font-size: 0.9rem;
  }
  .tag {
    font-size: 1.1rem;
  }
  .text {
    flex: 1 1 16rem;
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .text :global(strong) {
    font-weight: 700;
  }
  .issue {
    color: var(--warn);
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  button {
    min-height: 34px;
    padding: 0 10px;
  }
</style>
