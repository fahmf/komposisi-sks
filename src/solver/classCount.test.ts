import { describe, expect, it } from 'vitest';
import { recommendClassCount } from './classCount';

const base = { minPerClass: 30, maxPerClass: 45 };

describe('recommendClassCount', () => {
  it('splits a normal cohort within the window', () => {
    const r = recommendClassCount({ enrolledNow: 80, attritionPct: 0, ...base });
    expect(r.projected).toBe(80);
    expect(r.recommended).toBe(2);
    expect(r.avgPerClass).toBeCloseTo(40);
    expect(r.warnings).toHaveLength(0);
  });

  it('applies attrition before sizing', () => {
    const r = recommendClassCount({ enrolledNow: 100, attritionPct: 20, ...base });
    expect(r.projected).toBe(80);
    expect(r.recommended).toBe(2);
  });

  it('keeps a single class and warns when below minimum', () => {
    const r = recommendClassCount({ enrolledNow: 22, attritionPct: 0, ...base });
    expect(r.recommended).toBe(1);
    expect(r.warnings.join(' ')).toMatch(/di bawah minimum/);
  });

  it('flags an unsatisfiable window', () => {
    // 58 -> floor=ceil(58/45)=2 needs 29/class (<30); ceil=floor(58/30)=1 needs 58 (>45)
    const r = recommendClassCount({ enrolledNow: 58, attritionPct: 0, ...base });
    expect(r.warnings.join(' ')).toMatch(/tidak bisa dibagi/);
  });

  it('produces a 3-row scenario table with badges', () => {
    const r = recommendClassCount({ enrolledNow: 120, attritionPct: 0, ...base });
    expect(r.scenarios.length).toBeGreaterThanOrEqual(2);
    expect(r.scenarios.some((s) => s.badge === 'good')).toBe(true);
  });

  it('handles empty cohort', () => {
    const r = recommendClassCount({ enrolledNow: 0, attritionPct: 10, ...base });
    expect(r.recommended).toBe(0);
  });

  it('never returns a non-finite class count for degenerate (0) bounds', () => {
    // Used to cascade into Infinity classes and freeze the tab when materialised.
    const r = recommendClassCount({ enrolledNow: 80, attritionPct: 0, minPerClass: 0, maxPerClass: 0 });
    expect(Number.isFinite(r.recommended)).toBe(true);
    expect(r.recommended).toBeGreaterThanOrEqual(1);
    for (const sc of r.scenarios) expect(Number.isFinite(sc.classes)).toBe(true);
  });
});
