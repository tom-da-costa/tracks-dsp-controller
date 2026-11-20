// Mute all (panic, issue #72): the button is off by default; Settings › Display shows it in this
// browser (remembered here). The server mutes every output of every DSP; see server/panic.py.

const STORAGE_KEY = "dsp408.panic.button";

/** How long the button must be held. */
export const PANIC_HOLD_MS = 500;

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

class PanicSettings {
  enabled = $state(load());

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch {
      // not persisted: fine
    }
  }
}

export const panicButton = new PanicSettings();
