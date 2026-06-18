import { useStore, useActivePlan } from '../store/appStore';
import type { PlanConfig } from '../types/model';
import { PageHeader, Field, EmptyState } from '../components/ui';
import { IconPlus, IconTrash } from '../components/icons';
import { toNum } from '../lib/num';

export default function Settings() {
  const plans = useStore((s) => s.plans);
  const activePlanId = useStore((s) => s.activePlanId);
  const plan = useActivePlan();
  const createPlan = useStore((s) => s.createPlan);
  const duplicatePlan = useStore((s) => s.duplicatePlan);
  const renamePlan = useStore((s) => s.renamePlan);
  const deletePlan = useStore((s) => s.deletePlan);
  const setActivePlan = useStore((s) => s.setActivePlan);
  const updatePlanConfig = useStore((s) => s.updatePlanConfig);
  const resetAll = useStore((s) => s.resetAll);

  const num = (key: keyof PlanConfig, label: string, hint?: string, step = 1) => (
    <Field label={label}>
      <input
        type="number"
        className="input"
        step={step}
        value={(plan?.config[key] as number) ?? 0}
        min={0}
        onChange={(e) => updatePlanConfig({ [key]: toNum(e.target.value) } as Partial<PlanConfig>)}
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </Field>
  );

  return (
    <>
      <PageHeader title="Pengaturan" />

      {/* Plans */}
      <div className="card mb-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Semester</h3>
          <button
            className="btn-primary btn-sm"
            onClick={() => {
              const name = prompt('Nama semester baru:', 'Semester Baru');
              if (name !== null) createPlan(name);
            }}
          >
            <IconPlus width={14} height={14} /> Baru
          </button>
        </div>
        <div className="space-y-2">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${
                p.id === activePlanId ? 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <button className="flex-1 text-left" onClick={() => setActivePlan(p.id)}>
                <span className="font-medium">{p.name}</span>
                {p.id === activePlanId && <span className="ml-2 badge bg-brand-600 text-white">Aktif</span>}
                <span className="block text-xs text-slate-400">{p.classGroups.length} kelas · {p.slots.length} slot</span>
              </button>
              <div className="flex gap-1">
                <button
                  className="btn-outline btn-sm"
                  onClick={() => {
                    const name = prompt('Nama baru:', p.name);
                    if (name) renamePlan(p.id, name);
                  }}
                >
                  Ubah nama
                </button>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => {
                    const name = prompt('Nama salinan:', `${p.name} (salinan)`);
                    if (name !== null) duplicatePlan(p.id, name);
                  }}
                >
                  Duplikat
                </button>
                <button
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                  onClick={() => {
                    if (plans.length <= 1) return alert('Minimal harus ada satu semester.');
                    if (confirm(`Hapus semester "${p.name}"?`)) deletePlan(p.id);
                  }}
                  aria-label="Hapus semester"
                >
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Config */}
      {plan ? (
        <div className="card mb-6 p-5">
          <h3 className="mb-1 font-semibold">Aturan pembagian (semester aktif)</h3>
          <p className="mb-4 text-xs text-slate-400">Berlaku untuk "{plan.name}". Ubah lalu tekan "Susun otomatis" lagi.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {num('targetMinSksPerTeacher', 'Target minimal SKS / pengajar', 'Idealnya 24. Otomatis dilonggarkan bila kuota pengajar < target.')}
            {num('maxClassesPerSubjectPerTeacher', 'Maks kelas sama / mata kuliah', 'Tahfidz dikecualikan.')}
            {num('maxSksPerTeacherPerClass', 'Maks SKS pengajar dalam 1 kelas', 'Agar 1 kelas diisi beberapa pengajar. Tahfidz dikecualikan.')}
            {num('classMinStudents', 'Minimal mahasiswa / kelas')}
            {num('classMaxStudents', 'Maksimal mahasiswa / kelas')}
          </div>
          <h4 className="mb-2 mt-5 text-sm font-semibold text-slate-600 dark:text-slate-300">Bobot algoritma (lanjutan)</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Dorong ke target">
              <input type="number" className="input" step={0.5} value={plan.config.weights.underTargetPenalty}
                onChange={(e) => updatePlanConfig({ weights: { ...plan.config.weights, underTargetPenalty: toNum(e.target.value) } })} />
            </Field>
            <Field label="Penalti variasi kelas">
              <input type="number" className="input" step={0.5} value={plan.config.weights.perClassVarietyPenalty}
                onChange={(e) => updatePlanConfig({ weights: { ...plan.config.weights, perClassVarietyPenalty: toNum(e.target.value) } })} />
            </Field>
            <Field label="Pemerataan beban">
              <input type="number" className="input" step={0.1} value={plan.config.weights.loadBalancePenalty}
                onChange={(e) => updatePlanConfig({ weights: { ...plan.config.weights, loadBalancePenalty: toNum(e.target.value) } })} />
            </Field>
          </div>
        </div>
      ) : (
        <EmptyState title="Tidak ada semester aktif" />
      )}

      {/* Danger zone */}
      <div className="card border-rose-200 p-5 dark:border-rose-900/50">
        <h3 className="mb-1 font-semibold text-rose-600">Reset</h3>
        <p className="mb-3 text-sm text-slate-500">Menghapus semua data dan mengembalikan kurikulum bawaan. Tidak bisa dibatalkan.</p>
        <button
          className="btn-danger"
          onClick={() => {
            if (confirm('Hapus SEMUA data (pengajar, kelas, pembagian)? Pastikan sudah ekspor cadangan.')) resetAll();
          }}
        >
          <IconTrash width={16} height={16} /> Reset semua data
        </button>
      </div>
    </>
  );
}
