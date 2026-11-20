<script lang="ts">
  // Shown to every client once the server was shut down from Settings ("Disconnect from DSP
  // and shutdown"): the app stops trying to reconnect until the page is reloaded.
  import { app } from "../lib/app.svelte";
  import { t } from "../lib/i18n/index.svelte";
</script>

<main>
  <section class="card" role="status">
    <h1>{t("shutdown.title")}</h1>
    <p>{t("shutdown.text", { name: app.shutdownBy || t("shutdown.someone") })}</p>
    <p class="muted">{t("shutdown.restart")}</p>
    <button class="primary" onclick={() => location.reload()}>{t("shutdown.reload")}</button>
  </section>
</main>

<style>
  main {
    min-height: 100%;
    display: grid;
    place-items: center;
    padding: 16px;
    box-sizing: border-box;
  }
  section {
    max-width: 420px;
    display: grid;
    gap: 10px;
  }
  h1 {
    margin: 0;
    font-size: 1.3rem;
  }
  p {
    margin: 0;
  }
</style>
