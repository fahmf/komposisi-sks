import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, useActivePlan } from '../store/appStore';
import { buildTeacherSchedules, exportCSV, exportExcel } from '../lib/exporters';
import { PageHeader, EmptyState } from '../components/ui';
import { IconDownload, IconPrint } from '../components/icons';

export default function ExportPage() {
  const plan = useActivePlan();
  const teachers = useStore((s) => s.teachers);
  const subjects = useStore((s) => s.subjects);
  const exportJSON = useStore((s) => s.exportJSON);
  const importJSON = useStore((s) => s.importJSON);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!plan) return <EmptyState title="Belum ada semester aktif" />;
  const schedules = buildTeacherSchedules(plan, teachers, subjects);

  const doExportJSON = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `komposisi-sks-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    const text = await file.text();
    const res = importJSON(text);
    setMsg(res.ok ? { ok: true, text: 'Data berhasil dipulihkan.' } : { ok: false, text: res.error ?? 'Gagal mengimpor.' });
  };

  return (
    <>
      <PageHeader title="Ekspor & Cadangan" subtitle={plan.name} />

      <div className="no-print grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-1 font-semibold">Bagikan jadwal</h3>
          <p className="mb-4 text-sm text-slate-500">Unduh atau cetak hasil pembagian semester ini.</p>
          <div className="flex flex-col gap-2">
            <button className="btn-primary justify-start" onClick={() => void exportExcel(plan, teachers, subjects)}>
              <IconDownload width={16} height={16} /> Excel (.xlsx) — 3 sheet
            </button>
            <button className="btn-outline justify-start" onClick={() => exportCSV(plan, teachers, subjects)}>
              <IconDownload width={16} height={16} /> CSV
            </button>
            <button className="btn-outline justify-start" onClick={() => window.print()}>
              <IconPrint width={16} height={16} /> Cetak semua jadwal pengajar (PDF)
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-1 font-semibold">Cadangan data (JSON)</h3>
          <p className="mb-4 text-sm text-slate-500">
            Data tersimpan di browser ini saja. Ekspor JSON secara berkala agar tidak hilang dan untuk pindah perangkat.
          </p>
          <div className="flex flex-col gap-2">
            <button className="btn-primary justify-start" onClick={doExportJSON}>
              <IconDownload width={16} height={16} /> Ekspor cadangan
            </button>
            <button className="btn-outline justify-start" onClick={() => fileRef.current?.click()}>
              Impor / pulihkan cadangan
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = '';
              }}
            />
            {msg && (
              <p className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>
            )}
          </div>
        </div>
      </div>

      <div className="no-print mt-6">
        <h2 className="mb-3 text-lg font-bold">Pratinjau ({schedules.length} pengajar bertugas)</h2>
        {schedules.length === 0 ? (
          <EmptyState title="Belum ada penugasan" hint="Lakukan pembagian dulu di menu Pembagian." action={<Link className="btn-primary" to="/plan">Ke Pembagian</Link>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {schedules.map((s) => (
              <Link key={s.teacher.id} to={`/teacher/${s.teacher.id}`} className="card p-4 transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{s.teacher.name}</span>
                  <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">{s.totalSks} SKS</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{s.rows.length} pertemuan · {new Set(s.rows.map((r) => r.kelas)).size} kelas</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Print-only: all teacher schedules, one per page */}
      <div className="hidden print:block">
        {schedules.map((s) => (
          <div key={s.teacher.id} className="print-page mb-8">
            <div className="mb-1 text-center text-xs uppercase tracking-widest text-slate-500">Jadwal Mengajar · {plan.name}</div>
            <h1 className="text-center text-2xl font-bold">{s.teacher.name}</h1>
            <p className="mb-4 text-center text-sm">
              {s.teacher.gender === 'L' ? 'Pengajar Putra' : 'Pengajar Putri'} · Total {s.totalSks} SKS
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-400 text-left">
                  <th className="py-1">Kelas</th>
                  <th className="py-1">Mata Kuliah</th>
                  <th className="py-1 text-right">SKS</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="py-1">{r.kelas}</td>
                    <td className="py-1">{r.mataKuliah}</td>
                    <td className="py-1 text-right">{r.sks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}
