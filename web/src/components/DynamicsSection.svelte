<script lang="ts">
  import { t, type TextKey } from "../lib/i18n/index.svelte";
  // Compressor, limiter or noise gate: a ratio choice plus numeric fields.
  import { app } from "../lib/app.svelte";
  import { inStrip } from "../lib/layout";
  import type { Limits } from "../lib/types";
  import Field from "./Field.svelte";
  import Section from "./Section.svelte";

  type Kind = "compressor" | "limiter" | "gate";
  type FieldKey = "threshold_db" | "knee_db" | "attack_ms" | "hold_ms" | "release_ms";

  interface Props {
    kind: Kind;
    path: string;
    /** Current values (Compressor, Limiter or Gate). */
    values: Record<string, number>;
    reduction?: boolean | null; // LIM / COMP activity from the meters, when known
    id?: string;
    title?: string;
  }

  let { kind, path, values, reduction = null, id, title }: Props = $props();

  const TITLES = {
    compressor: "dyn.compressor",
    limiter: "dyn.limiter",
    gate: "dyn.gate",
  } as const satisfies Record<Kind, TextKey>;
  const FIELDS: Record<Kind, FieldKey[]> = {
    compressor: ["threshold_db", "knee_db", "attack_ms", "release_ms"],
    limiter: ["threshold_db", "attack_ms", "release_ms"],
    gate: ["threshold_db", "attack_ms", "hold_ms", "release_ms"],
  };
  const LABELS = {
    threshold_db: "dyn.threshold",
    knee_db: "dyn.knee",
    attack_ms: "dyn.attack",
    hold_ms: "dyn.hold",
    release_ms: "dyn.release",
  } as const satisfies Record<FieldKey, TextKey>;

  const vertical = inStrip();
  const limits = $derived(app.hello?.limits);
  const ratios = $derived(app.hello?.profile.ratios ?? []);
  const editable = $derived(app.editable(kind));

  function range(key: FieldKey, l: Limits): [number, number] {
    if (key === "threshold_db") return kind === "gate" ? l.gate_threshold_db : l.threshold_db;
    if (key === "release_ms") return kind === "gate" ? l.gate_release_ms : l.release_ms;
    if (key === "knee_db") return l.knee_db;
    if (key === "hold_ms") return l.hold_ms;
    return l.attack_ms;
  }

  function set(key: string, value: number) {
    void app.set(`${path}.${kind}`, { [key]: value });
  }
</script>

<Section id={id ?? kind} title={title ?? t(TITLES[kind])} {kind}>
  {#snippet actions()}
    {#if reduction !== null}
      <span class="led" class:on={reduction} title={t("dyn.active")}
        >{kind === "limiter" ? "LIM" : "COMP"}</span
      >
    {/if}
  {/snippet}
  {#if limits}
    {#if kind === "compressor"}
      <div class="bare-ratio">
      <label class="choice">
        <span>{t("dyn.ratio")}</span>
        <select
          aria-label={t("dyn.ratio")}
          value={values.ratio}
          disabled={!editable}
          onchange={(e) => set("ratio", Number((e.currentTarget as HTMLSelectElement).value))}
        >
          {#each ratios as name, i (i)}<option value={i}>{name}</option>{/each}
        </select>
      </label>
      </div>
    {/if}
    <div class:vfields-grid={vertical} class:two-rows={FIELDS[kind].length >= 4}>
    {#each FIELDS[kind] as key (key)}
      {@const [min, max] = range(key, limits)}
      {#if key === "threshold_db"}
        <Field
          label={t(LABELS[key])}
          value={values[key] ?? 0}
          {min}
          {max}
          unit="dBu"
          step={0.5}
          resolution={0.5}
          disabled={!editable}
          onchange={(v) => set(key, v)}
        />
      {:else if key === "knee_db"}
        <Field
          label={t(LABELS[key])}
          value={values[key] ?? 0}
          {min}
          {max}
          unit="dB"
          step={1}
          resolution={1}
          digits={0}
          disabled={!editable}
          onchange={(v) => set(key, v)}
        />
      {:else}
        <Field
          label={t(LABELS[key])}
          value={values[key] ?? min}
          {min}
          {max}
          unit="ms"
          scale="log"
          step={1}
          resolution={1}
          digits={0}
          disabled={!editable}
          onchange={(v) => set(key, v)}
        />
      {/if}
    {/each}
    </div>
  {/if}
</Section>

<style>
  .choice {
    display: grid;
    grid-template-columns: minmax(80px, 120px) 1fr;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .choice select {
    min-height: 36px;
    color: var(--text);
  }
  /* Strips of a width set on a phone (ParamStrips): the select takes what is left. */
  :global(.sized) .choice {
    grid-template-columns: auto minmax(0, 1fr);
  }
  :global(.sized) .choice select {
    grid-column: 2;
    width: 100%;
    min-width: 0;
    padding: 0 2px 0 4px;
  }
  /* A narrow strip: the select alone (its options read "4:1"…), the whole width. */
  :global(.sized) .bare-ratio {
    container-type: inline-size;
  }
  @container (width < 130px) {
    .choice > span {
      display: none;
    }
  }
  .led {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: #0b0c0f;
    color: var(--muted);
  }
  .led.on {
    background: var(--warn);
    color: #000;
  }
</style>
