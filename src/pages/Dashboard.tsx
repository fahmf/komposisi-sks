import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore, useActivePlan } from '../store/appStore';
import { validatePlan } from '../solver/validate';
import { StatCard, EmptyState } from '../components/ui';
import { IconBolt, IconBook, IconCheck, IconGrid, IconUsers } from '../components/icons';

export default function Dashboard() {
  const plan = useActivePlan();
  const teachers = useStore((s) => s.teachers);
  const subjects = useStore((s) => s.subjects);

  const stats = useMemo(() => {
    if (!plan) return null;
    const report = validatePlan({
      slots: plan.slots,
      assignments: plan.assignments,
      teachers,
      subjects,
      classGroups: plan.classGroups,
      config: plan.config,
    });
    const assigned = plan.assignments.filter((a) => a.teacherId).length;
    const totalSks = plan.slots.reduce((s, x) => s + x.sks, 0);
    return { report, assigned, total: plan.slots.length, totalSks };
  }, [plan, teachers, subjects]);

  if (!plan) return <EmptyState title="Belum ada semester aktif" hint="Buat semester di menu Pengaturan." />;

  const activeTeachers = teachers.filter((t) => t.active).length;
  const steps = [
    { done: subjects.length > 0, label: 'Kurikulum & mata kuliah siap', to: '/subjects', icon: IconBook },
    { done: teachers.length > 0, label: 'Tambahkan pengajar', to: '/teachers', icon: IconUsers },
    { done: plan.classGroups.length > 0, label: 'Buat kelas', to: '/classes', icon: IconGrid },
    { done: (stats?.assigned ?? 0) > 0, label: 'Susun pembagian SKS', to: '/plan', icon: IconBolt },
  ];
  const nextStep = steps.find((s) => !s.done);

  return (
    <>
      <div className="mb-5">
        <p className="text-sm text-slate-500">Semester aktif</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{plan.name}</h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Kelas" value={plan.classGroups.length} />
        <StatCard label="Pengajar aktif" value={activeTeachers} />
        <StatCard label="Slot terisi" value={`${stats?.assigned ?? 0}/${stats?.total ?? 0}`} tone={stats && stats.assigned === stats.total && stats.total > 0 ? 'good' : 'default'} />
        <StatCard label="Total SKS" value={stats?.totalSks ?? 0} />
      </div>

      {/* Getting started */}
      <div className="card mb-6 p-5">
        <h2 className="mb-4 font-semibold">Langkah pengaturan</h2>
        <div className="space-y-2">
          {steps.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:shadow-sm ${
                s.done ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${s.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                {s.done ? <IconCheck width={16} height={16} /> : <s.icon width={16} height={16} />}
              </span>
              <span className={`flex-1 text-sm font-medium ${s.done ? 'text-slate-500 line-through dark:text-slate-400' : ''}`}>{s.label}</span>
              {!s.done && nextStep?.to === s.to && <span className="badge bg-brand-600 text-white">Lanjut</span>}
            </Link>
          ))}
        </div>
      </div>

      {stats && stats.report.issues.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Ringkasan masalah</h2>
            <Link to="/plan" className="text-sm text-brand-600">Buka pembagian →</Link>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="badge bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{stats.report.errorCount} error</span>
            <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{stats.report.warningCount} peringatan</span>
          </div>
        </div>
      )}
    </>
  );
}
