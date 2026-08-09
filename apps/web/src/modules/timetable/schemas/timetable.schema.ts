// modules/timetable/schemas/timetable.schema.ts
import { z } from 'zod';

export const periodSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  sequence: z.coerce.number().int().min(1),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  isBreak: z.boolean().default(false),
});
export type PeriodInput = z.infer<typeof periodSchema>;

export const timetableEntrySchema = z.object({
  subjectId: z.string().uuid().optional().or(z.literal('')),
  teacherProfileId: z.string().uuid().optional().or(z.literal('')),
  roomNumber: z.string().max(50).optional().or(z.literal('')),
});
export type TimetableEntryInput = z.infer<typeof timetableEntrySchema>;

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
] as const;
