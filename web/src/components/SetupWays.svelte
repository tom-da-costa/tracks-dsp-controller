<script lang="ts">
  // Setup wizard, step 2: the ways (the frequency ranges of the system), their names and their
  // order. The main ways go from low to high: the crossovers sit between consecutive ones; the
  // auxiliary ways (monitor, fill…) stay outside. On the plan, each speaker section plays one.
  import {
    addWay,
    CHANNEL_NAME_LENGTH,
    freshWayName,
    moveWay,
    removeWay,
    WAY_SUGGESTIONS,
    wayColor,
    findWay,
    type Way,
  } from "../lib/setup";
  import { wizard } from "../lib/wizard.svelte";

  const draft = $derived(wizard.draft);
  const main = $derived(draft.ways.filter((w) => !w.aux));
  const aux = $derived(draft.ways.filter((w) => w.aux));
  const suggestions = $derived(WAY_SUGGESTIONS.filter((s) => !findWay(draft, s.name)));
  /** Speaker sections that play each way (by id). */
  const sections = $derived.by(() => {
    const count = new Map<number, number>();
    for (const node of draft.speakers)
      for (const s of node.sections) if (s.way !== null) count.set(s.way, (count.get(s.way) ?? 0) + 1);
    return count;
  });

  /** Just after the last main way. */
  const endOfMain = () => draft.ways.reduce((at, w, i) => (w.aux ? at : i + 1), 0);

  function add(name: string, isAux: boolean) {
    const at = isAux ? draft.ways.length : endOfMain();
    addWay(draft, name, at).aux = isAux;
  }
</script>

{#snippet row(way: Way, rank: number, count: number)}
  <div class="row" style:--c={wayColor(way)}>
    <span class="rank">{rank + 1}</span>
    <input
      type="text"
      aria-label="Way name"
      maxlength={CHANNEL_NAME_LENGTH}
      placeholder="Name"
      bind:value={way.name}
    />
    <div class="seg" role="group" aria-label={`Order of ${way.name}`}>
      <button
        aria-label={`${way.name} lower`}
        disabled={rank === 0}
        onclick={() => moveWay(draft, way.id, -1)}>▲</button
      >
      <button
        aria-label={`${way.name} higher`}
        disabled={rank === count - 1}
        onclick={() => moveWay(draft, way.id, 1)}>▼</button
      >
    </div>
    <span class="used">{sections.get(way.id) ?? 0} on the plan</span>
    <button class="remove" aria-label={`Remove ${way.name}`} onclick={() => removeWay(draft, way.id)}
      >✕</button
    >
  </div>
{/snippet}

<section class="card">
  <h2>Ways</h2>
  <p class="muted hint">
    A way is a frequency range of the system (Sub, Mid, High…). The main ways go from the
    lowest to the highest: the crossovers sit between consecutive ones. The auxiliary ways
    (monitor, fill…) stay outside and are filtered to their speakers' range. A way's name is
    the channel name of its outputs ({CHANNEL_NAME_LENGTH} characters, " L" and " R" are added
    for a stereo pair). On the plan, each speaker section plays a way; a library speaker picks
    the one named like it, made if it is not here.
  </p>
  <h3>Main, from low to high</h3>
  {#if main.length}
    <div class="rows">
      {#each main as way, i (way.id)}{@render row(way, i, main.length)}{/each}
    </div>
  {:else}
    <p class="muted note">None yet: add them here, or let the library speakers make theirs on the plan.</p>
  {/if}
  {#if aux.length}
    <h3>Auxiliary</h3>
    <div class="rows">
      {#each aux as way, i (way.id)}{@render row(way, i, aux.length)}{/each}
    </div>
  {/if}
  <div class="add">
    <button onclick={() => add(freshWayName(draft), false)}>+ Main way</button>
    <button onclick={() => add(freshWayName(draft), true)}>+ Auxiliary way</button>
  </div>
  {#if suggestions.length}
    <div class="add">
      <span class="muted">Quick add</span>
      {#each suggestions as s (s.name)}
        <button class="small" onclick={() => add(s.name, s.aux)}>{s.name}{s.aux ? " (aux)" : ""}</button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .hint {
    font-size: 0.85rem;
    margin: 0 0 10px;
  }
  h3 {
    font-size: 0.95rem;
    margin: 12px 0 6px;
  }
  .rows {
    display: grid;
    gap: 6px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding-left: 8px;
    box-shadow: inset 4px 0 0 var(--c);
  }
  .rank {
    width: 1.4em;
    text-align: center;
    font-weight: 700;
    color: var(--c);
  }
  .row input {
    flex: 0 1 14em;
    width: auto;
    min-width: 0;
  }
  .seg button {
    min-width: var(--tap);
  }
  .used {
    font-size: 0.8rem;
    color: var(--muted);
    white-space: nowrap;
  }
  .remove {
    width: var(--tap);
    padding: 0;
    margin-left: auto;
  }
  .note {
    font-size: 0.85rem;
    margin: 0;
  }
  .add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }
  .add span {
    font-size: 0.85rem;
  }
</style>
