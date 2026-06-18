import { describe, expect, it } from 'vitest';
import type { Subject } from '../types/model';
import { importTeachersFromCSV, parseCSV } from './importTeachers';

const subjects: Subject[] = [
  { id: 'subj-qiraah', name: 'Qiraah', isTahfidz: false },
  { id: 'subj-fiqh', name: 'Fiqh', isTahfidz: false },
];

describe('parseCSV', () => {
  it('handles quoted fields, escaped quotes and CRLF', () => {
    const rows = parseCSV('a,b\r\n"x,1","he said ""hi"""\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x,1', 'he said "hi"'],
    ]);
  });

  it('detects a semicolon delimiter', () => {
    const rows = parseCSV('a;b\n1;2');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('importTeachersFromCSV', () => {
  it('maps columns and resolves qualifications by subject name + jenjang', () => {
    const csv = [
      'Nama,JenisKelamin,KuotaSKS,Aktif,Catatan,Kualifikasi',
      'Ustadz A,Putra,24,ya,,ILP:Qiraah | ILL:Fiqh',
      'Ustadzah B,P,18,tidak,catatan,ILP:Qiraah',
    ].join('\n');
    const { rows, errors } = importTeachersFromCSV(csv, subjects);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);

    expect(rows[0].draft.name).toBe('Ustadz A');
    expect(rows[0].draft.gender).toBe('L');
    expect(rows[0].draft.maxSks).toBe(24);
    expect(rows[0].draft.active).toBe(true);
    expect([...rows[0].draft.qualifiedKeys].sort()).toEqual(['ILL:subj-fiqh', 'ILP:subj-qiraah']);

    expect(rows[1].draft.gender).toBe('P');
    expect(rows[1].draft.active).toBe(false);
  });

  it('warns about unknown subjects and invalid quota but still imports', () => {
    const csv = ['Nama,KuotaSKS,Kualifikasi', 'Ustadz C,abc,ILP:Nahwu'].join('\n');
    const { rows } = importTeachersFromCSV(csv, subjects);
    expect(rows).toHaveLength(1);
    expect(rows[0].draft.maxSks).toBe(24); // fallback
    expect(rows[0].draft.qualifiedKeys).toHaveLength(0);
    expect(rows[0].warnings.join(' ')).toMatch(/tidak ditemukan/);
    expect(rows[0].warnings.join(' ')).toMatch(/tidak valid/);
  });

  it('reports a file-level error when only the header is present', () => {
    const { rows, errors } = importTeachersFromCSV('Nama,KuotaSKS', subjects);
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});
