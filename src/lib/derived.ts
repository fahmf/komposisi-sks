import type {
  ClassGroup,
  Level,
  SemesterNo,
  SemesterPlan,
  Slot,
  Subject,
  Teacher,
} from '../types/model';
import { sectionToGender } from '../types/model';

export const subjMap = (subjects: Subject[]) => new Map(subjects.map((s) => [s.id, s]));
export const teacherMap = (teachers: Teacher[]) => new Map(teachers.map((t) => [t.id, t]));
export const classMap = (plan: SemesterPlan) => new Map(plan.classGroups.map((c) => [c.id, c]));

export interface ClassGrouping {
  section: ClassGroup['section'];
  level: Level;
  semester: SemesterNo;
  classes: ClassGroup[];
}

/** Group a plan's classes by (section, level, semester) in a stable order. */
export function groupedClasses(plan: SemesterPlan): ClassGrouping[] {
  const map = new Map<string, ClassGrouping>();
  for (const c of plan.classGroups) {
    const key = `${c.section}|${c.level}|${c.semester}`;
    let g = map.get(key);
    if (!g) map.set(key, (g = { section: c.section, level: c.level, semester: c.semester, classes: [] }));
    g.classes.push(c);
  }
  const order = { putra: 0, putri: 1 } as const;
  return [...map.values()]
    .map((g) => ({ ...g, classes: g.classes.sort((a, b) => a.order - b.order) }))
    .sort(
      (a, b) =>
        order[a.section] - order[b.section] ||
        a.level.localeCompare(b.level) ||
        a.semester - b.semester,
    );
}

/** Subjects required for a class (from the plan curriculum snapshot), ordered by SKS desc. */
export function subjectsForClass(plan: SemesterPlan, cg: ClassGroup) {
  return plan.curriculum
    .filter((e) => e.level === cg.level && e.semester === cg.semester)
    .sort((a, b) => b.sks - a.sks);
}

/** Teachers eligible for a slot by the two static filters (gender + qualification). */
export function eligibleTeachers(slot: Slot, teachers: Teacher[]): Teacher[] {
  const gender = sectionToGender(slot.section);
  return teachers.filter(
    (t) => t.active && t.gender === gender && t.qualifiedSubjectIds.includes(slot.subjectId),
  );
}

/** Curriculum total SKS per (level, semester) for the grid =32 check. */
export function curriculumTotal(plan: SemesterPlan, level: Level, sem: SemesterNo): number {
  return plan.curriculum
    .filter((e) => e.level === level && e.semester === sem)
    .reduce((sum, e) => sum + e.sks, 0);
}

export const LEVEL_SEM: { level: Level; semester: SemesterNo }[] = [
  { level: 'ILP', semester: 1 },
  { level: 'ILP', semester: 2 },
  { level: 'ILL', semester: 1 },
  { level: 'ILL', semester: 2 },
];
