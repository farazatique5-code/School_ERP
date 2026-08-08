// modules/inventory/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export async function listItems(schoolId: string) {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*, category:inventory_categories(name), inventory_stock(quantity), inventory_assets(id, status)')
    .eq('school_id', schoolId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((item: any) => ({
    ...item,
    totalStock: (item.inventory_stock ?? []).reduce((sum: number, s: any) => sum + s.quantity, 0),
    assetCount: item.inventory_assets?.length ?? 0,
    isLowStock:
      item.reorder_level != null &&
      !item.is_asset_tracked &&
      (item.inventory_stock ?? []).reduce((sum: number, s: any) => sum + s.quantity, 0) <= item.reorder_level,
  }));
}

export async function listLocations(schoolId: string) {
  const { data, error } = await supabase.from('inventory_locations').select('*').eq('school_id', schoolId).order('name');
  if (error) throw error;
  return data;
}

export async function listSuppliers(schoolId: string) {
  const { data, error } = await supabase.from('suppliers').select('*').eq('school_id', schoolId).order('name');
  if (error) throw error;
  return data;
}

export async function listAssets(itemId?: string) {
  let query = supabase.from('inventory_assets').select('*, item:inventory_items(name), location:inventory_locations(name), assigned_to:profiles(full_name)');
  if (itemId) query = query.eq('item_id', itemId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listPurchaseOrders(schoolId: string) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, supplier:suppliers(name)')
    .eq('school_id', schoolId)
    .order('order_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPurchaseOrderDetail(poId: string) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, supplier:suppliers(name), purchase_order_items(*, item:inventory_items(name, is_asset_tracked), location:inventory_locations(name))')
    .eq('id', poId)
    .single();
  if (error) throw error;
  return data;
}

export async function getStockMovementHistory(itemId: string) {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, location:inventory_locations(name), recorded_by:profiles(full_name)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
