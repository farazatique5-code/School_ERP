// modules/teachers-hr/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import {
  inviteEmployeeSchema,
  teacherAssignmentSchema,
  leaveRequestSchema,
  salaryStructureSchema,
  type InviteEmployeeInput,
  type TeacherAssignmentInput,
  type LeaveRequestInput,
  type SalaryStructureInput,
} from '../schemas/hr.schema';

const INVITE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-employee`;

export async function inviteEmployee(
  organizationId: string,
  schoolId: string,
  accessToken: string,
  input: InviteEmployeeInput,
) {
  const parsed = inviteEmployeeSchema.parse(input);

  const response = await fetch(INVITE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      fullName: parsed.fullName,
      email: parsed.email,
      organizationId,
      schoolId,
      designation: parsed.designation,
      departmentId: parsed.departmentId || undefined,
      employmentType: parsed.employmentType,
      joiningDate: parsed.joiningDate,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'unknown_error', body?.error?.message ?? 'Invite failed');
  }
  return body.data as { profile_id: string };
}

export async function addTeacherAssignment(teacherProfileId: string, academicYearId: string, input: TeacherAssignmentInput) {
  const parsed = teacherAssignmentSchema.parse(input);
  const { data, error } = await supabase
    .from('teacher_assignments')
    .insert({
      teacher_profile_id: teacherProfileId,
      academic_year_id: academicYearId,
      class_id: parsed.classId,
      section_id: parsed.sectionId,
      subject_id: parsed.subjectId || null,
      is_class_teacher: parsed.isClassTeacher,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new ApiError(
        error.message.includes('uq_one_class_teacher') ? 'class_teacher_taken' : 'duplicate_assignment',
        error.message.includes('uq_one_class_teacher')
          ? 'This section already has a class teacher assigned.'
          : 'This assignment already exists.',
      );
    }
    throw new ApiError(error.code ?? 'create_failed', error.message);
  }
  return data;
}

export async function removeTeacherAssignment(assignmentId: string) {
  const { error } = await supabase.from('teacher_assignments').delete().eq('id', assignmentId);
  if (error) throw new ApiError(error.code ?? 'delete_failed', error.message);
}

export async function applyForLeave(employeeProfileId: string, input: LeaveRequestInput) {
  const parsed = leaveRequestSchema.parse(input);
  const { data, error } = await supabase
    .from('employee_leave_requests')
    .insert({
      employee_profile_id: employeeProfileId,
      leave_type_id: parsed.leaveTypeId,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      reason: parsed.reason || null,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function reviewLeaveRequest(
  requestId: string,
  reviewerProfileId: string,
  decision: 'approved' | 'rejected',
) {
  const { data, error } = await supabase
    .from('employee_leave_requests')
    .update({ status: decision, reviewed_by_profile_id: reviewerProfileId, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'review_failed', error.message);
  return data;
}

export async function saveSalaryStructure(employeeProfileId: string, input: SalaryStructureInput) {
  const parsed = salaryStructureSchema.parse(input);
  const { data, error } = await supabase
    .from('salary_structures')
    .upsert({
      employee_profile_id: employeeProfileId,
      basic_salary: parsed.basicSalary,
      allowances: { housing: parsed.housingAllowance, transport: parsed.transportAllowance },
      deductions: { tax: parsed.taxDeduction },
      currency: parsed.currency,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'save_failed', error.message);
  return data;
}

/** Generates one month's slip from the current salary structure — a real,
 * simple computation (basic + allowances - deductions), not a placeholder.
 * Statutory tax tables and multi-currency payroll rules are genuinely
 * jurisdiction-specific and are a deliberate follow-up, not faked here. */
export async function generateSalarySlip(
  employeeProfileId: string,
  generatedByProfileId: string,
  month: number,
  year: number,
) {
  const { data: structure, error: structureError } = await supabase
    .from('salary_structures')
    .select('*')
    .eq('employee_profile_id', employeeProfileId)
    .single();
  if (structureError) throw new ApiError('no_structure', 'Set up a salary structure for this employee first.');

  const allowances = structure.allowances as Record<string, number>;
  const deductions = structure.deductions as Record<string, number>;
  const totalAllowances = Object.values(allowances ?? {}).reduce((sum, v) => sum + Number(v), 0);
  const totalDeductions = Object.values(deductions ?? {}).reduce((sum, v) => sum + Number(v), 0);
  const netPay = Number(structure.basic_salary) + totalAllowances - totalDeductions;

  const { data, error } = await supabase
    .from('salary_slips')
    .insert({
      employee_profile_id: employeeProfileId,
      period_month: month,
      period_year: year,
      basic_salary: structure.basic_salary,
      total_allowances: totalAllowances,
      total_deductions: totalDeductions,
      net_pay: netPay,
      generated_by_profile_id: generatedByProfileId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new ApiError('already_generated', 'A slip for this month already exists.');
    throw new ApiError(error.code ?? 'generate_failed', error.message);
  }
  return data;
}
