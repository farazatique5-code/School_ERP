// modules/transport/pages/RouteDetailPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { PersonPicker } from '../../../components/ui/PersonPicker';
import { useRouteDetail, useCreateStop, useAllocateStudent, useCancelAllocation } from '../hooks/useTransport';
import { useAcademicYears } from '../../academics/hooks/useAcademics';
import { stopSchema, type StopInput } from '../schemas/transport.schema';
import { ApiError } from '../../organizations/api/mutations';

export function RouteDetailPage() {
  return (
    <RequirePermission perm="transport.view">
      <RouteDetailContent />
    </RequirePermission>
  );
}

function RouteDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: route, isLoading } = useRouteDetail(id);
  const [showStopForm, setShowStopForm] = useState(false);
  const createStop = useCreateStop(id ?? '');

  if (isLoading) return <p>Loading…</p>;
  if (!route) return <p>Not found.</p>;

  return (
    <div className="route-detail-page">
      <h1>{route.name}</h1>
      <p className="text-secondary">Vehicle: {route.vehicle?.registration_number ?? '—'}</p>

      <RequirePermission perm="transport.manage" fallback={null}>
        <button type="button" onClick={() => setShowStopForm((s) => !s)} style={{ marginBottom: 12 }}>+ Add stop</button>
      </RequirePermission>

      {showStopForm && (
        <StopForm
          nextSequence={(route.transport_stops?.length ?? 0)}
          onSubmit={async (input) => { await createStop.mutateAsync(input); setShowStopForm(false); }}
          onClose={() => setShowStopForm(false)}
          error={createStop.error}
        />
      )}

      <div className="stops-list">
        {(route.transport_stops ?? []).map((stop: any) => (
          <StopCard key={stop.id} stop={stop} routeId={route.id} />
        ))}
        {route.transport_stops?.length === 0 && <p className="text-secondary">No stops added yet.</p>}
      </div>
    </div>
  );
}

function StopForm({ nextSequence, onSubmit, onClose, error }: { nextSequence: number; onSubmit: (input: StopInput) => Promise<void>; onClose: () => void; error: unknown }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<StopInput>({
    resolver: zodResolver(stopSchema),
    defaultValues: { sequence: nextSequence },
  });

  return (
    <form className="inline-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-row">
        <label>Stop name<input {...register('name')} />{errors.name && <span role="alert">{errors.name.message}</span>}</label>
        <label>Order<input type="number" {...register('sequence')} /></label>
      </div>
      <div className="form-row">
        <label>Pickup time<input type="time" {...register('pickupTime')} /></label>
        <label>Drop time<input type="time" {...register('dropTime')} /></label>
      </div>
      {!!error && <p role="alert" className="form-error">{error instanceof ApiError ? error.message : 'Could not save.'}</p>}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Save</button>
      </div>
    </form>
  );
}

function StopCard({ stop, routeId }: { stop: any; routeId: string }) {
  const [showAllocate, setShowAllocate] = useState(false);
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];
  const allocate = useAllocateStudent(routeId, currentYear?.id ?? '');
  const cancelAllocation = useCancelAllocation(routeId);
  const [studentId, setStudentId] = useState('');

  const activeAllocations = (stop.student_transport_allocations ?? []).filter((a: any) => a.status === 'active');

  return (
    <div className="card">
      <div className="page-toolbar">
        <h3>{stop.name} <span className="text-secondary">#{stop.sequence}</span></h3>
        <span className="text-secondary">
          {stop.pickup_time ? `Pickup ${stop.pickup_time}` : ''} {stop.drop_time ? `· Drop ${stop.drop_time}` : ''}
        </span>
        <RequirePermission perm="transport.manage" fallback={null}>
          <button type="button" onClick={() => setShowAllocate((s) => !s)}>+ Allocate student</button>
        </RequirePermission>
      </div>

      {showAllocate && (
        <div className="inline-form">
          <label>Student<PersonPicker type="student" value={studentId} onChange={(id) => setStudentId(id)} /></label>
          {allocate.isError && <p role="alert" className="form-error">{allocate.error instanceof ApiError ? allocate.error.message : 'Could not allocate.'}</p>}
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowAllocate(false)}>Cancel</button>
            <button
              type="button"
              onClick={async () => {
                await allocate.mutateAsync({ studentId, stopId: stop.id });
                setStudentId('');
                setShowAllocate(false);
              }}
              disabled={allocate.isPending || !studentId}
            >
              Allocate
            </button>
          </div>
        </div>
      )}

      <ul className="guardian-list" style={{ marginTop: 8 }}>
        {activeAllocations.map((a: any) => (
          <li key={a.id}>
            {a.student?.first_name} {a.student?.last_name}
            <RequirePermission perm="transport.manage" fallback={null}>
              <button type="button" className="link-button" onClick={() => cancelAllocation.mutate(a.id)}>Remove</button>
            </RequirePermission>
          </li>
        ))}
        {activeAllocations.length === 0 && <li className="text-secondary">No students allocated to this stop.</li>}
      </ul>
    </div>
  );
}
