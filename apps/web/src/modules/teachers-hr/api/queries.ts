// modules/teachers-hr/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export async function listEmployees(schoolId: string) {
  const { data, error } = await supabase
    .from('employees')
    .select('*, profile:profiles(full_name, email), department:departments(name)')
    .eq('school_id', schoolId)
    .order('employee_code');
  if (error) throw error;
  return data;
}

export async function getEmployeeDetail(profileId: string) {
  const { data, error } = await supabase
    .from('employees')
    .select(
      `*, profile:profiles(full_name, email, avatar_url), department:departments(name),
       employee_qualifications(*), employee_experience(*), employee_documents(*),
       teacher_assignments(*, class:classes(name), section:sections(name), subject:subjects(name)),
       salary_structures(*)`,
    )
    .eq('profile_id', profileId)
    .single();
  if (error) throw error;
  return data;
}

export async function listLeaveTypes(schoolId: string) {
  const { data, error } = await supabase.from('leave_types').select('*').eq('school_id', schoolId).order('name');
  if (error) throw error;
  return data;
}

export async function listLeaveRequests(schoolId: string, status?: string) {
  let query = supabase
    .from('employee_leave_requests')
    .select('*, employee:employees(employee_code, profile:profiles(full_name)), leave_type:leave_types(name)')
    .eq('employee.school_id', schoolId)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getMyLeaveRequests(profileId: string) {
  const { data, error } = await supabase
    .from('employee_leave_requests')
    .select('*, leave_type:leave_types(name)')
    .eq('employee_profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSalarySlips(profileId: string) {
  const { data, error } = await supabase
    .from('salary_slips')
    .select('*')
    .eq('employee_profile_id', profileId)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });
  if (error) throw error;
  return data;
}
