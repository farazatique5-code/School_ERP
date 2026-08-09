// modules/organizations/schemas/school.schema.ts
import { z } from 'zod';

export const schoolSchema = z.object({
  name: z.string().min(2, 'School name is required').max(200),
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20)
    .regex(/^[A-Z0-9]+$/, 'Uppercase letters/numbers only'),
  type: z.enum(['school', 'college', 'academy', 'campus']),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  country: z.string().max(100).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  timezone: z.string().min(1).default('UTC'),
});
export type SchoolInput = z.infer<typeof schoolSchema>;
