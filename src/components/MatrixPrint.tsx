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

  const teacherName = (classGroupId: string, subjectId: string): string => {
    const a = bySlot.get(slotId(classGroupId, subjectId));
    const tid = a?.teacherId;
    return tid ? (tm.get(tid)?.name ?? '—') : '—';
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
                    {entries.map((e) => (
                      <td key={e.id} className="border border-slate-400 px-2 py-1">
                        {teacherName(c.id, e.subjectId)}
                      </td>
                    ))}
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
