// modules/hostel/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export async function listBuildings(schoolId: string) {
  const { data, error } = await supabase
    .from('hostel_buildings')
    .select('*, warden:employees(profile:profiles(full_name)), hostel_rooms(id, hostel_beds(id, status))')
    .eq('school_id', schoolId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((b: any) => {
    const beds = b.hostel_rooms.flatMap((r: any) => r.hostel_beds);
    return {
      ...b,
      totalBeds: beds.length,
      occupiedBeds: beds.filter((bed: any) => bed.status === 'occupied').length,
    };
  });
}

export async function getBuildingDetail(buildingId: string) {
  const { data, error } = await supabase
    .from('hostel_buildings')
    .select('*, hostel_rooms(*, hostel_beds(*, hostel_allocations(id, status, student:students(first_name, last_name, student_code))))')
    .eq('id', buildingId)
    .single();
  if (error) throw error;
  return data;
}

export async function listVacantBeds(schoolId: string) {
  const { data, error } = await supabase
    .from('hostel_beds')
    .select('*, room:hostel_rooms(room_number, building:hostel_buildings(name, school_id))')
    .eq('status', 'vacant')
    .eq('room.building.school_id', schoolId);
  if (error) throw error;
  return data;
}

export async function getStudentAllocation(studentId: string) {
  const { data, error } = await supabase
    .from('hostel_allocations')
    .select('*, bed:hostel_beds(bed_number, room:hostel_rooms(room_number, building:hostel_buildings(name)))')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listVisitors(studentId?: string) {
  let query = supabase.from('hostel_visitors').select('*, student:students(first_name, last_name)');
  if (studentId) query = query.eq('student_id', studentId);
  const { data, error } = await query.order('visit_date', { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

export async function listMessMenu(schoolId: string) {
  const { data, error } = await supabase.from('mess_menus').select('*').eq('school_id', schoolId).order('day_of_week');
  if (error) throw error;
  return data;
}
