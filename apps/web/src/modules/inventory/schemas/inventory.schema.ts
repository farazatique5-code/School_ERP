// modules/inventory/schemas/inventory.schema.ts
import { z } from 'zod';

export const itemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  sku: z.string().max(100).optional().or(z.literal('')),
  unitOfMeasure: z.string().min(1).max(30).default('unit'),
  isAssetTracked: z.boolean().default(false),
  reorderLevel: z.coerce.number().int().min(0).optional(),
});
export type ItemInput = z.infer<typeof itemSchema>;

export const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  contactPerson: z.string().max(150).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const assetSchema = z.object({
  itemId: z.string().uuid('Select an item'),
  assetTag: z.string().min(1, 'Asset tag is required').max(100),
  locationId: z.string().uuid().optional().or(z.literal('')),
  purchaseDate: z.string().optional().or(z.literal('')),
  purchaseCost: z.coerce.number().min(0).optional(),
});
export type AssetInput = z.infer<typeof assetSchema>;

export const purchaseOrderItemSchema = z.object({
  itemId: z.string().uuid(),
  locationId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().min(0),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().uuid('Select a supplier'),
  orderDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  items: z.array(purchaseOrderItemSchema).min(1, 'Add at least one line item'),
});
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;

export const stockMovementSchema = z.object({
  itemId: z.string().uuid('Select an item'),
  locationId: z.string().uuid('Select a location'),
  movementType: z.enum(['in', 'out', 'adjustment']),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().max(500).optional().or(z.literal('')),
});
export type StockMovementInput = z.infer<typeof stockMovementSchema>;
