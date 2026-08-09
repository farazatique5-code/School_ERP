// modules/library/schemas/library.schema.ts
import { z } from 'zod';

export const bookSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  author: z.string().max(200).optional().or(z.literal('')),
  isbn: z.string().max(30).optional().or(z.literal('')),
  publisher: z.string().max(200).optional().or(z.literal('')),
  category: z.string().max(100).optional().or(z.literal('')),
  shelfLocation: z.string().max(100).optional().or(z.literal('')),
  copyCount: z.coerce.number().int().min(1).max(500).default(1),
});
export type BookInput = z.infer<typeof bookSchema>;

export const issueSchema = z.object({
  barcode: z.string().min(1, 'Scan or enter a barcode'),
  borrowerType: z.enum(['student', 'employee']),
  borrowerId: z.string().uuid('Select a borrower'),
  dueDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
});
export type IssueInput = z.infer<typeof issueSchema>;
