// modules/timetable/hooks/useTimetable.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { listPeriods, getSectionTimetable, getTeacherTimetable, getClassSubjects } from '../api/queries';
import { createPeriod, upsertTimetableEntry, clearTimetableEntry } from '../api/mutations';
import type { PeriodInput, TimetableEntryInput } from '../schemas/timetable.schema';

export const timetableKeys = {
  periods: (schoolId?: string) => ['timetable', 'periods', schoolId] as const,
  section: (sectionId?: string, yearId?: string) => ['timetable', 'section', sectionId, yearId] as const,
  teacher: (profileId?: string, yearId?: string) => ['timetable', 'teacher', profileId, yearId] as const,
};

export function usePeriods() {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: timetableKeys.periods(activeSchoolId ?? undefined),
    enabled: !!activeSchoolId,
    queryFn: () => listPeriods(activeSchoolId!),
  });
}

export function useCreatePeriod() {
  const { activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PeriodInput) => createPeriod(activeSchoolId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: timetableKeys.periods(activeSchoolId ?? undefined) }),
  });
}

export function useSectionTimetable(sectionId: string | undefined, academicYearId: string | undefined) {
  return useQuery({
    queryKey: timetableKeys.section(sectionId, academicYearId),
    enabled: !!sectionId && !!academicYearId,
    queryFn: () => getSectionTimetable(sectionId!, academicYearId!),
  });
}

export function useTeacherTimetable(teacherProfileId: string | undefined, academicYearId: string | undefined) {
  return useQuery({
    queryKey: timetableKeys.teacher(teacherProfileId, academicYearId),
    enabled: !!teacherProfileId && !!academicYearId,
    queryFn: () => getTeacherTimetable(teacherProfileId!, academicYearId!),
  });
}

export function useClassSubjects(classId: string | undefined) {
  return useQuery({
    queryKey: ['timetable', 'classSubjects', classId],
    enabled: !!classId,
    queryFn: () => getClassSubjects(classId!),
  });
}

export function useUpsertTimetableEntry(sectionId: string, academicYearId: string) {
  const { activeSchoolId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dayOfWeek,
      periodId,
      input,
    }: {
      dayOfWeek: number;
      periodId: string;
      input: TimetableEntryInput;
    }) => upsertTimetableEntry(activeSchoolId!, academicYearId, sectionId, dayOfWeek, periodId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: timetableKeys.section(sectionId, academicYearId) }),
  });
}

export function useClearTimetableEntry(sectionId: string, academicYearId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayOfWeek, periodId }: { dayOfWeek: number; periodId: string }) =>
      clearTimetableEntry(sectionId, dayOfWeek, periodId, academicYearId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: timetableKeys.section(sectionId, academicYearId) }),
  });
}
