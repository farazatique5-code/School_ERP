// modules/fees-finance/schemas/fees.schema.ts
import { z } from 'zod';

export const feeCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});
export type FeeCategoryInput = z.infer<typeof feeCategorySchema>;

export const feeStructureSchema = z.object({
  classId: z.string().uuid('Select a class'),
  feeCategoryId: z.string().uuid('Select a fee category'),
  amount: z.coerce.number().positive('Enter a positive amount'),
  frequency: z.enum(['one_time', 'monthly', 'quarterly', 'annual']),
});
export type FeeStructureInput = z.infer<typeof feeStructureSchema>;

export const scholarshipSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().positive('Enter a positive amount'),
});
export type ScholarshipInput = z.infer<typeof scholarshipSchema>;

export const invoiceSchema = z.object({
  studentId: z.string().uuid('Select a student'),
  termId: z.string().uuid().optional().or(z.literal('')),
  dueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  items: z
    .array(
      z.object({
        feeCategoryId: z.string().uuid(),
        amount: z.coerce.number().positive(),
      }),
    )
    .min(1, 'Add at least one line item'),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const paymentSchema = z.object({
  amount: z.coerce.number().positive('Enter a positive amount'),
  paymentDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'online', 'cheque']),
  transactionReference: z.string().max(200).optional().or(z.literal('')),
});
export type PaymentInput = z.infer<typeof paymentSchema>;
