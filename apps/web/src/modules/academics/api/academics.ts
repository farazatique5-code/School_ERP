// modules/academics/api/academics.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import { academicYearSchema, classSchema, sectionSchema } from '../schemas/academics.schema';
import type { AcademicYearInput, ClassInput, SectionInput } from '../schemas/academics.schema';

export async function listAcademicYears(schoolId: string) {
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createAcademicYear(schoolId: string, input: AcademicYearInput) {
  const parsed = academicYearSchema.parse(input);
  if (parsed.isCurrent) {
    // Clear any existing "current" flag first — the unique partial index
    // (uq_one_current_academic_year) would otherwise reject this insert.
    await supabase.from('academic_years').update({ is_current: false }).eq('school_id', schoolId).eq('is_current', true);
  }
  const { data, error } = await supabase
    .from('academic_years')
    .insert({
      school_id: schoolId,
      name: parsed.name,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      is_current: parsed.isCurrent,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function listClasses(schoolId: string, academicYearId: string) {
  const { data, error } = await supabase
    .from('classes')
    .select('*, sections(*)')
    .eq('school_id', schoolId)
    .eq('academic_year_id', academicYearId)
    .order('sequence');
  if (error) throw error;
  return data;
}

export async function createClass(schoolId: string, academicYearId: string, input: ClassInput) {
  const parsed = classSchema.parse(input);
  const { data, error } = await supabase
    .from('classes')
    .insert({ school_id: schoolId, academic_year_id: academicYearId, name: parsed.name, sequence: parsed.sequence })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function createSection(classId: string, input: SectionInput) {
  const parsed = sectionSchema.parse(input);
  const { data, error } = await supabase
    .from('sections')
    .insert({ class_id: classId, name: parsed.name, capacity: parsed.capacity, room_number: parsed.roomNumber || null })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}
