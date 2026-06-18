import type { CurriculumEntry, Subject } from '../types/model';

// Stable IDs so curriculum entries can reference subjects deterministically.
export const SUBJECT_IDS = {
  fahmulKitabah: 'subj-fahmul-kitabah',
  qiraah: 'subj-qiraah',
  tabir: 'subj-tabir',
  qawaidArabiyyah: 'subj-qawaid-arabiyyah',
  hifzh: 'subj-hifzhul-quran',
  tauhid: 'subj-tauhid',
  qawaidImla: 'subj-qawaid-imla',
  khath: 'subj-khath-arabiy',
  fahmulTabir: 'subj-fahmul-tabir',
  adab: 'subj-adab-arabiy',
  fiqh: 'subj-fiqh',
  hadits: 'subj-hadits',
  balaghah: 'subj-balaghah',
  ushulFiqh: 'subj-ushul-fiqh',
  mushthalah: 'subj-mushthalah-hadits',
} as const;

export const SEED_SUBJECTS: Subject[] = [
  { id: SUBJECT_IDS.fahmulKitabah, name: "Fahmul Masmu' & Kitabah", isTahfidz: false },
  { id: SUBJECT_IDS.qiraah, name: 'Qiraah', isTahfidz: false },
  { id: SUBJECT_IDS.tabir, name: "Ta'bir", isTahfidz: false },
  { id: SUBJECT_IDS.qawaidArabiyyah, name: "Qawaid 'Arabiyyah", isTahfidz: false },
  { id: SUBJECT_IDS.hifzh, name: "Hifzhul Qur'an", isTahfidz: true },
  { id: SUBJECT_IDS.tauhid, name: 'Tauhid', isTahfidz: false },
  { id: SUBJECT_IDS.qawaidImla, name: "Qawaid Imla'", isTahfidz: false },
  { id: SUBJECT_IDS.khath, name: "Khath 'Arabiy", isTahfidz: false },
  { id: SUBJECT_IDS.fahmulTabir, name: "Fahmul Masmu' & Ta'bir", isTahfidz: false },
  { id: SUBJECT_IDS.adab, name: "Adab 'Arabiy", isTahfidz: false },
  { id: SUBJECT_IDS.fiqh, name: 'Fiqh', isTahfidz: false },
  { id: SUBJECT_IDS.hadits, name: 'Hadits', isTahfidz: false },
  { id: SUBJECT_IDS.balaghah, name: 'Balaghah', isTahfidz: false },
  { id: SUBJECT_IDS.ushulFiqh, name: 'Ushul Fiqh', isTahfidz: false },
  { id: SUBJECT_IDS.mushthalah, name: 'Mushthalahul Hadits', isTahfidz: false },
];

// Helper to build curriculum rows with deterministic ids.
const c = (
  level: CurriculumEntry['level'],
  semester: CurriculumEntry['semester'],
  subjectId: string,
  sks: number,
): CurriculumEntry => ({
  id: `cur-${level}-${semester}-${subjectId.replace('subj-', '')}`,
  level,
  semester,
  subjectId,
  sks,
});

export const SEED_CURRICULUM: CurriculumEntry[] = [
  // ILP Semester 1 (32 SKS)
  c('ILP', 1, SUBJECT_IDS.fahmulKitabah, 8),
  c('ILP', 1, SUBJECT_IDS.qiraah, 8),
  c('ILP', 1, SUBJECT_IDS.tabir, 6),
  c('ILP', 1, SUBJECT_IDS.qawaidArabiyyah, 6),
  c('ILP', 1, SUBJECT_IDS.hifzh, 2),
  c('ILP', 1, SUBJECT_IDS.tauhid, 2),

  // ILP Semester 2 (32 SKS)
  c('ILP', 2, SUBJECT_IDS.fahmulKitabah, 8),
  c('ILP', 2, SUBJECT_IDS.qiraah, 8),
  c('ILP', 2, SUBJECT_IDS.qawaidArabiyyah, 8),
  c('ILP', 2, SUBJECT_IDS.qawaidImla, 2),
  c('ILP', 2, SUBJECT_IDS.tauhid, 2),
  c('ILP', 2, SUBJECT_IDS.hifzh, 2),
  c('ILP', 2, SUBJECT_IDS.khath, 2),

  // ILL Semester 1 (32 SKS)
  c('ILL', 1, SUBJECT_IDS.fahmulTabir, 6),
  c('ILL', 1, SUBJECT_IDS.qiraah, 6),
  c('ILL', 1, SUBJECT_IDS.qawaidArabiyyah, 4),
  c('ILL', 1, SUBJECT_IDS.adab, 4),
  c('ILL', 1, SUBJECT_IDS.tauhid, 2),
  c('ILL', 1, SUBJECT_IDS.hifzh, 2),
  c('ILL', 1, SUBJECT_IDS.fiqh, 4),
  c('ILL', 1, SUBJECT_IDS.hadits, 4),

  // ILL Semester 2 (32 SKS)
  c('ILL', 2, SUBJECT_IDS.fahmulTabir, 4),
  c('ILL', 2, SUBJECT_IDS.qiraah, 6),
  c('ILL', 2, SUBJECT_IDS.qawaidArabiyyah, 4),
  c('ILL', 2, SUBJECT_IDS.balaghah, 2),
  c('ILL', 2, SUBJECT_IDS.hifzh, 2),
  c('ILL', 2, SUBJECT_IDS.tauhid, 2),
  c('ILL', 2, SUBJECT_IDS.fiqh, 4),
  c('ILL', 2, SUBJECT_IDS.hadits, 4),
  c('ILL', 2, SUBJECT_IDS.ushulFiqh, 2),
  c('ILL', 2, SUBJECT_IDS.mushthalah, 2),
];

export const DEFAULT_PLAN_CONFIG = {
  meetingSks: 2,
  curriculumTargetSks: 32,
  maxClassesPerSubjectPerTeacher: 2,
  maxSksPerTeacherPerClass: 8,
  targetMinSksPerTeacher: 24,
  classMinStudents: 30,
  classMaxStudents: 45,
  weights: {
    underTargetPenalty: 10,
    perClassVarietyPenalty: 4,
    loadBalancePenalty: 0.5,
  },
};
