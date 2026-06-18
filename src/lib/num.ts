/** Parse an <input type="number"> value into a finite number.
 *  Empty/invalid input resolves to `min` (default 0), and the result is clamped
 *  to [min, max] so config/quantities never go negative or non-finite. */
export function toNum(value: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(n, max));
}
