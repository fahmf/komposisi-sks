import type { Gender, Level, Subject, Teacher } from '../types/model';
import { qualKey } from '../types/model';

// ===========================================================================
// Bulk teacher import from CSV (native, safe parser) or Excel (SheetJS, lazy).
// Columns (header row, case-insensitive; order-independent):
//   Nama | JenisKelamin | KuotaSKS | Aktif | Catatan | Kualifikasi
// Kualifikasi cell: "Jenjang:MataKuliah" entries separated by | or ;  e.g.
//   "ILP:Qiraah | ILL:Fiqh"  (subject matched by name; jenjang = ILP/Pemula, ILL/Lanjutan)
// ===========================================================================

export type TeacherDraft = Omit<Teacher, 'id'>;

export interface ParsedTeacherRow {
  draft: TeacherDraft;
  warnings: string[];
}

export interface ImportResult {
  rows: ParsedTeacherRow[];
  errors: string[]; // file-level problems (empty, no headers, …)
}

const norm = (s: string) => s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const normKey = (s: string) => norm(s).replace(/[\s_]+/g, '');

/** RFC-4180-ish CSV parser (handles quotes, escaped quotes, CRLF). Detects
 *  comma vs semicolon delimiter from the first non-empty line. */
export function parseCSV(input: string): string[][] {
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\r') { /* skip */ }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Map a header-keyed record to one of our known fields. */
type Field = 'name' | 'gender' | 'maxSks' | 'active' | 'note' | 'quals';
const HEADER_ALIASES: Record<string, Field> = {
  nama: 'name', name: 'name', namapengajar: 'name',
  jeniskelamin: 'gender', gender: 'gender', jk: 'gender', kelamin: 'gender',
  kuotasks: 'maxSks', kuota: 'maxSks', maxsks: 'maxSks', sks: 'maxSks', kuotamakssks: 'maxSks',
  aktif: 'active', active: 'active', status: 'active',
  catatan: 'note', note: 'note', keterangan: 'note',
  kualifikasi: 'quals', matakuliah: 'quals', mapel: 'quals', matkul: 'quals', kompetensi: 'quals',
};

function toRecords(rows: string[][]): Record<Field, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => HEADER_ALIASES[normKey(h)]);
  return rows.slice(1).map((cols) => {
    const rec = { name: '', gender: '', maxSks: '', active: '', note: '', quals: '' } as Record<Field, string>;
    headers.forEach((field, idx) => {
      if (field) rec[field] = (cols[idx] ?? '').trim();
    });
    return rec;
  });
}

function parseGender(v: string): Gender | null {
  const n = norm(v);
  if (['l', 'laki', 'laki-laki', 'lakilaki', 'pria', 'putra', 'm', 'male'].includes(n)) return 'L';
  if (['p', 'perempuan', 'wanita', 'putri', 'f', 'female'].includes(n)) return 'P';
  return null;
}

function parseActive(v: string): boolean {
  const n = norm(v);
  if (n === '') return true; // default active
  return !['tidak', 'no', 'nonaktif', 'non-aktif', 'false', '0', 'n', 'off'].includes(n);
}

function parseLevel(v: string): Level | null {
  const n = norm(v);
  if (['ilp', 'pemula', 'p'].includes(n)) return 'ILP';
  if (['ill', 'lanjutan', 'l'].includes(n)) return 'ILL';
  return null;
}

/** Resolve "ILP:Qiraah | ILL:Fiqh" into qualifiedKeys, collecting warnings. */
function parseQuals(cell: string, subjects: Subject[]): { keys: string[]; warnings: string[] } {
  const byName = new Map(subjects.map((s) => [norm(s.name), s.id]));
  const keys = new Set<string>();
  const warnings: string[] = [];
  for (const part of cell.split(/[|;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const idx = part.indexOf(':');
    if (idx < 0) {
      warnings.push(`Kualifikasi "${part}" diabaikan (format: Jenjang:MataKuliah).`);
      continue;
    }
    const level = parseLevel(part.slice(0, idx));
    const subjId = byName.get(norm(part.slice(idx + 1)));
    if (!level) { warnings.push(`Jenjang pada "${part}" tidak dikenal (pakai ILP/ILL).`); continue; }
    if (!subjId) { warnings.push(`Mata kuliah "${part.slice(idx + 1).trim()}" tidak ditemukan.`); continue; }
    keys.add(qualKey(level, subjId));
  }
  return { keys: [...keys], warnings };
}

function mapRecords(records: Record<Field, string>[], subjects: Subject[]): ParsedTeacherRow[] {
  const out: ParsedTeacherRow[] = [];
  for (const rec of records) {
    const warnings: string[] = [];
    const name = rec.name.trim();
    if (!name) continue; // skip blank rows silently

    const gender = parseGender(rec.gender);
    if (!gender) warnings.push(`Jenis kelamin "${rec.gender}" tidak dikenal — diisi default L (Putra).`);

    const maxNum = Number(rec.maxSks);
    const maxSks = Number.isFinite(maxNum) && maxNum > 0 ? Math.floor(maxNum) : 24;
    if (rec.maxSks.trim() && !(Number.isFinite(maxNum) && maxNum > 0)) {
      warnings.push(`Kuota SKS "${rec.maxSks}" tidak valid — diisi default 24.`);
    }

    const { keys, warnings: qWarn } = parseQuals(rec.quals, subjects);
    warnings.push(...qWarn);

    out.push({
      draft: {
        name,
        gender: gender ?? 'L',
        maxSks,
        qualifiedKeys: keys,
        active: parseActive(rec.active),
        note: rec.note.trim() || undefined,
      },
      warnings,
    });
  }
  return out;
}

/** Parse a CSV string. */
export function importTeachersFromCSV(text: string, subjects: Subject[]): ImportResult {
  const rows = parseCSV(text);
  if (rows.length === 0) return { rows: [], errors: ['File kosong.'] };
  if (rows.length < 2) return { rows: [], errors: ['Hanya ada baris judul; belum ada data pengajar.'] };
  const records = toRecords(rows);
  const parsed = mapRecords(records, subjects);
  if (parsed.length === 0) return { rows: [], errors: ['Tidak ada baris pengajar yang terbaca (cek kolom "Nama").'] };
  return { rows: parsed, errors: [] };
}

/** Parse the first sheet of an Excel file (xlsx is loaded lazily). */
export async function importTeachersFromExcel(file: File, subjects: Subject[]): Promise<ImportResult> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [], errors: ['Tidak ada sheet pada file Excel.'] };
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, raw: false });
  const grid = rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []));
  if (grid.length < 2) return { rows: [], errors: ['Hanya ada baris judul; belum ada data pengajar.'] };
  const parsed = mapRecords(toRecords(grid), subjects);
  if (parsed.length === 0) return { rows: [], errors: ['Tidak ada baris pengajar yang terbaca (cek kolom "Nama").'] };
  return { rows: parsed, errors: [] };
}

/** A ready-to-fill CSV template seeded with one example row. */
export function teacherTemplateCSV(subjects: Subject[]): string {
  const a = subjects[0]?.name ?? 'Qiraah';
  const b = subjects[1]?.name ?? 'Tauhid';
  const header = ['Nama', 'JenisKelamin', 'KuotaSKS', 'Aktif', 'Catatan', 'Kualifikasi'];
  const example = ['Ustadz Fulan', 'L', '24', 'ya', 'berbagi dengan divisi tahfizh', `ILP:${a} | ILL:${b}`];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '﻿' + [header.join(','), example.map(esc).join(',')].join('\n');
}
