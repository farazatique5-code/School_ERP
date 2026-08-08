// modules/examinations/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export async function listExams(schoolId: string) {
  const { data, error } = await supabase
    .from('exams')
    .select('*, term:terms(name)')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getExamDetail(examId: string) {
  const { data, error } = await supabase
    .from('exams')
    .select('*, grading_scale:grading_scales(name), exam_schedules(*, class:classes(name), subject:subjects(name))')
    .eq('id', examId)
    .single();
  if (error) throw error;
  return data;
}

export async function getMarksRoster(examScheduleId: string) {
  const { data: schedule, error: scheduleError } = await supabase
    .from('exam_schedules')
    .select('*, class:classes(id, name)')
    .eq('id', examScheduleId)
    .single();
  if (scheduleError) throw scheduleError;

  const { data: enrollments, error: enrollError } = await supabase
    .from('student_enrollments')
    .select('roll_number, student:students(id, first_name, last_name, student_code)')
    .eq('class_id', schedule.class_id)
    .order('roll_number');
  if (enrollError) throw enrollError;

  const { data: existingMarks, error: marksError } = await supabase
    .from('student_marks')
    .select('*')
    .eq('exam_schedule_id', examScheduleId);
  if (marksError) throw marksError;

  const marksByStudent = new Map((existingMarks ?? []).map((m) => [m.student_id, m]));

  return {
    schedule,
    roster: (enrollments ?? []).map((row: any) => ({
      studentId: row.student.id,
      firstName: row.student.first_name,
      lastName: row.student.last_name,
      studentCode: row.student.student_code,
      rollNumber: row.roll_number,
      existingMarks: marksByStudent.get(row.student.id) ?? null,
    })),
  };
}

export async function getRankings(examId: string, sectionId: string) {
  const { data, error } = await supabase
    .from('exam_rankings')
    .select('*, student:students(first_name, last_name, student_code)')
    .eq('exam_id', examId)
    .eq('section_id', sectionId)
    .order('rank_in_section');
  if (error) throw error;
  return data;
}

export async function getStudentReportCard(examId: string, studentId: string) {
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*, grading_scale:grading_scales(name)')
    .eq('id', examId)
    .single();
  if (examError) throw examError;

  const { data: marks, error: marksError } = await supabase
    .from('student_marks')
    .select('*, exam_schedule:exam_schedules(max_marks, passing_marks, subject:subjects(name))')
    .eq('student_id', studentId)
    .in('exam_schedule_id', (await supabase.from('exam_schedules').select('id').eq('exam_id', examId)).data?.map((r) => r.id) ?? []);
  if (marksError) throw marksError;

  const { data: ranking } = await supabase
    .from('exam_rankings')
    .select('*')
    .eq('exam_id', examId)
    .eq('student_id', studentId)
    .maybeSingle();

  return { exam, marks: marks ?? [], ranking };
}

export async function listQuestions(schoolId: string, subjectId?: string) {
  let query = supabase.from('question_bank_questions').select('*, subject:subjects(name), class:classes(name)').eq('school_id', schoolId);
  if (subjectId) query = query.eq('subject_id', subjectId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
