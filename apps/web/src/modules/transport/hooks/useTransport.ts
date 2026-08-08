// modules/transport/hooks/useTransport.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { listVehicles, listRoutes, getRouteDetail, getVehicleLogs } from '../api/queries';
import { createVehicle, createRoute, createStop, allocateStudentToRoute, cancelAllocation, addFuelLog, addMaintenanceLog } from '../api/mutations';
import type { VehicleInput, RouteInput, StopInput, AllocationInput, FuelLogInput, MaintenanceLogInput } from '../schemas/transport.schema';

export function useVehicles() {
  const { activeSchoolId } = useAuth();
  return useQuery({ queryKey: ['transport', 'vehicles', activeSchoolId], enabled: !!activeSchoolId, queryFn: () => listVehicles(activeSchoolId!) });
}

export function useRoutes() {
  const { activeSchoolId } = useAuth();
  return useQuery({ queryKey: ['transport', 'routes', activeSchoolId], enabled: !!activeSchoolId, queryFn: () => listRoutes(activeSchoolId!) });
}

export function useRouteDetail(routeId: string | undefined) {
  return useQuery({ queryKey: ['transport', 'route', routeId], enabled: !!routeId, queryFn: () => getRouteDetail(routeId!) });
}

export function useVehicleLogs(vehicleId: string | undefined) {
  return useQuery({ queryKey: ['transport', 'logs', vehicleId], enabled: !!vehicleId, queryFn: () => getVehicleLogs(vehicleId!) });
}

export function useCreateVehicle() {
  const { activeSchoolId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VehicleInput) => createVehicle(activeSchoolId!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport', 'vehicles'] }),
  });
}

export function useCreateRoute() {
  const { activeSchoolId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RouteInput) => createRoute(activeSchoolId!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport', 'routes'] }),
  });
}

export function useCreateStop(routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StopInput) => createStop(routeId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport', 'route', routeId] }),
  });
}

export function useAllocateStudent(routeId: string, academicYearId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AllocationInput) => allocateStudentToRoute(routeId, academicYearId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport', 'route', routeId] }),
  });
}

export function useCancelAllocation(routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (allocationId: string) => cancelAllocation(allocationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transport', 'route', routeId] }),
  });
}

export function useAddFuelLog(vehicleId: string) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FuelLogInput) => addFuelLog(vehicleId, profile!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transport', 'logs', vehicleId] });
      qc.invalidateQueries({ queryKey: ['fees', 'ledger'] });
    },
  });
}

export function useAddMaintenanceLog(vehicleId: string) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MaintenanceLogInput) => addMaintenanceLog(vehicleId, profile!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transport', 'logs', vehicleId] });
      qc.invalidateQueries({ queryKey: ['fees', 'ledger'] });
    },
  });
}
