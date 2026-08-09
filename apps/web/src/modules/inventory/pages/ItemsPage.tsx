// modules/inventory/pages/ItemsPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useItems, useLocations, useCreateItem, useRecordStockMovement } from '../hooks/useInventory';
import { itemSchema, stockMovementSchema, type ItemInput, type StockMovementInput } from '../schemas/inventory.schema';
import { ApiError } from '../../organizations/api/mutations';

export function ItemsPage() {
  return (
    <RequirePermission perm="inventory.view">
      <ItemsContent />
    </RequirePermission>
  );
}

function ItemsContent() {
  const { data: items, isLoading } = useItems();
  const [showForm, setShowForm] = useState(false);
  const [movementItemId, setMovementItemId] = useState<string | null>(null);

  return (
    <div className="items-page">
      <div className="page-toolbar">
        <h1>Inventory Items</h1>
        <RequirePermission perm="inventory.manage" fallback={null}>
          <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add item</button>
        </RequirePermission>
      </div>

      {showForm && <NewItemForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Category</th><th>Type</th><th>Quantity / Units</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {(items ?? []).map((item: any) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.category?.name ?? '—'}</td>
                <td>{item.is_asset_tracked ? 'Asset' : 'Stock'}</td>
                <td>
                  {item.is_asset_tracked ? (
                    `${item.assetCount} units`
                  ) : (
                    <span className={`status-badge ${item.isLowStock ? 'status-inactive' : 'status-active'}`}>
                      {item.totalStock} {item.unit_of_measure}
                      {item.isLowStock ? ' — low stock' : ''}
                    </span>
                  )}
                </td>
                <td>
                  {!item.is_asset_tracked && (
                    <RequirePermission perm="inventory.manage" fallback={null}>
                      <button type="button" onClick={() => setMovementItemId(item.id)}>Adjust stock</button>
                    </RequirePermission>
                  )}
                </td>
              </tr>
            ))}
            {items?.length === 0 && <tr><td colSpan={5} className="empty-state">No items yet.</td></tr>}
          </tbody>
        </table>
      )}

      {movementItemId && <StockMovementForm itemId={movementItemId} onClose={() => setMovementItemId(null)} />}
    </div>
  );
}

function NewItemForm({ onClose }: { onClose: () => void }) {
  const create = useCreateItem();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: { unitOfMeasure: 'unit', isAssetTracked: false },
  });

  return (
    <form className="inline-form" onSubmit={handleSubmit(async (input) => { await create.mutateAsync(input); onClose(); })}>
      <label>Name<input {...register('name')} />{errors.name && <span role="alert">{errors.name.message}</span>}</label>
      <div className="form-row">
        <label>SKU<input {...register('sku')} /></label>
        <label>Unit of measure<input {...register('unitOfMeasure')} /></label>
        <label>Reorder level<input type="number" {...register('reorderLevel')} /></label>
      </div>
      <label className="checkbox-label">
        <input type="checkbox" {...register('isAssetTracked')} />
        Track as individually numbered assets (furniture, equipment) instead of bulk quantity
      </label>
      {create.isError && <p role="alert" className="form-error">{create.error instanceof ApiError ? create.error.message : 'Could not save.'}</p>}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Save</button>
      </div>
    </form>
  );
}

function StockMovementForm({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { data: locations } = useLocations();
  const record = useRecordStockMovement();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<StockMovementInput>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: { itemId, movementType: 'adjustment' },
  });

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <div className="drawer">
        <h2>Adjust stock</h2>
        <form onSubmit={handleSubmit(async (input) => { await record.mutateAsync(input); onClose(); })}>
          <input type="hidden" {...register('itemId')} value={itemId} />
          <label>
            Location
            <select {...register('locationId')}>
              <option value="">Select</option>
              {(locations ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            {errors.locationId && <span role="alert">{errors.locationId.message}</span>}
          </label>
          <div className="form-row">
            <label>
              Type
              <select {...register('movementType')}>
                <option value="in">Stock in</option>
                <option value="out">Stock out</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </label>
            <label>Quantity<input type="number" {...register('quantity')} /></label>
          </div>
          <label>Reason<input {...register('reason')} /></label>
          {record.isError && <p role="alert" className="form-error">Could not save. Please try again.</p>}
          <div className="drawer-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
