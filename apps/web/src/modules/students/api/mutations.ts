// modules/students/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import {
  studentSchema,
  guardianSchema,
  medicalRecordSchema,
  disciplineRecordSchema,
  achievementSchema,
  type StudentInput,
  type GuardianInput,
  type MedicalRecordInput,
  type DisciplineRecordInput,
  type AchievementInput,
} from '../schemas/student.schema';

/** Creates a student + its current-year enrollment as one logical unit.
 * Not wrapped in a single DB transaction here because Supabase's client
 * API doesn't expose multi-statement transactions directly — if the
 * enrollment insert fails we roll the student back explicitly so we never
 * leave a student with no enrollment. (A Postgres function is the more
 * robust home for this and is the natural refactor once Phase 4 Admissions
 * needs the same create-student-plus-enrollment step for its automation.) */
export async function createStudent(organizationId: string, schoolId: string, input: StudentInput) {
  const parsed = studentSchema.parse(input);

  const { data: studentCode, error: codeError } = await supabase.rpc('generate_student_code', {
    p_school_id: schoolId,
  });
  if (codeError) throw new ApiError('code_generation_failed', codeError.message);

  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert({
      organization_id: organizationId,
      school_id: schoolId,
      student_code: studentCode,
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      date_of_birth: parsed.dateOfBirth,
      gender: parsed.gender,
      nationality: parsed.nationality || null,
      admission_date: parsed.admissionDate,
      house_id: parsed.houseId || null,
    })
    .select()
    .single();
  if (studentError) throw new ApiError(studentError.code ?? 'create_failed', studentError.message);

  const { error: enrollmentError } = await supabase.from('student_enrollments').insert({
    student_id: student.id,
    academic_year_id: parsed.academicYearId,
    class_id: parsed.classId,
    section_id: parsed.sectionId,
    roll_number: parsed.rollNumber || null,
  });
  if (enrollmentError) {
    await supabase.from('students').delete().eq('id', student.id); // compensating rollback
    throw new ApiError('enrollment_failed', enrollmentError.message);
  }

  return student;
}

export async function updateStudent(studentId: string, input: Partial<StudentInput>) {
  const parsed = studentSchema.partial().parse(input);
  const { data, error } = await supabase
    .from('students')
    .update({
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      date_of_birth: parsed.dateOfBirth,
      gender: parsed.gender,
      nationality: parsed.nationality || null,
      house_id: parsed.houseId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', studentId)
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'update_failed', error.message);
  return data;
}

export async function archiveStudent(studentId: string, status: 'graduated' | 'transferred_out' | 'expelled' | 'inactive') {
  const { error } = await supabase
    .from('students')
    .update({ status, deleted_at: status === 'inactive' ? null : new Date().toISOString() })
    .eq('id', studentId);
  if (error) throw new ApiError(error.code ?? 'archive_failed', error.message);
}

export async function addGuardian(organizationId: string, studentId: string, input: GuardianInput) {
  const parsed = guardianSchema.parse(input);

  const { data: guardian, error: guardianError } = await supabase
    .from('guardians')
    .insert({
      organization_id: organizationId,
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      email: parsed.email || null,
      phone: parsed.phone,
      occupation: parsed.occupation || null,
      address: parsed.address || null,
    })
    .select()
    .single();
  if (guardianError) throw new ApiError(guardianError.code ?? 'create_failed', guardianError.message);

  const { error: linkError } = await supabase.from('student_guardians').insert({
    student_id: studentId,
    guardian_id: guardian.id,
    relationship: parsed.relationship,
    is_primary_contact: parsed.isPrimaryContact,
    is_emergency_contact: parsed.isEmergencyContact,
  });
  if (linkError) {
    if (linkError.code === '23505') {
      throw new ApiError('primary_contact_exists', 'This student already has a primary contact set.');
    }
    throw new ApiError(linkError.code ?? 'link_failed', linkError.message);
  }

  return guardian;
}

export async function upsertMedicalRecord(studentId: string, input: MedicalRecordInput) {
  const parsed = medicalRecordSchema.parse(input);
  const { data, error } = await supabase
    .from('student_medical_records')
    .upsert({
      student_id: studentId,
      blood_group: parsed.bloodGroup || null,
      allergies: parsed.allergies || null,
      chronic_conditions: parsed.chronicConditions || null,
      medications: parsed.medications || null,
      emergency_instructions: parsed.emergencyInstructions || null,
      physician_name: parsed.physicianName || null,
      physician_phone: parsed.physicianPhone || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'save_failed', error.message);
  return data;
}

export async function addDisciplineRecord(studentId: string, input: DisciplineRecordInput) {
  const parsed = disciplineRecordSchema.parse(input);
  const { data, error } = await supabase
    .from('student_discipline_records')
    .insert({
      student_id: studentId,
      incident_date: parsed.incidentDate,
      category: parsed.category,
      description: parsed.description,
      action_taken: parsed.actionTaken || null,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function addAchievement(studentId: string, input: AchievementInput) {
  const parsed = achievementSchema.parse(input);
  const { data, error } = await supabase
    .from('student_achievements')
    .insert({
      student_id: studentId,
      title: parsed.title,
      category: parsed.category,
      achieved_on: parsed.achievedOn,
      description: parsed.description || null,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function uploadStudentDocument(
  studentId: string,
  documentType: string,
  file: File,
  uploadedByProfileId: string,
) {
  const path = `student-documents/${studentId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('student-documents').upload(path, file);
  if (uploadError) throw new ApiError('upload_failed', uploadError.message);

  const { data, error } = await supabase
    .from('student_documents')
    .insert({
      student_id: studentId,
      document_type: documentType,
      file_path: path,
      file_name: file.name,
      uploaded_by_profile_id: uploadedByProfileId,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}
