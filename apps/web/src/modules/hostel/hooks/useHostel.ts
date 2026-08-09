// modules/hostel/hooks/useHostel.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { listBuildings, getBuildingDetail, listVacantBeds, getStudentAllocation, listVisitors, listMessMenu } from '../api/queries';
import { createBuilding, createRoomWithBeds, allocateBed, vacateBed, logVisitor, checkOutVisitor, upsertMessMenu } from '../api/mutations';
import type { BuildingInput, RoomInput, VisitorInput, MessMenuInput } from '../schemas/hostel.schema';

export function useBuildings() {
  const { activeSchoolId } = useAuth();
  return useQuery({ queryKey: ['hostel', 'buildings', activeSchoolId], enabled: !!activeSchoolId, queryFn: () => listBuildings(activeSchoolId!) });
}

export function useBuildingDetail(buildingId: string | undefined) {
  return useQuery({ queryKey: ['hostel', 'building', buildingId], enabled: !!buildingId, queryFn: () => getBuildingDetail(buildingId!) });
}

export function useVacantBeds() {
  const { activeSchoolId } = useAuth();
  return useQuery({ queryKey: ['hostel', 'vacantBeds', activeSchoolId], enabled: !!activeSchoolId, queryFn: () => listVacantBeds(activeSchoolId!) });
}

export function useStudentAllocation(studentId: string | undefined) {
  return useQuery({ queryKey: ['hostel', 'allocation', studentId], enabled: !!studentId, queryFn: () => getStudentAllocation(studentId!) });
}

export function useVisitors(studentId?: string) {
  return useQuery({ queryKey: ['hostel', 'visitors', studentId], queryFn: () => listVisitors(studentId) });
}

export function useMessMenu() {
  const { activeSchoolId } = useAuth();
  return useQuery({ queryKey: ['hostel', 'menu', activeSchoolId], enabled: !!activeSchoolId, queryFn: () => listMessMenu(activeSchoolId!) });
}

export function useCreateBuilding() {
  const { activeSchoolId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BuildingInput) => createBuilding(activeSchoolId!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostel', 'buildings'] }),
  });
}

export function useCreateRoom(buildingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomInput) => createRoomWithBeds(buildingId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hostel', 'building', buildingId] });
      qc.invalidateQueries({ queryKey: ['hostel', 'buildings'] });
      qc.invalidateQueries({ queryKey: ['hostel', 'vacantBeds'] });
    },
  });
}

export function useAllocateBed() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bedId, studentId, academicYearId }: { bedId: string; studentId: string; academicYearId: string }) =>
      allocateBed(bedId, studentId, academicYearId, profile!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hostel'] });
    },
  });
}

export function useVacateBed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (allocationId: string) => vacateBed(allocationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostel'] }),
  });
}

export function useLogVisitor() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VisitorInput) => logVisitor(profile!.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostel', 'visitors'] }),
  });
}

export function useCheckOutVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visitorId: string) => checkOutVisitor(visitorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostel', 'visitors'] }),
  });
}

export function useUpsertMessMenu() {
  const { activeSchoolId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MessMenuInput) => upsertMessMenu(activeSchoolId!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hostel', 'menu'] }),
  });
}
