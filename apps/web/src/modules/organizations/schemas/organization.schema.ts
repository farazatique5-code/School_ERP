// modules/organizations/schemas/organization.schema.ts
import { z } from 'zod';

const slugRegex = /^[a-z0-9-]+$/;
const codeRegex = /^[A-Z0-9]+$/;

export const signUpSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  organizationName: z.string().min(2, 'Organization name is required').max(200),
  organizationSlug: z
    .string()
    .min(2, 'URL slug is required')
    .max(63)
    .regex(slugRegex, 'Only lowercase letters, numbers, and hyphens'),
  schoolName: z.string().min(2, 'School name is required').max(200),
  schoolCode: z
    .string()
    .min(1, 'School code is required')
    .max(20)
    .regex(codeRegex, 'Use uppercase letters/numbers, e.g. MAIN'),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const organizationSettingsSchema = z.object({
  name: z.string().min(2).max(200),
  customDomain: z
    .string()
    .max(253)
    .regex(/^[a-z0-9.-]+$/i, 'Enter a valid domain, e.g. portal.myschool.edu')
    .optional()
    .or(z.literal('')),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6})$/, 'Use a hex color, e.g. #4F46E5'),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6})$/, 'Use a hex color, e.g. #0EA5E9'),
  themeModeDefault: z.enum(['light', 'dark', 'system']),
  billingEmail: z.string().email().optional().or(z.literal('')),
});
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;

/** Auto-derives a URL-safe slug suggestion from an organization name;
 * the field remains editable so the user can resolve collisions themselves. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 63);
}
