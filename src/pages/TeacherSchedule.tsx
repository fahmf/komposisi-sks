import { Link, useParams } from 'react-router-dom';
import { useStore, useActivePlan } from '../store/appStore';
import { buildTeacherSchedules } from '../lib/exporters';
import { EmptyState } from '../components/ui';
import { IconPrint } from '../components/icons';

export default function TeacherSchedule() {
  const { id } = useParams();
  const plan = useActivePlan();
  const teachers = useStore((s) => s.teachers);
  const subjects = useStore((s) => s.subjects);

  if (!plan) return <EmptyState title="Belum ada semester aktif" />;
  const teacher = teachers.find((t) => t.id === id);
  if (!teacher) return <EmptyState title="Pengajar tidak ditemukan" action={<Link className="btn-primary" to="/teachers">Kembali</Link>} />;

  const sched = buildTeacherSchedules(plan, teachers, subjects).find((s) => s.teacher.id === id);
  const rows = sched?.rows ?? [];
  const total = sched?.totalSks ?? 0;

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to="/plan" className="btn-ghost">← Kembali</Link>
        <button className="btn-primary" onClick={() => window.print()}>
          <IconPrint width={16} height={16} /> Cetak / PDF
        </button>
      </div>

      <div className="card mx-auto max-w-2xl p-6 print:border-0 print:shadow-none">
        <div className="mb-1 text-center text-xs uppercase tracking-widest text-slate-400">Jadwal Mengajar · {plan.name}</div>
        <h1 className="text-center text-2xl font-bold">{teacher.name}</h1>
        <p className="mb-5 text-center text-sm text-slate-500">
          {teacher.gender === 'L' ? 'Pengajar Putra' : 'Pengajar Putri'} · Total {total} SKS
        </p>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Belum ada penugasan untuk pengajar ini.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                <th className="py-2">Kelas</th>
                <th className="py-2">Mata Kuliah</th>
                <th className="py-2 text-right">SKS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-medium">{r.kelas}</td>
                  <td className="py-2">{r.mataKuliah}</td>
                  <td className="py-2 text-right">{r.sks}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-2" colSpan={2}>
                  Total
                </td>
                <td className="py-2 text-right">{total} SKS</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
