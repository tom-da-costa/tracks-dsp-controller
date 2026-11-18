// Width of the strips of a view with one strip per channel (Live, Params › Gain), set in the
// panel of the folded channel picker on a phone and remembered in this browser, one per view.
// Unset (null), the view keeps its own CSS width. "Fit" shares the screen's width between the
// strips shown: the view measures it (measure()) and the width follows rotations and picks.

export interface WidthRange {
  min: number;
  max: number;
  step: number;
  /** Width shown on the slider while unset (the view's own width), px. */
  default: number;
}

const FIT = "fit";

export class StripWidth {
  value = $state<number | null>(null);
  fit = $state(false);
  /** The width that fits the screen, measured by the view. */
  fitted = $state<number | null>(null);

  constructor(
    private readonly storageKey: string,
    readonly range: WidthRange,
  ) {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === FIT) this.fit = true;
      else if (saved !== null && Number.isFinite(Number(saved)))
        this.value = this.clamp(Number(saved));
    } catch {
      // not available: unset
    }
  }

  /** The width in px: fitted, set, or the view's default. */
  get px(): number {
    if (this.fit && this.fitted !== null) return this.fitted;
    return this.value ?? this.range.default;
  }

  /** CSS value for `--strip-w`, undefined while unset (the view's own width applies). */
  get css(): string | undefined {
    if (this.fit) return this.fitted === null ? undefined : `${this.fitted}px`;
    return this.value === null ? undefined : `${this.value}px`;
  }

  set(px: number): void {
    this.fit = false;
    this.value = this.clamp(px);
    this.save();
  }

  /** One step narrower (-1) or wider (+1). */
  nudge(direction: -1 | 1): void {
    this.set(this.px + direction * this.range.step);
  }

  /** Share the screen's width between the strips shown (until the width is set otherwise). */
  fitScreen(): void {
    this.fit = true;
    this.value = null;
    this.save();
  }

  reset(): void {
    this.fit = false;
    this.value = null;
    this.save();
  }

  /**
   * From the view: `available` px for `count` strips (gaps and dividers already taken off).
   * Below the minimum width the strips still scroll.
   */
  measure(available: number, count: number): void {
    if (count <= 0 || available <= 0) {
      this.fitted = null;
      return;
    }
    const { min, max } = this.range;
    this.fitted = Math.min(max, Math.max(min, Math.floor(available / count)));
  }

  private clamp(px: number): number {
    const { min, max, step } = this.range;
    const snapped = min + Math.round((px - min) / step) * step;
    return Math.min(max, Math.max(min, snapped));
  }

  private save(): void {
    try {
      if (this.fit) localStorage.setItem(this.storageKey, FIT);
      else if (this.value === null) localStorage.removeItem(this.storageKey);
      else localStorage.setItem(this.storageKey, String(this.value));
    } catch {
      // not persisted: fine
    }
  }
}
