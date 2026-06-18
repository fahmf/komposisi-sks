import { useMemo, useState } from 'react';
import { useStore, useActivePlan } from '../store/appStore';
import type { Level, Section, SemesterNo } from '../types/model';
import { LEVEL_LABELS, SECTION_LABELS } from '../types/model';
import { recommendClassCount } from '../solver/classCount';
import { groupedClasses } from '../lib/derived';
import { PageHeader, EmptyState } from '../components/ui';
import { IconCheck, IconGrid, IconPlus, IconTrash } from '../components/icons';
import { toNum } from '../lib/num';

export default function Classes() {
  const plan = useActivePlan();
  const setClassCount = useStore((s) => s.setClassCount);
  const addClass = useStore((s) => s.addClass);
  const removeClass = useStore((s) => s.removeClass);

  const [section, setSection] = useState<Section>('putra');
  const [level, setLevel] = useState<Level>('ILP');
  const [semester, setSemester] = useState<SemesterNo>(1);
  const [enrolled, setEnrolled] = useState(80);
  const [attrition, setAttrition] = useState(10);

  const cfg = plan?.config;
  const result = useMemo(
    () =>
      cfg
        ? recommendClassCount({
            enrolledNow: enrolled,
            attritionPct: attrition,
            minPerClass: cfg.classMinStudents,
            maxPerClass: cfg.classMaxStudents,
          })
        : null,
    [enrolled, attrition, cfg],
  );

  if (!plan) return <EmptyState title="Belum ada semester aktif" hint="Buat semester di menu Pengaturan." />;

  const groups = groupedClasses(plan);
  const badgeColor = (b: string) =>
    b === 'good'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : b === 'warn'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';

  return (
    <>
      <PageHeader title="Kelas" subtitle="Hitung jumlah kelas ideal lalu buat kelasnya" />

      {/* Calculator */}
      <div className="card mb-6 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <IconGrid width={18} height={18} /> Kalkulator jumlah kelas
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="label">Bagian</span>
            <select className="input" value={section} onChange={(e) => setSection(e.target.value as Section)}>
              <option value="putra">Putra</option>
              <option value="putri">Putri</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Jenjang</span>
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              <option value="ILP">Pemula (ILP)</option>
              <option value="ILL">Lanjutan (ILL)</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Semester</span>
            <select className="input" value={semester} onChange={(e) => setSemester(Number(e.target.value) as SemesterNo)}>
              <option value={1}>Semester 1</option>
              <option value={2}>Semester 2</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Jumlah mahasiswa terdaftar</span>
            <input type="number" className="input" value={enrolled} min={0} onChange={(e) => setEnrolled(toNum(e.target.value))} />
          </label>
          <label className="block">
            <span className="label">Perkiraan mundur (%)</span>
            <input type="number" className="input" value={attrition} min={0} max={100} onChange={(e) => setAttrition(toNum(e.target.value, 0, 100))} />
          </label>
          <div className="flex items-end">
            <div className="w-full rounded-xl bg-brand-50 px-4 py-2.5 text-center dark:bg-brand-900/30">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Proyeksi mahasiswa</p>
              <p className="text-xl font-bold text-brand-800 dark:text-brand-200">{result?.projected ?? 0}</p>
            </div>
          </div>
        </div>

        {result && result.projected > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-slate-900 px-5 py-3 text-white dark:bg-white dark:text-slate-900">
                <span className="text-xs opacity-70">Rekomendasi</span>
                <p className="text-2xl font-bold leading-tight">
                  {result.recommended} kelas <span className="text-sm font-normal opacity-70">≈ {result.avgPerClass.toFixed(0)}/kelas</span>
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={() => setClassCount(section, level, semester, result.recommended, Math.round(result.avgPerClass))}
              >
                <IconCheck width={16} height={16} /> Buat {result.recommended} kelas {SECTION_LABELS[section]} {level}-{semester}
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Skenario</th>
                    <th className="px-4 py-2 font-semibold">Rata-rata / kelas</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {result.scenarios.map((sc) => (
                    <tr key={sc.classes}>
                      <td className="px-4 py-2 font-medium">{sc.classes} kelas</td>
                      <td className="px-4 py-2">{sc.avgPerClass.toFixed(1)} mhs</td>
                      <td className="px-4 py-2">
                        <span className={`badge ${badgeColor(sc.badge)}`}>
                          {sc.badge === 'good' ? 'Ideal' : sc.badge === 'warn' ? 'Mendekati' : 'Di luar rentang'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          className="btn-outline btn-sm"
                          onClick={() => setClassCount(section, level, semester, sc.classes, Math.round(sc.avgPerClass))}
                        >
                          Pakai
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.warnings.map((w, i) => (
              <p key={i} className="mt-2 text-xs text-amber-600 dark:text-amber-400">⚠ {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* Existing classes */}
      <h2 className="mb-3 text-lg font-bold">Kelas semester ini</h2>
      {groups.length === 0 ? (
        <EmptyState title="Belum ada kelas" hint="Gunakan kalkulator di atas untuk membuat kelas." />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={`${g.section}-${g.level}-${g.semester}`} className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">
                  {SECTION_LABELS[g.section]} · {LEVEL_LABELS[g.level]} · Sem {g.semester}
                </h3>
                <span className="text-sm text-slate-500">{g.classes.length} kelas</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {g.classes.map((c) => (
                  <span key={c.id} className="badge gap-1.5 bg-slate-100 py-1.5 pl-3 pr-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {c.label.split(' ').pop()}
                    {c.studentCount != null && <span className="text-slate-400">· {c.studentCount}</span>}
                    <button
                      className="rounded-full p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/40"
                      onClick={() => removeClass(c.id)}
                      aria-label="Hapus kelas"
                    >
                      <IconTrash width={13} height={13} />
                    </button>
                  </span>
                ))}
                <button className="btn-outline btn-sm" onClick={() => addClass(g.section, g.level, g.semester)}>
                  <IconPlus width={14} height={14} /> Kelas
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
