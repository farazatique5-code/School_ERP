// modules/transport/pages/RoutesPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useRoutes, useCreateRoute, useVehicles } from '../hooks/useTransport';
import { routeSchema, type RouteInput } from '../schemas/transport.schema';
import { ApiError } from '../../organizations/api/mutations';

export function RoutesPage() {
  return (
    <RequirePermission perm="transport.view">
      <RoutesContent />
    </RequirePermission>
  );
}

function RoutesContent() {
  const { data: routes, isLoading } = useRoutes();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="routes-page">
      <div className="page-toolbar">
        <h1>Transport Routes</h1>
        <RequirePermission perm="transport.manage" fallback={null}>
          <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add route</button>
        </RequirePermission>
      </div>

      {showForm && <NewRouteForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Route</th><th>Vehicle</th><th>Stops</th></tr></thead>
          <tbody>
            {(routes ?? []).map((r: any) => (
              <tr key={r.id}>
                <td><Link to={`/transport/routes/${r.id}`}>{r.name}</Link></td>
                <td>{r.vehicle?.registration_number ?? '—'}</td>
                <td>{r.transport_stops?.length ?? 0}</td>
              </tr>
            ))}
            {routes?.length === 0 && <tr><td colSpan={3} className="empty-state">No routes yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewRouteForm({ onClose }: { onClose: () => void }) {
  const { data: vehicles } = useVehicles();
  const create = useCreateRoute();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RouteInput>({ resolver: zodResolver(routeSchema) });

  return (
    <form className="inline-form" onSubmit={handleSubmit(async (input) => { await create.mutateAsync(input); onClose(); })}>
      <label>Name<input {...register('name')} placeholder="North Route" />{errors.name && <span role="alert">{errors.name.message}</span>}</label>
      <label>
        Vehicle
        <select {...register('vehicleId')}>
          <option value="">— None —</option>
          {(vehicles ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
        </select>
      </label>
      <label>Description<input {...register('description')} /></label>
      {create.isError && <p role="alert" className="form-error">{create.error instanceof ApiError ? create.error.message : 'Could not save.'}</p>}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Save</button>
      </div>
    </form>
  );
}
