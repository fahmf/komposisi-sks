import { useState } from 'react';
import { useStore } from '../store/appStore';
import type { Level, SemesterNo } from '../types/model';
import { LEVEL_LABELS } from '../types/model';
import { Field, Modal, PageHeader } from '../components/ui';
import { IconEdit, IconPlus, IconTrash } from '../components/icons';

const LEVEL_SEM: { level: Level; semester: SemesterNo }[] = [
  { level: 'ILP', semester: 1 },
  { level: 'ILP', semester: 2 },
  { level: 'ILL', semester: 1 },
  { level: 'ILL', semester: 2 },
];

export default function Subjects() {
  const subjects = useStore((s) => s.subjects);
  const master = useStore((s) => s.masterCurriculum);
  const addSubject = useStore((s) => s.addSubject);
  const updateSubject = useStore((s) => s.updateSubject);
  const deleteSubject = useStore((s) => s.deleteSubject);
  const setMasterSks = useStore((s) => s.setMasterSks);
  const addMasterEntry = useStore((s) => s.addMasterEntry);
  const removeMasterEntry = useStore((s) => s.removeMasterEntry);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isTahfidz, setIsTahfidz] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    if (editId) updateSubject(editId, { name: name.trim(), isTahfidz });
    else addSubject({ name: name.trim(), isTahfidz });
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Kurikulum"
        subtitle="Daftar mata kuliah & bobot SKS tiap jenjang/semester"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setEditId(null);
              setName('');
              setIsTahfidz(false);
              setOpen(true);
            }}
          >
            <IconPlus width={16} height={16} /> Mata kuliah
          </button>
        }
      />

      <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        Perubahan di sini menjadi template. Semester yang sudah dibuat tetap memakai kurikulum saat dibuat — buat semester baru untuk memakai template terbaru.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {LEVEL_SEM.map(({ level, semester }) => {
          const entries = master
            .filter((e) => e.level === level && e.semester === semester)
            .map((e) => ({ ...e, subject: subjects.find((s) => s.id === e.subjectId) }))
            .sort((a, b) => b.sks - a.sks);
          const total = entries.reduce((sum, e) => sum + e.sks, 0);
          const unused = subjects.filter((s) => !entries.some((e) => e.subjectId === s.id));
          return (
            <div key={`${level}-${semester}`} className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">
                  {LEVEL_LABELS[level]} · Semester {semester}
                </h3>
                <span
                  className={`badge ${
                    total === 32
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                  }`}
                >
                  {total} / 32 SKS
                </span>
              </div>
              <div className="space-y-1">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm">
                      {e.subject?.name ?? '—'}
                      {e.subject?.isTahfidz && <span className="ml-1 text-[10px] text-violet-500">tahfidz</span>}
                    </span>
                    <input
                      type="number"
                      className="input w-20 py-1.5 text-center"
                      value={e.sks}
                      min={0}
                      step={2}
                      onChange={(ev) => setMasterSks(level, semester, e.subjectId, Number(ev.target.value))}
                    />
                    <button
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                      onClick={() => removeMasterEntry(e.id)}
                      aria-label="Hapus dari kurikulum"
                    >
                      <IconTrash width={15} height={15} />
                    </button>
                  </div>
                ))}
                {entries.length === 0 && <p className="text-xs text-slate-400">Belum ada mata kuliah.</p>}
              </div>
              {unused.length > 0 && (
                <select
                  className="input mt-3 text-sm"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addMasterEntry(level, semester, e.target.value, 2);
                  }}
                >
                  <option value="">+ Tambah mata kuliah ke semester ini…</option>
                  {unused.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">Semua mata kuliah</h2>
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {subjects.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{s.name}</span>
              {s.isTahfidz && <span className="badge bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Tahfidz</span>}
            </div>
            <div className="flex gap-1">
              <button
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                onClick={() => {
                  setEditId(s.id);
                  setName(s.name);
                  setIsTahfidz(s.isTahfidz);
                  setOpen(true);
                }}
                aria-label="Edit"
              >
                <IconEdit width={16} height={16} />
              </button>
              <button
                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                onClick={() => {
                  if (confirm(`Hapus mata kuliah "${s.name}"? Ini juga menghapusnya dari kurikulum & kualifikasi pengajar.`)) deleteSubject(s.id);
                }}
                aria-label="Hapus"
              >
                <IconTrash width={16} height={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit mata kuliah' : 'Tambah mata kuliah'}>
        <div className="space-y-4">
          <Field label="Nama mata kuliah">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="mis. Balaghah" />
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={isTahfidz} onChange={(e) => setIsTahfidz(e.target.checked)} />
            <span className="text-sm">Mata kuliah tahfidz (dikecualikan dari batas kelas & variasi)</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-outline" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={save} disabled={!name.trim()}>
              Simpan
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
