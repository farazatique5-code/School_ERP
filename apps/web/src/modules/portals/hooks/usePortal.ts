// modules/portals/hooks/usePortal.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import {
  getMyChildren,
  getMyOwnStudentRecord,
  getPortalOverview,
  getPortalAttendance,
  getPortalInvoices,
  getPortalExams,
  getPortalTimetable,
  getMyNotifications,
} from '../api/queries';
import { invitePortalUser } from '../api/mutations';

export function useMyChildren() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['portal', 'children', profile?.id],
    enabled: !!profile?.id,
    queryFn: () => getMyChildren(profile!.id),
  });
}

export function useMyOwnStudentRecord() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['portal', 'ownRecord', profile?.id],
    enabled: !!profile?.id,
    queryFn: () => getMyOwnStudentRecord(profile!.id),
  });
}

export function usePortalOverview(studentId: string | undefined) {
  return useQuery({ queryKey: ['portal', 'overview', studentId], enabled: !!studentId, queryFn: () => getPortalOverview(studentId!) });
}

export function usePortalAttendance(studentId: string | undefined) {
  return useQuery({ queryKey: ['portal', 'attendance', studentId], enabled: !!studentId, queryFn: () => getPortalAttendance(studentId!) });
}

export function usePortalInvoices(studentId: string | undefined) {
  return useQuery({ queryKey: ['portal', 'invoices', studentId], enabled: !!studentId, queryFn: () => getPortalInvoices(studentId!) });
}

export function usePortalExams(studentId: string | undefined) {
  return useQuery({ queryKey: ['portal', 'exams', studentId], enabled: !!studentId, queryFn: () => getPortalExams(studentId!) });
}

export function usePortalTimetable(studentId: string | undefined) {
  return useQuery({ queryKey: ['portal', 'timetable', studentId], enabled: !!studentId, queryFn: () => getPortalTimetable(studentId!) });
}

export function useMyNotifications() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['portal', 'notifications', profile?.id],
    enabled: !!profile?.id,
    queryFn: () => getMyNotifications(profile!.id),
    refetchInterval: 30_000,
  });
}

export function useInvitePortalUser() {
  const { organization, session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      portalType,
      targetId,
      fullName,
      email,
    }: {
      portalType: 'student' | 'guardian';
      targetId: string;
      fullName: string;
      email: string;
    }) => invitePortalUser(session!.access_token, organization!.id, portalType, targetId, fullName, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
