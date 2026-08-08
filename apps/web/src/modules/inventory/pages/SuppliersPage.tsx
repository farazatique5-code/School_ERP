// modules/inventory/pages/SuppliersPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useSuppliers, useCreateSupplier } from '../hooks/useInventory';
import { supplierSchema, type SupplierInput } from '../schemas/inventory.schema';
import { ApiError } from '../../organizations/api/mutations';

export function SuppliersPage() {
  return (
    <RequirePermission perm="inventory.manage">
      <SuppliersContent />
    </RequirePermission>
  );
}

function SuppliersContent() {
  const { data: suppliers, isLoading } = useSuppliers();
  const [showForm, setShowForm] = useState(false);
  const create = useCreateSupplier();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SupplierInput>({ resolver: zodResolver(supplierSchema) });

  return (
    <div className="suppliers-page">
      <div className="page-toolbar">
        <h1>Suppliers</h1>
        <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add supplier</button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={handleSubmit(async (input) => { await create.mutateAsync(input); reset(); setShowForm(false); })}>
          <label>Name<input {...register('name')} />{errors.name && <span role="alert">{errors.name.message}</span>}</label>
          <div className="form-row">
            <label>Contact person<input {...register('contactPerson')} /></label>
            <label>Phone<input {...register('phone')} /></label>
            <label>Email<input type="email" {...register('email')} /></label>
          </div>
          <label>Address<input {...register('address')} /></label>
          {create.isError && <p role="alert" className="form-error">{create.error instanceof ApiError ? create.error.message : 'Could not save.'}</p>}
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th></tr></thead>
          <tbody>
            {(suppliers ?? []).map((s: any) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.contact_person ?? '—'}</td><td>{s.phone ?? '—'}</td><td>{s.email ?? '—'}</td>
              </tr>
            ))}
            {suppliers?.length === 0 && <tr><td colSpan={4} className="empty-state">No suppliers yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
