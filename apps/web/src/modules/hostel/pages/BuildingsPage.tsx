// modules/hostel/pages/BuildingsPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useBuildings, useCreateBuilding } from '../hooks/useHostel';
import { useEmployeesList } from '../../teachers-hr/hooks/useHr';
import { buildingSchema, type BuildingInput } from '../schemas/hostel.schema';
import { ApiError } from '../../organizations/api/mutations';

export function BuildingsPage() {
  return (
    <RequirePermission perm="hostel.view">
      <BuildingsContent />
    </RequirePermission>
  );
}

function BuildingsContent() {
  const { data: buildings, isLoading } = useBuildings();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="buildings-page">
      <div className="page-toolbar">
        <h1>Hostel Buildings</h1>
        <RequirePermission perm="hostel.manage" fallback={null}>
          <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add building</button>
        </RequirePermission>
      </div>

      {showForm && <NewBuildingForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <div className="kpi-grid">
          {(buildings ?? []).map((b: any) => (
            <Link to={`/hostel/buildings/${b.id}`} key={b.id} className="card kpi-card building-card">
              <span className="kpi-label">{b.name}</span>
              <span className="kpi-value">{b.occupiedBeds} / {b.totalBeds}</span>
              <span className="text-secondary">beds occupied {b.warden?.profile?.full_name ? `· Warden: ${b.warden.profile.full_name}` : ''}</span>
            </Link>
          ))}
          {buildings?.length === 0 && <p className="text-secondary">No hostel buildings yet.</p>}
        </div>
      )}
    </div>
  );
}

function NewBuildingForm({ onClose }: { onClose: () => void }) {
  const { data: employees } = useEmployeesList();
  const create = useCreateBuilding();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<BuildingInput>({ resolver: zodResolver(buildingSchema) });

  return (
    <form className="inline-form" onSubmit={handleSubmit(async (input) => { await create.mutateAsync(input); onClose(); })}>
      <label>Name<input {...register('name')} placeholder="Boys Hostel Block A" />{errors.name && <span role="alert">{errors.name.message}</span>}</label>
      <label>
        Warden
        <select {...register('wardenProfileId')}>
          <option value="">— None —</option>
          {(employees ?? []).map((e: any) => <option key={e.profile_id} value={e.profile_id}>{e.profile?.full_name}</option>)}
        </select>
      </label>
      {create.isError && <p role="alert" className="form-error">{create.error instanceof ApiError ? create.error.message : 'Could not save.'}</p>}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Save</button>
      </div>
    </form>
  );
}
