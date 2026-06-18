// Pure class-count calculator: given current enrollment and expected attrition,
// recommend how many classes to open so each lands within [min, max] students.

export interface ClassCountInput {
  enrolledNow: number;
  attritionPct: number; // 0..100
  minPerClass: number; // 30
  maxPerClass: number; // 45
  targetPerClass?: number; // sweet spot, defaults to midpoint
}

export type ScenarioBadge = 'good' | 'warn' | 'bad';

export interface Scenario {
  classes: number;
  avgPerClass: number;
  badge: ScenarioBadge;
}

export interface ClassCountResult {
  projected: number;
  recommended: number;
  avgPerClass: number;
  scenarios: Scenario[];
  warnings: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function badgeFor(avg: number, min: number, max: number): ScenarioBadge {
  if (avg >= min && avg <= max) return 'good';
  const lo = min * 0.9;
  const hi = max * 1.1;
  if (avg >= lo && avg <= hi) return 'warn';
  return 'bad';
}

export function recommendClassCount(input: ClassCountInput): ClassCountResult {
  const { enrolledNow, attritionPct, minPerClass, maxPerClass } = input;
  const target = input.targetPerClass ?? Math.round((minPerClass + maxPerClass) / 2);
  const warnings: string[] = [];

  const projected = Math.max(0, Math.round(enrolledNow * (1 - attritionPct / 100)));

  if (projected === 0) {
    return { projected: 0, recommended: 0, avgPerClass: 0, scenarios: [], warnings: ['Belum ada mahasiswa.'] };
  }

  // fewest classes so none exceeds max; most classes so none drops below min
  const classesFloor = Math.ceil(projected / maxPerClass);
  const classesCeil = Math.max(1, Math.floor(projected / minPerClass));

  let recommended: number;
  if (classesFloor > classesCeil) {
    // The 30–45 window can't be satisfied by any class count.
    warnings.push(
      `Jumlah ${projected} mahasiswa tidak bisa dibagi agar setiap kelas pas di rentang ${minPerClass}–${maxPerClass}. Pilih jumlah kelas terbaik secara manual.`,
    );
    recommended = clamp(Math.round(projected / target), 1, classesFloor);
  } else {
    recommended = clamp(Math.round(projected / target), classesFloor, classesCeil);
  }
  recommended = Math.max(1, recommended);

  const avgPerClass = projected / recommended;
  if (avgPerClass < minPerClass) {
    warnings.push(`Rata-rata ${avgPerClass.toFixed(1)} mahasiswa/kelas di bawah minimum ${minPerClass}.`);
  }
  if (avgPerClass > maxPerClass) {
    warnings.push(`Rata-rata ${avgPerClass.toFixed(1)} mahasiswa/kelas di atas maksimum ${maxPerClass}.`);
  }

  const candidates = [recommended - 1, recommended, recommended + 1].filter((n) => n >= 1);
  const scenarios: Scenario[] = candidates.map((classes) => {
    const avg = projected / classes;
    return { classes, avgPerClass: avg, badge: badgeFor(avg, minPerClass, maxPerClass) };
  });

  return { projected, recommended, avgPerClass, scenarios, warnings };
}
