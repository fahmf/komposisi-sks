import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  AppState,
  ClassGroup,
  CurriculumEntry,
  Level,
  PlanConfig,
  Section,
  SemesterNo,
  SemesterPlan,
  Subject,
  Teacher,
} from '../types/model';
import { SECTION_LABELS } from '../types/model';
import { DEFAULT_PLAN_CONFIG, SEED_CURRICULUM, SEED_SUBJECTS } from '../data/seed';
import { buildSlots } from '../solver/slots';
import { autoAssign } from '../solver/assign';
import { appStateSchema, SCHEMA_VERSION } from './schema';

// ---------- helpers ----------

const now = () => new Date().toISOString();

export function letterLabel(i: number): string {
  let s = '';
  i += 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

const groupKey = (s: Section, l: Level, sem: SemesterNo) => `${s}|${l}|${sem}`;

function classLabel(section: Section, level: Level, sem: SemesterNo, index: number): string {
  return `${SECTION_LABELS[section]} ${level}-${sem} ${letterLabel(index)}`;
}

function makePlan(name: string, master: CurriculumEntry[], config: PlanConfig): SemesterPlan {
  const t = now();
  return {
    id: nanoid(),
    name,
    createdAt: t,
    updatedAt: t,
    classGroups: [],
    curriculum: master.map((c) => ({ ...c })),
    slots: [],
    assignments: [],
    config: structuredClone(config),
  };
}

/** Rebuild slots from classes×curriculum and keep assignments for surviving slots. */
function reconcile(plan: SemesterPlan, subjects: Subject[]): SemesterPlan {
  const slots = buildSlots(plan.classGroups, plan.curriculum, subjects);
  const prev = new Map(plan.assignments.map((a) => [a.slotId, a]));
  const assignments = slots.map(
    (s) => prev.get(s.id) ?? { slotId: s.id, teacherId: null, locked: false, source: 'auto' as const },
  );
  return { ...plan, slots, assignments, updatedAt: now() };
}

function createInitialState(): AppState {
  const plan = makePlan('Semester Baru', SEED_CURRICULUM, DEFAULT_PLAN_CONFIG);
  return {
    schemaVersion: SCHEMA_VERSION,
    subjects: SEED_SUBJECTS.map((s) => ({ ...s })),
    masterCurriculum: SEED_CURRICULUM.map((c) => ({ ...c })),
    teachers: [],
    plans: [plan],
    activePlanId: plan.id,
    ui: { theme: 'light' },
  };
}

// ---------- store interface ----------

export interface StoreActions {
  // subjects
  addSubject: (s: Omit<Subject, 'id'>) => void;
  updateSubject: (id: string, patch: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;
  // teachers
  addTeacher: (t: Omit<Teacher, 'id'>) => void;
  updateTeacher: (id: string, patch: Partial<Teacher>) => void;
  deleteTeacher: (id: string) => void;
  // master curriculum
  setMasterSks: (level: Level, sem: SemesterNo, subjectId: string, sks: number) => void;
  addMasterEntry: (level: Level, sem: SemesterNo, subjectId: string, sks: number) => void;
  removeMasterEntry: (id: string) => void;
  // plans
  createPlan: (name: string) => void;
  duplicatePlan: (id: string, name: string) => void;
  renamePlan: (id: string, name: string) => void;
  deletePlan: (id: string) => void;
  setActivePlan: (id: string) => void;
  updatePlanConfig: (patch: Partial<PlanConfig>) => void;
  // classes
  setClassCount: (section: Section, level: Level, sem: SemesterNo, count: number, studentCount?: number) => void;
  addClass: (section: Section, level: Level, sem: SemesterNo) => void;
  removeClass: (id: string) => void;
  // assignments
  runAutoAssign: () => void;
  setAssignment: (slotId: string, teacherId: string | null) => void;
  toggleLock: (slotId: string) => void;
  clearAssignments: () => void;
  // io
  exportJSON: () => string;
  importJSON: (raw: string) => { ok: boolean; error?: string };
  resetAll: () => void;
  // ui
  toggleTheme: () => void;
}

export type Store = AppState & StoreActions;

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const mutateActivePlan = (fn: (p: SemesterPlan) => SemesterPlan, opts?: { reconcile?: boolean }) => {
        const { plans, activePlanId, subjects } = get();
        const idx = plans.findIndex((p) => p.id === activePlanId);
        if (idx < 0) return;
        let plan = fn(plans[idx]);
        if (opts?.reconcile !== false) plan = reconcile(plan, subjects);
        else plan = { ...plan, updatedAt: now() };
        const next = plans.slice();
        next[idx] = plan;
        set({ plans: next });
      };

      return {
        ...createInitialState(),

        // ----- subjects -----
        addSubject: (s) => set({ subjects: [...get().subjects, { ...s, id: nanoid() }] }),
        updateSubject: (id, patch) =>
          set({ subjects: get().subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
        deleteSubject: (id) =>
          set({
            subjects: get().subjects.filter((s) => s.id !== id),
            masterCurriculum: get().masterCurriculum.filter((c) => c.subjectId !== id),
            teachers: get().teachers.map((t) => ({
              ...t,
              qualifiedSubjectIds: t.qualifiedSubjectIds.filter((q) => q !== id),
            })),
          }),

        // ----- teachers -----
        addTeacher: (t) => set({ teachers: [...get().teachers, { ...t, id: nanoid() }] }),
        updateTeacher: (id, patch) =>
          set({ teachers: get().teachers.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
        deleteTeacher: (id) => set({ teachers: get().teachers.filter((t) => t.id !== id) }),

        // ----- master curriculum -----
        setMasterSks: (level, sem, subjectId, sks) => {
          const exists = get().masterCurriculum.find(
            (c) => c.level === level && c.semester === sem && c.subjectId === subjectId,
          );
          if (exists) {
            set({
              masterCurriculum: get().masterCurriculum.map((c) =>
                c.id === exists.id ? { ...c, sks } : c,
              ),
            });
          } else {
            get().addMasterEntry(level, sem, subjectId, sks);
          }
        },
        addMasterEntry: (level, sem, subjectId, sks) =>
          set({
            masterCurriculum: [
              ...get().masterCurriculum,
              { id: nanoid(), level, semester: sem, subjectId, sks },
            ],
          }),
        removeMasterEntry: (id) =>
          set({ masterCurriculum: get().masterCurriculum.filter((c) => c.id !== id) }),

        // ----- plans -----
        createPlan: (name) => {
          const plan = makePlan(name || 'Semester Baru', get().masterCurriculum, DEFAULT_PLAN_CONFIG);
          set({ plans: [...get().plans, plan], activePlanId: plan.id });
        },
        duplicatePlan: (id, name) => {
          const src = get().plans.find((p) => p.id === id);
          if (!src) return;
          const copy: SemesterPlan = {
            ...structuredClone(src),
            id: nanoid(),
            name: name || `${src.name} (salinan)`,
            createdAt: now(),
            updatedAt: now(),
          };
          set({ plans: [...get().plans, copy], activePlanId: copy.id });
        },
        renamePlan: (id, name) =>
          set({ plans: get().plans.map((p) => (p.id === id ? { ...p, name, updatedAt: now() } : p)) }),
        deletePlan: (id) => {
          const plans = get().plans.filter((p) => p.id !== id);
          const activePlanId =
            get().activePlanId === id ? (plans[0]?.id ?? null) : get().activePlanId;
          set({ plans, activePlanId });
        },
        setActivePlan: (id) => set({ activePlanId: id }),
        updatePlanConfig: (patch) =>
          mutateActivePlan((p) => ({ ...p, config: { ...p.config, ...patch } }), { reconcile: false }),

        // ----- classes -----
        setClassCount: (section, level, sem, count, studentCount) =>
          mutateActivePlan((p) => {
            const others = p.classGroups.filter(
              (c) => groupKey(c.section, c.level, c.semester) !== groupKey(section, level, sem),
            );
            const current = p.classGroups
              .filter((c) => groupKey(c.section, c.level, c.semester) === groupKey(section, level, sem))
              .sort((a, b) => a.order - b.order);
            const next: ClassGroup[] = [];
            for (let i = 0; i < count; i++) {
              const existing = current[i];
              next.push(
                existing
                  ? { ...existing, label: classLabel(section, level, sem, i), order: i, studentCount }
                  : {
                      id: nanoid(),
                      section,
                      level,
                      semester: sem,
                      label: classLabel(section, level, sem, i),
                      order: i,
                      studentCount,
                    },
              );
            }
            return { ...p, classGroups: [...others, ...next] };
          }),
        addClass: (section, level, sem) =>
          mutateActivePlan((p) => {
            const count = p.classGroups.filter(
              (c) => groupKey(c.section, c.level, c.semester) === groupKey(section, level, sem),
            ).length;
            return {
              ...p,
              classGroups: [
                ...p.classGroups,
                {
                  id: nanoid(),
                  section,
                  level,
                  semester: sem,
                  label: classLabel(section, level, sem, count),
                  order: count,
                },
              ],
            };
          }),
        removeClass: (id) =>
          mutateActivePlan((p) => ({ ...p, classGroups: p.classGroups.filter((c) => c.id !== id) })),

        // ----- assignments -----
        runAutoAssign: () =>
          mutateActivePlan((p) => {
            const { assignments } = autoAssign({
              slots: p.slots,
              teachers: get().teachers,
              config: p.config,
              existing: p.assignments,
            });
            return { ...p, assignments };
          }),
        setAssignment: (slotId, teacherId) =>
          mutateActivePlan(
            (p) => ({
              ...p,
              assignments: p.assignments.map((a) =>
                a.slotId === slotId
                  ? { ...a, teacherId, locked: teacherId !== null, source: 'manual' }
                  : a,
              ),
            }),
            { reconcile: false },
          ),
        toggleLock: (slotId) =>
          mutateActivePlan(
            (p) => ({
              ...p,
              assignments: p.assignments.map((a) =>
                a.slotId === slotId ? { ...a, locked: !a.locked } : a,
              ),
            }),
            { reconcile: false },
          ),
        clearAssignments: () =>
          mutateActivePlan(
            (p) => ({
              ...p,
              assignments: p.assignments.map((a) => ({
                ...a,
                teacherId: null,
                locked: false,
                source: 'auto',
              })),
            }),
            { reconcile: false },
          ),

        // ----- io -----
        exportJSON: () => {
          const { schemaVersion, subjects, masterCurriculum, teachers, plans, activePlanId, ui } = get();
          return JSON.stringify(
            { schemaVersion, subjects, masterCurriculum, teachers, plans, activePlanId, ui },
            null,
            2,
          );
        },
        importJSON: (raw) => {
          try {
            const parsed = JSON.parse(raw);
            const result = appStateSchema.safeParse(parsed);
            if (!result.success) {
              return { ok: false, error: result.error.issues[0]?.message ?? 'Format tidak valid.' };
            }
            const data = result.data;
            if (data.schemaVersion !== SCHEMA_VERSION) {
              return {
                ok: false,
                error: `Versi data ${data.schemaVersion} tidak cocok dengan aplikasi (v${SCHEMA_VERSION}).`,
              };
            }
            set({ ...data });
            return { ok: true };
          } catch (e) {
            return { ok: false, error: (e as Error).message };
          }
        },
        resetAll: () => set({ ...createInitialState() }),

        // ----- ui -----
        toggleTheme: () => set({ ui: { theme: get().ui.theme === 'light' ? 'dark' : 'light' } }),
      };
    },
    {
      name: 'komposisi-sks',
      version: SCHEMA_VERSION,
    },
  ),
);

// ----- selectors -----

export const useActivePlan = (): SemesterPlan | undefined => {
  const plans = useStore((s) => s.plans);
  const activePlanId = useStore((s) => s.activePlanId);
  return plans.find((p) => p.id === activePlanId);
};
