// modules/students/schemas/student.schema.ts
import { z } from 'zod';

export const studentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  nationality: z.string().max(100).optional().or(z.literal('')),
  admissionDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  classId: z.string().uuid('Select a class'),
  sectionId: z.string().uuid('Select a section'),
  academicYearId: z.string().uuid(),
  houseId: z.string().uuid().optional().or(z.literal('')),
  rollNumber: z.string().max(20).optional().or(z.literal('')),
});
export type StudentInput = z.infer<typeof studentSchema>;

export const guardianSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(6, 'Enter a valid phone number').max(30),
  occupation: z.string().max(150).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  relationship: z.enum(['father', 'mother', 'guardian', 'other']),
  isPrimaryContact: z.boolean().default(false),
  isEmergencyContact: z.boolean().default(false),
});
export type GuardianInput = z.infer<typeof guardianSchema>;

export const medicalRecordSchema = z.object({
  bloodGroup: z.string().max(5).optional().or(z.literal('')),
  allergies: z.string().max(1000).optional().or(z.literal('')),
  chronicConditions: z.string().max(1000).optional().or(z.literal('')),
  medications: z.string().max(1000).optional().or(z.literal('')),
  emergencyInstructions: z.string().max(1000).optional().or(z.literal('')),
  physicianName: z.string().max(200).optional().or(z.literal('')),
  physicianPhone: z.string().max(30).optional().or(z.literal('')),
});
export type MedicalRecordInput = z.infer<typeof medicalRecordSchema>;

export const disciplineRecordSchema = z.object({
  incidentDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  category: z.enum(['minor', 'moderate', 'major']),
  description: z.string().min(1, 'Description is required').max(2000),
  actionTaken: z.string().max(1000).optional().or(z.literal('')),
});
export type DisciplineRecordInput = z.infer<typeof disciplineRecordSchema>;

export const achievementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  category: z.enum(['academic', 'sports', 'arts', 'leadership', 'other']).optional(),
  achievedOn: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  description: z.string().max(1000).optional().or(z.literal('')),
});
export type AchievementInput = z.infer<typeof achievementSchema>;

export const studentListFilterSchema = z.object({
  search: z.string().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'graduated', 'transferred_out', 'expelled']).optional(),
});
export type StudentListFilter = z.infer<typeof studentListFilterSchema>;
