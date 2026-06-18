// ===========================================================================
// Domain model for the SKS distribution app.
// 1 pertemuan (meeting) = 2 SKS. Gender maps 1:1 to section (L↔putra, P↔putri).
// ===========================================================================

export type Section = 'putra' | 'putri';
export type Level = 'ILP' | 'ILL';
export type SemesterNo = 1 | 2;
export type Gender = 'L' | 'P';

// ---------- catalog (editable master data) ----------

export interface Subject {
  id: string;
  name: string;
  shortName?: string;
  /** Tahfidz subjects (Hifzhul Qur'an) are exempt from the max-2-classes,
   *  per-class variety and meeting-load rules. */
  isTahfidz: boolean;
}

export interface CurriculumEntry {
  id: string;
  level: Level;
  semester: SemesterNo;
  subjectId: string;
  /** Whole number, normally a multiple of 2 (1 pertemuan = 2 SKS). */
  sks: number;
}

// ---------- teachers ----------

export interface Teacher {
  id: string;
  name: string;
  /** 'L' teaches putra only; 'P' teaches putri only. */
  gender: Gender;
  qualifiedSubjectIds: string[];
  /** Hard cap on SKS this teacher may take in THIS program (captures
   *  capacity shared with other divisions). */
  maxSks: number;
  active: boolean;
  note?: string;
}

// ---------- class structure ----------

export interface ClassGroup {
  id: string;
  section: Section;
  level: Level;
  semester: SemesterNo;
  label: string;
  /** Post-attrition planning headcount (informational). */
  studentCount?: number;
  order: number;
}

// ---------- slots & assignments ----------

/** One (class × subject) pair that needs exactly one teacher. */
export interface Slot {
  id: string;
  classGroupId: string;
  subjectId: string;
  sks: number;
  isTahfidz: boolean;
  section: Section;
}

export interface Assignment {
  slotId: string;
  teacherId: string | null;
  /** Manual edits the solver must preserve on re-run. */
  locked: boolean;
  source: 'auto' | 'manual';
}

// ---------- config ----------

export interface SolverWeights {
  underTargetPenalty: number;
  perClassVarietyPenalty: number;
  loadBalancePenalty: number;
}

export interface PlanConfig {
  meetingSks: number; // 2
  curriculumTargetSks: number; // 32
  maxClassesPerSubjectPerTeacher: number; // 2 (tahfidz exempt)
  maxSksPerTeacherPerClass: number; // variety cap (tahfidz exempt)
  targetMinSksPerTeacher: number; // 24 (relaxed to min(24, maxSks))
  classMinStudents: number; // 30
  classMaxStudents: number; // 45
  weights: SolverWeights;
}

// ---------- term snapshot ----------

export interface SemesterPlan {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  classGroups: ClassGroup[];
  /** Snapshot taken at plan creation so editing the master catalog later
   *  doesn't mutate historical plans. */
  curriculum: CurriculumEntry[];
  slots: Slot[];
  assignments: Assignment[];
  config: PlanConfig;
}

// ---------- localStorage root ----------

export interface UiState {
  theme: 'light' | 'dark';
}

export interface AppState {
  schemaVersion: number;
  subjects: Subject[];
  masterCurriculum: CurriculumEntry[];
  teachers: Teacher[];
  plans: SemesterPlan[];
  activePlanId: string | null;
  ui: UiState;
}

// ---------- validation output ----------

export type IssueCode =
  | 'NO_FEASIBLE_TEACHER'
  | 'BELOW_TARGET'
  | 'OVER_CLASS_VARIETY'
  | 'SUBJECT_UNDERSTAFFED'
  | 'CAP_EXCEEDED'
  | 'OVER_MAX_CLASSES'
  | 'GENDER_MISMATCH'
  | 'NOT_QUALIFIED'
  | 'CURRICULUM_NOT_32';

export interface ValidationIssue {
  level: 'error' | 'warning';
  code: IssueCode;
  message: string;
  suggestion?: string;
  slotId?: string;
  teacherId?: string;
  subjectId?: string;
  classGroupId?: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

// ---------- helpers ----------

export const sectionToGender = (section: Section): Gender =>
  section === 'putra' ? 'L' : 'P';

export const genderToSection = (gender: Gender): Section =>
  gender === 'L' ? 'putra' : 'putri';

/** Centralised exemption check — tahfidz subjects skip load rules. */
export const isExemptFromLoadRules = (isTahfidz: boolean): boolean => isTahfidz;

export const LEVEL_LABELS: Record<Level, string> = {
  ILP: 'Pemula (ILP)',
  ILL: 'Lanjutan (ILL)',
};

export const SECTION_LABELS: Record<Section, string> = {
  putra: 'Putra',
  putri: 'Putri',
};
