import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store/appStore';
import type { Gender, Level, SemesterNo, Teacher } from '../types/model';
import { LEVEL_LABELS, parseQualKey, qualKey } from '../types/model';
import { Field, Modal, PageHeader, EmptyState } from '../components/ui';
import { IconDownload, IconEdit, IconPlus, IconTrash, IconUsers } from '../components/icons';
import { toNum } from '../lib/num';
import {
  importTeachersFromCSV,
  importTeachersFromExcel,
  teacherTemplateCSV,
  type ImportResult,
} from '../lib/importTeachers';

interface Draft {
  name: string;
  gender: Gender;
  maxSks: number;
  qualifiedKeys: string[];
  active: boolean;
  note: string;
}

const emptyDraft: Draft = {
  name: '',
  gender: 'L',
  maxSks: 24,
  qualifiedKeys: [],
  active: true,
  note: '',
};

const LEVELS: Level[] = ['ILP', 'ILL'];

export default function Teachers() {
  const teachers = useStore((s) => s.teachers);
  const subjects = useStore((s) => s.subjects);
  const master = useStore((s) => s.masterCurriculum);
  const addTeacher = useStore((s) => s.addTeacher);
  const addTeachers = useStore((s) => s.addTeachers);
  const updateTeacher = useStore((s) => s.updateTeacher);
  const deleteTeacher = useStore((s) => s.deleteTeacher);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [subjectSemester, setSubjectSemester] = useState<SemesterNo>(1);

  // ----- bulk import -----
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const onPickFile = async (file: File) => {
    setImporting(true);
    try {
      const isExcel = /\.xlsx?$/i.test(file.name);
      const result = isExcel
        ? await importTeachersFromExcel(file, subjects)
        : importTeachersFromCSV(await file.text(), subjects);
      setImportResult(result);
    } catch (e) {
      setImportResult({ rows: [], errors: [(e as Error).message || 'Gagal membaca file.'] });
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = () => {
    if (importResult && importResult.rows.length > 0) {
      addTeachers(importResult.rows.map((r) => r.draft));
    }
    setImportResult(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([teacherTemplateCSV(subjects)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-pengajar.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sorted = useMemo(
    () => [...teachers].sort((a, b) => a.gender.localeCompare(b.gender) || a.name.localeCompare(b.name)),
    [teachers],
  );

  // Subjects per jenjang (from master curriculum), filtered to the selected semester.
  const subjectsByLevel = (level: Level, semester: SemesterNo) => {
    const m = new Map<string, { id: string; name: string; isTahfidz: boolean; sems: { semester: number; sks: number }[] }>();
    for (const e of master) {
      if (e.level !== level || e.semester !== semester) continue;
      const subject = subjects.find((s) => s.id === e.subjectId);
      if (!subject) continue;
      let rec = m.get(e.subjectId);
      if (!rec) m.set(e.subjectId, (rec = { id: subject.id, name: subject.name, isTahfidz: subject.isTahfidz, sems: [] }));
      rec.sems.push({ semester: e.semester, sks: e.sks });
    }
    return [...m.values()]
      .map((r) => ({ ...r, sems: r.sems.sort((a, b) => a.semester - b.semester) }))
      .sort(
        (a, b) =>
          Math.max(...b.sems.map((s) => s.sks)) - Math.max(...a.sems.map((s) => s.sks)) ||
          a.name.localeCompare(b.name),
      );
  };

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
      qualifiedKeys: [...t.qualifiedKeys],
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
  const toggleKey = (key: string) =>
    setDraft((d) => ({
      ...d,
      qualifiedKeys: d.qualifiedKeys.includes(key)
        ? d.qualifiedKeys.filter((x) => x !== key)
        : [...d.qualifiedKeys, key],
    }));

  return (
    <>
      <PageHeader
        title="Pengajar"
        subtitle={`${teachers.length} pengajar terdaftar`}
        actions={
          <>
            <button className="btn-outline" onClick={downloadTemplate} title="Unduh template CSV untuk diisi">
              <IconDownload width={16} height={16} /> Template
            </button>
            <button className="btn-outline" onClick={() => fileRef.current?.click()} disabled={importing}>
              <IconDownload width={16} height={16} className="rotate-180" />
              {importing ? 'Membaca…' : 'Impor CSV/Excel'}
            </button>
            <button className="btn-primary" onClick={openAdd}>
              <IconPlus width={16} height={16} /> Tambah pengajar
            </button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPickFile(f);
          e.target.value = '';
        }}
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="Belum ada pengajar"
          hint="Tambahkan pengajar beserta jenis kelamin, mata kuliah yang bisa diajar (per jenjang), dan kuota SKS-nya."
          action={
            <button className="btn-primary" onClick={openAdd}>
              <IconPlus width={16} height={16} /> Tambah pengajar
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((t) => {
            const subs = t.qualifiedKeys
              .map((k) => {
                const { level, subjectId } = parseQualKey(k);
                const name = subjects.find((s) => s.id === subjectId)?.name;
                return name ? { name, level } : null;
              })
              .filter((x): x is { name: string; level: Level } => x !== null)
              .sort((a, b) => a.level.localeCompare(b.level) || a.name.localeCompare(b.name));
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
                    subs.map((s, i) => (
                      <span
                        key={i}
                        className={`badge ${s.level === 'ILP' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'}`}
                        title={LEVEL_LABELS[s.level]}
                      >
                        {s.name} · {s.level}
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
                onChange={(e) => setDraft({ ...draft, maxSks: toNum(e.target.value) })}
              />
            </Field>
          </div>

          <div>
            <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_180px] sm:items-end">
              <div>
                <span className="label">Mata kuliah yang bisa diajar (dipisah per jenjang)</span>
                <p className="text-[11px] text-slate-400">
                  Kualifikasi Pemula & Lanjutan terpisah. Daftar di bawah mengikuti semester yang dipilih.
                </p>
              </div>
              <Field label="Semester">
                <select
                  className="input"
                  value={subjectSemester}
                  onChange={(e) => setSubjectSemester(Number(e.target.value) as SemesterNo)}
                >
                  <option value={1}>Semester 1</option>
                  <option value={2}>Semester 2</option>
                </select>
              </Field>
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {LEVELS.map((level) => {
                const list = subjectsByLevel(level, subjectSemester);
                if (list.length === 0) return null;
                return (
                  <div key={level}>
                    <p
                      className={`mb-1 rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                        level === 'ILP'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                      }`}
                    >
                      {LEVEL_LABELS[level]}
                    </p>
                    <div className="space-y-1">
                      {list.map((s) => {
                        const key = qualKey(level, s.id);
                        return (
                          <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded accent-brand-600"
                              checked={draft.qualifiedKeys.includes(key)}
                              onChange={() => toggleKey(key)}
                            />
                            <span className="flex-1 text-sm">
                              {s.name}
                              {s.isTahfidz && <span className="ml-1 badge bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Tahfidz</span>}
                            </span>
                            <span className="flex shrink-0 gap-1">
                              {s.sems.map((sem) => (
                                <span key={sem.semester} className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  S{sem.semester}·{sem.sks}
                                </span>
                              ))}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {master.length === 0 && <p className="px-2 py-2 text-xs text-slate-400">Belum ada kurikulum. Isi dulu di menu Kurikulum.</p>}
            </div>
          </div>

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

      <Modal open={importResult !== null} onClose={() => setImportResult(null)} title="Pratinjau impor pengajar" wide>
        {importResult && (
          <div className="space-y-4">
            {importResult.errors.length > 0 && (
              <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                {importResult.errors.map((e, i) => (
                  <p key={i}>⚠ {e}</p>
                ))}
              </div>
            )}
            {importResult.rows.length > 0 && (
              <>
                <p className="text-sm text-slate-500">
                  {importResult.rows.length} pengajar terbaca. Periksa lalu konfirmasi untuk menambahkan.
                </p>
                <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  {importResult.rows.map((r, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${r.draft.gender === 'L' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300'}`}>
                          {r.draft.gender === 'L' ? 'Putra' : 'Putri'}
                        </span>
                        <span className="font-semibold">{r.draft.name}</span>
                        <span className="text-xs text-slate-400">· {r.draft.maxSks} SKS · {r.draft.qualifiedKeys.length} matkul{r.draft.active ? '' : ' · nonaktif'}</span>
                      </div>
                      {r.warnings.map((w, j) => (
                        <p key={j} className="mt-1 text-xs text-amber-600 dark:text-amber-400">⚠ {w}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-outline" onClick={() => setImportResult(null)}>
                Batal
              </button>
              <button className="btn-primary" onClick={confirmImport} disabled={importResult.rows.length === 0}>
                <IconUsers width={16} height={16} /> Tambah {importResult.rows.length} pengajar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
