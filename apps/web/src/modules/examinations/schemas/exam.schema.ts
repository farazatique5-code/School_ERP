// modules/examinations/schemas/exam.schema.ts
import { z } from 'zod';

export const examSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  examType: z.enum(['unit_test', 'midterm', 'final', 'other']),
  termId: z.string().uuid().optional().or(z.literal('')),
  gradingScaleId: z.string().uuid('Select a grading scale'),
  startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
});
export type ExamInput = z.infer<typeof examSchema>;

export const examScheduleSchema = z.object({
  classId: z.string().uuid('Select a class'),
  subjectId: z.string().uuid('Select a subject'),
  examDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  maxMarks: z.coerce.number().positive('Enter a positive number'),
  passingMarks: z.coerce.number().min(0),
  roomNumber: z.string().max(50).optional().or(z.literal('')),
});
export type ExamScheduleInput = z.infer<typeof examScheduleSchema>;

export const marksRowSchema = z.object({
  studentId: z.string().uuid(),
  marksObtained: z.coerce.number().min(0).optional(),
  isAbsent: z.boolean().default(false),
  remarks: z.string().max(500).optional().or(z.literal('')),
});

export const bulkMarksSchema = z.object({
  examScheduleId: z.string().uuid(),
  rows: z.array(marksRowSchema).min(1),
});
export type BulkMarksInput = z.infer<typeof bulkMarksSchema>;

export const questionSchema = z.object({
  subjectId: z.string().uuid('Select a subject'),
  classId: z.string().uuid().optional().or(z.literal('')),
  questionText: z.string().min(1, 'Question text is required').max(2000),
  questionType: z.enum(['mcq', 'short_answer', 'long_answer']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  marks: z.coerce.number().positive(),
  correctAnswer: z.string().max(500).optional().or(z.literal('')),
  bloomLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']).optional(),
});
export type QuestionInput = z.infer<typeof questionSchema>;
