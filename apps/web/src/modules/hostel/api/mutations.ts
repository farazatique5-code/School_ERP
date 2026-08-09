// modules/hostel/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import { buildingSchema, roomSchema, visitorSchema, messMenuSchema, type BuildingInput, type RoomInput, type VisitorInput, type MessMenuInput } from '../schemas/hostel.schema';

export async function createBuilding(schoolId: string, input: BuildingInput) {
  const parsed = buildingSchema.parse(input);
  const { data, error } = await supabase
    .from('hostel_buildings')
    .insert({ school_id: schoolId, name: parsed.name, warden_profile_id: parsed.wardenProfileId || null })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function createRoomWithBeds(buildingId: string, input: RoomInput) {
  const parsed = roomSchema.parse(input);
  const { data: room, error: roomError } = await supabase
    .from('hostel_rooms')
    .insert({ building_id: buildingId, room_number: parsed.roomNumber, room_type: parsed.roomType })
    .select()
    .single();
  if (roomError) throw new ApiError(roomError.code ?? 'create_failed', roomError.message);

  const beds = Array.from({ length: parsed.bedCount }, (_, i) => ({ room_id: room.id, bed_number: String(i + 1) }));
  const { error: bedsError } = await supabase.from('hostel_beds').insert(beds);
  if (bedsError) {
    await supabase.from('hostel_rooms').delete().eq('id', room.id);
    throw new ApiError('beds_failed', bedsError.message);
  }
  return room;
}

export async function allocateBed(bedId: string, studentId: string, academicYearId: string, allocatedBy: string) {
  const { data, error } = await supabase.rpc('fn_allocate_bed', {
    p_bed_id: bedId,
    p_student_id: studentId,
    p_academic_year_id: academicYearId,
    p_allocated_by: allocatedBy,
  });
  if (error) {
    if (error.message?.includes('bed_not_vacant')) throw new ApiError('bed_not_vacant', 'This bed is no longer vacant.');
    if (error.code === '23505') throw new ApiError('student_already_allocated', 'This student already has an active hostel allocation.');
    throw new ApiError('allocate_failed', error.message);
  }
  return data as string;
}

export async function vacateBed(allocationId: string) {
  const { error } = await supabase.rpc('fn_vacate_bed', { p_allocation_id: allocationId });
  if (error) throw new ApiError('vacate_failed', error.message);
}

export async function logVisitor(loggedByProfileId: string, input: VisitorInput) {
  const parsed = visitorSchema.parse(input);
  const { data, error } = await supabase
    .from('hostel_visitors')
    .insert({
      student_id: parsed.studentId,
      visitor_name: parsed.visitorName,
      relationship: parsed.relationship || null,
      purpose: parsed.purpose || null,
      logged_by_profile_id: loggedByProfileId,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function checkOutVisitor(visitorId: string) {
  const { error } = await supabase
    .from('hostel_visitors')
    .update({ check_out_time: new Date().toTimeString().slice(0, 8) })
    .eq('id', visitorId);
  if (error) throw new ApiError(error.code ?? 'update_failed', error.message);
}

export async function upsertMessMenu(schoolId: string, input: MessMenuInput) {
  const parsed = messMenuSchema.parse(input);
  const { data, error } = await supabase
    .from('mess_menus')
    .upsert(
      { school_id: schoolId, day_of_week: parsed.dayOfWeek, meal_type: parsed.mealType, menu_description: parsed.menuDescription },
      { onConflict: 'school_id,day_of_week,meal_type' },
    )
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'save_failed', error.message);
  return data;
}
