import type { Slot, Teacher } from '../types/model';
import { IconLock, IconUnlock, IconEdit } from './icons';

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
  other = [],
  currentName,
  subjectName,
  tone,
  dupCount = 0,
  onChange,
  onToggleLock,
  onOpenQuickEdit,
}: {
  slot: Slot;
  teacherId: string | null;
  locked: boolean;
  eligible: CellTeacher[];
  other?: CellTeacher[];
  currentName?: string;
  subjectName?: string;
  tone: 'ok' | 'warn' | 'error' | 'empty';
  /** How many subjects this teacher holds in the same class (≥2 = flagged). */
  dupCount?: number;
  onChange: (teacherId: string | null) => void;
  onToggleLock: () => void;
  onOpenQuickEdit?: (teacherId: string) => void;
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
        {eligible.length > 0 && (
          <optgroup label="Memenuhi Syarat">
            {eligible.map((e) => (
              <option key={e.teacher.id} value={e.teacher.id}>
                {e.teacher.name} · {e.load}
                {e.wouldExceedCap ? ' ⚠' : ''}
              </option>
            ))}
          </optgroup>
        )}
        {other.length > 0 && (
          <optgroup label="Pengajar Lain (Tidak Memenuhi Syarat)">
            {other.map((e) => (
              <option key={e.teacher.id} value={e.teacher.id}>
                {e.teacher.name} · {e.load}
                {e.wouldExceedCap ? ' ⚠' : ''}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {teacherId && dupCount >= 2 && (
        <span
          className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
          title={`Pengajar ini mengampu ${dupCount} mata kuliah di kelas yang sama`}
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
      {teacherId && onOpenQuickEdit && (
        <button
          onClick={() => onOpenQuickEdit(teacherId)}
          className="shrink-0 rounded p-1 text-slate-300 hover:text-brand-500"
          aria-label="Pengaturan Cepat"
          title="Ubah SKS atau Kualifikasi Matkul"
        >
          <IconEdit width={14} height={14} />
        </button>
      )}
    </div>
  );
}
