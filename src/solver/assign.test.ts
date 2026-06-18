import { describe, expect, it } from 'vitest';
import type { ClassGroup, PlanConfig, Subject, Teacher } from '../types/model';
import { DEFAULT_PLAN_CONFIG } from '../data/seed';
import { buildSlots } from './slots';
import { autoAssign } from './assign';
import { computeTeacherLoads, validatePlan } from './validate';

const config: PlanConfig = { ...DEFAULT_PLAN_CONFIG };

const subjects: Subject[] = [
  { id: 'qiraah', name: 'Qiraah', isTahfidz: false },
  { id: 'tauhid', name: 'Tauhid', isTahfidz: false },
  { id: 'hifzh', name: 'Hifzh', isTahfidz: true },
];

const curriculum = [
  { id: 'c1', level: 'ILP' as const, semester: 1 as const, subjectId: 'qiraah', sks: 8 },
  { id: 'c2', level: 'ILP' as const, semester: 1 as const, subjectId: 'tauhid', sks: 2 },
  { id: 'c3', level: 'ILP' as const, semester: 1 as const, subjectId: 'hifzh', sks: 2 },
];

function classes(n: number, section: 'putra' | 'putri' = 'putra'): ClassGroup[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${section}-${i}`,
    section,
    level: 'ILP' as const,
    semester: 1 as const,
    label: `${section} ${i + 1}`,
    order: i,
  }));
}

const teacher = (id: string, gender: 'L' | 'P', subs: string[], maxSks: number): Teacher => ({
  id,
  name: id,
  gender,
  qualifiedSubjectIds: subs,
  maxSks,
  active: true,
});

describe('autoAssign hard constraints', () => {
  it('only assigns gender-matching teachers', () => {
    const cg = classes(2, 'putra');
    const slots = buildSlots(cg, curriculum, subjects);
    const teachers = [
      teacher('m1', 'L', ['qiraah', 'tauhid', 'hifzh'], 32),
      teacher('f1', 'P', ['qiraah', 'tauhid', 'hifzh'], 32),
    ];
    const { assignments } = autoAssign({ slots, teachers, config });
    for (const a of assignments) {
      if (a.teacherId) expect(a.teacherId).toBe('m1'); // female never used in putra classes
    }
  });

  it('never exceeds a teacher maxSks cap', () => {
    const cg = classes(2, 'putra');
    const slots = buildSlots(cg, curriculum, subjects); // 2*(8+2+2)=24 sks demand
    const teachers = [
      teacher('m1', 'L', ['qiraah', 'tauhid', 'hifzh'], 10),
      teacher('m2', 'L', ['qiraah', 'tauhid', 'hifzh'], 10),
      teacher('m3', 'L', ['qiraah', 'tauhid', 'hifzh'], 10),
    ];
    const { assignments } = autoAssign({ slots, teachers, config });
    const loads = computeTeacherLoads({ slots, assignments, teachers, subjects, classGroups: cg, config });
    for (const t of teachers) expect(loads.get(t.id)!.load).toBeLessThanOrEqual(t.maxSks);
  });

  it('respects max 2 classes per subject (non-tahfidz)', () => {
    const cg = classes(3, 'putra');
    const slots = buildSlots(cg, curriculum, subjects);
    const teachers = [teacher('m1', 'L', ['qiraah', 'tauhid', 'hifzh'], 100)];
    const { assignments } = autoAssign({ slots, teachers, config });
    const loads = computeTeacherLoads({ slots, assignments, teachers, subjects, classGroups: cg, config });
    const qiraahClasses = loads.get('m1')!.classesPerSubject.get('qiraah');
    // only 1 teacher exists, so at most 2 qiraah classes can be served; the 3rd stays open
    expect((qiraahClasses?.size ?? 0)).toBeLessThanOrEqual(2);
    const openQiraah = assignments.filter(
      (a) => a.teacherId === null && a.slotId.includes('qiraah'),
    );
    expect(openQiraah.length).toBeGreaterThanOrEqual(1);
  });

  it('exempts tahfidz from the max-2-classes rule', () => {
    const cg = classes(4, 'putra');
    const slots = buildSlots(cg, curriculum, subjects);
    const teachers = [teacher('m1', 'L', ['hifzh'], 100)];
    const { assignments } = autoAssign({ slots, teachers, config });
    const hifzhAssigned = assignments.filter((a) => a.slotId.includes('hifzh') && a.teacherId === 'm1');
    expect(hifzhAssigned.length).toBe(4); // all 4 hifzh classes to one teacher is allowed
  });
});

describe('autoAssign objectives & robustness', () => {
  it('is deterministic across re-runs', () => {
    const cg = classes(3, 'putra');
    const slots = buildSlots(cg, curriculum, subjects);
    const teachers = [
      teacher('m1', 'L', ['qiraah', 'tauhid', 'hifzh'], 32),
      teacher('m2', 'L', ['qiraah', 'tauhid', 'hifzh'], 32),
      teacher('m3', 'L', ['qiraah', 'tauhid', 'hifzh'], 32),
    ];
    const a = autoAssign({ slots, teachers, config }).assignments;
    const b = autoAssign({ slots, teachers, config }).assignments;
    expect(a).toEqual(b);
  });

  it('preserves locked manual assignments', () => {
    const cg = classes(2, 'putra');
    const slots = buildSlots(cg, curriculum, subjects);
    const teachers = [
      teacher('m1', 'L', ['qiraah', 'tauhid', 'hifzh'], 32),
      teacher('m2', 'L', ['qiraah', 'tauhid', 'hifzh'], 32),
    ];
    const lockedSlot = slots.find((s) => s.subjectId === 'qiraah')!;
    const existing = [{ slotId: lockedSlot.id, teacherId: 'm2', locked: true, source: 'manual' as const }];
    const { assignments } = autoAssign({ slots, teachers, config, existing });
    const got = assignments.find((a) => a.slotId === lockedSlot.id)!;
    expect(got.teacherId).toBe('m2');
    expect(got.locked).toBe(true);
  });

  it('flags understaffed subjects instead of throwing', () => {
    const cg = classes(5, 'putra');
    const slots = buildSlots(cg, curriculum, subjects); // 5 qiraah classes
    const teachers = [teacher('m1', 'L', ['qiraah', 'tauhid', 'hifzh'], 100)]; // can cover only 2 qiraah
    const { assignments } = autoAssign({ slots, teachers, config });
    const report = validatePlan({ slots, assignments, teachers, subjects, classGroups: cg, config });
    expect(report.issues.some((i) => i.code === 'SUBJECT_UNDERSTAFFED')).toBe(true);
  });

  it('pushes teachers toward the relaxed 24 SKS target when capacity allows', () => {
    // 4 classes * 12 sks = 48 sks across 2 teachers -> each should land near 24
    const cg = classes(4, 'putra');
    const slots = buildSlots(cg, curriculum, subjects);
    const teachers = [
      teacher('m1', 'L', ['qiraah', 'tauhid', 'hifzh'], 32),
      teacher('m2', 'L', ['qiraah', 'tauhid', 'hifzh'], 32),
    ];
    const { assignments } = autoAssign({ slots, teachers, config });
    const loads = computeTeacherLoads({ slots, assignments, teachers, subjects, classGroups: cg, config });
    for (const t of teachers) expect(loads.get(t.id)!.load).toBeGreaterThanOrEqual(16);
  });
});
