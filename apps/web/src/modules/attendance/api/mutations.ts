// modules/attendance/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import { markAttendanceSchema, type MarkAttendanceInput } from '../schemas/attendance.schema';

export async function bulkMarkAttendance(
  organizationId: string,
  schoolId: string,
  markedByProfileId: string,
  input: MarkAttendanceInput,
) {
  const parsed = markAttendanceSchema.parse(input);

  const rows = parsed.rows.map((row) => ({
    organization_id: organizationId,
    school_id: schoolId,
    student_id: row.studentId,
    section_id: parsed.sectionId,
    attendance_date: parsed.attendanceDate,
    status: row.status,
    remarks: row.remarks || null,
    marked_by_profile_id: markedByProfileId,
    updated_at: new Date().toISOString(),
  }));

  // upsert on the (student_id, attendance_date) unique constraint — marking
  // the same date twice edits in place instead of erroring or duplicating.
  const { error } = await supabase.from('student_attendance').upsert(rows, { onConflict: 'student_id,attendance_date' });
  if (error) throw new ApiError(error.code ?? 'mark_failed', error.message);
}
