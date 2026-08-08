// modules/portals/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export interface PortalChild {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  photoUrl: string | null;
}

/** For a Parent: every child linked to their guardian profile. */
export async function getMyChildren(guardianProfileId: string): Promise<PortalChild[]> {
  const { data, error } = await supabase
    .from('guardians')
    .select('student_guardians(student:students(id, first_name, last_name, student_code, photo_url))')
    .eq('profile_id', guardianProfileId)
    .maybeSingle();
  if (error) throw error;
  return (data?.student_guardians ?? []).map((sg: any) => ({
    id: sg.student.id,
    firstName: sg.student.first_name,
    lastName: sg.student.last_name,
    studentCode: sg.student.student_code,
    photoUrl: sg.student.photo_url,
  }));
}

/** For a Student: their own student row. */
export async function getMyOwnStudentRecord(profileId: string): Promise<PortalChild | null> {
  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, student_code, photo_url')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, firstName: data.first_name, lastName: data.last_name, studentCode: data.student_code, photoUrl: data.photo_url };
}

export async function getPortalOverview(studentId: string) {
  const { data, error } = await supabase
    .from('students')
    .select('*, student_enrollments(*, class:classes(name), section:sections(name), academic_year:academic_years(is_current)), house:houses(name)')
    .eq('id', studentId)
    .single();
  if (error) throw error;
  return data;
}

export async function getPortalAttendance(studentId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('student_attendance')
    .select('attendance_date, status')
    .eq('student_id', studentId)
    .gte('attendance_date', since.toISOString().slice(0, 10))
    .order('attendance_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPortalInvoices(studentId: string) {
  const { data, error } = await supabase
    .from('fee_invoices')
    .select('*, fee_invoice_items(*, fee_category:fee_categories(name))')
    .eq('student_id', studentId)
    .order('due_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPortalExams(studentId: string) {
  const { data, error } = await supabase
    .from('student_marks')
    .select('*, exam_schedule:exam_schedules(max_marks, subject:subjects(name), exam:exams(id, name, status))')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPortalTimetable(studentId: string) {
  const { data: enrollment, error: enrollError } = await supabase
    .from('student_enrollments')
    .select('section_id, academic_year:academic_years(is_current)')
    .eq('student_id', studentId)
    .eq('academic_year.is_current', true)
    .maybeSingle();
  if (enrollError) throw enrollError;
  if (!enrollment) return [];

  const { data, error } = await supabase
    .from('timetable_entries')
    .select('*, subject:subjects(name), period:periods(name, sequence, start_time, end_time)')
    .eq('section_id', enrollment.section_id);
  if (error) throw error;
  return data;
}

export async function getMyNotifications(profileId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data;
}
