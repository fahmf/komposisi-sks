import { useMemo, useState } from 'react';
import { useStore } from '../store/appStore';
import type { Gender, Teacher } from '../types/model';
import { Field, Modal, PageHeader, EmptyState } from '../components/ui';
import { IconEdit, IconPlus, IconTrash, IconUsers } from '../components/icons';

interface Draft {
  name: string;
  gender: Gender;
  maxSks: number;
  qualifiedSubjectIds: string[];
  active: boolean;
  note: string;
}

const emptyDraft: Draft = {
  name: '',
  gender: 'L',
  maxSks: 32,
  qualifiedSubjectIds: [],
  active: true,
  note: '',
};

export default function Teachers() {
  const teachers = useStore((s) => s.teachers);
  const subjects = useStore((s) => s.subjects);
  const addTeacher = useStore((s) => s.addTeacher);
  const updateTeacher = useStore((s) => s.updateTeacher);
  const deleteTeacher = useStore((s) => s.deleteTeacher);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const sorted = useMemo(
    () => [...teachers].sort((a, b) => a.gender.localeCompare(b.gender) || a.name.localeCompare(b.name)),
    [teachers],
  );

  const openAdd = () => {
    setEditId(null);
    setDraft(emptyDraft);
    setOpen(true);
  };
  const openEdit = (t: Teacher) => {
    setEditId(t.id);
    setDraft({
      name: t.name,
      gender: t.gender,
      maxSks: t.maxSks,
      qualifiedSubjectIds: [...t.qualifiedSubjectIds],
      active: t.active,
      note: t.note ?? '',
    });
    setOpen(true);
  };
  const save = () => {
    if (!draft.name.trim()) return;
    const payload = { ...draft, name: draft.name.trim() };
    if (editId) updateTeacher(editId, payload);
    else addTeacher(payload);
    setOpen(false);
  };
  const toggleSubject = (id: string) =>
    setDraft((d) => ({
      ...d,
      qualifiedSubjectIds: d.qualifiedSubjectIds.includes(id)
        ? d.qualifiedSubjectIds.filter((x) => x !== id)
        : [...d.qualifiedSubjectIds, id],
    }));

  return (
    <>
      <PageHeader
        title="Pengajar"
        subtitle={`${teachers.length} pengajar terdaftar`}
        actions={
          <button className="btn-primary" onClick={openAdd}>
            <IconPlus width={16} height={16} /> Tambah pengajar
          </button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="Belum ada pengajar"
          hint="Tambahkan pengajar beserta jenis kelamin, mata kuliah yang bisa diajar, dan kuota SKS-nya."
          action={
            <button className="btn-primary" onClick={openAdd}>
              <IconPlus width={16} height={16} /> Tambah pengajar
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((t) => {
            const subs = t.qualifiedSubjectIds
              .map((id) => subjects.find((s) => s.id === id)?.name)
              .filter(Boolean);
            return (
              <div key={t.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${t.gender === 'L' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300'}`}>
                        {t.gender === 'L' ? 'Putra' : 'Putri'}
                      </span>
                      {!t.active && <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Nonaktif</span>}
                    </div>
                    <p className="mt-1.5 truncate font-semibold">{t.name}</p>
                    <p className="text-xs text-slate-500">Kuota maks {t.maxSks} SKS</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" onClick={() => openEdit(t)} aria-label="Edit">
                      <IconEdit width={16} height={16} />
                    </button>
                    <button
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                      onClick={() => {
                        if (confirm(`Hapus pengajar "${t.name}"?`)) deleteTeacher(t.id);
                      }}
                      aria-label="Hapus"
                    >
                      <IconTrash width={16} height={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {subs.length === 0 ? (
                    <span className="text-xs text-amber-600">Belum ada mata kuliah</span>
                  ) : (
                    subs.map((name) => (
                      <span key={name} className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit pengajar' : 'Tambah pengajar'} wide>
        <div className="space-y-4">
          <Field label="Nama">
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nama pengajar" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jenis kelamin">
              <div className="flex gap-2">
                {(['L', 'P'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setDraft({ ...draft, gender: g })}
                    className={`btn flex-1 ${draft.gender === g ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {g === 'L' ? 'Putra (L)' : 'Putri (P)'}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Kuota maks SKS">
              <input
                type="number"
                className="input"
                value={draft.maxSks}
                min={0}
                onChange={(e) => setDraft({ ...draft, maxSks: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Mata kuliah yang bisa diajar">
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {subjects.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-brand-600"
                    checked={draft.qualifiedSubjectIds.includes(s.id)}
                    onChange={() => toggleSubject(s.id)}
                  />
                  <span className="text-sm">{s.name}</span>
                  {s.isTahfidz && <span className="badge bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Tahfidz</span>}
                </label>
              ))}
            </div>
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            <span className="text-sm">Aktif semester ini</span>
          </label>
          <Field label="Catatan (opsional)">
            <input className="input" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="mis. berbagi dengan divisi tahfizh" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-outline" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={save} disabled={!draft.name.trim()}>
              <IconUsers width={16} height={16} /> Simpan
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
