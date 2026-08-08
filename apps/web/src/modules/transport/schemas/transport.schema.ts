// modules/transport/schemas/transport.schema.ts
import { z } from 'zod';

export const vehicleSchema = z.object({
  registrationNumber: z.string().min(1, 'Registration number is required').max(50),
  vehicleType: z.enum(['bus', 'van', 'car']),
  capacity: z.coerce.number().int().positive('Enter a positive number'),
  driverProfileId: z.string().uuid().optional().or(z.literal('')),
  gpsDeviceId: z.string().max(100).optional().or(z.literal('')),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

export const routeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  vehicleId: z.string().uuid().optional().or(z.literal('')),
  description: z.string().max(500).optional().or(z.literal('')),
});
export type RouteInput = z.infer<typeof routeSchema>;

export const stopSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  sequence: z.coerce.number().int().min(0),
  pickupTime: z.string().optional().or(z.literal('')),
  dropTime: z.string().optional().or(z.literal('')),
});
export type StopInput = z.infer<typeof stopSchema>;

export const allocationSchema = z.object({
  studentId: z.string().uuid('Select a student'),
  stopId: z.string().uuid('Select a stop'),
});
export type AllocationInput = z.infer<typeof allocationSchema>;

export const fuelLogSchema = z.object({
  fillDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  liters: z.coerce.number().positive(),
  cost: z.coerce.number().min(0),
  odometerReading: z.coerce.number().int().min(0).optional(),
});
export type FuelLogInput = z.infer<typeof fuelLogSchema>;

export const maintenanceLogSchema = z.object({
  maintenanceDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  description: z.string().min(1, 'Description is required').max(500),
  cost: z.coerce.number().min(0),
  nextDueDate: z.string().optional().or(z.literal('')),
});
export type MaintenanceLogInput = z.infer<typeof maintenanceLogSchema>;
