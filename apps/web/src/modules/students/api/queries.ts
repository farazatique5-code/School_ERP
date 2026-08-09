// modules/students/api/queries.ts
import { supabase } from '../../../core/supabase/client';
import type { StudentListFilter } from '../schemas/student.schema';

export interface ListParams {
  schoolId: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: StudentListFilter;
}

export interface StudentListRow {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  status: string;
  photoUrl: string | null;
  className: string | null;
  sectionName: string | null;
  rollNumber: string | null;
}

export async function listStudents(params: ListParams): Promise<{ rows: StudentListRow[]; totalCount: number }> {
  const { schoolId, page, pageSize, sortBy = 'last_name', sortDir = 'asc', filters } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('students')
    .select(
      `id, student_code, first_name, last_name, status, photo_url,
       student_enrollments!inner(roll_number, class:classes(name), section:sections(name), academic_year:academic_years(is_current))`,
      { count: 'exact' },
    )
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .eq('student_enrollments.academic_year.is_current', true);

  if (filters?.search) {
    query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,student_code.ilike.%${filters.search}%`);
  }
  if (filters?.classId) query = query.eq('student_enrollments.class_id', filters.classId);
  if (filters?.sectionId) query = query.eq('student_enrollments.section_id', filters.sectionId);
  if (filters?.status) query = query.eq('status', filters.status);

  const sortColumn = sortBy === 'name' ? 'last_name' : sortBy;
  query = query.order(sortColumn, { ascending: sortDir === 'asc' }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows: StudentListRow[] = (data ?? []).map((row: any) => {
    const enrollment = row.student_enrollments?.[0];
    return {
      id: row.id,
      studentCode: row.student_code,
      firstName: row.first_name,
      lastName: row.last_name,
      status: row.status,
      photoUrl: row.photo_url,
      className: enrollment?.class?.name ?? null,
      sectionName: enrollment?.section?.name ?? null,
      rollNumber: enrollment?.roll_number ?? null,
    };
  });

  return { rows, totalCount: count ?? 0 };
}

export async function getStudentDetail(studentId: string) {
  const { data, error } = await supabase
    .from('students')
    .select(
      `*,
       student_enrollments(*, class:classes(name), section:sections(name), academic_year:academic_years(name, is_current)),
       student_guardians(relationship, is_primary_contact, is_emergency_contact, guardian:guardians(*)),
       student_documents(*),
       student_achievements(*),
       house:houses(name, color)`,
    )
    .eq('id', studentId)
    .single();
  if (error) throw error;
  return data;
}

/** Separate query: medical records require students.view_medical, distinct
 * from students.view — calling this only where that permission is checked
 * keeps the RLS boundary and the UI boundary aligned. */
export async function getStudentMedicalRecord(studentId: string) {
  const { data, error } = await supabase
    .from('student_medical_records')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStudentDisciplineRecords(studentId: string) {
  const { data, error } = await supabase
    .from('student_discipline_records')
    .select('*, reported_by:profiles(full_name)')
    .eq('student_id', studentId)
    .order('incident_date', { ascending: false });
  if (error) throw error;
  return data;
}
