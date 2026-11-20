<script lang="ts">
  import { LoginError } from "../lib/api";
  import { app } from "../lib/app.svelte";
  import { i18n, LANG_NAMES, LANGS, t, type Lang } from "../lib/i18n/index.svelte";

  let pin = $state("");
  let name = $state(localStorageGet("dsp408.name"));
  // The failed login, in words when shown (follows a change of language).
  let failure = $state<LoginError | "unreachable" | null>(null);
  const error = $derived(
    failure === null
      ? ""
      : failure === "unreachable"
        ? t("error.unreachable")
        : app.errorText({ error: failure.code, message: failure.message, owner: failure.owner }),
  );
  // Why the login is shown: "Disconnected by <master>" when kicked (the server's close reason).
  const notice = $derived.by(() => {
    const kicked = /^Disconnected by (.+)$/.exec(app.loginNotice);
    return kicked ? t("login.kicked", { name: kicked[1] ?? "" }) : app.loginNotice;
  });
  let busy = $state(false);

  function localStorageGet(key: string): string {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    failure = null;
    app.loginNotice = "";
    try {
      try {
        localStorage.setItem("dsp408.name", name);
      } catch {
        /* private mode: the name is just not remembered */
      }
      await app.login(pin, name.trim());
    } catch (exc) {
      failure = exc instanceof LoginError ? exc : "unreachable";
      pin = "";
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <form class="card" onsubmit={submit}>
    <h1>t.racks DSP controller</h1>
    <label class="lang">
      <span class="muted">{t("common.language")}</span>
      <select value={i18n.lang} onchange={(e) => i18n.set(e.currentTarget.value as Lang)}>
        {#each LANGS as code (code)}<option value={code}>{LANG_NAMES[code]}</option>{/each}
      </select>
    </label>
    <label>
      {t("login.code")}
      <input
        type="password"
        inputmode="numeric"
        autocomplete="current-password"
        bind:value={pin}
        required
      />
    </label>
    <label>
      <span>{t("login.name")} <span class="muted">{t("common.optional")}</span></span>
      <input type="text" maxlength="32" placeholder={t("login.name_placeholder")} bind:value={name} />
    </label>
    {#if notice}<p class="notice" role="status">{notice}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="primary" type="submit" disabled={busy || !pin}>{t("login.connect")}</button>
  </form>
</main>

<style>
  .notice {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--warn) 18%, var(--panel));
    border-left: 3px solid var(--warn);
  }
  main {
    min-height: 100%;
    display: grid;
    place-items: center;
    padding: 16px;
  }
  form {
    width: min(360px, 100%);
    display: grid;
    gap: 14px;
  }
  h1 {
    margin: 0;
    font-size: 1.4rem;
  }
  label {
    display: grid;
    gap: 6px;
  }
  .lang {
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 10px;
  }
  .error {
    color: var(--danger);
    margin: 0;
  }
</style>
