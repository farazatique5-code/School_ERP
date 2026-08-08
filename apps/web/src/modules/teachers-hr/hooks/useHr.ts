// modules/teachers-hr/hooks/useHr.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import {
  listEmployees,
  getEmployeeDetail,
  listLeaveTypes,
  listLeaveRequests,
  getMyLeaveRequests,
  getSalarySlips,
} from '../api/queries';
import {
  inviteEmployee,
  addTeacherAssignment,
  removeTeacherAssignment,
  applyForLeave,
  reviewLeaveRequest,
  saveSalaryStructure,
  generateSalarySlip,
} from '../api/mutations';
import type {
  InviteEmployeeInput,
  TeacherAssignmentInput,
  LeaveRequestInput,
  SalaryStructureInput,
} from '../schemas/hr.schema';

export const hrKeys = {
  employees: (schoolId?: string) => ['hr', 'employees', schoolId] as const,
  employee: (profileId?: string) => ['hr', 'employee', profileId] as const,
  leaveTypes: (schoolId?: string) => ['hr', 'leaveTypes', schoolId] as const,
  leaveRequests: (schoolId?: string, status?: string) => ['hr', 'leaveRequests', schoolId, status] as const,
  myLeave: (profileId?: string) => ['hr', 'myLeave', profileId] as const,
  salarySlips: (profileId?: string) => ['hr', 'salarySlips', profileId] as const,
};

export function useEmployeesList() {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: hrKeys.employees(activeSchoolId ?? undefined),
    enabled: !!activeSchoolId,
    queryFn: () => listEmployees(activeSchoolId!),
  });
}

export function useEmployeeDetail(profileId: string | undefined) {
  return useQuery({
    queryKey: hrKeys.employee(profileId),
    enabled: !!profileId,
    queryFn: () => getEmployeeDetail(profileId!),
  });
}

export function useLeaveTypes() {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: hrKeys.leaveTypes(activeSchoolId ?? undefined),
    enabled: !!activeSchoolId,
    queryFn: () => listLeaveTypes(activeSchoolId!),
  });
}

export function useLeaveRequests(status?: string) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: hrKeys.leaveRequests(activeSchoolId ?? undefined, status),
    enabled: !!activeSchoolId,
    queryFn: () => listLeaveRequests(activeSchoolId!, status),
  });
}

export function useMyLeaveRequests() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: hrKeys.myLeave(profile?.id),
    enabled: !!profile?.id,
    queryFn: () => getMyLeaveRequests(profile!.id),
  });
}

export function useSalarySlips(profileId: string | undefined) {
  return useQuery({
    queryKey: hrKeys.salarySlips(profileId),
    enabled: !!profileId,
    queryFn: () => getSalarySlips(profileId!),
  });
}

export function useInviteEmployee() {
  const { organization, activeSchoolId, session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteEmployeeInput) =>
      inviteEmployee(organization!.id, activeSchoolId!, session!.access_token, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hrKeys.employees(activeSchoolId ?? undefined) }),
  });
}

export function useAddTeacherAssignment(teacherProfileId: string, academicYearId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TeacherAssignmentInput) => addTeacherAssignment(teacherProfileId, academicYearId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hrKeys.employee(teacherProfileId) }),
  });
}

export function useRemoveTeacherAssignment(teacherProfileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => removeTeacherAssignment(assignmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hrKeys.employee(teacherProfileId) }),
  });
}

export function useApplyForLeave() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LeaveRequestInput) => applyForLeave(profile!.id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hrKeys.myLeave(profile?.id) }),
  });
}

export function useReviewLeaveRequest() {
  const { profile, activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, decision }: { requestId: string; decision: 'approved' | 'rejected' }) =>
      reviewLeaveRequest(requestId, profile!.id, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hrKeys.leaveRequests(activeSchoolId ?? undefined) }),
  });
}

export function useSaveSalaryStructure(employeeProfileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SalaryStructureInput) => saveSalaryStructure(employeeProfileId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hrKeys.employee(employeeProfileId) }),
  });
}

export function useGenerateSalarySlip(employeeProfileId: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      generateSalarySlip(employeeProfileId, profile!.id, month, year),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hrKeys.salarySlips(employeeProfileId) }),
  });
}
