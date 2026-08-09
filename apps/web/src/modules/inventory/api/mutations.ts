// modules/inventory/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';
import {
  itemSchema,
  supplierSchema,
  assetSchema,
  purchaseOrderSchema,
  stockMovementSchema,
  type ItemInput,
  type SupplierInput,
  type AssetInput,
  type PurchaseOrderInput,
  type StockMovementInput,
} from '../schemas/inventory.schema';

export async function createItem(schoolId: string, input: ItemInput) {
  const parsed = itemSchema.parse(input);
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      school_id: schoolId,
      category_id: parsed.categoryId || null,
      name: parsed.name,
      sku: parsed.sku || null,
      unit_of_measure: parsed.unitOfMeasure,
      is_asset_tracked: parsed.isAssetTracked,
      reorder_level: parsed.reorderLevel,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function createSupplier(schoolId: string, input: SupplierInput) {
  const parsed = supplierSchema.parse(input);
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      school_id: schoolId,
      name: parsed.name,
      contact_person: parsed.contactPerson || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      address: parsed.address || null,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'create_failed', error.message);
  return data;
}

export async function createAsset(input: AssetInput) {
  const parsed = assetSchema.parse(input);
  const { data, error } = await supabase
    .from('inventory_assets')
    .insert({
      item_id: parsed.itemId,
      asset_tag: parsed.assetTag,
      location_id: parsed.locationId || null,
      purchase_date: parsed.purchaseDate || null,
      purchase_cost: parsed.purchaseCost,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new ApiError('duplicate_tag', 'This asset tag is already in use.');
    throw new ApiError(error.code ?? 'create_failed', error.message);
  }
  return data;
}

export async function updateAssetStatus(assetId: string, status: string, locationId?: string) {
  const { error } = await supabase
    .from('inventory_assets')
    .update({ status, location_id: locationId, updated_at: new Date().toISOString() })
    .eq('id', assetId);
  if (error) throw new ApiError(error.code ?? 'update_failed', error.message);
}

export async function recordStockMovement(recordedByProfileId: string, input: StockMovementInput) {
  const parsed = stockMovementSchema.parse(input);
  const { data, error } = await supabase
    .from('stock_movements')
    .insert({
      item_id: parsed.itemId,
      location_id: parsed.locationId,
      movement_type: parsed.movementType,
      quantity: parsed.quantity,
      reason: parsed.reason || null,
      recorded_by_profile_id: recordedByProfileId,
    })
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'record_failed', error.message);
  return data;
}

export async function createPurchaseOrder(organizationId: string, schoolId: string, createdBy: string, input: PurchaseOrderInput) {
  const parsed = purchaseOrderSchema.parse(input);

  const { data: orderNumber, error: numberError } = await supabase.rpc('generate_po_number', { p_school_id: schoolId });
  if (numberError) throw new ApiError('number_generation_failed', numberError.message);

  const totalAmount = parsed.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      organization_id: organizationId,
      school_id: schoolId,
      supplier_id: parsed.supplierId,
      order_number: orderNumber,
      order_date: parsed.orderDate,
      total_amount: totalAmount,
      created_by_profile_id: createdBy,
    })
    .select()
    .single();
  if (poError) throw new ApiError(poError.code ?? 'create_failed', poError.message);

  const { error: itemsError } = await supabase.from('purchase_order_items').insert(
    parsed.items.map((item) => ({
      purchase_order_id: po.id,
      item_id: item.itemId,
      location_id: item.locationId,
      quantity: item.quantity,
      unit_cost: item.unitCost,
    })),
  );
  if (itemsError) {
    await supabase.from('purchase_orders').delete().eq('id', po.id);
    throw new ApiError('items_failed', itemsError.message);
  }

  return po;
}

export async function markPurchaseOrderOrdered(poId: string) {
  const { error } = await supabase.from('purchase_orders').update({ status: 'ordered', updated_at: new Date().toISOString() }).eq('id', poId);
  if (error) throw new ApiError(error.code ?? 'update_failed', error.message);
}

export async function markPurchaseOrderReceived(poId: string) {
  const { data, error } = await supabase.from('purchase_orders').update({ status: 'received', updated_at: new Date().toISOString() }).eq('id', poId).select().single();
  if (error) throw new ApiError(error.code ?? 'update_failed', error.message);
  return data;
}
