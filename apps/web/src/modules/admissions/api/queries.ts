// modules/admissions/api/queries.ts
import { supabase } from '../../../core/supabase/client';
import type { ApplicationListFilter } from '../schemas/admission.schema';
import { APPLICATION_STATUSES } from '../schemas/admission.schema';

export interface ListParams {
  schoolId: string;
  page: number;
  pageSize: number;
  filters?: ApplicationListFilter;
}

export async function listApplications(params: ListParams) {
  const { schoolId, page, pageSize, filters } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('admission_applications')
    .select('id, application_number, first_name, last_name, status, submitted_at, applying_for_class:classes(name)', {
      count: 'exact',
    })
    .eq('school_id', schoolId);

  if (filters?.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,application_number.ilike.%${filters.search}%`,
    );
  }
  if (filters?.status) query = query.eq('status', filters.status);

  query = query.order('submitted_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], totalCount: count ?? 0 };
}

/** Count of applications per status, for the pipeline board columns —
 * a real aggregate query, not a client-side count over a partial page. */
export async function getPipelineCounts(schoolId: string) {
  const results = await Promise.all(
    APPLICATION_STATUSES.map((status) =>
      supabase
        .from('admission_applications')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', status),
    ),
  );
  return Object.fromEntries(APPLICATION_STATUSES.map((status, i) => [status, results[i].count ?? 0]));
}

export async function getApplicationDetail(applicationId: string) {
  const { data, error } = await supabase
    .from('admission_applications')
    .select(
      `*, applying_for_class:classes(name), academic_year:academic_years(name),
       admission_interviews(*, interviewer:profiles(full_name)),
       admission_documents(*),
       converted_student:students(id, student_code)`,
    )
    .eq('id', applicationId)
    .single();
  if (error) throw error;
  return data;
}
