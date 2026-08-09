// modules/transport/pages/VehiclesPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useVehicles, useCreateVehicle, useVehicleLogs, useAddFuelLog, useAddMaintenanceLog } from '../hooks/useTransport';
import { useEmployeesList } from '../../teachers-hr/hooks/useHr';
import { vehicleSchema, fuelLogSchema, maintenanceLogSchema, type VehicleInput, type FuelLogInput, type MaintenanceLogInput } from '../schemas/transport.schema';
import { ApiError } from '../../organizations/api/mutations';

export function VehiclesPage() {
  return (
    <RequirePermission perm="transport.manage">
      <VehiclesContent />
    </RequirePermission>
  );
}

function VehiclesContent() {
  const { data: vehicles, isLoading } = useVehicles();
  const [showForm, setShowForm] = useState(false);
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);

  return (
    <div className="vehicles-page">
      <div className="page-toolbar">
        <h1>Vehicles</h1>
        <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add vehicle</button>
      </div>

      {showForm && <NewVehicleForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Registration</th><th>Type</th><th>Capacity</th><th>Driver</th><th>GPS device</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {(vehicles ?? []).map((v: any) => (
              <>
                <tr key={v.id}>
                  <td className="mono-text">{v.registration_number}</td>
                  <td>{v.vehicle_type}</td>
                  <td>{v.capacity}</td>
                  <td>{v.driver?.profile?.full_name ?? '—'}</td>
                  <td>{v.gps_device_id ?? '—'}</td>
                  <td>
                    <button type="button" onClick={() => setExpandedVehicleId(expandedVehicleId === v.id ? null : v.id)}>
                      {expandedVehicleId === v.id ? 'Hide logs' : 'Fuel & maintenance'}
                    </button>
                  </td>
                </tr>
                {expandedVehicleId === v.id && (
                  <tr>
                    <td colSpan={6}>
                      <VehicleLogsPanel vehicleId={v.id} />
                    </td>
                  </tr>
                )}
              </>
            ))}
            {vehicles?.length === 0 && <tr><td colSpan={6} className="empty-state">No vehicles yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewVehicleForm({ onClose }: { onClose: () => void }) {
  const { data: employees } = useEmployeesList();
  const create = useCreateVehicle();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<VehicleInput>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { vehicleType: 'bus' },
  });

  return (
    <form className="inline-form" onSubmit={handleSubmit(async (input) => { await create.mutateAsync(input); onClose(); })}>
      <div className="form-row">
        <label>Registration number<input {...register('registrationNumber')} />{errors.registrationNumber && <span role="alert">{errors.registrationNumber.message}</span>}</label>
        <label>
          Type
          <select {...register('vehicleType')}>
            <option value="bus">Bus</option>
            <option value="van">Van</option>
            <option value="car">Car</option>
          </select>
        </label>
        <label>Capacity<input type="number" {...register('capacity')} />{errors.capacity && <span role="alert">{errors.capacity.message}</span>}</label>
      </div>
      <div className="form-row">
        <label>
          Driver
          <select {...register('driverProfileId')}>
            <option value="">— None —</option>
            {(employees ?? []).map((e: any) => <option key={e.profile_id} value={e.profile_id}>{e.profile?.full_name}</option>)}
          </select>
        </label>
        <label>GPS device ID<input {...register('gpsDeviceId')} placeholder="Optional — for GPS provider integration" /></label>
      </div>
      {create.isError && <p role="alert" className="form-error">{create.error instanceof ApiError ? create.error.message : 'Could not save.'}</p>}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Save</button>
      </div>
    </form>
  );
}

function VehicleLogsPanel({ vehicleId }: { vehicleId: string }) {
  const { data: logs, isLoading } = useVehicleLogs(vehicleId);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const addFuel = useAddFuelLog(vehicleId);
  const addMaintenance = useAddMaintenanceLog(vehicleId);

  const fuelForm = useForm<FuelLogInput>({ resolver: zodResolver(fuelLogSchema), defaultValues: { fillDate: new Date().toISOString().slice(0, 10) } });
  const maintenanceForm = useForm<MaintenanceLogInput>({ resolver: zodResolver(maintenanceLogSchema), defaultValues: { maintenanceDate: new Date().toISOString().slice(0, 10) } });

  return (
    <div className="vehicle-logs-panel">
      <div className="circulation-grid">
        <div className="card">
          <div className="page-toolbar">
            <h3>Fuel logs</h3>
            <button type="button" onClick={() => setShowFuelForm((s) => !s)}>+ Add</button>
          </div>
          {showFuelForm && (
            <form
              className="inline-form"
              onSubmit={fuelForm.handleSubmit(async (input) => { await addFuel.mutateAsync(input); fuelForm.reset(); setShowFuelForm(false); })}
            >
              <div className="form-row">
                <label>Date<input type="date" {...fuelForm.register('fillDate')} /></label>
                <label>Liters<input type="number" step="0.01" {...fuelForm.register('liters')} /></label>
                <label>Cost<input type="number" step="0.01" {...fuelForm.register('cost')} /></label>
              </div>
              <label>Odometer<input type="number" {...fuelForm.register('odometerReading')} /></label>
              <div className="drawer-actions">
                <button type="button" onClick={() => setShowFuelForm(false)}>Cancel</button>
                <button type="submit">Save</button>
              </div>
            </form>
          )}
          {!isLoading && (
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead><tr><th>Date</th><th>Liters</th><th>Cost</th></tr></thead>
              <tbody>
                {(logs?.fuelLogs ?? []).map((l: any) => (
                  <tr key={l.id}><td>{new Date(l.fill_date).toLocaleDateString()}</td><td>{l.liters}</td><td>{l.cost}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="page-toolbar">
            <h3>Maintenance logs</h3>
            <button type="button" onClick={() => setShowMaintenanceForm((s) => !s)}>+ Add</button>
          </div>
          {showMaintenanceForm && (
            <form
              className="inline-form"
              onSubmit={maintenanceForm.handleSubmit(async (input) => { await addMaintenance.mutateAsync(input); maintenanceForm.reset(); setShowMaintenanceForm(false); })}
            >
              <label>Description<input {...maintenanceForm.register('description')} /></label>
              <div className="form-row">
                <label>Date<input type="date" {...maintenanceForm.register('maintenanceDate')} /></label>
                <label>Cost<input type="number" step="0.01" {...maintenanceForm.register('cost')} /></label>
                <label>Next due<input type="date" {...maintenanceForm.register('nextDueDate')} /></label>
              </div>
              <div className="drawer-actions">
                <button type="button" onClick={() => setShowMaintenanceForm(false)}>Cancel</button>
                <button type="submit">Save</button>
              </div>
            </form>
          )}
          {!isLoading && (
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead><tr><th>Date</th><th>Description</th><th>Cost</th></tr></thead>
              <tbody>
                {(logs?.maintenanceLogs ?? []).map((l: any) => (
                  <tr key={l.id}><td>{new Date(l.maintenance_date).toLocaleDateString()}</td><td>{l.description}</td><td>{l.cost}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <p className="field-hint">Every fuel/maintenance entry posts a real expense to Financial Reports automatically.</p>
    </div>
  );
}
