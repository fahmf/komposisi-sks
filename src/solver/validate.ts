import type {
  Assignment,
  ClassGroup,
  PlanConfig,
  Slot,
  Subject,
  Teacher,
  ValidationIssue,
  ValidationReport,
} from '../types/model';
import { isAllowedTeacherClassCombo, LEVEL_LABELS, qualKey, sectionToGender, SECTION_LABELS } from '../types/model';
import type { Level } from '../types/model';

export interface TeacherLoad {
  teacherId: string;
  load: number;
  relaxedTarget: number;
  belowTarget: boolean;
  overCap: boolean;
  classesPerSubject: Map<string, Set<string>>; // subjectId -> classGroupIds
  classLoad: Map<string, number>; // classGroupId -> non-tahfidz sks
}

export interface ValidateInput {
  slots: Slot[];
  assignments: Assignment[];
  teachers: Teacher[];
  subjects: Subject[];
  classGroups: ClassGroup[];
  config: PlanConfig;
}

/** Aggregate each teacher's load from the current assignments. */
export function computeTeacherLoads(input: ValidateInput): Map<string, TeacherLoad> {
  const { slots, assignments, teachers, config } = input;
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const loads = new Map<string, TeacherLoad>();
  for (const t of teachers) {
    loads.set(t.id, {
      teacherId: t.id,
      load: 0,
      relaxedTarget: Math.min(config.targetMinSksPerTeacher, t.maxSks),
      belowTarget: false,
      overCap: false,
      classesPerSubject: new Map(),
      classLoad: new Map(),
    });
  }
  for (const a of assignments) {
    if (!a.teacherId) continue;
    const slot = slotById.get(a.slotId);
    const tl = loads.get(a.teacherId);
    if (!slot || !tl) continue;
    tl.load += slot.sks;
    if (!slot.isTahfidz) {
      let set = tl.classesPerSubject.get(slot.subjectId);
      if (!set) tl.classesPerSubject.set(slot.subjectId, (set = new Set()));
      set.add(slot.classGroupId);
      tl.classLoad.set(slot.classGroupId, (tl.classLoad.get(slot.classGroupId) ?? 0) + slot.sks);
    }
  }
  for (const t of teachers) {
    const tl = loads.get(t.id)!;
    tl.overCap = tl.load > t.maxSks;
    tl.belowTarget = t.active && tl.load < tl.relaxedTarget;
  }
  return loads;
}

