// modules/transport/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export async function listVehicles(schoolId: string) {
  const { data, error } = await supabase
    .from('transport_vehicles')
    .select('*, driver:employees(profile:profiles(full_name))')
    .eq('school_id', schoolId)
    .order('registration_number');
  if (error) throw error;
  return data;
}

export async function listRoutes(schoolId: string) {
  const { data, error } = await supabase
    .from('transport_routes')
    .select('*, vehicle:transport_vehicles(registration_number), transport_stops(id)')
    .eq('school_id', schoolId)
    .order('name');
  if (error) throw error;
  return data;
}

export async function getRouteDetail(routeId: string) {
  const { data, error } = await supabase
    .from('transport_routes')
    .select('*, vehicle:transport_vehicles(*), transport_stops(*, student_transport_allocations(id, status, student:students(first_name, last_name, student_code)))')
    .eq('id', routeId)
    .order('sequence', { referencedTable: 'transport_stops' })
    .single();
  if (error) throw error;
  return data;
}

export async function getVehicleLogs(vehicleId: string) {
  const [fuel, maintenance] = await Promise.all([
    supabase.from('vehicle_fuel_logs').select('*').eq('vehicle_id', vehicleId).order('fill_date', { ascending: false }),
    supabase.from('vehicle_maintenance_logs').select('*').eq('vehicle_id', vehicleId).order('maintenance_date', { ascending: false }),
  ]);
  if (fuel.error) throw fuel.error;
  if (maintenance.error) throw maintenance.error;
  return { fuelLogs: fuel.data ?? [], maintenanceLogs: maintenance.data ?? [] };
}
