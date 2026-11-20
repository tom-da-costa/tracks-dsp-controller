<script lang="ts">
  import { t, th } from "../lib/i18n/index.svelte";
  // "Limiter" tab: compute the compressor / limiter thresholds that protect a speaker, from the
  // amp gain, the speaker power, the load and impedance (Hornplans method), then apply them.
  import { app } from "../lib/app.svelte";
  import { links } from "../lib/links.svelte";
  import {
    APPLIED,
    computeLimiter,
    LIMITER_ABOVE_COMP_DB,
    type LimiterInput,
    type Load,
    type Mode,
    type Rounding,
    validate,
  } from "../lib/limiter";
  import { formatDb } from "../lib/scale";

  const STORAGE_KEY = "dsp408.limiter.calc";

  interface Form {
    speakerAesW: string;
    impedanceOhm: string;
    ampGainDb: string;
    ampPowerW: string;
    load: Load;
    mode: Mode;
    rounding: Rounding;
  }

  function load(): Form {
    const fallback: Form = {
      speakerAesW: "",
      impedanceOhm: "8",
      ampGainDb: "",
      ampPowerW: "",
      load: "open",
      mode: "hard",
      rounding: "down",
    };
    try {
      return { ...fallback, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Form) };
    } catch {
      return fallback;
    }
  }

  let form = $state<Form>(load());
  $effect(() => {
    const snapshot = JSON.stringify(form);
    try {
      localStorage.setItem(STORAGE_KEY, snapshot);
    } catch {
      // not persisted: fine
    }
  });

  const num = (text: string) => (text.trim() === "" ? NaN : Number(text.replace(",", ".")));

  const input = $derived<LimiterInput>({
    speakerAesW: num(form.speakerAesW),
    impedanceOhm: num(form.impedanceOhm),
    ampGainDb: num(form.ampGainDb),
    ampPowerW: form.ampPowerW.trim() === "" ? null : num(form.ampPowerW),
    load: form.load,
    mode: form.mode,
    rounding: form.rounding,
  });
  const error = $derived(validate(input));
  const result = $derived(error ? null : computeLimiter(input));

  // --- applying ------------------------------------------------------------------------------
  const outputs = $derived(app.device?.outputs ?? []);
  const limitRatio = $derived(
    Math.max(0, (app.hello?.profile.ratios ?? []).findIndex((r) => /limit/i.test(r))),
  );
  const editable = $derived(app.editable("compressor") && app.editable("limiter"));
  let selected = $state<number[]>([]);
  let confirming = $state(false);
  let busy = $state(false);

  function toggle(i: number) {
    confirming = false;
    selected = selected.includes(i) ? selected.filter((n) => n !== i) : [...selected, i].sort();
  }

  async function apply() {
    if (!result) return;
    busy = true;
    let ok = true;
    for (const i of selected) {
      ok =
        (await app.set(`outputs.${i}.compressor`, {
          ...APPLIED.compressor,
          ratio: limitRatio,
          threshold_db: result.compThresholdDbu,
        })) && ok;
      ok =
        (await app.set(`outputs.${i}.limiter`, {
          ...APPLIED.limiter,
          threshold_db: result.limitThresholdDbu,
        })) && ok;
    }
    busy = false;
    confirming = false;
    if (ok) {
      app.toast(
        t("lim.applied", { slots: selected.map((i) => links.slot(`outputs.${i}`)).join(", ") }),
      );
      selected = [];
    }
  }

  const dbu = (v: number) => `${formatDb(v)} dBu`;
</script>

