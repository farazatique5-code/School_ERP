// modules/hostel/schemas/hostel.schema.ts
import { z } from 'zod';

export const buildingSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  wardenProfileId: z.string().uuid().optional().or(z.literal('')),
});
export type BuildingInput = z.infer<typeof buildingSchema>;

export const roomSchema = z.object({
  roomNumber: z.string().min(1, 'Room number is required').max(50),
  roomType: z.enum(['single', 'double', 'dormitory']),
  bedCount: z.coerce.number().int().min(1).max(50).default(1),
});
export type RoomInput = z.infer<typeof roomSchema>;

export const allocationSchema = z.object({
  bedId: z.string().uuid('Select a bed'),
  studentId: z.string().uuid('Select a student'),
});
export type AllocationInput = z.infer<typeof allocationSchema>;

export const visitorSchema = z.object({
  studentId: z.string().uuid('Select a student'),
  visitorName: z.string().min(1, 'Visitor name is required').max(200),
  relationship: z.string().max(100).optional().or(z.literal('')),
  purpose: z.string().max(500).optional().or(z.literal('')),
});
export type VisitorInput = z.infer<typeof visitorSchema>;

export const messMenuSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  mealType: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']),
  menuDescription: z.string().min(1, 'Menu description is required').max(500),
});
export type MessMenuInput = z.infer<typeof messMenuSchema>;

export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
