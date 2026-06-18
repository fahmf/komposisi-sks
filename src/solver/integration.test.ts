import { describe, expect, it } from 'vitest';
import type { ClassGroup, Teacher } from '../types/model';
import { DEFAULT_PLAN_CONFIG, SEED_CURRICULUM, SEED_SUBJECTS, SUBJECT_IDS } from '../data/seed';
import { buildSlots } from './slots';
import { autoAssign } from './assign';
import { computeTeacherLoads, validatePlan } from './validate';

const config = { ...DEFAULT_PLAN_CONFIG };

// ILP semester 1 subjects (the heaviest term).
const ILP1 = [
  SUBJECT_IDS.fahmulKitabah,
  SUBJECT_IDS.qiraah,
  SUBJECT_IDS.tabir,
  SUBJECT_IDS.qawaidArabiyyah,
  SUBJECT_IDS.hifzh,
  SUBJECT_IDS.tauhid,
];

function cls(id: string, section: 'putra' | 'putri', order: number): ClassGroup {
  return { id, section, level: 'ILP', semester: 1, label: `${section} ${order}`, order };
}

const t = (id: string, gender: 'L' | 'P', maxSks: number): Teacher => ({
  id,
  name: id,
  gender,
  qualifiedSubjectIds: ILP1,
  maxSks,
  active: true,
});

describe('end-to-end distribution with seed curriculum', () => {
  // 2 putra + 1 putri ILP-1 classes. Demand: putra 2*32=64, putri 32.
  const classGroups = [cls('p1', 'putra', 0), cls('p2', 'putra', 1), cls('q1', 'putri', 0)];
  const slots = buildSlots(classGroups, SEED_CURRICULUM, SEED_SUBJECTS);
  const teachers = [
    t('M1', 'L', 24),
    t('M2', 'L', 24),
    t('M3', 'L', 24),
    t('F1', 'P', 18),
    t('F2', 'P', 18),
  ];

  const { assignments } = autoAssign({ slots, teachers, config });
  const report = validatePlan({ slots, assignments, teachers, subjects: SEED_SUBJECTS, classGroups, config });
  const loads = computeTeacherLoads({ slots, assignments, teachers, subjects: SEED_SUBJECTS, classGroups, config });

  it('fills every slot', () => {
    expect(assignments.every((a) => a.teacherId)).toBe(true);
  });

  it('produces no hard errors', () => {
    expect(report.errorCount).toBe(0);
  });

  it('keeps every teacher within their cap', () => {
    for (const tt of teachers) expect(loads.get(tt.id)!.load).toBeLessThanOrEqual(tt.maxSks);
  });

  it('respects gender separation (male only in putra, female only in putri)', () => {
    const bySlot = new Map(assignments.map((a) => [a.slotId, a.teacherId]));
    for (const s of slots) {
      const tid = bySlot.get(s.id)!;
      const teacher = teachers.find((x) => x.id === tid)!;
      expect(teacher.gender).toBe(s.section === 'putra' ? 'L' : 'P');
    }
  });

  it('never assigns the same non-tahfidz subject to a teacher in more than 2 classes', () => {
    for (const tt of teachers) {
      for (const [, classes] of loads.get(tt.id)!.classesPerSubject) {
        expect(classes.size).toBeLessThanOrEqual(config.maxClassesPerSubjectPerTeacher);
      }
    }
  });

  it('distributes load broadly (no idle active teacher when work remains)', () => {
    for (const tt of teachers) expect(loads.get(tt.id)!.load).toBeGreaterThan(0);
  });
});
