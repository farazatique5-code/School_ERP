// modules/transport/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import {
  vehicleSchema,
  routeSchema,
  stopSchema,
  allocationSchema,
  fuelLogSchema,
  maintenanceLogSchema,
  type VehicleInput,
  type RouteInput,
  type StopInput,
  type AllocationInput,
  type FuelLogInput,
  type MaintenanceLogInput,
} from '../schemas/transport.schema';

export async function createVehicle(schoolId: string, input: VehicleInput) {
  const parsed = vehicleSchema.parse(input);
  const { data, error } = await supabase
    .from('transport_vehicles')
    .insert({
      school_id: schoolId,
      registration_number: parsed.registrationNumber,
      vehicle_type: parsed.vehicleType,
      capacity: parsed.capacity,
      driver_profile_id: parsed.driverProfileId || null,
      gps_device_id: parsed.gpsDeviceId || null,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new ApiError('duplicate', 'A vehicle with this registration number already exists.');
    throw new ApiError(error.code ?? 'create_failed', error.message);
  }
  return data;
}

export async function createRoute(schoolId: string, input: RouteInput) {
  const parsed = routeSchema.parse(input);
  const { data, error } = await supabase
    .from('transport_routes')
    .insert({ school_id: schoolId, name: parsed.name, vehicle_id: parsed.vehicleId || null, description: parsed.description || null })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function createStop(routeId: string, input: StopInput) {
  const parsed = stopSchema.parse(input);
  const { data, error } = await supabase
    .from('transport_stops')
    .insert({
      route_id: routeId,
      name: parsed.name,
      sequence: parsed.sequence,
      pickup_time: parsed.pickupTime || null,
      drop_time: parsed.dropTime || null,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function allocateStudentToRoute(routeId: string, academicYearId: string, input: AllocationInput) {
  const parsed = allocationSchema.parse(input);
  const { data, error } = await supabase
    .from('student_transport_allocations')
    .insert({ student_id: parsed.studentId, route_id: routeId, stop_id: parsed.stopId, academic_year_id: academicYearId })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new ApiError('already_allocated', 'This student already has a transport allocation for this year.');
    throw new ApiError(error.code ?? 'allocate_failed', error.message);
  }
  return data;
}

export async function cancelAllocation(allocationId: string) {
  const { error } = await supabase.from('student_transport_allocations').update({ status: 'cancelled' }).eq('id', allocationId);
  if (error) throw new ApiError(error.code ?? 'cancel_failed', error.message);
}

export async function addFuelLog(vehicleId: string, recordedBy: string, input: FuelLogInput) {
  const parsed = fuelLogSchema.parse(input);
  const { data, error } = await supabase
    .from('vehicle_fuel_logs')
    .insert({
      vehicle_id: vehicleId,
      fill_date: parsed.fillDate,
      liters: parsed.liters,
      cost: parsed.cost,
      odometer_reading: parsed.odometerReading,
      recorded_by_profile_id: recordedBy,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function addMaintenanceLog(vehicleId: string, recordedBy: string, input: MaintenanceLogInput) {
  const parsed = maintenanceLogSchema.parse(input);
  const { data, error } = await supabase
    .from('vehicle_maintenance_logs')
    .insert({
      vehicle_id: vehicleId,
      maintenance_date: parsed.maintenanceDate,
      description: parsed.description,
      cost: parsed.cost,
      next_due_date: parsed.nextDueDate || null,
      recorded_by_profile_id: recordedBy,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}
