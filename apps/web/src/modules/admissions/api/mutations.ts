// modules/admissions/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import {
  admissionApplicationSchema,
  interviewSchema,
  rejectionSchema,
  type AdmissionApplicationInput,
  type InterviewInput,
  type RejectionInput,
} from '../schemas/admission.schema';

export async function createApplication(
  organizationId: string,
  schoolId: string,
  input: AdmissionApplicationInput,
) {
  const parsed = admissionApplicationSchema.parse(input);

  const { data: applicationNumber, error: numberError } = await supabase.rpc('generate_application_number', {
    p_school_id: schoolId,
  });
  if (numberError) throw new ApiError('number_generation_failed', numberError.message);

  const { data, error } = await supabase
    .from('admission_applications')
    .insert({
      organization_id: organizationId,
      school_id: schoolId,
      application_number: applicationNumber,
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      date_of_birth: parsed.dateOfBirth,
      gender: parsed.gender,
      applying_for_class_id: parsed.applyingForClassId,
      academic_year_id: parsed.academicYearId,
      guardian_first_name: parsed.guardianFirstName,
      guardian_last_name: parsed.guardianLastName,
      guardian_email: parsed.guardianEmail || null,
      guardian_phone: parsed.guardianPhone,
      previous_school_name: parsed.previousSchoolName || null,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

/** General status transitions that AREN'T "approve" (submitted → under_review,
 * under_review → interview_scheduled, any → withdrawn) go through this —
 * approval has its own function below because it's gated by a distinct
 * RLS-enforced permission (admissions.approve). */
export async function updateApplicationStatus(
  applicationId: string,
  status: 'under_review' | 'interview_scheduled' | 'withdrawn',
) {
  const { data, error } = await supabase
    .from('admission_applications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', applicationId)
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'update_failed', error.message);
  return data;
}

export async function approveApplication(applicationId: string, reviewerProfileId: string) {
  const { data, error } = await supabase
    .from('admission_applications')
    .update({ status: 'approved', reviewed_by_profile_id: reviewerProfileId, reviewed_at: new Date().toISOString() })
    .eq('id', applicationId)
    .select()
    .single();
  if (error) {
    if (error.message?.includes('no_section_available')) {
      throw new ApiError(
        'no_section_available',
        'The applied-for class has no sections set up yet. Add a section in Academic Setup before approving.',
      );
    }
    if (error.code === '42501') {
      throw new ApiError('forbidden', "You don't have permission to approve applications.");
    }
    throw new ApiError(error.code ?? 'approve_failed', error.message);
  }
  return data; // includes converted_student_id, set by the admission_approved trigger
}

export async function rejectApplication(applicationId: string, reviewerProfileId: string, input: RejectionInput) {
  const parsed = rejectionSchema.parse(input);
  const { data, error } = await supabase
    .from('admission_applications')
    .update({
      status: 'rejected',
      rejection_reason: parsed.rejectionReason,
      reviewed_by_profile_id: reviewerProfileId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'reject_failed', error.message);
  return data;
}

export async function scheduleInterview(applicationId: string, interviewerProfileId: string, input: InterviewInput) {
  const parsed = interviewSchema.parse(input);

  const { data, error } = await supabase
    .from('admission_interviews')
    .insert({
      application_id: applicationId,
      scheduled_at: parsed.scheduledAt,
      location: parsed.location || null,
      notes: parsed.notes || null,
      interviewer_profile_id: interviewerProfileId,
      outcome: 'pending',
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'schedule_failed', error.message);

  // Move the application into the interview_scheduled stage automatically —
  // scheduling an interview and the pipeline stage should never drift apart.
  await updateApplicationStatus(applicationId, 'interview_scheduled');

  return data;
}

export async function uploadAdmissionDocument(applicationId: string, documentType: string, file: File) {
  const path = `admission-documents/${applicationId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('admission-documents').upload(path, file);
  if (uploadError) throw new ApiError('upload_failed', uploadError.message);

  const { data, error } = await supabase
    .from('admission_documents')
    .insert({ application_id: applicationId, document_type: documentType, file_path: path, file_name: file.name })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}
