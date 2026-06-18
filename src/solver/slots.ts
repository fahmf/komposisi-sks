import type { ClassGroup, CurriculumEntry, Slot, Subject } from '../types/model';

export const slotId = (classGroupId: string, subjectId: string) => `${classGroupId}__${subjectId}`;

/** Materialise one slot per (class × curriculum subject for that level/semester). */
export function buildSlots(
  classGroups: ClassGroup[],
  curriculum: CurriculumEntry[],
  subjects: Subject[],
): Slot[] {
  const subjById = new Map(subjects.map((s) => [s.id, s]));
  const slots: Slot[] = [];
  for (const cg of classGroups) {
    const entries = curriculum.filter((e) => e.level === cg.level && e.semester === cg.semester);
    for (const e of entries) {
      const subj = subjById.get(e.subjectId);
      slots.push({
        id: slotId(cg.id, e.subjectId),
        classGroupId: cg.id,
        subjectId: e.subjectId,
        sks: e.sks,
        isTahfidz: subj?.isTahfidz ?? false,
        section: cg.section,
        level: cg.level,
      });
    }
  }
  return slots;
}
