// modules/inventory/pages/PurchaseOrdersPage.tsx
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { usePurchaseOrders, useCreatePurchaseOrder, useSuppliers, useItems, useLocations } from '../hooks/useInventory';
import { purchaseOrderSchema, type PurchaseOrderInput } from '../schemas/inventory.schema';
import { ApiError } from '../../organizations/api/mutations';

export function PurchaseOrdersPage() {
  return (
    <RequirePermission perm="inventory.manage">
      <PurchaseOrdersContent />
    </RequirePermission>
  );
}

function PurchaseOrdersContent() {
  const { data: pos, isLoading } = usePurchaseOrders();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="purchase-orders-page">
      <div className="page-toolbar">
        <h1>Purchase Orders</h1>
        <button type="button" onClick={() => setShowForm((s) => !s)}>+ New order</button>
      </div>

      {showForm && <NewPOForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Order #</th><th>Supplier</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {(pos ?? []).map((po: any) => (
              <tr key={po.id}>
                <td className="mono-text"><Link to={`/inventory/purchase-orders/${po.id}`}>{po.order_number}</Link></td>
                <td>{po.supplier?.name}</td>
                <td>{new Date(po.order_date).toLocaleDateString()}</td>
                <td>{po.total_amount}</td>
                <td><span className="status-badge">{po.status}</span></td>
              </tr>
            ))}
            {pos?.length === 0 && <tr><td colSpan={5} className="empty-state">No purchase orders yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewPOForm({ onClose }: { onClose: () => void }) {
  const { data: suppliers } = useSuppliers();
  const { data: items } = useItems();
  const { data: locations } = useLocations();
  const create = useCreatePurchaseOrder();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseOrderInput>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: { orderDate: new Date().toISOString().slice(0, 10), items: [{ itemId: '', locationId: '', quantity: 1, unitCost: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <form
      className="inline-form"
      onSubmit={handleSubmit(async (input) => {
        await create.mutateAsync(input);
        onClose();
      })}
    >
      <div className="form-row">
        <label>
          Supplier
          <select {...register('supplierId')}>
            <option value="">Select</option>
            {(suppliers ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {errors.supplierId && <span role="alert">{errors.supplierId.message}</span>}
        </label>
        <label>Order date<input type="date" {...register('orderDate')} /></label>
      </div>

      <h3>Line items</h3>
      {fields.map((field, index) => (
        <div className="form-row" key={field.id}>
          <label>
            Item
            <select {...register(`items.${index}.itemId`)}>
              <option value="">Select</option>
              {(items ?? []).map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <label>
            Location
            <select {...register(`items.${index}.locationId`)}>
              <option value="">Select</option>
              {(locations ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label>Qty<input type="number" {...register(`items.${index}.quantity`)} /></label>
          <label>Unit cost<input type="number" step="0.01" {...register(`items.${index}.unitCost`)} /></label>
          <button type="button" onClick={() => remove(index)} disabled={fields.length === 1}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append({ itemId: '', locationId: '', quantity: 1, unitCost: 0 })}>+ Add line item</button>

      {create.isError && (
        <p role="alert" className="form-error">
          {create.error instanceof ApiError ? create.error.message : 'Could not create order. Please try again.'}
        </p>
      )}

      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Create order</button>
      </div>
    </form>
  );
}
