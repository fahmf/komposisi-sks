import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, useActivePlan } from '../store/appStore';
import type { IssueCode, Slot } from '../types/model';
import { LEVEL_LABELS, SECTION_LABELS } from '../types/model';
import { computeTeacherLoads, validatePlan } from '../solver/validate';
import { eligibleTeachers, groupedClasses, subjMap } from '../lib/derived';
import { buildTeacherSchedules } from '../lib/exporters';
import TeacherCell, { type CellTeacher } from '../components/TeacherCell';
import { PageHeader, EmptyState, StatCard } from '../components/ui';
import { IconBolt, IconCheck, IconPrint, IconTrash, IconWarn } from '../components/icons';

const HARD_SLOT_CODES: IssueCode[] = ['GENDER_MISMATCH', 'NOT_QUALIFIED'];
type BoardView = 'matrix' | 'teacher';
type MatrixOrientation = 'classRows' | 'subjectRows';

export default function AssignmentBoard() {
  const plan = useActivePlan();
  const teachers = useStore((s) => s.teachers);
  const subjects = useStore((s) => s.subjects);
  const runAutoAssign = useStore((s) => s.runAutoAssign);
  const clearAssignments = useStore((s) => s.clearAssignments);
  const setAssignment = useStore((s) => s.setAssignment);
  const toggleLock = useStore((s) => s.toggleLock);

  const [showIssues, setShowIssues] = useState(false);
  const [boardView, setBoardView] = useState<BoardView>('matrix');
  const [matrixOrientation, setMatrixOrientation] = useState<MatrixOrientation>('classRows');
  const [teacherFilter, setTeacherFilter] = useState('all');

  const derived = useMemo(() => {
    if (!plan) return null;
    const sm = subjMap(subjects);
    const report = validatePlan({
      slots: plan.slots,
      assignments: plan.assignments,
      teachers,
      subjects,
      classGroups: plan.classGroups,
      config: plan.config,
    });
    const loads = computeTeacherLoads({
      slots: plan.slots,
      assignments: plan.assignments,
      teachers,
      subjects,
      classGroups: plan.classGroups,
      config: plan.config,
    });
    const assignmentBySlot = new Map(plan.assignments.map((a) => [a.slotId, a]));
    const slotByClassSubject = new Map(plan.slots.map((s) => [`${s.classGroupId}|${s.subjectId}`, s]));

    const teacherTone = new Map<string, 'ok' | 'warn' | 'error'>();
    for (const t of teachers) teacherTone.set(t.id, 'ok');
    for (const issue of report.issues) {
      if (!issue.teacherId) continue;
      const cur = teacherTone.get(issue.teacherId);
      if (issue.level === 'error') teacherTone.set(issue.teacherId, 'error');
      else if (cur !== 'error') teacherTone.set(issue.teacherId, 'warn');
    }
    const slotHardError = new Set(
      report.issues.filter((i) => i.slotId && HARD_SLOT_CODES.includes(i.code)).map((i) => i.slotId!),
    );
    const assignedCount = plan.assignments.filter((a) => a.teacherId).length;
    return { sm, report, loads, assignmentBySlot, slotByClassSubject, teacherTone, slotHardError, assignedCount };
  }, [plan, teachers, subjects]);

  const teacherSchedules = useMemo(() => {
    if (!plan) return [];
    return buildTeacherSchedules(plan, teachers, subjects);
  }, [plan, teachers, subjects]);

  if (!plan) return <EmptyState title="Belum ada semester aktif" hint="Buat semester di menu Pengaturan." />;
  if (!derived) return null;

  const { report, loads, assignmentBySlot, slotByClassSubject, teacherTone, slotHardError, assignedCount } = derived;
  const groups = groupedClasses(plan);
  const totalSlots = plan.slots.length;

  const getCell = (slot: Slot) => {
    const a = assignmentBySlot.get(slot.id);
    const teacherId = a?.teacherId ?? null;
    const locked = a?.locked ?? false;
    const eligible: CellTeacher[] = eligibleTeachers(slot, teachers)
      .map((t) => {
        const load = loads.get(t.id)?.load ?? 0;
        return { teacher: t, load, wouldExceedCap: t.id !== teacherId && load + slot.sks > t.maxSks };
      })
      .sort((x, y) => x.teacher.name.localeCompare(y.teacher.name));
    const tTone = teacherId ? teacherTone.get(teacherId) : undefined;
    const tone: 'ok' | 'warn' | 'error' | 'empty' = !teacherId
      ? 'empty'
      : slotHardError.has(slot.id) || tTone === 'error'
        ? 'error'
        : tTone === 'warn'
          ? 'warn'
          : 'ok';
    const currentName = teacherId ? teachers.find((t) => t.id === teacherId)?.name : undefined;
    return { teacherId, locked, eligible, tone, currentName };
  };

  const getSlot = (classGroupId: string, subjectId: string) => slotByClassSubject.get(`${classGroupId}|${subjectId}`);

  const renderTeacherCell = (slot: Slot) => {
    const cell = getCell(slot);
    return (
      <TeacherCell
        slot={slot}
        teacherId={cell.teacherId}
        locked={cell.locked}
        eligible={cell.eligible}
        currentName={cell.currentName}
        subjectName={derived.sm.get(slot.subjectId)?.name}
        tone={cell.tone}
        onChange={(tid) => setAssignment(slot.id, tid)}
        onToggleLock={() => toggleLock(slot.id)}
      />
    );
  };

  const activeTeachers = teachers.filter((t) => t.active);
  const sortedTeachers = [...activeTeachers].sort(
    (a, b) => a.gender.localeCompare(b.gender) || a.name.localeCompare(b.name),
  );
  const teacherOptions = [...teachers].sort(
    (a, b) => a.gender.localeCompare(b.gender) || a.name.localeCompare(b.name),
  );
  const scheduleByTeacher = new Map(teacherSchedules.map((s) => [s.teacher.id, s]));
  const visibleTeacherSchedules =
    teacherFilter === 'all'
      ? teacherSchedules
      : (() => {
          const teacher = teachers.find((t) => t.id === teacherFilter);
          if (!teacher) return [];
          return [scheduleByTeacher.get(teacher.id) ?? { teacher, totalSks: 0, rows: [] }];
        })();

  return (
    <>
      <PageHeader
        title="Pembagian SKS"
        subtitle={plan.name}
        actions={
          <>
            <button
              className="btn-outline"
              onClick={() => {
                if (confirm('Kosongkan semua penugasan?')) clearAssignments();
              }}
            >
              <IconTrash width={16} height={16} /> Kosongkan
            </button>
            <button className="btn-primary" onClick={runAutoAssign} disabled={totalSlots === 0}>
              <IconBolt width={16} height={16} /> Susun otomatis
            </button>
          </>
        }
      />

      {totalSlots === 0 ? (
        <EmptyState
          title="Belum ada kelas untuk dibagi"
          hint="Buat kelas dulu di menu Kelas, lalu kembali ke sini dan tekan Susun otomatis."
          action={
            <Link to="/classes" className="btn-primary">
              Ke menu Kelas
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Slot terisi" value={`${assignedCount}/${totalSlots}`} tone={assignedCount === totalSlots ? 'good' : 'warn'} />
            <StatCard label="Masalah (error)" value={report.errorCount} tone={report.errorCount ? 'bad' : 'good'} />
            <StatCard label="Peringatan" value={report.warningCount} tone={report.warningCount ? 'warn' : 'good'} />
            <StatCard label="Pengajar aktif" value={activeTeachers.length} />
          </div>

          {report.issues.length > 0 && (
            <div className="card mb-5 overflow-hidden">
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() => setShowIssues((v) => !v)}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <IconWarn width={18} height={18} className="text-amber-500" />
                  {report.errorCount} error - {report.warningCount} peringatan
                </span>
                <span className="text-sm text-slate-400">{showIssues ? 'Sembunyikan' : 'Lihat'}</span>
              </button>
              {showIssues && (
                <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                  {[...report.issues]
                    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
                    .map((issue, i) => (
                      <li key={i} className="flex gap-2 px-4 py-2.5 text-sm">
                        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${issue.level === 'error' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                        <div>
                          <p>{issue.message}</p>
                          {issue.suggestion && <p className="text-xs text-slate-400">{issue.suggestion}</p>}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}

          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Beban pengajar</h2>
          <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sortedTeachers.map((t) => {
              const tl = loads.get(t.id)!;
              const pct = tl.relaxedTarget > 0 ? Math.min(100, (tl.load / tl.relaxedTarget) * 100) : 100;
              const tone = teacherTone.get(t.id);
              const barColor =
                tone === 'error'
                  ? 'bg-rose-500'
                  : tl.load >= tl.relaxedTarget
                    ? 'bg-emerald-500'
                    : tone === 'warn'
                      ? 'bg-amber-400'
                      : 'bg-brand-500';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setBoardView('teacher');
                    setTeacherFilter(t.id);
                  }}
                  className="card p-3 text-left transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-semibold">{t.name}</span>
                    <span className="text-xs text-slate-500">
                      {tl.load}/{t.maxSks}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    target {tl.relaxedTarget} SKS{tl.load >= tl.relaxedTarget ? ' ok' : ''}
                  </p>
                </button>
              );
            })}
            {sortedTeachers.length === 0 && <p className="text-sm text-slate-400">Belum ada pengajar aktif.</p>}
          </div>

          <div className="no-print mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-950">
                {([
                  ['matrix', 'Matriks'],
                  ['teacher', 'Per pengajar'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBoardView(value)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      boardView === value
                        ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {boardView === 'matrix' && (
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-950">
                  {([
                    ['classRows', 'Kelas sebagai baris'],
                    ['subjectRows', 'Matkul sebagai baris'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMatrixOrientation(value)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        matrixOrientation === value
                          ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {boardView === 'teacher' && (
              <select className="input sm:max-w-xs" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
                <option value="all">Semua pengajar bertugas</option>
                {teacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {boardView === 'matrix' ? (
            groups.map((g) => {
              const entries = plan.curriculum
                .filter((e) => e.level === g.level && e.semester === g.semester)
                .sort((a, b) => b.sks - a.sks);
              return (
                <section key={`${g.section}-${g.level}-${g.semester}`} className="mb-8">
                  <h3 className="mb-2 flex items-center gap-2 font-bold">
                    <span className={`badge ${g.section === 'putra' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'}`}>
                      {SECTION_LABELS[g.section]}
                    </span>
                    {LEVEL_LABELS[g.level]} - Semester {g.semester}
                  </h3>

                  <div className="no-print hidden overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 lg:block">
                    <table className="w-full border-collapse text-sm">
                      {matrixOrientation === 'classRows' ? (
                        <>
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50">
                              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
                                Kelas
                              </th>
                              {entries.map((e) => (
                                <th key={e.id} className="min-w-[150px] px-2 py-2 text-left text-xs font-semibold">
                                  {derived.sm.get(e.subjectId)?.name}
                                  <span className="ml-1 font-normal text-slate-400">{e.sks}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {g.classes.map((c) => (
                              <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium dark:bg-slate-900">
                                  {c.label.split(' ').pop()}
                                </td>
                                {entries.map((e) => {
                                  const slot = getSlot(c.id, e.subjectId);
                                  return (
                                    <td key={e.id} className="px-1.5 py-1.5 align-top">
                                      {slot ? renderTeacherCell(slot) : null}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </>
                      ) : (
                        <>
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50">
                              <th className="sticky left-0 z-10 min-w-[190px] bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
                                Mata kuliah
                              </th>
                              {g.classes.map((c) => (
                                <th key={c.id} className="min-w-[180px] px-2 py-2 text-left text-xs font-semibold">
                                  {c.label.split(' ').pop()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map((e) => (
                              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium dark:bg-slate-900">
                                  {derived.sm.get(e.subjectId)?.name}
                                  <span className="ml-1 text-xs font-normal text-slate-400">{e.sks}</span>
                                </td>
                                {g.classes.map((c) => {
                                  const slot = getSlot(c.id, e.subjectId);
                                  return (
                                    <td key={c.id} className="px-1.5 py-1.5 align-top">
                                      {slot ? renderTeacherCell(slot) : null}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </>
                      )}
                    </table>
                  </div>

                  <div className="space-y-3 lg:hidden">
                    {matrixOrientation === 'classRows'
                      ? g.classes.map((c) => (
                          <div key={c.id} className="card p-3">
                            <p className="mb-2 font-semibold">{c.label}</p>
                            <div className="space-y-2">
                              {entries.map((e) => {
                                const slot = getSlot(c.id, e.subjectId);
                                if (!slot) return null;
                                return (
                                  <div key={e.id} className="grid grid-cols-[1fr_1.4fr] items-center gap-2">
                                    <span className="text-sm">
                                      {derived.sm.get(e.subjectId)?.name}
                                      <span className="ml-1 text-xs text-slate-400">{e.sks}</span>
                                    </span>
                                    {renderTeacherCell(slot)}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      : entries.map((e) => (
                          <div key={e.id} className="card p-3">
                            <p className="mb-2 font-semibold">
                              {derived.sm.get(e.subjectId)?.name}
                              <span className="ml-1 text-xs font-normal text-slate-400">{e.sks}</span>
                            </p>
                            <div className="space-y-2">
                              {g.classes.map((c) => {
                                const slot = getSlot(c.id, e.subjectId);
                                if (!slot) return null;
                                return (
                                  <div key={c.id} className="grid grid-cols-[64px_1fr] items-center gap-2">
                                    <span className="text-sm font-medium">{c.label.split(' ').pop()}</span>
                                    {renderTeacherCell(slot)}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="mb-8 space-y-3">
              {visibleTeacherSchedules.length === 0 ? (
                <EmptyState title="Belum ada pengajar bertugas" hint="Jalankan susun otomatis atau isi penugasan manual di mode matriks." />
              ) : (
                visibleTeacherSchedules.map((schedule) => (
                  <section key={schedule.teacher.id} className="card overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <div>
                        <h3 className="font-bold">{schedule.teacher.name}</h3>
                        <p className="text-xs text-slate-500">
                          {schedule.teacher.gender === 'L' ? 'Putra' : 'Putri'} - Total {schedule.totalSks} SKS
                        </p>
                      </div>
                      <Link to={`/teacher/${schedule.teacher.id}`} className="btn-outline btn-sm">
                        <IconPrint width={14} height={14} /> Cetak
                      </Link>
                    </div>
                    {schedule.rows.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-slate-400">Belum ada penugasan untuk pengajar ini.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
                              <th className="px-4 py-2">Kelas</th>
                              <th className="px-4 py-2">Mata kuliah</th>
                              <th className="px-4 py-2 text-right">SKS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.rows.map((row, i) => (
                              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                                <td className="px-4 py-2 font-medium">{row.kelas}</td>
                                <td className="px-4 py-2">{row.mataKuliah}</td>
                                <td className="px-4 py-2 text-right">{row.sks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ))
              )}
            </div>
          )}

          {assignedCount === totalSlots && report.errorCount === 0 && (
            <div className="card flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <IconCheck className="text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Semua slot terisi tanpa error. Buka menu Ekspor untuk membagikan jadwal.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
