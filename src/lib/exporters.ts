import type { SemesterPlan, Subject, Teacher } from '../types/model';
import { LEVEL_LABELS, SECTION_LABELS } from '../types/model';
import { classMap, subjMap, teacherMap } from './derived';

export interface AssignmentRow {
  bagian: string;
  jenjang: string;
  semester: number;
  kelas: string;
  mataKuliah: string;
  sks: number;
  pengajar: string;
}

export function buildRows(plan: SemesterPlan, teachers: Teacher[], subjects: Subject[]): AssignmentRow[] {
  const cm = classMap(plan);
  const sm = subjMap(subjects);
  const tm = teacherMap(teachers);
  const bySlot = new Map(plan.assignments.map((a) => [a.slotId, a]));
  const rows: AssignmentRow[] = [];
  for (const slot of plan.slots) {
    const cg = cm.get(slot.classGroupId);
    if (!cg) continue;
    const a = bySlot.get(slot.id);
    const teacher = a?.teacherId ? tm.get(a.teacherId) : undefined;
    rows.push({
      bagian: SECTION_LABELS[slot.section],
      jenjang: LEVEL_LABELS[cg.level],
      semester: cg.semester,
      kelas: cg.label,
      mataKuliah: sm.get(slot.subjectId)?.name ?? slot.subjectId,
      sks: slot.sks,
      pengajar: teacher?.name ?? '— belum ada —',
    });
  }
  return rows.sort(
    (a, b) =>
      a.bagian.localeCompare(b.bagian) ||
      a.jenjang.localeCompare(b.jenjang) ||
      a.semester - b.semester ||
      a.kelas.localeCompare(b.kelas) ||
      b.sks - a.sks,
  );
}

export interface TeacherSchedule {
  teacher: Teacher;
  totalSks: number;
  rows: { kelas: string; mataKuliah: string; sks: number; bagian: string }[];
}

export function buildTeacherSchedules(
  plan: SemesterPlan,
  teachers: Teacher[],
  subjects: Subject[],
): TeacherSchedule[] {
  const cm = classMap(plan);
  const sm = subjMap(subjects);
  const bySlot = new Map(plan.assignments.map((a) => [a.slotId, a]));
  const map = new Map<string, TeacherSchedule>();
  for (const t of teachers) map.set(t.id, { teacher: t, totalSks: 0, rows: [] });
  for (const slot of plan.slots) {
    const a = bySlot.get(slot.id);
    if (!a?.teacherId) continue;
    const sched = map.get(a.teacherId);
    const cg = cm.get(slot.classGroupId);
    if (!sched || !cg) continue;
    sched.totalSks += slot.sks;
    sched.rows.push({
      kelas: cg.label,
      mataKuliah: sm.get(slot.subjectId)?.name ?? slot.subjectId,
      sks: slot.sks,
      bagian: SECTION_LABELS[slot.section],
    });
  }
  for (const s of map.values()) s.rows.sort((a, b) => a.kelas.localeCompare(b.kelas) || b.sks - a.sks);
  return [...map.values()]
    .filter((s) => s.rows.length > 0)
    .sort((a, b) => a.teacher.gender.localeCompare(b.teacher.gender) || a.teacher.name.localeCompare(b.teacher.name));
}

function download(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCSV(plan: SemesterPlan, teachers: Teacher[], subjects: Subject[]) {
  const rows = buildRows(plan, teachers, subjects);
  const header = ['Bagian', 'Jenjang', 'Semester', 'Kelas', 'Mata Kuliah', 'SKS', 'Pengajar'];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.bagian, r.jenjang, r.semester, r.kelas, r.mataKuliah, r.sks, r.pengajar].map(esc).join(','));
  }
  download(`jadwal-${slug(plan.name)}.csv`, '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
}

export async function exportExcel(plan: SemesterPlan, teachers: Teacher[], subjects: Subject[]) {
  const XLSX = await import('xlsx');
  const rows = buildRows(plan, teachers, subjects);
  const schedules = buildTeacherSchedules(plan, teachers, subjects);
  const wb = XLSX.utils.book_new();

  const perKelas = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      Bagian: r.bagian,
      Jenjang: r.jenjang,
      Semester: r.semester,
      Kelas: r.kelas,
      'Mata Kuliah': r.mataKuliah,
      SKS: r.sks,
      Pengajar: r.pengajar,
    })),
  );
  XLSX.utils.book_append_sheet(wb, perKelas, 'Per Kelas');

  const perPengajar = XLSX.utils.json_to_sheet(
    schedules.flatMap((s) =>
      s.rows.map((r) => ({
        Pengajar: s.teacher.name,
        Bagian: r.bagian,
        Kelas: r.kelas,
        'Mata Kuliah': r.mataKuliah,
        SKS: r.sks,
      })),
    ),
  );
  XLSX.utils.book_append_sheet(wb, perPengajar, 'Per Pengajar');

  const rekap = XLSX.utils.json_to_sheet(
    schedules.map((s) => ({
      Pengajar: s.teacher.name,
      Bagian: s.teacher.gender === 'L' ? 'Putra' : 'Putri',
      'Total SKS': s.totalSks,
      'Jumlah Kelas': new Set(s.rows.map((r) => r.kelas)).size,
      'Kuota Maks': s.teacher.maxSks,
    })),
  );
  XLSX.utils.book_append_sheet(wb, rekap, 'Rekap Pengajar');

  XLSX.writeFile(wb, `jadwal-${slug(plan.name)}.xlsx`);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'semester';
}
