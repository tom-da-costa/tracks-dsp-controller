// The width left for the strips of a row (Live, Params › Gain) once the gaps between them and
// the IN | OUT divider are taken off, for StripWidth.measure().

/** `.strips` gap between items, px (LiveView, Mixer). */
export const STRIP_GAP = 6;
/** SideDivider: 24 px wide plus 4 px margins. */
export const DIVIDER_WIDTH = 32;

/** Width for the strips of `paths` (inputs then outputs) in a row `rowWidth` px wide. */
export function stripSpace(rowWidth: number, paths: readonly string[]): number {
  const divider =
    paths.some((p) => p.startsWith("inputs.")) && paths.some((p) => p.startsWith("outputs."))
      ? 1
      : 0;
  const items = paths.length + divider;
  return rowWidth - STRIP_GAP * Math.max(0, items - 1) - DIVIDER_WIDTH * divider;
}
