// modules/organizations/hooks/useSchools.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { listSchools, createSchool, updateSchool, archiveSchool } from '../api/schools';
import type { SchoolInput } from '../schemas/school.schema';

export const schoolKeys = {
  all: ['schools'] as const,
  list: (orgId?: string) => [...schoolKeys.all, 'list', orgId] as const,
};

export function useSchoolsList() {
  const { organization } = useAuth();
  return useQuery({
    queryKey: schoolKeys.list(organization?.id),
    enabled: !!organization?.id,
    queryFn: () => listSchools(organization!.id),
  });
}

export function useCreateSchool() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SchoolInput) => createSchool(organization!.id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schoolKeys.list(organization?.id) }),
  });
}

export function useUpdateSchool(schoolId: string) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SchoolInput) => updateSchool(schoolId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schoolKeys.list(organization?.id) }),
  });
}

export function useArchiveSchool() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schoolId: string) => archiveSchool(schoolId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schoolKeys.list(organization?.id) }),
  });
}
