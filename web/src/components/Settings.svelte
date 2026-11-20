<script lang="ts">
  import { app } from "../lib/app.svelte";
  import { i18n, LANG_NAMES, LANGS, statusText, t, th, type Lang } from "../lib/i18n/index.svelte";
  import { links } from "../lib/links.svelte";
  import {
    METER_MAX_RANGE,
    METER_MIN_RANGE,
    METER_RANGE_STEP,
    METER_SEGMENTS,
    meterRange,
  } from "../lib/meterrange.svelte";
  import { panicButton } from "../lib/panic.svelte";
  import { SIGNAL_DEFAULT_DB, SIGNAL_RANGE_DB, signal } from "../lib/signal.svelte";
  import Stepper from "./Stepper.svelte";

  let rate = $state(app.settings?.meter_rate_hz ?? 5);

  $effect(() => {
    if (app.settings) rate = app.settings.meter_rate_hz;
  });

  const RATE_RANGE = [1, 10] as const;
  const rateLocked = $derived(app.viewOnly || app.lockedByOther || app.screenLocked);

  async function saveRate(hz: number) {
    rate = hz;
    await app.run({ type: "settings.set", meter_rate_hz: hz });
  }

  // Whole dB, with a sign above 0 (formatDb would show −∞ at the gain floor, −60).
  const dbu = (db: number) => `${db > 0 ? "+" : ""}${db} dBu`;

  const otherMaster = $derived(!!app.master?.owner_id && !app.iAmMaster);

  async function toggleMaster() {
    await app.run({ type: app.iAmMaster ? "master.release" : "master.acquire" });
  }

  async function blockLogins(blocked: boolean) {
    await app.run({ type: "logins.block", blocked });
  }

  async function kick(id: string, name: string) {
    if (!confirm(t("settings.kick_confirm", { name }))) return;
    if (await app.run({ type: "client.kick", client_id: id }))
      app.toast(t("settings.kicked", { name }));
  }

  // Same rule as the server: refused while another client has Control or is the master.
  const canShutdown = $derived(
    app.connected && !app.viewOnly && !app.screenLocked && !app.lockedByOther && !otherMaster,
  );

  async function shutdown() {
    if (!confirm(t("settings.shutdown_confirm"))) return;
    await app.run({ type: "server.shutdown" });
  }

  async function refresh() {
    if (await app.run({ type: "resync" })) app.toast(t("settings.refreshed"));
  }
</script>

