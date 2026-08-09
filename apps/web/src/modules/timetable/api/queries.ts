// modules/timetable/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export async function listPeriods(schoolId: string) {
  const { data, error } = await supabase.from('periods').select('*').eq('school_id', schoolId).order('sequence');
  if (error) throw error;
  return data;
}

/** Full grid for a section: every (day, period) cell for the week, with
 * whatever entry already exists joined in — the grid always has a cell
 * for every slot, whether or not it's been filled in yet. */
export async function getSectionTimetable(sectionId: string, academicYearId: string) {
  const { data, error } = await supabase
    .from('timetable_entries')
    .select('*, subject:subjects(name), teacher:employees(profile_id, profile:profiles(full_name))')
    .eq('section_id', sectionId)
    .eq('academic_year_id', academicYearId);
  if (error) throw error;
  return data;
}

export async function getTeacherTimetable(teacherProfileId: string, academicYearId: string) {
  const { data, error } = await supabase
    .from('timetable_entries')
    .select('*, subject:subjects(name), section:sections(name, class:classes(name)), period:periods(name, sequence, start_time, end_time)')
    .eq('teacher_profile_id', teacherProfileId)
    .eq('academic_year_id', academicYearId);
  if (error) throw error;
  return data;
}

export async function getClassSubjects(classId: string) {
  const { data, error } = await supabase
    .from('class_subjects')
    .select('subject:subjects(id, name)')
    .eq('class_id', classId);
  if (error) throw error;
  return (data ?? []).map((row: any) => row.subject);
}
