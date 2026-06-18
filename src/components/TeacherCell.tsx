import type { Slot, Teacher } from '../types/model';
import { IconLock, IconUnlock } from './icons';

export interface CellTeacher {
  teacher: Teacher;
  load: number;
  wouldExceedCap: boolean;
}

export default function TeacherCell({
  slot,
  teacherId,
  locked,
  eligible,
  currentName,
  subjectName,
  tone,
  dupCount = 0,
  dupViolation = false,
  onChange,
  onToggleLock,
}: {
  slot: Slot;
  teacherId: string | null;
  locked: boolean;
  eligible: CellTeacher[];
  currentName?: string;
  subjectName?: string;
  tone: 'ok' | 'warn' | 'error' | 'empty';
  /** How many subjects this teacher holds in the same class (≥2 = flagged). */
  dupCount?: number;
  /** True when the per-class combo breaks the rule (red) vs. the allowed pairing (blue). */
  dupViolation?: boolean;
  onChange: (teacherId: string | null) => void;
  onToggleLock: () => void;
}) {
  const ring =
    tone === 'error'
      ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30'
      : tone === 'warn'
        ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'
        : tone === 'empty'
          ? 'border-dashed border-slate-300 dark:border-slate-700'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';

  // If the current teacher is no longer eligible, still surface them as an option.
  const hasCurrent = teacherId && eligible.some((e) => e.teacher.id === teacherId);

  return (
    <div className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 ${ring}`}>
      <select
        className="min-w-0 flex-1 bg-transparent py-1 text-sm focus:outline-none"
        value={teacherId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={`Pengajar untuk ${subjectName ?? slot.subjectId}`}
      >
        <option value="">— pilih —</option>
        {!hasCurrent && teacherId && <option value={teacherId}>{currentName ?? '(tidak memenuhi syarat)'}</option>}
        {eligible.map((e) => (
          <option key={e.teacher.id} value={e.teacher.id}>
            {e.teacher.name} · {e.load}
            {e.wouldExceedCap ? ' ⚠' : ''}
          </option>
        ))}
      </select>
      {teacherId && dupCount >= 2 && (
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            dupViolation
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
              : 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
          }`}
          title={
            dupViolation
              ? `Tidak boleh: ${dupCount} mata kuliah di kelas yang sama (maks 1, kecuali 1 matkul maks 4 SKS + Hifzhul Qur'an)`
              : `Diizinkan: 1 matkul (maks 4 SKS) + Hifzhul Qur'an di kelas yang sama`
          }
        >
          {dupCount}×
        </span>
      )}
      {teacherId && (
        <button
          onClick={onToggleLock}
          className={`shrink-0 rounded p-1 ${locked ? 'text-brand-600' : 'text-slate-300 hover:text-slate-500'}`}
          aria-label={locked ? 'Buka kunci' : 'Kunci'}
          title={locked ? 'Terkunci (tidak diubah saat auto)' : 'Kunci agar tidak diubah saat auto'}
        >
          {locked ? <IconLock width={14} height={14} /> : <IconUnlock width={14} height={14} />}
        </button>
      )}
    </div>
  );
}
