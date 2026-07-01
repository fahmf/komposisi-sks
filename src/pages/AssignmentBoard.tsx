import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, useActivePlan } from '../store/appStore';
import type { Gender, IssueCode, Slot, Teacher } from '../types/model';
import { LEVEL_LABELS, SECTION_LABELS } from '../types/model';
import { computeTeacherLoads, validatePlan } from '../solver/validate';
import { eligibleTeachers, otherTeachers, groupedClasses, subjMap } from '../lib/derived';
import { buildTeacherSchedules } from '../lib/exporters';
import TeacherCell, { type CellTeacher } from '../components/TeacherCell';
import MatrixPrint from '../components/MatrixPrint';
import { PageHeader, EmptyState, StatCard, Modal, Field, Drawer } from '../components/ui';
import { IconBolt, IconCheck, IconPrint, IconTrash, IconWarn, IconPlus, IconCopy } from '../components/icons';

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
  const updateTeacher = useStore((s) => s.updateTeacher);
  const createPlan = useStore((s) => s.createPlan);
  const duplicatePlan = useStore((s) => s.duplicatePlan);

  const [showIssues, setShowIssues] = useState(false);
  const [boardView, setBoardView] = useState<BoardView>('matrix');
  const [matrixOrientation, setMatrixOrientation] = useState<MatrixOrientation>('classRows');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [quickEditState, setQuickEditState] = useState<{ teacherId: string; slot: Slot } | null>(null);
  const [sidebarTeacherId, setSidebarTeacherId] = useState<string | null>(null);

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
    // Count how many slots each teacher holds within a single class, to flag when
    // the same teacher teaches ≥2 subjects in one class (tahfidz included).
    const classTeacherCount = new Map<string, Map<string, number>>(); // classGroupId -> teacherId -> count
    for (const slot of plan.slots) {
      const tid = assignmentBySlot.get(slot.id)?.teacherId;
      if (!tid) continue;
      let m = classTeacherCount.get(slot.classGroupId);
      if (!m) classTeacherCount.set(slot.classGroupId, (m = new Map()));
      m.set(tid, (m.get(tid) ?? 0) + 1);
    }
    let totalSksNeeded = 0;
    let totalSksAssigned = 0;
    for (const slot of plan.slots) {
      totalSksNeeded += slot.sks;
      if (assignmentBySlot.get(slot.id)?.teacherId) {
        totalSksAssigned += slot.sks;
      }
    }
    const assignedCount = plan.assignments.filter((a) => a.teacherId).length;
    return { sm, report, loads, assignmentBySlot, slotByClassSubject, teacherTone, slotHardError, classTeacherCount, assignedCount, totalSksNeeded, totalSksAssigned };
  }, [plan, teachers, subjects]);

  const teacherSchedules = useMemo(() => {
    if (!plan) return [];
    return buildTeacherSchedules(plan, teachers, subjects);
  }, [plan, teachers, subjects]);

  if (!plan) return <EmptyState title="Belum ada semester aktif" hint="Buat semester di menu Pengaturan." />;
  if (!derived) return null;

  const { report, loads, assignmentBySlot, slotByClassSubject, teacherTone, slotHardError, classTeacherCount, assignedCount, totalSksNeeded, totalSksAssigned } = derived;
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
    const other: CellTeacher[] = otherTeachers(slot, teachers)
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
    const dupCount = teacherId ? (classTeacherCount.get(slot.classGroupId)?.get(teacherId) ?? 0) : 0;
    return { teacherId, locked, eligible, other, tone, currentName, dupCount };
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
        other={cell.other}
        currentName={cell.currentName}
        subjectName={derived.sm.get(slot.subjectId)?.name}
        tone={cell.tone}
        dupCount={cell.dupCount}
        onChange={(tid) => setAssignment(slot.id, tid)}
        onToggleLock={() => toggleLock(slot.id)}
        onOpenQuickEdit={(tid) => setQuickEditState({ teacherId: tid, slot })}
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
  const renderLoadCard = (t: Teacher) => {
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
        onClick={() => setSidebarTeacherId(t.id)}
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
  };

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
      <div className="no-print">
      <PageHeader
        title="Pembagian SKS"
        subtitle={plan.name}
        actions={
          <>
            <button
              className="btn-outline btn-sm hidden sm:inline-flex"
              onClick={() => {
                const name = prompt('Nama skenario baru:', `${plan.name} (salinan)`);
                if (name) duplicatePlan(plan.id, name);
              }}
              title="Simpan kondisi saat ini sebagai skenario baru"
            >
              <IconCopy width={16} height={16} /> Simpan Skenario
            </button>
            <button
              className="btn-outline btn-sm hidden sm:inline-flex"
              onClick={() => {
                const name = prompt('Nama skenario kosong:', 'Skenario Baru');
                if (name) createPlan(name);
              }}
              title="Buat skenario baru dengan kelas kosong"
            >
              <IconPlus width={16} height={16} /> Buat Skenario Kosong
            </button>
            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <button
              className="btn-outline"
              onClick={() => {
                if (confirm('Kosongkan semua penugasan?')) clearAssignments();
              }}
            >
              <IconTrash width={16} height={16} /> Kosongkan
            </button>
            <button className="btn-outline" onClick={() => window.print()} disabled={totalSlots === 0} title="Untuk tabel lebar, pilih orientasi Lanskap di dialog cetak.">
              <IconPrint width={16} height={16} /> Cetak matriks
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
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="SKS terpenuhi" value={`${totalSksAssigned}/${totalSksNeeded}`} tone={totalSksAssigned === totalSksNeeded ? 'good' : 'warn'} />
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
          {sortedTeachers.length === 0 ? (
            <p className="mb-6 text-sm text-slate-400">Belum ada pengajar aktif.</p>
          ) : (
            (['L', 'P'] as Gender[]).map((g) => {
              const list = sortedTeachers.filter((t) => t.gender === g);
              if (list.length === 0) return null;
              return (
                <div key={g} className="mb-6">
                  <h3 className="mb-2 flex items-center gap-2">
                    <span className={`badge ${g === 'L' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'}`}>
                      {g === 'L' ? 'Putra' : 'Putri'}
                    </span>
                    <span className="text-xs text-slate-400">{list.length} pengajar</span>
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{list.map(renderLoadCard)}</div>
                </div>
              );
            })
          )}

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
      </div>
      <MatrixPrint plan={plan} teachers={teachers} subjects={subjects} />

      {quickEditState && (() => {
        const t = teachers.find((x) => x.id === quickEditState.teacherId);
        if (!t) return null;
        const { slot } = quickEditState;
        const subject = derived.sm.get(slot.subjectId);
        const qk = `${slot.level}:${slot.subjectId}`;
        const isQual = t.qualifiedKeys.includes(qk);
        return (
          <Modal title="Pengaturan Cepat Pengajar" open={true} onClose={() => setQuickEditState(null)}>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-brand-600 dark:text-brand-400">{t.name}</p>
                <p className="text-sm text-slate-500">Mata kuliah: {subject?.name}</p>
              </div>
              <Field label="Beban Maksimal SKS">
                <input
                  type="number"
                  className="input"
                  value={t.maxSks}
                  onChange={(e) => updateTeacher(t.id, { maxSks: Number(e.target.value) || 0 })}
                />
              </Field>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="qe-qual"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900"
                  checked={isQual}
                  onChange={(e) => {
                    const keys = new Set(t.qualifiedKeys);
                    if (e.target.checked) keys.add(qk);
                    else keys.delete(qk);
                    updateTeacher(t.id, { qualifiedKeys: [...keys] });
                  }}
                />
                <label htmlFor="qe-qual" className="text-sm font-medium">Memenuhi syarat untuk matkul ini</label>
              </div>
              <hr className="border-slate-100 dark:border-slate-800" />
              <button
                onClick={() => {
                  const keys = new Set(t.ignoredKeys ?? []);
                  keys.add(qk);
                  updateTeacher(t.id, { ignoredKeys: [...keys] });
                  setQuickEditState(null);
                }}
                className="w-full rounded-lg border border-rose-200 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30"
              >
                Abaikan pengajar ini untuk matkul ini
              </button>
            </div>
          </Modal>
        );
      })()}

      <Drawer
        open={!!sidebarTeacherId}
        onClose={() => setSidebarTeacherId(null)}
        title="Jadwal Pengajar"
      >
        {(() => {
          if (!sidebarTeacherId) return null;
          const schedule = scheduleByTeacher.get(sidebarTeacherId);
          const t = teachers.find((x) => x.id === sidebarTeacherId);
          if (!t) return null;
          
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <h3 className="font-bold">{t.name}</h3>
                  <p className="text-xs text-slate-500">
                    {t.gender === 'L' ? 'Putra' : 'Putri'} - Total {schedule?.totalSks ?? 0} SKS
                  </p>
                </div>
                <Link to={`/teacher/${t.id}`} className="btn-outline btn-sm">
                  <IconPrint width={14} height={14} /> Cetak
                </Link>
              </div>
              
              {!schedule || schedule.rows.length === 0 ? (
                <p className="py-6 text-sm text-slate-400 text-center">Belum ada penugasan untuk pengajar ini.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Kelas</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">Mata kuliah</th>
                        <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-right">SKS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {schedule.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-medium">{row.kelas}</td>
                          <td className="px-3 py-2">{row.mataKuliah}</td>
                          <td className="px-3 py-2 text-right">{row.sks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </Drawer>
    </>
  );
}
