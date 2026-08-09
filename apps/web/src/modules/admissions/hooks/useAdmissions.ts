// modules/admissions/hooks/useAdmissions.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { listApplications, getPipelineCounts, getApplicationDetail } from '../api/queries';
import {
  createApplication,
  updateApplicationStatus,
  approveApplication,
  rejectApplication,
  scheduleInterview,
} from '../api/mutations';
import type { ListParams } from '../api/queries';
import type { AdmissionApplicationInput, InterviewInput, RejectionInput } from '../schemas/admission.schema';

export const admissionKeys = {
  all: ['admissions'] as const,
  list: (params: Omit<ListParams, 'schoolId'> & { schoolId?: string }) => [...admissionKeys.all, 'list', params] as const,
  pipeline: (schoolId?: string) => [...admissionKeys.all, 'pipeline', schoolId] as const,
  detail: (id: string) => [...admissionKeys.all, 'detail', id] as const,
};

export function useApplicationsList(params: Omit<ListParams, 'schoolId'>) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: admissionKeys.list({ ...params, schoolId: activeSchoolId ?? undefined }),
    enabled: !!activeSchoolId,
    queryFn: () => listApplications({ ...params, schoolId: activeSchoolId! }),
    placeholderData: (prev) => prev,
  });
}

export function usePipelineCounts() {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: admissionKeys.pipeline(activeSchoolId ?? undefined),
    enabled: !!activeSchoolId,
    queryFn: () => getPipelineCounts(activeSchoolId!),
  });
}

export function useApplicationDetail(applicationId: string | undefined) {
  return useQuery({
    queryKey: admissionKeys.detail(applicationId ?? ''),
    enabled: !!applicationId,
    queryFn: () => getApplicationDetail(applicationId!),
  });
}

export function useCreateApplication() {
  const { organization, activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdmissionApplicationInput) => createApplication(organization!.id, activeSchoolId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: admissionKeys.all }),
  });
}

export function useUpdateApplicationStatus(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: 'under_review' | 'interview_scheduled' | 'withdrawn') =>
      updateApplicationStatus(applicationId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: admissionKeys.detail(applicationId) });
      queryClient.invalidateQueries({ queryKey: admissionKeys.all });
    },
  });
}

export function useApproveApplication(applicationId: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => approveApplication(applicationId, profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: admissionKeys.detail(applicationId) });
      queryClient.invalidateQueries({ queryKey: admissionKeys.all });
      queryClient.invalidateQueries({ queryKey: ['students'] }); // a new student now exists
    },
  });
}

export function useRejectApplication(applicationId: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RejectionInput) => rejectApplication(applicationId, profile!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: admissionKeys.detail(applicationId) });
      queryClient.invalidateQueries({ queryKey: admissionKeys.all });
    },
  });
}

export function useScheduleInterview(applicationId: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InterviewInput) => scheduleInterview(applicationId, profile!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: admissionKeys.detail(applicationId) });
      queryClient.invalidateQueries({ queryKey: admissionKeys.all });
    },
  });
}
