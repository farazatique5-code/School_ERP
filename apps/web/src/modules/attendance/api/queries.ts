// modules/attendance/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export interface RosterRow {
  studentId: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  rollNumber: string | null;
  existingStatus: string | null;
  existingRemarks: string | null;
}

/** Pulls the current-year roster for a section, LEFT JOINed against any
 * attendance already marked for the given date — so re-opening a date
 * you've already marked shows the saved statuses instead of a blank form. */
export async function getRosterForAttendance(sectionId: string, date: string): Promise<RosterRow[]> {
  const { data: enrollments, error: enrollError } = await supabase
    .from('student_enrollments')
    .select('roll_number, student:students(id, first_name, last_name, student_code)')
    .eq('section_id', sectionId)
    .order('roll_number');
  if (enrollError) throw enrollError;

  const { data: existing, error: attendanceError } = await supabase
    .from('student_attendance')
    .select('student_id, status, remarks')
    .eq('section_id', sectionId)
    .eq('attendance_date', date);
  if (attendanceError) throw attendanceError;

  const existingByStudent = new Map((existing ?? []).map((row) => [row.student_id, row]));

  return (enrollments ?? []).map((row: any) => {
    const existingRow = existingByStudent.get(row.student.id);
    return {
      studentId: row.student.id,
      firstName: row.student.first_name,
      lastName: row.student.last_name,
      studentCode: row.student.student_code,
      rollNumber: row.roll_number,
      existingStatus: existingRow?.status ?? null,
      existingRemarks: existingRow?.remarks ?? null,
    };
  });
}

export async function getStudentAttendanceHistory(studentId: string, limit = 30) {
  const { data, error } = await supabase
    .from('student_attendance')
    .select('attendance_date, status, remarks')
    .eq('student_id', studentId)
    .order('attendance_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export interface SectionStatsRow {
  attendanceDate: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  excusedCount: number;
}

export async function getSectionStats(sectionId: string, fromDate: string, toDate: string): Promise<SectionStatsRow[]> {
  const { data, error } = await supabase
    .from('attendance_daily_stats')
    .select('*')
    .eq('section_id', sectionId)
    .gte('attendance_date', fromDate)
    .lte('attendance_date', toDate)
    .order('attendance_date');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    attendanceDate: row.attendance_date,
    presentCount: row.present_count,
    absentCount: row.absent_count,
    lateCount: row.late_count,
    halfDayCount: row.half_day_count,
    excusedCount: row.excused_count,
  }));
}

/** Students below a threshold attendance % over a date range — the exact
 * "Show students with attendance below 75%" query the AI Copilot (Phase 16)
 * will eventually wrap in natural language; built here first as a real,
 * directly usable report rather than waiting for Phase 16 to invent it. */
export async function getLowAttendanceStudents(schoolId: string, fromDate: string, toDate: string, thresholdPercent: number) {
  const { data, error } = await supabase
    .from('student_attendance')
    .select('student_id, status, student:students(first_name, last_name, student_code)')
    .eq('school_id', schoolId)
    .gte('attendance_date', fromDate)
    .lte('attendance_date', toDate);
  if (error) throw error;

  const byStudent = new Map<string, { name: string; code: string; total: number; present: number }>();
  for (const row of data ?? []) {
    const key = row.student_id;
    const entry = byStudent.get(key) ?? {
      name: `${(row as any).student.first_name} ${(row as any).student.last_name}`,
      code: (row as any).student.student_code,
      total: 0,
      present: 0,
    };
    entry.total += 1;
    if (row.status === 'present' || row.status === 'late') entry.present += 1;
    byStudent.set(key, entry);
  }

  return Array.from(byStudent.entries())
    .map(([studentId, v]) => ({
      studentId,
      name: v.name,
      code: v.code,
      attendancePercent: v.total > 0 ? Math.round((v.present / v.total) * 1000) / 10 : 0,
    }))
    .filter((s) => s.attendancePercent < thresholdPercent)
    .sort((a, b) => a.attendancePercent - b.attendancePercent);
}
