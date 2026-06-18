import { z } from 'zod';

export const SCHEMA_VERSION = 2;

const sectionSchema = z.enum(['putra', 'putri']);
const levelSchema = z.enum(['ILP', 'ILL']);
const semesterSchema = z.union([z.literal(1), z.literal(2)]);
const genderSchema = z.enum(['L', 'P']);

export const subjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().optional(),
  isTahfidz: z.boolean(),
});

export const curriculumEntrySchema = z.object({
  id: z.string(),
  level: levelSchema,
  semester: semesterSchema,
  subjectId: z.string(),
  sks: z.number().finite(),
});

export const teacherSchema = z.object({
  id: z.string(),
  name: z.string(),
  gender: genderSchema,
  qualifiedKeys: z.array(z.string()),
  maxSks: z.number().finite(),
  active: z.boolean(),
  note: z.string().optional(),
});

export const classGroupSchema = z.object({
  id: z.string(),
  section: sectionSchema,
  level: levelSchema,
  semester: semesterSchema,
  label: z.string(),
  studentCount: z.number().finite().optional(),
  order: z.number().finite(),
});

export const slotSchema = z.object({
  id: z.string(),
  classGroupId: z.string(),
  subjectId: z.string(),
  sks: z.number().finite(),
  isTahfidz: z.boolean(),
  section: sectionSchema,
  level: levelSchema,
});

export const assignmentSchema = z.object({
  slotId: z.string(),
  teacherId: z.string().nullable(),
  locked: z.boolean(),
  source: z.enum(['auto', 'manual']),
});

export const planConfigSchema = z.object({
  meetingSks: z.number().finite(),
  curriculumTargetSks: z.number().finite(),
  maxClassesPerSubjectPerTeacher: z.number().finite(),
  maxSksPerTeacherPerClass: z.number().finite(),
  targetMinSksPerTeacher: z.number().finite(),
  classMinStudents: z.number().finite(),
  classMaxStudents: z.number().finite(),
  weights: z.object({
    underTargetPenalty: z.number().finite(),
    perClassVarietyPenalty: z.number().finite(),
    loadBalancePenalty: z.number().finite(),
  }),
});

export const semesterPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  classGroups: z.array(classGroupSchema),
  curriculum: z.array(curriculumEntrySchema),
  slots: z.array(slotSchema),
  assignments: z.array(assignmentSchema),
  config: planConfigSchema,
});

export const appStateSchema = z.object({
  schemaVersion: z.number().finite(),
  subjects: z.array(subjectSchema),
  masterCurriculum: z.array(curriculumEntrySchema),
  teachers: z.array(teacherSchema),
  plans: z.array(semesterPlanSchema),
  activePlanId: z.string().nullable(),
  ui: z.object({
    theme: z.enum(['light', 'dark']),
  }),
});

export type PersistedAppState = z.infer<typeof appStateSchema>;
