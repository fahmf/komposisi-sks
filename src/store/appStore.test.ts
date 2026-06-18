import { beforeAll, describe, expect, it } from 'vitest';
import { SUBJECT_IDS } from '../data/seed';

// The store is a module singleton that reads localStorage on import (persist
// middleware), so polyfill a memory storage before importing it.
beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

const ILP1 = [
  SUBJECT_IDS.fahmulKitabah,
  SUBJECT_IDS.qiraah,
  SUBJECT_IDS.tabir,
  SUBJECT_IDS.qawaidArabiyyah,
  SUBJECT_IDS.hifzh,
  SUBJECT_IDS.tauhid,
];

describe('appStore end-to-end actions (UI logic)', () => {
  it('seeds curriculum and one active plan', async () => {
    const { useStore } = await import('./appStore');
    const s = useStore.getState();
    expect(s.subjects.length).toBe(15);
    expect(s.masterCurriculum.length).toBe(31); // 6 + 7 + 8 + 10
    expect(s.plans.length).toBe(1);
    expect(s.activePlanId).toBe(s.plans[0].id);
  });

  it('runs the full flow: teachers -> classes -> auto-assign', async () => {
    const { useStore } = await import('./appStore');
    const st = useStore.getState();

    // One specialist per ILP-1 subject per section, so 2 putra + 1 putri classes are
    // fully staffable under the one-subject-per-class rule (12 teachers total).
    ILP1.forEach((s, i) => st.addTeacher({ name: `Ustadz ${i}`, gender: 'L', qualifiedKeys: [`ILP:${s}`], maxSks: 24, active: true }));
    ILP1.forEach((s, i) => st.addTeacher({ name: `Ustadzah ${i}`, gender: 'P', qualifiedKeys: [`ILP:${s}`], maxSks: 18, active: true }));

    useStore.getState().setClassCount('putra', 'ILP', 1, 2);
    useStore.getState().setClassCount('putri', 'ILP', 1, 1);

    let plan = useStore.getState().plans.find((p) => p.id === useStore.getState().activePlanId)!;
    expect(plan.classGroups.length).toBe(3);
    expect(plan.slots.length).toBe(18); // 3 classes * 6 subjects
    expect(plan.assignments.every((a) => a.teacherId === null)).toBe(true);

    useStore.getState().runAutoAssign();
    plan = useStore.getState().plans.find((p) => p.id === useStore.getState().activePlanId)!;
    expect(plan.assignments.every((a) => a.teacherId)).toBe(true);
  });

  it('locks a manual edit and preserves it on re-run', async () => {
    const { useStore } = await import('./appStore');
    const plan = useStore.getState().plans.find((p) => p.id === useStore.getState().activePlanId)!;
    const slot = plan.slots[0];
    const someTeacher = useStore.getState().teachers.find((t) => t.gender === (slot.section === 'putra' ? 'L' : 'P'))!;
    useStore.getState().setAssignment(slot.id, someTeacher.id);
    useStore.getState().runAutoAssign();
    const after = useStore.getState().plans.find((p) => p.id === useStore.getState().activePlanId)!;
    const a = after.assignments.find((x) => x.slotId === slot.id)!;
    expect(a.teacherId).toBe(someTeacher.id);
    expect(a.locked).toBe(true);
  });

  it('migrates v1 data to v2 (expands qualifications per jenjang, adds slot level)', async () => {
    const { migrateAppState } = await import('./appStore');
    const v1 = {
      schemaVersion: 1,
      subjects: [{ id: 'qiraah', name: 'Qiraah', isTahfidz: false }],
      masterCurriculum: [
        { id: 'c1', level: 'ILP', semester: 1, subjectId: 'qiraah', sks: 8 },
        { id: 'c2', level: 'ILL', semester: 1, subjectId: 'qiraah', sks: 6 },
      ],
      teachers: [{ id: 't1', name: 'T', gender: 'L', qualifiedSubjectIds: ['qiraah'], maxSks: 24, active: true }],
      plans: [
        {
          id: 'p1',
          name: 'x',
          createdAt: '',
          updatedAt: '',
          classGroups: [{ id: 'g1', section: 'putra', level: 'ILP', semester: 1, label: 'A', order: 0 }],
          curriculum: [{ id: 'c1', level: 'ILP', semester: 1, subjectId: 'qiraah', sks: 8 }],
          slots: [{ id: 'g1__qiraah', classGroupId: 'g1', subjectId: 'qiraah', sks: 8, isTahfidz: false, section: 'putra' }],
          assignments: [{ slotId: 'g1__qiraah', teacherId: 't1', locked: true, source: 'manual' }],
          config: {},
        },
      ],
      activePlanId: 'p1',
      ui: { theme: 'light' },
    };
    const m = migrateAppState(v1);
    expect(m.schemaVersion).toBe(2);
    expect([...m.teachers[0].qualifiedKeys].sort()).toEqual(['ILL:qiraah', 'ILP:qiraah']);
    expect(m.teachers[0].qualifiedSubjectIds).toBeUndefined();
    expect(m.plans[0].slots[0].level).toBe('ILP');
    expect(m.plans[0].assignments[0].teacherId).toBe('t1'); // preserved by slotId
  });

  it('round-trips through JSON export/import', async () => {
    const { useStore } = await import('./appStore');
    const json = useStore.getState().exportJSON();
    useStore.getState().resetAll();
    expect(useStore.getState().teachers.length).toBe(0);
    const res = useStore.getState().importJSON(json);
    expect(res.ok).toBe(true);
    expect(useStore.getState().teachers.length).toBe(12);
  });
});
