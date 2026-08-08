// modules/organizations/api/schools.ts
import { supabase } from '../../../core/supabase/client';
import { schoolSchema, type SchoolInput } from '../schemas/school.schema';
import { ApiError } from './mutations';

export async function listSchools(organizationId: string) {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('name');
  if (error) throw new ApiError(error.code ?? 'list_failed', error.message);
  return data;
}

export async function createSchool(organizationId: string, input: SchoolInput) {
  const parsed = schoolSchema.parse(input);
  const { data, error } = await supabase
    .from('schools')
    .insert({ ...parsed, organization_id: organizationId })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new ApiError('code_taken', 'A school with this code already exists.');
    throw new ApiError(error.code ?? 'create_failed', error.message);
  }
  return data;
}

export async function updateSchool(schoolId: string, input: SchoolInput) {
  const parsed = schoolSchema.parse(input);
  const { data, error } = await supabase.from('schools').update(parsed).eq('id', schoolId).select().single();
  if (error) throw new ApiError(error.code ?? 'update_failed', error.message);
  return data;
}

/** Soft delete only — schools carry too much dependent data (Phase 3+)
 * to ever hard-delete; this matches the `deleted_at` column already in
 * the Phase 1 schema. */
export async function archiveSchool(schoolId: string) {
  const { error } = await supabase
    .from('schools')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', schoolId);
  if (error) throw new ApiError(error.code ?? 'archive_failed', error.message);
}
