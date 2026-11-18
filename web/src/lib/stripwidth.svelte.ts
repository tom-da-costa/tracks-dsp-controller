// Width of the strips of a view with one strip per channel (Live, Params › Gain), set in the
// panel of the folded channel picker on a phone and remembered in this browser, one per view.
// Unset (null), the view keeps its own CSS width.

export interface WidthRange {
  min: number;
  max: number;
  step: number;
  /** Width shown on the slider while unset (the view's own width), px. */
  default: number;
}

export class StripWidth {
  value = $state<number | null>(null);

  constructor(
    private readonly storageKey: string,
    readonly range: WidthRange,
  ) {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null && Number.isFinite(Number(saved))) this.value = this.clamp(Number(saved));
    } catch {
      // not available: unset
    }
  }

  /** The width in px, the view's default while unset. */
  get px(): number {
    return this.value ?? this.range.default;
  }

  /** CSS value for `--strip-w`, undefined while unset (the view's own width applies). */
  get css(): string | undefined {
    return this.value === null ? undefined : `${this.value}px`;
  }

  set(px: number): void {
    this.value = this.clamp(px);
    this.save();
  }

  /** One step narrower (-1) or wider (+1). */
  nudge(direction: -1 | 1): void {
    this.set(this.px + direction * this.range.step);
  }

  reset(): void {
    this.value = null;
    this.save();
  }

  private clamp(px: number): number {
    const { min, max, step } = this.range;
    const snapped = min + Math.round((px - min) / step) * step;
    return Math.min(max, Math.max(min, snapped));
  }

  private save(): void {
    try {
      if (this.value === null) localStorage.removeItem(this.storageKey);
      else localStorage.setItem(this.storageKey, String(this.value));
    } catch {
      // not persisted: fine
    }
  }
}