<div class="calc">
  <section class="card">
    <h2>{t("lim.title")}</h2>
    <div class="fields">
      <label>
        <span>{t("lim.amp_gain")}</span>
        <input type="text" inputmode="decimal" bind:value={form.ampGainDb} placeholder="32" />
        <small>dB</small>
      </label>
      <label>
        <span>{t("lim.speaker_power")}</span>
        <input type="text" inputmode="decimal" bind:value={form.speakerAesW} placeholder="1600" />
        <small>W AES</small>
      </label>
      <label>
        <span>{t("lim.impedance")}</span>
        <input type="text" inputmode="decimal" bind:value={form.impedanceOhm} placeholder="8" />
        <small>Ω</small>
      </label>
      <label>
        <span>{t("lim.amp_power")} <em>{t("common.optional")}</em></span>
        <input type="text" inputmode="decimal" bind:value={form.ampPowerW} placeholder="—" />
        <small>W RMS</small>
      </label>
    </div>
    <p class="hint muted">{t("lim.totals")}</p>

    <fieldset>
      <legend>{t("lim.load")}</legend>
      <label class="choice"
        ><input type="radio" bind:group={form.load} value="open" /> {t("lim.open")}
        <small>{t("lim.open_help")}</small></label
      >
      <label class="choice"
        ><input type="radio" bind:group={form.load} value="closed" /> {t("lim.closed")}
        <small>{t("lim.closed_help")}</small></label
      >
    </fieldset>
    <fieldset>
      <legend>{t("lim.limiter")}</legend>
      <label class="choice"
        ><input type="radio" bind:group={form.mode} value="hard" /> {t("lim.hard")}
        <small>{t("lim.hard_help")}</small></label
      >
      <label class="choice"
        ><input type="radio" bind:group={form.mode} value="soft" /> {t("lim.soft")}
        <small>{t("lim.soft_help")}</small></label
      >
    </fieldset>
    <fieldset>
      <legend>{t("lim.rounding")}</legend>
      <label class="choice"
        ><input type="radio" bind:group={form.rounding} value="down" /> {t("lim.down")}
        <small>{t("lim.down_help")}</small></label
      >
      <label class="choice"
        ><input type="radio" bind:group={form.rounding} value="up" /> {t("lim.up")}
        <small>{t("lim.up_help")}</small></label
      >
    </fieldset>
  </section>

  <section class="card result">
    <h2>{t("lim.result")}</h2>
    {#if error || !result}
      <p class="muted">{error}</p>
    {:else}
      <dl>
        <dt>{t("lim.speaker_limit")}</dt>
        <dd class:lowest={result.limitedBy === "speaker"}>{dbu(result.speakerDbu)}</dd>
        {#if result.ampDbu !== null}
          <dt>{t("lim.amp_limit")}</dt>
          <dd class:lowest={result.limitedBy === "amp"}>{dbu(result.ampDbu)}</dd>
        {/if}
        <dt>{t("lim.hard_threshold")}</dt>
        <dd>{dbu(result.hornplansDbu)}</dd>
        {#if form.mode === "soft"}
          <dt>{t("lim.soft_threshold", { db: result.extraDb })}</dt>
          <dd>{dbu(result.thresholdDbu)}</dd>
        {/if}
        <dt>{result.rounding === "up" ? t("lim.step_up") : t("lim.step_down")}</dt>
        <dd>{dbu(result.compThresholdDbu)}</dd>
      </dl>
      <div class="big">
        <div>
          <span>{t("lim.compressor")}</span>
          <strong>{dbu(result.compThresholdDbu)}</strong>
          <small>{t("lim.comp_settings")}</small>
        </div>
        <div>
          <span>{t("lim.limiter")}</span>
          <strong>{dbu(result.limitThresholdDbu)}</strong>
          <small>{t("lim.limiter_settings", { db: LIMITER_ABOVE_COMP_DB })}</small>
        </div>
      </div>
      {#if result.clamped}
        <p class="warn">{t("lim.clamped")}</p>
      {/if}

      <h3>{t("lim.apply_to")}</h3>
      <div class="chips" role="group" aria-label={t("lim.outputs")}>
        {#each outputs as ch, i (i)}
          <!-- One chip per link group when merging: the DSP applies the change to the group. -->
          {#if links.isShown(`outputs.${i}`)}
          <button
            class="ch-bar"
            style:--ch={app.color(`outputs.${i}`)}
            class:on={selected.includes(i)}
            aria-pressed={selected.includes(i)}
            disabled={!editable || busy}
            onclick={() => toggle(i)}
          >
            <span>{links.slot(`outputs.${i}`)}{links.mark(`outputs.${i}`)}</span>
            <small>{links.name(`outputs.${i}`)}</small>
            <small class="now"
              >C {formatDb(ch.compressor.threshold_db)} · L {formatDb(ch.limiter.threshold_db)}</small
            >
          </button>
          {/if}
        {/each}
      </div>
      {#if confirming}
        <div class="confirm">
          <p>
            {@html th("lim.confirm", {
              slots: selected.map((i) => links.slot(`outputs.${i}`)).join(", "),
              comp: dbu(result.compThresholdDbu),
              limit: dbu(result.limitThresholdDbu),
            })}
          </p>
          <div class="actions">
            <button class="primary" disabled={busy} onclick={apply}>{t("lim.apply")}</button>
            <button disabled={busy} onclick={() => (confirming = false)}>{t("common.cancel")}</button>
          </div>
        </div>
      {:else}
        <div class="actions">
          <button
            class="primary"
            disabled={!editable || busy || selected.length === 0}
            onclick={() => (confirming = true)}>{t("lim.apply_selected")}</button
          >
        </div>
      {/if}
    {/if}
  </section>

  <p class="muted hint source">{t("lim.source")}</p>
</div>

<style>
  .calc {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 10px;
    align-items: start;
  }
  .fields {
    display: grid;
    gap: 8px;
  }
  .fields label {
    display: grid;
    grid-template-columns: 1fr 7em 3.6em;
    align-items: center;
    gap: 8px;
  }
  .fields em {
    color: var(--muted);
    font-style: normal;
    font-size: 0.8rem;
  }
  .fields input {
    text-align: right;
  }
  small {
    color: var(--muted);
    font-size: 0.75rem;
  }
  .hint {
    font-size: 0.8rem;
    margin: 10px 0;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: 8px;
    margin: 8px 0 0;
    padding: 6px 10px 8px;
  }
  legend {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .choice {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
  }
  .choice input {
    flex: none; /* a long description must not shrink the radio */
    width: 20px;
    height: 20px;
  }
  dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    margin: 0 0 12px;
    font-variant-numeric: tabular-nums;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    text-align: right;
  }
  dd.lowest {
    color: var(--accent);
    font-weight: 700;
  }
  .big {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .big div {
    display: grid;
    gap: 2px;
    padding: 10px;
    border-radius: 8px;
    background: var(--panel-2);
  }
  .big strong {
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
  }
  .warn {
    color: var(--warn);
  }
  h3 {
    font-size: 1rem;
    margin: 16px 0 8px;
  }
  .chips {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .chips button {
    display: grid;
    padding: 6px 4px;
    line-height: 1.15;
    min-width: 0;
  }
  .chips small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chips .now {
    font-size: 0.65rem;
  }
  .chips .ch-bar:not(.on) {
    border-color: color-mix(in srgb, var(--ch) 60%, var(--line));
  }
  .chips .ch-bar span,
  .chips .ch-bar small:not(.now) {
    color: var(--ch);
  }
  .chips .on {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    background: color-mix(in srgb, var(--accent) 18%, var(--panel-2));
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .confirm {
    margin-top: 10px;
    padding: 10px;
    border-radius: 8px;
    background: var(--panel-2);
    border: 1px solid var(--warn);
  }
  .confirm p {
    margin: 0;
    font-size: 0.9rem;
  }
  .source {
    grid-column: 1 / -1;
  }
</style>
