// modules/teachers-hr/schemas/hr.schema.ts
import { z } from 'zod';

export const inviteEmployeeSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
  email: z.string().email('Enter a valid email address'),
  designation: z.string().min(1, 'Designation is required').max(200),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'substitute']),
  joiningDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
});
export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;

export const teacherAssignmentSchema = z.object({
  classId: z.string().uuid('Select a class'),
  sectionId: z.string().uuid('Select a section'),
  subjectId: z.string().uuid().optional().or(z.literal('')),
  isClassTeacher: z.boolean().default(false),
});
export type TeacherAssignmentInput = z.infer<typeof teacherAssignmentSchema>;

export const leaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid('Select a leave type'),
  startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  reason: z.string().max(1000).optional().or(z.literal('')),
});
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

export const salaryStructureSchema = z.object({
  basicSalary: z.coerce.number().positive('Enter a positive amount'),
  housingAllowance: z.coerce.number().min(0).default(0),
  transportAllowance: z.coerce.number().min(0).default(0),
  taxDeduction: z.coerce.number().min(0).default(0),
  currency: z.string().min(1).max(10).default('USD'),
});
export type SalaryStructureInput = z.infer<typeof salaryStructureSchema>;
