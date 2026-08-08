// modules/attendance/hooks/useAttendance.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import {
  getRosterForAttendance,
  getStudentAttendanceHistory,
  getSectionStats,
  getLowAttendanceStudents,
} from '../api/queries';
import { bulkMarkAttendance } from '../api/mutations';
import type { MarkAttendanceInput } from '../schemas/attendance.schema';

export const attendanceKeys = {
  roster: (sectionId?: string, date?: string) => ['attendance', 'roster', sectionId, date] as const,
  history: (studentId?: string) => ['attendance', 'history', studentId] as const,
  stats: (sectionId?: string, from?: string, to?: string) => ['attendance', 'stats', sectionId, from, to] as const,
  lowAttendance: (schoolId?: string, from?: string, to?: string, threshold?: number) =>
    ['attendance', 'low', schoolId, from, to, threshold] as const,
};

export function useRosterForAttendance(sectionId: string | undefined, date: string) {
  return useQuery({
    queryKey: attendanceKeys.roster(sectionId, date),
    enabled: !!sectionId && !!date,
    queryFn: () => getRosterForAttendance(sectionId!, date),
  });
}

export function useStudentAttendanceHistory(studentId: string | undefined) {
  return useQuery({
    queryKey: attendanceKeys.history(studentId),
    enabled: !!studentId,
    queryFn: () => getStudentAttendanceHistory(studentId!),
  });
}

export function useSectionStats(sectionId: string | undefined, fromDate: string, toDate: string) {
  return useQuery({
    queryKey: attendanceKeys.stats(sectionId, fromDate, toDate),
    enabled: !!sectionId,
    queryFn: () => getSectionStats(sectionId!, fromDate, toDate),
  });
}

export function useLowAttendanceStudents(fromDate: string, toDate: string, thresholdPercent: number) {
  const { activeSchoolId } = useAuth();
  return useQuery({
    queryKey: attendanceKeys.lowAttendance(activeSchoolId ?? undefined, fromDate, toDate, thresholdPercent),
    enabled: !!activeSchoolId,
    queryFn: () => getLowAttendanceStudents(activeSchoolId!, fromDate, toDate, thresholdPercent),
  });
}

export function useBulkMarkAttendance() {
  const { organization, activeSchoolId, profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MarkAttendanceInput) =>
      bulkMarkAttendance(organization!.id, activeSchoolId!, profile!.id, input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.roster(input.sectionId, input.attendanceDate) });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // activity feed picks up the audit trail
    },
  });
}
