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

    for (const id of ['A', 'B', 'C']) st.addTeacher({ name: `Ustadz ${id}`, gender: 'L', qualifiedSubjectIds: ILP1, maxSks: 24, active: true });
    for (const id of ['X', 'Y']) st.addTeacher({ name: `Ustadzah ${id}`, gender: 'P', qualifiedSubjectIds: ILP1, maxSks: 18, active: true });

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

  it('round-trips through JSON export/import', async () => {
    const { useStore } = await import('./appStore');
    const json = useStore.getState().exportJSON();
    useStore.getState().resetAll();
    expect(useStore.getState().teachers.length).toBe(0);
    const res = useStore.getState().importJSON(json);
    expect(res.ok).toBe(true);
    expect(useStore.getState().teachers.length).toBe(5);
  });
});
