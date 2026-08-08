// modules/academics/hooks/useAcademics.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { listAcademicYears, createAcademicYear, listClasses, createClass, createSection } from '../api/academics';
import type { AcademicYearInput, ClassInput, SectionInput } from '../schemas/academics.schema';

export const academicsKeys = {
  years: (schoolId?: string) => ['academics', 'years', schoolId] as const,
  classes: (schoolId?: string, yearId?: string) => ['academics', 'classes', schoolId, yearId] as const,
};

export function useAcademicYears() {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: academicsKeys.years(activeSchoolId ?? undefined),
    enabled: !!activeSchoolId,
    queryFn: () => listAcademicYears(activeSchoolId!),
  });
}

export function useCreateAcademicYear() {
  const { activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AcademicYearInput) => createAcademicYear(activeSchoolId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: academicsKeys.years(activeSchoolId ?? undefined) }),
  });
}

export function useClasses(academicYearId: string | undefined) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: academicsKeys.classes(activeSchoolId ?? undefined, academicYearId),
    enabled: !!activeSchoolId && !!academicYearId,
    queryFn: () => listClasses(activeSchoolId!, academicYearId!),
  });
}

export function useCreateClass(academicYearId: string) {
  const { activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClassInput) => createClass(activeSchoolId!, academicYearId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: academicsKeys.classes(activeSchoolId ?? undefined, academicYearId) }),
  });
}

export function useCreateSection(classId: string, academicYearId: string) {
  const { activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SectionInput) => createSection(classId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: academicsKeys.classes(activeSchoolId ?? undefined, academicYearId) }),
  });
}
