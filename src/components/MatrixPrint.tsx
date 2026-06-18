import type { SemesterPlan, Subject, Teacher } from '../types/model';
import { LEVEL_LABELS, SECTION_LABELS } from '../types/model';
import { groupedClasses, subjMap, teacherMap } from '../lib/derived';
import { slotId } from '../solver/slots';

/** Print-only rendering of the assignment matrix (class × subject → teacher).
 *  Hidden on screen; one (section, jenjang, semester) block per page. */
export default function MatrixPrint({
  plan,
  teachers,
  subjects,
}: {
  plan: SemesterPlan;
  teachers: Teacher[];
  subjects: Subject[];
}) {
  const groups = groupedClasses(plan);
  const sm = subjMap(subjects);
  const tm = teacherMap(teachers);
  const bySlot = new Map(plan.assignments.map((a) => [a.slotId, a]));

  // Count slots per teacher within each class to mark duplicates.
  const classTeacherCount = new Map<string, Map<string, number>>();
  for (const slot of plan.slots) {
    const tid = bySlot.get(slot.id)?.teacherId;
    if (!tid) continue;
    let m = classTeacherCount.get(slot.classGroupId);
    if (!m) classTeacherCount.set(slot.classGroupId, (m = new Map()));
    m.set(tid, (m.get(tid) ?? 0) + 1);
  }

  const cell = (classGroupId: string, subjectId: string): { name: string; dup: number } => {
    const tid = bySlot.get(slotId(classGroupId, subjectId))?.teacherId;
    if (!tid) return { name: '—', dup: 0 };
    return { name: tm.get(tid)?.name ?? '—', dup: classTeacherCount.get(classGroupId)?.get(tid) ?? 0 };
  };

  return (
    <div className="hidden print:block">
      {groups.map((g) => {
        const entries = plan.curriculum
          .filter((e) => e.level === g.level && e.semester === g.semester)
          .sort((a, b) => b.sks - a.sks);
        return (
          <section key={`${g.section}-${g.level}-${g.semester}`} className="print-page mb-6">
            <div className="mb-1 text-center text-[10px] uppercase tracking-widest text-slate-500">
              Pembagian SKS · {plan.name}
            </div>
            <h2 className="mb-3 text-center text-base font-bold">
              {SECTION_LABELS[g.section]} · {LEVEL_LABELS[g.level]} · Semester {g.semester}
            </h2>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="border border-slate-400 px-2 py-1 text-left">Kelas</th>
                  {entries.map((e) => (
                    <th key={e.id} className="border border-slate-400 px-2 py-1 text-left">
                      {sm.get(e.subjectId)?.name ?? e.subjectId}
                      <span className="ml-1 font-normal text-slate-500">{e.sks}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.classes.map((c) => (
                  <tr key={c.id}>
                    <td className="border border-slate-400 px-2 py-1 font-semibold">
                      {c.label.split(' ').pop()}
                    </td>
                    {entries.map((e) => {
                      const { name, dup } = cell(c.id, e.subjectId);
                      return (
                        <td key={e.id} className="border border-slate-400 px-2 py-1">
                          {name}
                          {dup >= 2 && <span className="ml-1 font-bold"> ({dup}×)</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
