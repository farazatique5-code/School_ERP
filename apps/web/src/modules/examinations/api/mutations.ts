// modules/examinations/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import {
  examSchema,
  examScheduleSchema,
  bulkMarksSchema,
  questionSchema,
  type ExamInput,
  type ExamScheduleInput,
  type BulkMarksInput,
  type QuestionInput,
} from '../schemas/exam.schema';

export async function createExam(organizationId: string, schoolId: string, academicYearId: string, input: ExamInput) {
  const parsed = examSchema.parse(input);
  const { data, error } = await supabase
    .from('exams')
    .insert({
      organization_id: organizationId,
      school_id: schoolId,
      academic_year_id: academicYearId,
      term_id: parsed.termId || null,
      grading_scale_id: parsed.gradingScaleId,
      name: parsed.name,
      exam_type: parsed.examType,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function addExamSchedule(examId: string, input: ExamScheduleInput) {
  const parsed = examScheduleSchema.parse(input);
  const { data, error } = await supabase
    .from('exam_schedules')
    .insert({
      exam_id: examId,
      class_id: parsed.classId,
      subject_id: parsed.subjectId,
      exam_date: parsed.examDate,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      max_marks: parsed.maxMarks,
      passing_marks: parsed.passingMarks,
      room_number: parsed.roomNumber || null,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new ApiError('duplicate_schedule', 'This class/subject is already scheduled for this exam.');
    throw new ApiError(error.code ?? 'create_failed', error.message);
  }
  return data;
}

export async function updateExamStatus(examId: string, status: 'scheduled' | 'ongoing' | 'completed' | 'published') {
  const { data, error } = await supabase.from('exams').update({ status, updated_at: new Date().toISOString() }).eq('id', examId).select().single();
  if (error) {
    if (error.code === '42501') throw new ApiError('forbidden', "You don't have permission to do this.");
    throw new ApiError(error.code ?? 'update_failed', error.message);
  }
  return data;
}

export async function bulkSaveMarks(enteredByProfileId: string, input: BulkMarksInput) {
  const parsed = bulkMarksSchema.parse(input);
  const rows = parsed.rows.map((row) => ({
    exam_schedule_id: parsed.examScheduleId,
    student_id: row.studentId,
    marks_obtained: row.isAbsent ? null : row.marksObtained,
    is_absent: row.isAbsent,
    remarks: row.remarks || null,
    entered_by_profile_id: enteredByProfileId,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('student_marks').upsert(rows, { onConflict: 'exam_schedule_id,student_id' });
  if (error) throw new ApiError(error.code ?? 'save_failed', error.message);
}

export async function createQuestion(schoolId: string, createdByProfileId: string, input: QuestionInput) {
  const parsed = questionSchema.parse(input);
  const { data, error } = await supabase
    .from('question_bank_questions')
    .insert({
      school_id: schoolId,
      subject_id: parsed.subjectId,
      class_id: parsed.classId || null,
      question_text: parsed.questionText,
      question_type: parsed.questionType,
      difficulty: parsed.difficulty,
      marks: parsed.marks,
      correct_answer: parsed.correctAnswer || null,
      bloom_level: parsed.bloomLevel,
      created_by_profile_id: createdByProfileId,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}
