// modules/admissions/schemas/admission.schema.ts
import { z } from 'zod';

export const admissionApplicationSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  applyingForClassId: z.string().uuid('Select a class'),
  academicYearId: z.string().uuid(),
  guardianFirstName: z.string().min(1, 'Guardian first name is required').max(100),
  guardianLastName: z.string().min(1, 'Guardian last name is required').max(100),
  guardianEmail: z.string().email().optional().or(z.literal('')),
  guardianPhone: z.string().min(6, 'Enter a valid phone number').max(30),
  previousSchoolName: z.string().max(200).optional().or(z.literal('')),
});
export type AdmissionApplicationInput = z.infer<typeof admissionApplicationSchema>;

export const interviewSchema = z.object({
  scheduledAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date/time'),
  location: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type InterviewInput = z.infer<typeof interviewSchema>;

export const rejectionSchema = z.object({
  rejectionReason: z.string().min(1, 'A reason is required so guardians receive a clear answer').max(1000),
});
export type RejectionInput = z.infer<typeof rejectionSchema>;

export const applicationListFilterSchema = z.object({
  search: z.string().optional(),
  status: z
    .enum(['submitted', 'under_review', 'interview_scheduled', 'approved', 'rejected', 'withdrawn'])
    .optional(),
});
export type ApplicationListFilter = z.infer<typeof applicationListFilterSchema>;

export const APPLICATION_STATUSES = [
  'submitted',
  'under_review',
  'interview_scheduled',
  'approved',
  'rejected',
  'withdrawn',
] as const;
