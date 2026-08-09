// modules/timetable/pages/PeriodsSetupPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { usePeriods, useCreatePeriod } from '../hooks/useTimetable';
import { periodSchema, type PeriodInput } from '../schemas/timetable.schema';

export function PeriodsSetupPage() {
  return (
    <RequirePermission perm="timetable.manage">
      <PeriodsSetupContent />
    </RequirePermission>
  );
}

function PeriodsSetupContent() {
  const { data: periods, isLoading } = usePeriods();
  const [showForm, setShowForm] = useState(false);
  const create = useCreatePeriod();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PeriodInput>({
    resolver: zodResolver(periodSchema),
    defaultValues: { sequence: (periods?.length ?? 0) + 1, isBreak: false },
  });

  return (
    <div className="periods-setup-page">
      <div className="page-toolbar">
        <h1>Periods</h1>
        <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add period</button>
      </div>
      <p className="field-hint">
        Defines your school's daily period structure — every section's timetable fills in these same slots.
      </p>

      {showForm && (
        <form
          className="inline-form"
          onSubmit={handleSubmit(async (input) => {
            await create.mutateAsync(input);
            reset();
            setShowForm(false);
          })}
        >
          <div className="form-row">
            <label>
              Name
              <input {...register('name')} placeholder="Period 1" />
              {errors.name && <span role="alert">{errors.name.message}</span>}
            </label>
            <label>
              Order
              <input type="number" {...register('sequence')} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Start time
              <input type="time" {...register('startTime')} />
              {errors.startTime && <span role="alert">{errors.startTime.message}</span>}
            </label>
            <label>
              End time
              <input type="time" {...register('endTime')} />
              {errors.endTime && <span role="alert">{errors.endTime.message}</span>}
            </label>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" {...register('isBreak')} />
            This is a break/lunch slot, not a teaching period
          </label>
          {create.isError && <p role="alert" className="form-error">Could not save. Please try again.</p>}
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Start</th>
              <th>End</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {(periods ?? []).map((p: any) => (
              <tr key={p.id}>
                <td>{p.sequence}</td>
                <td>{p.name}</td>
                <td>{p.start_time}</td>
                <td>{p.end_time}</td>
                <td>{p.is_break ? 'Break' : 'Teaching'}</td>
              </tr>
            ))}
            {periods?.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">No periods set up yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
