// modules/academics/schemas/academics.schema.ts
import { z } from 'zod';

export const academicYearSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  startDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  endDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  isCurrent: z.boolean().default(false),
});
export type AcademicYearInput = z.infer<typeof academicYearSchema>;

export const classSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  sequence: z.coerce.number().int().min(0).default(0),
});
export type ClassInput = z.infer<typeof classSchema>;

export const sectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  capacity: z.coerce.number().int().min(1).optional(),
  roomNumber: z.string().max(50).optional().or(z.literal('')),
});
export type SectionInput = z.infer<typeof sectionSchema>;
