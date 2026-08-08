// modules/students/hooks/useStudents.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { listStudents, getStudentDetail, getStudentMedicalRecord, getStudentDisciplineRecords } from '../api/queries';
import {
  createStudent,
  updateStudent,
  archiveStudent,
  addGuardian,
  upsertMedicalRecord,
  addDisciplineRecord,
  addAchievement,
} from '../api/mutations';
import type { ListParams } from '../api/queries';
import type {
  StudentInput,
  GuardianInput,
  MedicalRecordInput,
  DisciplineRecordInput,
  AchievementInput,
} from '../schemas/student.schema';

export const studentKeys = {
  all: ['students'] as const,
  list: (params: Omit<ListParams, 'schoolId'> & { schoolId?: string }) => [...studentKeys.all, 'list', params] as const,
  detail: (id: string) => [...studentKeys.all, 'detail', id] as const,
  medical: (id: string) => [...studentKeys.all, 'medical', id] as const,
  discipline: (id: string) => [...studentKeys.all, 'discipline', id] as const,
};

export function useStudentsList(params: Omit<ListParams, 'schoolId'>) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: studentKeys.list({ ...params, schoolId: activeSchoolId ?? undefined }),
    enabled: !!activeSchoolId,
    queryFn: () => listStudents({ ...params, schoolId: activeSchoolId! }),
    placeholderData: (prev) => prev, // keeps the table populated while flipping pages
  });
}

export function useStudentDetail(studentId: string | undefined) {
  return useQuery({
    queryKey: studentKeys.detail(studentId ?? ''),
    enabled: !!studentId,
    queryFn: () => getStudentDetail(studentId!),
  });
}

export function useStudentMedicalRecord(studentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: studentKeys.medical(studentId ?? ''),
    enabled: !!studentId && enabled,
    queryFn: () => getStudentMedicalRecord(studentId!),
  });
}

export function useStudentDisciplineRecords(studentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: studentKeys.discipline(studentId ?? ''),
    enabled: !!studentId && enabled,
    queryFn: () => getStudentDisciplineRecords(studentId!),
  });
}

export function useCreateStudent() {
  const { organization, activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StudentInput) => createStudent(organization!.id, activeSchoolId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentKeys.all }),
  });
}

export function useUpdateStudent(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<StudentInput>) => updateStudent(studentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.detail(studentId) });
      queryClient.invalidateQueries({ queryKey: studentKeys.all });
    },
  });
}

export function useArchiveStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: 'graduated' | 'transferred_out' | 'expelled' | 'inactive' }) =>
      archiveStudent(studentId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentKeys.all }),
  });
}

export function useAddGuardian(studentId: string) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GuardianInput) => addGuardian(organization!.id, studentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentKeys.detail(studentId) }),
  });
}

export function useSaveMedicalRecord(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MedicalRecordInput) => upsertMedicalRecord(studentId, input),
    onSuccess: (data) => queryClient.setQueryData(studentKeys.medical(studentId), data),
  });
}

export function useAddDisciplineRecord(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DisciplineRecordInput) => addDisciplineRecord(studentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentKeys.discipline(studentId) }),
  });
}

export function useAddAchievement(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AchievementInput) => addAchievement(studentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentKeys.detail(studentId) }),
  });
}
