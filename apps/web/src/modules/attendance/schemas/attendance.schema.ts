// modules/attendance/schemas/attendance.schema.ts
import { z } from 'zod';

export const attendanceStatusEnum = z.enum(['present', 'absent', 'late', 'half_day', 'excused']);
export type AttendanceStatus = z.infer<typeof attendanceStatusEnum>;

export const markAttendanceRowSchema = z.object({
  studentId: z.string().uuid(),
  status: attendanceStatusEnum,
  remarks: z.string().max(500).optional().or(z.literal('')),
});

export const markAttendanceSchema = z.object({
  sectionId: z.string().uuid(),
  attendanceDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  rows: z.array(markAttendanceRowSchema).min(1, 'No students to mark'),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  half_day: 'Half day',
  excused: 'Excused',
};
