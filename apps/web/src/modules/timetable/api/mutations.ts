// modules/timetable/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import { periodSchema, timetableEntrySchema, type PeriodInput, type TimetableEntryInput } from '../schemas/timetable.schema';

export async function createPeriod(schoolId: string, input: PeriodInput) {
  const parsed = periodSchema.parse(input);
  const { data, error } = await supabase
    .from('periods')
    .insert({
      school_id: schoolId,
      name: parsed.name,
      sequence: parsed.sequence,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      is_break: parsed.isBreak,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

/** Maps the database's real conflict constraints (unique indexes +
 * the teacher-assignment validation trigger) to specific, actionable
 * messages — the conflict detection itself lives in the schema
 * (012_timetable.sql), this just translates the resulting error code. */
export async function upsertTimetableEntry(
  schoolId: string,
  academicYearId: string,
  sectionId: string,
  dayOfWeek: number,
  periodId: string,
  input: TimetableEntryInput,
) {
  const parsed = timetableEntrySchema.parse(input);

  const { data, error } = await supabase
    .from('timetable_entries')
    .upsert(
      {
        school_id: schoolId,
        academic_year_id: academicYearId,
        section_id: sectionId,
        day_of_week: dayOfWeek,
        period_id: periodId,
        subject_id: parsed.subjectId || null,
        teacher_profile_id: parsed.teacherProfileId || null,
        room_number: parsed.roomNumber || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'section_id,day_of_week,period_id,academic_year_id' },
    )
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('uq_no_teacher_double_booking')) {
        throw new ApiError('teacher_conflict', 'This teacher is already scheduled elsewhere at this day and period.');
      }
      if (error.message.includes('uq_no_room_double_booking')) {
        throw new ApiError('room_conflict', 'This room is already booked by another section at this day and period.');
      }
    }
    if (error.code === 'P0002' || error.message.includes('teacher_not_assigned')) {
      throw new ApiError(
        'teacher_not_assigned',
        'This teacher isn\u2019t assigned to this class/subject yet — add the assignment in Teachers & HR first.',
      );
    }
    throw new ApiError(error.code ?? 'save_failed', error.message);
  }
  return data;
}

export async function clearTimetableEntry(sectionId: string, dayOfWeek: number, periodId: string, academicYearId: string) {
  const { error } = await supabase
    .from('timetable_entries')
    .delete()
    .eq('section_id', sectionId)
    .eq('day_of_week', dayOfWeek)
    .eq('period_id', periodId)
    .eq('academic_year_id', academicYearId);
  if (error) throw new ApiError(error.code ?? 'clear_failed', error.message);
}