<div class="grid">
  <section class="card">
    <h2>{t("settings.meters")}</h2>
    <Stepper
      id="meter-rate"
      label={t("settings.refresh_rate")}
      value={rate}
      min={RATE_RANGE[0]}
      max={RATE_RANGE[1]}
      format={(hz) => `${hz} Hz`}
      disabled={rateLocked}
      onchange={saveRate}
    />
    <p class="muted">{t("settings.rate_all")}</p>
    <Stepper
      id="meter-min"
      label={t("settings.scale_bottom")}
      value={meterRange.min}
      min={METER_MIN_RANGE[0]}
      max={METER_MIN_RANGE[1]}
      step={METER_RANGE_STEP}
      format={dbu}
      disabled={app.screenLocked}
      live
      onchange={(db) => meterRange.setMin(db)}
    />
    <Stepper
      id="meter-max"
      label={t("settings.scale_top")}
      value={meterRange.max}
      min={METER_MAX_RANGE[0]}
      max={METER_MAX_RANGE[1]}
      step={METER_RANGE_STEP}
      format={dbu}
      disabled={app.screenLocked}
      live
      onchange={(db) => meterRange.setMax(db)}
    />
    <div class="setting-row">
      <label for="meter-segments">{t("settings.segments")}</label>
      <select
        id="meter-segments"
        value={meterRange.segment}
        disabled={app.screenLocked}
        onchange={(e) => meterRange.setSegment(Number(e.currentTarget.value))}
      >
        {#each METER_SEGMENTS as step (step)}
          <option value={step}>{step ? `${step} dB` : t("settings.continuous")}</option>
        {/each}
      </select>
    </div>
    <p class="muted">
      {t("settings.meters_help")}
      {#if !meterRange.isDefault}
        <button class="link" disabled={app.screenLocked} onclick={() => meterRange.reset()}
          >{t("common.reset")}</button
        >
      {/if}
    </p>
  </section>

  <section class="card">
    <h2>{t("settings.display")}</h2>
    <div class="setting-row">
      <label for="language">{t("common.language")}:</label>
      <select
        id="language"
        value={i18n.lang}
        disabled={app.screenLocked}
        onchange={(e) => i18n.set(e.currentTarget.value as Lang)}
      >
        {#each LANGS as code (code)}<option value={code}>{LANG_NAMES[code]}</option>{/each}
      </select>
    </div>
    <p class="muted">{t("settings.language_help")}</p>
    <label class="check">
      <input
        type="checkbox"
        checked={links.merge}
        disabled={app.screenLocked}
        onchange={(e) => links.setMerge(e.currentTarget.checked)}
      />
      {t("settings.merge")}
    </label>
    <p class="muted">{t("settings.merge_help")}</p>
    <Stepper
      id="signal-threshold"
      label={t("settings.signal")}
      value={signal.threshold}
      min={SIGNAL_RANGE_DB[0]}
      max={SIGNAL_RANGE_DB[1]}
      format={dbu}
      disabled={app.screenLocked}
      live
      onchange={(db) => signal.setThreshold(db)}
    />
    <p class="muted">{t("settings.signal_help", { db: SIGNAL_DEFAULT_DB })}</p>
    {#if !app.viewOnly}
      <label class="check">
        <input
          id="panic-button"
          type="checkbox"
          checked={panicButton.enabled}
          disabled={app.screenLocked}
          onchange={(e) => panicButton.setEnabled(e.currentTarget.checked)}
        />
        {t("settings.panic")}
      </label>
      <p class="muted">{t("settings.panic_help")}</p>
    {/if}
  </section>

  <section class="card">
    <h2>{t("settings.clients", { n: app.clients.length })}</h2>
    <ul class="clients">
      {#each app.clients as client (client.id)}
        <li>
          <span class="who">
            {client.name}
            {#if client.id === app.hello?.client_id}<span class="muted">{t("settings.you")}</span>{/if}
            {#if client.id === app.master?.owner_id}<span class="badge master">{t("settings.badge_master")}</span>{/if}
            {#if client.id === app.lock?.owner_id}<span class="badge">{t("settings.badge_control")}</span>{/if}
            {#if client.read_only}<span class="badge" title={t("settings.badge_read_only_title")}
                >{t("settings.badge_read_only")}</span
              >{/if}
            {#if client.devices.length}
              <span class="muted">· {client.devices.join(", ")}</span>
            {/if}
          </span>
          {#if app.iAmMaster && client.id !== app.hello?.client_id}
            <button
              class="danger small"
              onclick={() => kick(client.id, client.name)}
              disabled={app.screenLocked}>{t("settings.disconnect")}</button
            >
          {/if}
        </li>
      {/each}
    </ul>
    {#if app.hello?.view_pin}
      <p class="muted view-code">
        {@html th("settings.view_code", { code: app.hello.view_pin })}
      </p>
    {/if}
    <h3>{t("settings.master")}</h3>
    <p class="muted">
      {#if app.iAmMaster}
        {t("settings.master_me")}
      {:else if otherMaster}
        {t(app.master?.logins_blocked ? "settings.master_other_blocked" : "settings.master_other", {
          name: app.master?.owner_name ?? "",
        })}
      {:else}
        {t("settings.master_none")}
      {/if}
    </p>
    {#if app.iAmMaster}
      <label class="check">
        <input
          type="checkbox"
          checked={app.master?.logins_blocked ?? false}
          disabled={app.screenLocked}
          onchange={(e) => blockLogins(e.currentTarget.checked)}
        />
        {t("settings.block")}
      </label>
      <p class="muted">{t("settings.block_help")}</p>
    {/if}
    <div class="actions">
      <button
        onclick={toggleMaster}
        disabled={app.viewOnly || otherMaster || app.screenLocked || !app.connected}
      >
        {app.iAmMaster ? t("settings.master_stop") : t("settings.master_become")}
      </button>
    </div>
  </section>

  <section class="card">
    <h2>{t("settings.device")}</h2>
    <dl>
      <dt>DSP</dt>
      <dd>
        {app.deviceId ?? "—"}
        <span class="muted"
          >({app.hello?.demo ? t("settings.demo") : (app.currentDevice?.target ?? "—")})</span
        >
      </dd>
      <dt>{t("settings.status")}</dt>
      <dd>{statusText(app.status?.status)}{app.status?.error ? ` (${app.status.error})` : ""}</dd>
      <dt>{t("settings.model")}</dt>
      <dd>
        {app.status?.model || "—"}
        {#if app.status?.model && app.status.model_tested === false}
          <span class="muted">{t("settings.untested")}</span>
        {/if}
      </dd>
      <dt>{t("settings.firmware")}</dt>
      <dd>{app.status?.firmware || "—"}</dd>
      <dt>{t("settings.server")}</dt>
      <dd>{app.hello?.server_version ?? "—"}</dd>
    </dl>
    <div class="actions">
      <button onclick={refresh} disabled={app.readOnly}>{t("settings.refresh")}</button>
      <button class="danger" onclick={shutdown} disabled={!canShutdown}>
        {t("settings.shutdown")}
      </button>
    </div>
    <p class="muted">
      {t("settings.shutdown_help")}
      {#if app.lockedByOther}{t("settings.shutdown_control", { name: app.lock?.owner_name ?? "" })}
      {:else if otherMaster}{t("settings.shutdown_master", { name: app.master?.owner_name ?? "" })}{/if}
    </p>
  </section>

  <section class="card">
    <h2>{t("settings.browser")}</h2>
    <p>{@html th("settings.connected_as", { name: app.hello?.name ?? app.me?.name ?? "—" })}</p>
    {#if app.viewOnly}
      <p class="muted">{@html th("settings.read_only_note")}</p>
    {/if}
    <div class="actions">
      <button class="danger" onclick={() => app.logout()}>{t("settings.logout")}</button>
    </div>
    <p class="muted">{t("settings.logout_help")}</p>
  </section>
</div>

<style>
  .view-code :global(strong) {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.1em;
    color: var(--text);
  }
  .grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
  label {
    display: grid;
    gap: 8px;
  }
  label.check {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--tap);
  }
  label.check input {
    width: 22px;
    height: 22px;
    margin: 0;
  }
  .setting-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 12px 0 8px;
  }
  .setting-row select {
    flex: 1;
    min-height: var(--tap);
  }
  .link {
    min-height: 0;
    padding: 0 4px;
    border: none;
    background: none;
    color: var(--accent);
    text-decoration: underline;
  }
  ul {
    margin: 0;
    padding-left: 18px;
  }
  .clients {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .clients li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 36px;
  }
  .who {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  button.small {
    min-height: 32px;
    padding: 0 10px;
    font-size: 0.85rem;
  }
  h3 {
    margin: 12px 0 4px;
    font-size: 1rem;
  }
  .badge.master {
    background: var(--info);
  }
  .badge {
    font-size: 0.7rem;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--warn);
    color: #000;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0 0 12px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