export function validatePlan(input: ValidateInput): ValidationReport {
  const { slots, assignments, teachers, subjects, classGroups, config } = input;
  const issues: ValidationIssue[] = [];
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const subjById = new Map(subjects.map((s) => [s.id, s]));
  const classById = new Map(classGroups.map((c) => [c.id, c]));
  const subjName = (id: string) => subjById.get(id)?.name ?? id;
  const className = (id: string) => classById.get(id)?.label ?? id;

  // ---- per-assignment hard checks ----
  for (const a of assignments) {
    const slot = slotById.get(a.slotId);
    if (!slot) continue;
    if (!a.teacherId) {
      issues.push({
        level: 'warning',
        code: 'NO_FEASIBLE_TEACHER',
        message: `${className(slot.classGroupId)} — ${subjName(slot.subjectId)} belum punya pengajar.`,
        suggestion: 'Tambah pengajar berkualifikasi atau sesuaikan kuota.',
        slotId: slot.id,
        subjectId: slot.subjectId,
        classGroupId: slot.classGroupId,
      });
      continue;
    }
    const t = teacherById.get(a.teacherId);
    if (!t) continue;
    if (sectionToGender(slot.section) !== t.gender) {
      issues.push({
        level: 'error',
        code: 'GENDER_MISMATCH',
        message: `${t.name} (${t.gender === 'L' ? 'L' : 'P'}) ditugaskan di kelas ${SECTION_LABELS[slot.section]} — ${subjName(slot.subjectId)}.`,
        slotId: slot.id,
        teacherId: t.id,
      });
    }
    if (!t.qualifiedKeys.includes(qualKey(slot.level, slot.subjectId))) {
      issues.push({
        level: 'error',
        code: 'NOT_QUALIFIED',
        message: `${t.name} tidak terdaftar mengajar ${subjName(slot.subjectId)} ${LEVEL_LABELS[slot.level]} (${className(slot.classGroupId)}).`,
        slotId: slot.id,
        teacherId: t.id,
      });
    }
  }

  // ---- per-teacher aggregate checks ----
  const loads = computeTeacherLoads(input);
  for (const t of teachers) {
    const tl = loads.get(t.id)!;
    if (tl.overCap) {
      issues.push({
        level: 'error',
        code: 'CAP_EXCEEDED',
        message: `${t.name} mendapat ${tl.load} SKS, melebihi kuota ${t.maxSks} SKS.`,
        teacherId: t.id,
      });
    }
    for (const [subjectId, classes] of tl.classesPerSubject) {
      if (classes.size > config.maxClassesPerSubjectPerTeacher) {
        issues.push({
          level: 'error',
          code: 'OVER_MAX_CLASSES',
          message: `${t.name} mengajar ${subjName(subjectId)} di ${classes.size} kelas (maks ${config.maxClassesPerSubjectPerTeacher}).`,
          teacherId: t.id,
          subjectId,
        });
      }
    }
    for (const [classGroupId, sks] of tl.classLoad) {
      if (sks > config.maxSksPerTeacherPerClass) {
        issues.push({
          level: 'warning',
          code: 'OVER_CLASS_VARIETY',
          message: `${t.name} mengajar ${sks} SKS di kelas ${className(classGroupId)} (anjuran maks ${config.maxSksPerTeacherPerClass}).`,
          teacherId: t.id,
          classGroupId,
        });
      }
    }
    if (tl.belowTarget && tl.load > 0) {
      issues.push({
        level: 'warning',
        code: 'BELOW_TARGET',
        message: `${t.name} baru ${tl.load} SKS (target ${tl.relaxedTarget} SKS).`,
        teacherId: t.id,
      });
    }
  }

  // ---- per-(teacher, class) rule: at most one subject, except 4-SKS + Hifzh ----
  const byTeacherClass = new Map<string, Map<string, Slot[]>>(); // teacherId -> classGroupId -> slots
  for (const a of assignments) {
    if (!a.teacherId) continue;
    const slot = slotById.get(a.slotId);
    if (!slot) continue;
    let m = byTeacherClass.get(a.teacherId);
    if (!m) byTeacherClass.set(a.teacherId, (m = new Map()));
    const arr = m.get(slot.classGroupId);
    if (arr) arr.push(slot);
    else m.set(slot.classGroupId, [slot]);
  }
  for (const [teacherId, m] of byTeacherClass) {
    const t = teacherById.get(teacherId);
    for (const [classGroupId, classSlots] of m) {
      if (isAllowedTeacherClassCombo(classSlots)) continue;
      const subjList = classSlots.map((s) => subjName(s.subjectId)).join(', ');
      issues.push({
        level: 'error',
        code: 'TEACHER_TWICE_IN_CLASS',
        message: `${t?.name ?? teacherId} mengampu ${classSlots.length} mata kuliah di ${className(classGroupId)} (${subjList}). Maks 1 per kelas, kecuali 1 matkul 4 SKS bersama Hifzhul Qur'an.`,
        teacherId,
        classGroupId,
      });
    }
  }

  // ---- pre-flight understaffing per (section, jenjang, subject) ----
  const demand = new Map<string, number>(); // `${section}|${level}|${subjectId}` -> count
  for (const s of slots) {
    const key = `${s.section}|${s.level}|${s.subjectId}`;
    demand.set(key, (demand.get(key) ?? 0) + 1);
  }
  for (const [key, count] of demand) {
    const [section, level, subjectId] = key.split('|') as [Slot['section'], Level, string];
    const subj = subjById.get(subjectId);
    if (subj?.isTahfidz) continue; // tahfidz has no max-2 limit
    const gender = sectionToGender(section);
    const qk = qualKey(level, subjectId);
    const sampleSks =
      slots.find((s) => s.section === section && s.level === level && s.subjectId === subjectId)?.sks ??
      config.meetingSks;
    let supply = 0;
    for (const t of teachers) {
      if (!t.active || t.gender !== gender) continue;
      if (!t.qualifiedKeys.includes(qk)) continue;
      supply += Math.min(config.maxClassesPerSubjectPerTeacher, Math.floor(t.maxSks / sampleSks));
    }
    if (count > supply) {
      const where = `${subjName(subjectId)} ${LEVEL_LABELS[level]} (${SECTION_LABELS[section]})`;
      issues.push({
        level: 'error',
        code: 'SUBJECT_UNDERSTAFFED',
        message: `${where}: butuh ${count} kelas, kapasitas pengajar hanya ${supply}.`,
        suggestion: `Tambah pengajar ${where}.`,
        subjectId,
      });
    }
  }

  // ---- curriculum total per (jenjang, semester) vs configured target ----
  // Derived from in-use slots so unused terms don't produce noise. All classes in a
  // term share one curriculum, so one sks per (subject) is enough to total the term.
  const curriculumBy = new Map<string, Map<string, number>>(); // `${level}|${sem}` -> subjectId -> sks
  for (const s of slots) {
    const cg = classById.get(s.classGroupId);
    if (!cg) continue;
    const key = `${cg.level}|${cg.semester}`;
    let m = curriculumBy.get(key);
    if (!m) curriculumBy.set(key, (m = new Map()));
    m.set(s.subjectId, s.sks);
  }
  for (const [key, perTerm] of curriculumBy) {
    const total = [...perTerm.values()].reduce((a, b) => a + b, 0);
    if (total !== config.curriculumTargetSks) {
      const [level, sem] = key.split('|') as [Level, string];
      issues.push({
        level: 'warning',
        code: 'CURRICULUM_NOT_32',
        message: `Kurikulum ${LEVEL_LABELS[level]} Semester ${sem} berjumlah ${total} SKS (target ${config.curriculumTargetSks}).`,
        suggestion: 'Sesuaikan bobot SKS di menu Kurikulum atau ubah target di Pengaturan.',
      });
    }
  }

  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warningCount = issues.filter((i) => i.level === 'warning').length;
  return { issues, errorCount, warningCount };
}
