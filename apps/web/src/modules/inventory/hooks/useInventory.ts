// modules/inventory/hooks/useInventory.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { listItems, listLocations, listSuppliers, listAssets, listPurchaseOrders, getPurchaseOrderDetail, getStockMovementHistory } from '../api/queries';
import { createItem, createSupplier, createAsset, updateAssetStatus, recordStockMovement, createPurchaseOrder, markPurchaseOrderOrdered, markPurchaseOrderReceived } from '../api/mutations';
import type { ItemInput, SupplierInput, AssetInput, StockMovementInput, PurchaseOrderInput } from '../schemas/inventory.schema';

export function useItems() {
  const { activeSchoolId } = useAuth();
  return useQuery({ queryKey: ['inventory', 'items', activeSchoolId], enabled: !!activeSchoolId, queryFn: () => listItems(activeSchoolId!) });
}

export function useLocations() {
  const { activeSchoolId } = useAuth();
  return useQuery({ queryKey: ['inventory', 'locations', activeSchoolId], enabled: !!activeSchoolId, queryFn: () => listLocations(activeSchoolId!) });
}

export function useSuppliers() {
  const { activeSchoolId } = useAuth();
  return useQuery({ queryKey: ['inventory', 'suppliers', activeSchoolId], enabled: !!activeSchoolId, queryFn: () => listSuppliers(activeSchoolId!) });
}

export function useAssets(itemId?: string) {
  return useQuery({ queryKey: ['inventory', 'assets', itemId], queryFn: () => listAssets(itemId) });
}

export function usePurchaseOrders() {
  const { activeSchoolId } = useAuth();
  return useQuery({ queryKey: ['inventory', 'pos', activeSchoolId], enabled: !!activeSchoolId, queryFn: () => listPurchaseOrders(activeSchoolId!) });
}

export function usePurchaseOrderDetail(poId: string | undefined) {
  return useQuery({ queryKey: ['inventory', 'poDetail', poId], enabled: !!poId, queryFn: () => getPurchaseOrderDetail(poId!) });
}

export function useStockMovementHistory(itemId: string | undefined) {
  return useQuery({ queryKey: ['inventory', 'movements', itemId], enabled: !!itemId, queryFn: () => getStockMovementHistory(itemId!) });
}

export function useCreateItem() {
  const { activeSchoolId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ItemInput) => createItem(activeSchoolId!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'items'] }),
  });
}

export function useCreateSupplier() {
  const { activeSchoolId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplierInput) => createSupplier(activeSchoolId!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'suppliers'] }),
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssetInput) => createAsset(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'assets'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] });
    },
  });
}

export function useUpdateAssetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, status, locationId }: { assetId: string; status: string; locationId?: string }) =>
      updateAssetStatus(assetId, status, locationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'assets'] }),
  });
}

export function useRecordStockMovement() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StockMovementInput) => recordStockMovement(profile!.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'movements'] });
    },
  });
}

export function useCreatePurchaseOrder() {
  const { organization, activeSchoolId, profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PurchaseOrderInput) => createPurchaseOrder(organization!.id, activeSchoolId!, profile!.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'pos'] }),
  });
}

export function useMarkPurchaseOrderOrdered(poId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markPurchaseOrderOrdered(poId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'poDetail', poId] });
      qc.invalidateQueries({ queryKey: ['inventory', 'pos'] });
    },
  });
}

export function useMarkPurchaseOrderReceived(poId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markPurchaseOrderReceived(poId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'poDetail', poId] });
      qc.invalidateQueries({ queryKey: ['inventory', 'pos'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] });
      qc.invalidateQueries({ queryKey: ['fees', 'ledger'] }); // ledger now has a new expense entry
    },
  });
}
