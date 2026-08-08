// modules/hostel/pages/BuildingDetailPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { PersonPicker } from '../../../components/ui/PersonPicker';
import { useBuildingDetail, useCreateRoom, useAllocateBed, useVacateBed } from '../hooks/useHostel';
import { useAcademicYears } from '../../academics/hooks/useAcademics';
import { roomSchema, type RoomInput } from '../schemas/hostel.schema';
import { ApiError } from '../../organizations/api/mutations';

export function BuildingDetailPage() {
  return (
    <RequirePermission perm="hostel.view">
      <BuildingDetailContent />
    </RequirePermission>
  );
}

function BuildingDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: building, isLoading } = useBuildingDetail(id);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const createRoom = useCreateRoom(id ?? '');

  if (isLoading) return <p>Loading…</p>;
  if (!building) return <p>Not found.</p>;

  return (
    <div className="building-detail-page">
      <h1>{building.name}</h1>

      <RequirePermission perm="hostel.manage" fallback={null}>
        <button type="button" onClick={() => setShowRoomForm((s) => !s)} style={{ marginBottom: 12 }}>+ Add room</button>
      </RequirePermission>

      {showRoomForm && (
        <RoomForm
          onSubmit={async (input) => {
            await createRoom.mutateAsync(input);
            setShowRoomForm(false);
          }}
          onClose={() => setShowRoomForm(false)}
          error={createRoom.error}
        />
      )}

      <div className="room-grid">
        {(building.hostel_rooms ?? []).map((room: any) => (
          <RoomCard key={room.id} room={room} />
        ))}
        {building.hostel_rooms?.length === 0 && <p className="text-secondary">No rooms yet.</p>}
      </div>
    </div>
  );
}

function RoomForm({ onSubmit, onClose, error }: { onSubmit: (input: RoomInput) => Promise<void>; onClose: () => void; error: unknown }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RoomInput>({
    resolver: zodResolver(roomSchema),
    defaultValues: { roomType: 'dormitory', bedCount: 4 },
  });

  return (
    <form className="inline-form" onSubmit={handleSubmit(onSubmit)}>
      <div className="form-row">
        <label>Room number<input {...register('roomNumber')} />{errors.roomNumber && <span role="alert">{errors.roomNumber.message}</span>}</label>
        <label>
          Type
          <select {...register('roomType')}>
            <option value="single">Single</option>
            <option value="double">Double</option>
            <option value="dormitory">Dormitory</option>
          </select>
        </label>
        <label>Number of beds<input type="number" {...register('bedCount')} /></label>
      </div>
      {!!error && <p role="alert" className="form-error">{error instanceof ApiError ? error.message : 'Could not save.'}</p>}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Save</button>
      </div>
    </form>
  );
}

function RoomCard({ room }: { room: any }) {
  const [allocatingBedId, setAllocatingBedId] = useState<string | null>(null);
  const vacate = useVacateBed();

  return (
    <div className="card room-card">
      <h3>Room {room.room_number} <span className="text-secondary">({room.room_type})</span></h3>
      <ul className="bed-list">
        {(room.hostel_beds ?? []).map((bed: any) => {
          const activeAllocation = bed.hostel_allocations?.find((a: any) => a.status === 'active');
          return (
            <li key={bed.id} className={`bed-chip bed-${bed.status}`}>
              <span>Bed {bed.bed_number}</span>
              {activeAllocation ? (
                <>
                  <span className="text-secondary">{activeAllocation.student?.first_name} {activeAllocation.student?.last_name}</span>
                  <RequirePermission perm="hostel.manage" fallback={null}>
                    <button type="button" className="link-button" onClick={() => vacate.mutate(activeAllocation.id)}>Vacate</button>
                  </RequirePermission>
                </>
              ) : bed.status === 'vacant' ? (
                <RequirePermission perm="hostel.manage" fallback={null}>
                  <button type="button" className="link-button" onClick={() => setAllocatingBedId(bed.id)}>Allocate</button>
                </RequirePermission>
              ) : (
                <span className="text-secondary">{bed.status}</span>
              )}
            </li>
          );
        })}
      </ul>
      {allocatingBedId && <AllocateBedDrawer bedId={allocatingBedId} onClose={() => setAllocatingBedId(null)} />}
    </div>
  );
}

function AllocateBedDrawer({ bedId, onClose }: { bedId: string; onClose: () => void }) {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];
  const allocate = useAllocateBed();
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAllocate = async () => {
    if (!studentId || !currentYear) return;
    try {
      await allocate.mutateAsync({ bedId, studentId, academicYearId: currentYear.id });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not allocate this bed.');
    }
  };

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <div className="drawer">
        <h2>Allocate bed</h2>
        <label>
          Student
          <PersonPicker type="student" value={studentId} onChange={(id) => setStudentId(id)} />
        </label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="drawer-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={handleAllocate} disabled={allocate.isPending || !studentId}>
            {allocate.isPending ? 'Allocating…' : 'Allocate'}
          </button>
        </div>
      </div>
    </div>
  );
}
