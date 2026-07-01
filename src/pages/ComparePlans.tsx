import { useMemo } from 'react';
import { useStore } from '../store/appStore';
import { validatePlan } from '../solver/validate';
import { PageHeader, EmptyState } from '../components/ui';
import { IconCheck, IconTrash, IconWarn, IconCopy } from '../components/icons';

export default function ComparePlans() {
  const plans = useStore((s) => s.plans);
  const activePlanId = useStore((s) => s.activePlanId);
  const teachers = useStore((s) => s.teachers);
  const subjects = useStore((s) => s.subjects);
  const setActivePlan = useStore((s) => s.setActivePlan);
  const duplicatePlan = useStore((s) => s.duplicatePlan);
  const deletePlan = useStore((s) => s.deletePlan);

  const comparisons = useMemo(() => {
    return plans.map((plan) => {
      const report = validatePlan({
        slots: plan.slots,
        assignments: plan.assignments,
        teachers,
        subjects,
        classGroups: plan.classGroups,
        config: plan.config,
      });

      const totalClasses = plan.classGroups.length;
      const classPutra = plan.classGroups.filter((c) => c.section === 'putra').length;
      const classPutri = plan.classGroups.filter((c) => c.section === 'putri').length;

      let totalSksNeeded = 0;
      let totalSksAssigned = 0;
      const assignedTeacherIds = new Set<string>();

      const assignmentMap = new Map(plan.assignments.map((a) => [a.slotId, a.teacherId]));

      for (const slot of plan.slots) {
        totalSksNeeded += slot.sks;
        const tid = assignmentMap.get(slot.id);
        if (tid) {
          totalSksAssigned += slot.sks;
          assignedTeacherIds.add(tid);
        }
      }

      return {
        id: plan.id,
        name: plan.name,
        totalClasses,
        classPutra,
        classPutri,
        totalSksNeeded,
        totalSksAssigned,
        teachersUsed: assignedTeacherIds.size,
        errors: report.errorCount,
        warnings: report.warningCount,
      };
    });
  }, [plans, teachers, subjects]);

  const activeTeachersCount = teachers.filter((t) => t.active).length;

  if (plans.length < 2) {
    return (
      <>
        <PageHeader title="Komparasi Skenario" subtitle="Bandingkan berbagai versi pembagian SKS" />
        <EmptyState
          title="Belum cukup skenario untuk dibandingkan"
          hint="Buat minimal 2 skenario pembagian di menu Pembagian (menggunakan fitur Simpan Skenario) untuk membandingkannya di sini."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Komparasi Skenario" subtitle="Bandingkan berbagai versi pembagian SKS" />

      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4">
          {comparisons.map((comp) => {
            const isActive = comp.id === activePlanId;
            return (
              <div
                key={comp.id}
                className={`card flex min-w-[280px] max-w-sm flex-col p-5 shadow-sm transition-all ${
                  isActive ? 'ring-2 ring-brand-500 dark:ring-brand-400' : ''
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold truncate pr-2">{comp.name}</h3>
                  {isActive && (
                    <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                      Aktif
                    </span>
                  )}
                </div>

                <div className="mb-6 space-y-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jumlah Kelas</p>
                    <p className="mt-1 text-2xl font-bold">{comp.totalClasses}</p>
                    <p className="text-sm text-slate-400">{comp.classPutra} Putra, {comp.classPutri} Putri</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kebutuhan SKS</p>
                    <p className="mt-1 text-2xl font-bold">{comp.totalSksNeeded}</p>
                    <p className="text-sm text-slate-400">Total SKS untuk seluruh kelas</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKS Terisi</p>
                    <p className={`mt-1 text-2xl font-bold ${comp.totalSksAssigned < comp.totalSksNeeded ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {comp.totalSksAssigned}
                    </p>
                    <p className="text-sm text-slate-400">{(comp.totalSksNeeded > 0 ? (comp.totalSksAssigned / comp.totalSksNeeded * 100).toFixed(0) : 0)}% teralokasikan</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pengajar Terlibat</p>
                    <p className="mt-1 text-2xl font-bold">{comp.teachersUsed}</p>
                    <p className="text-sm text-slate-400">dari {activeTeachersCount} pengajar aktif</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Validasi</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <IconWarn width={16} height={16} className={comp.errors > 0 ? 'text-rose-500' : 'text-emerald-500'} />
                        <span className={`font-semibold ${comp.errors > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{comp.errors} Error</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <IconWarn width={16} height={16} className={comp.warnings > 0 ? 'text-amber-500' : 'text-emerald-500'} />
                        <span className={`font-semibold ${comp.warnings > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{comp.warnings} Peringatan</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    onClick={() => setActivePlan(comp.id)}
                    disabled={isActive}
                    className={`btn w-full ${isActive ? 'btn-ghost' : 'btn-primary'}`}
                  >
                    {isActive ? (
                      <>
                        <IconCheck width={18} height={18} /> Skenario Aktif
                      </>
                    ) : (
                      'Pilih Skenario Ini'
                    )}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const name = prompt('Nama duplikat:', `${comp.name} (salinan)`);
                        if (name) duplicatePlan(comp.id, name);
                      }}
                      className="btn-outline flex-1 px-2 py-1.5 text-xs"
                      title="Duplikat Skenario"
                    >
                      <IconCopy width={14} height={14} /> Duplikat
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Hapus skenario "${comp.name}"?`)) deletePlan(comp.id);
                      }}
                      disabled={plans.length <= 1}
                      className="btn-outline flex-1 px-2 py-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Hapus Skenario"
                    >
                      <IconTrash width={14} height={14} /> Hapus
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
