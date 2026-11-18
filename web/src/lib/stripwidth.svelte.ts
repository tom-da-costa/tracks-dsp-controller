// Width of the strips of the views with one strip per channel (Live, and Params: Gain, Delay,
// Filters, Comp, Limit, Gate), set in the panel of the folded channel picker on a phone and
// remembered in this browser. One setting for all those views, as a percentage of each view's
// usual width (100 % = unset). "Fit" shares the screen's width between the strips shown: each
// view works out its own width (stripPx) and reports it for the slider (fitted).

export const WIDTH_PERCENT = { min: 40, max: 150, step: 5 } as const;

const STORAGE_KEY = "dsp408.strips.width";
const FIT = "fit";

export class StripWidth {
  /** Percentage of the usual width; null = the usual width. */
  percent = $state<number | null>(null);
  fit = $state(false);
  /** The percentage the view shown fits at (for the slider while fitting). */
  fitted = $state<number | null>(null);

  constructor(private readonly storageKey: string) {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === FIT) this.fit = true;
      else if (saved !== null && Number.isFinite(Number(saved)))
        this.percent = clampPercent(Number(saved));
    } catch {
      // not available: unset
    }
  }

  /** The slider's value, %. */
  get shown(): number {
    if (this.fit) return this.fitted ?? 100;
    return this.percent ?? 100;
  }

  set(percent: number): void {
    this.fit = false;
    this.percent = clampPercent(percent);
    this.save();
  }

  /** One step narrower (-1) or wider (+1). */
  nudge(direction: -1 | 1): void {
    this.set(this.shown + direction * WIDTH_PERCENT.step);
  }

  /** Share the screen's width between the strips shown (until the width is set otherwise). */
  fitScreen(): void {
    this.fit = true;
    this.percent = null;
    this.save();
  }

  reset(): void {
    this.fit = false;
    this.percent = null;
    this.save();
  }

  private save(): void {
    try {
      if (this.fit) localStorage.setItem(this.storageKey, FIT);
      else if (this.percent === null) localStorage.removeItem(this.storageKey);
      else localStorage.setItem(this.storageKey, String(this.percent));
    } catch {
      // not persisted: fine
    }
  }
}

function clampPercent(p: number): number {
  const { min, max, step } = WIDTH_PERCENT;
  const snapped = Math.round(p / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/** The setting shared by Live and Params. */
export const stripWidth = new StripWidth(STORAGE_KEY);

/** A view whose strips have a fixed usual width (Live, Params › Gain), px. */
export interface FixedStrips {
  /** Usual width (100 %). */
  base: number;
  /** Narrowest the content allows. */
  min: number;
}

/**
 * Strip width in px for `--strip-w`, or undefined for the usual width. `space` and `count`:
 * the width left for the strips of the row (lib/stripfit) and how many there are.
 */
export function stripPx(
  w: StripWidth,
  view: FixedStrips,
  space: number,
  count: number,
): number | undefined {
  const max = Math.round((view.base * WIDTH_PERCENT.max) / 100);
  if (w.fit) {
    if (count <= 0 || space <= 0) return undefined;
    return Math.min(max, Math.max(view.min, Math.floor(space / count)));
  }
  if (w.percent === null) return undefined;
  return Math.max(view.min, Math.round((view.base * w.percent) / 100));
}
