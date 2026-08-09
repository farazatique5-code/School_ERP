// modules/hostel/pages/VisitorsPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { PersonPicker } from '../../../components/ui/PersonPicker';
import { useVisitors, useLogVisitor, useCheckOutVisitor } from '../hooks/useHostel';
import { visitorSchema, type VisitorInput } from '../schemas/hostel.schema';
import { ApiError } from '../../organizations/api/mutations';

export function VisitorsPage() {
  return (
    <RequirePermission perm="hostel.manage">
      <VisitorsContent />
    </RequirePermission>
  );
}

function VisitorsContent() {
  const { data: visitors, isLoading } = useVisitors();
  const [showForm, setShowForm] = useState(false);
  const checkOut = useCheckOutVisitor();

  return (
    <div className="visitors-page">
      <div className="page-toolbar">
        <h1>Hostel Visitors</h1>
        <button type="button" onClick={() => setShowForm((s) => !s)}>+ Log visitor</button>
      </div>

      {showForm && <LogVisitorForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Student</th><th>Visitor</th><th>Relationship</th><th>Check-in</th><th>Check-out</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {(visitors ?? []).map((v: any) => (
              <tr key={v.id}>
                <td>{v.student?.first_name} {v.student?.last_name}</td>
                <td>{v.visitor_name}</td>
                <td>{v.relationship ?? '—'}</td>
                <td>{v.check_in_time}</td>
                <td>{v.check_out_time ?? '—'}</td>
                <td>
                  {!v.check_out_time && (
                    <button type="button" onClick={() => checkOut.mutate(v.id)} disabled={checkOut.isPending}>Check out</button>
                  )}
                </td>
              </tr>
            ))}
            {visitors?.length === 0 && <tr><td colSpan={6} className="empty-state">No visitors logged yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LogVisitorForm({ onClose }: { onClose: () => void }) {
  const log = useLogVisitor();
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<VisitorInput>({ resolver: zodResolver(visitorSchema) });
  const studentId = watch('studentId');

  return (
    <form className="inline-form" onSubmit={handleSubmit(async (input) => { await log.mutateAsync(input); onClose(); })}>
      <label>
        Student
        <PersonPicker type="student" value={studentId} onChange={(id) => setValue('studentId', id, { shouldValidate: true })} />
        {errors.studentId && <span role="alert">{errors.studentId.message}</span>}
      </label>
      <div className="form-row">
        <label>Visitor name<input {...register('visitorName')} />{errors.visitorName && <span role="alert">{errors.visitorName.message}</span>}</label>
        <label>Relationship<input {...register('relationship')} /></label>
      </div>
      <label>Purpose<input {...register('purpose')} /></label>
      {log.isError && <p role="alert" className="form-error">{log.error instanceof ApiError ? log.error.message : 'Could not save.'}</p>}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Log visitor</button>
      </div>
    </form>
  );
}
