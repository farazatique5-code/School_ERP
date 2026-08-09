// modules/teachers-hr/pages/LeaveManagementPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePermission } from '../../../core/rbac/usePermission';
import { useLeaveTypes, useLeaveRequests, useMyLeaveRequests, useApplyForLeave, useReviewLeaveRequest } from '../hooks/useHr';
import { leaveRequestSchema, type LeaveRequestInput } from '../schemas/hr.schema';
import { ApiError } from '../../organizations/api/mutations';

export function LeaveManagementPage() {
  const canManageHr = usePermission('hr.manage');
  const [showApplyForm, setShowApplyForm] = useState(false);

  return (
    <div className="leave-page">
      <div className="page-toolbar">
        <h1>Leave</h1>
        <button type="button" onClick={() => setShowApplyForm((s) => !s)}>
          + Apply for leave
        </button>
      </div>

      {showApplyForm && <ApplyLeaveForm onClose={() => setShowApplyForm(false)} />}

      <section className="card">
        <h2>My leave requests</h2>
        <MyLeaveTable />
      </section>

      {canManageHr && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Pending approvals</h2>
          <PendingApprovalsTable />
        </section>
      )}
    </div>
  );
}

function ApplyLeaveForm({ onClose }: { onClose: () => void }) {
  const { data: leaveTypes } = useLeaveTypes();
  const apply = useApplyForLeave();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeaveRequestInput>({ resolver: zodResolver(leaveRequestSchema) });

  return (
    <form
      className="inline-form"
      onSubmit={handleSubmit(async (input) => {
        await apply.mutateAsync(input);
        onClose();
      })}
    >
      <label>
        Leave type
        <select {...register('leaveTypeId')}>
          <option value="">Select</option>
          {(leaveTypes ?? []).map((t: any) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {errors.leaveTypeId && <span role="alert">{errors.leaveTypeId.message}</span>}
      </label>
      <div className="form-row">
        <label>
          Start date
          <input type="date" {...register('startDate')} />
          {errors.startDate && <span role="alert">{errors.startDate.message}</span>}
        </label>
        <label>
          End date
          <input type="date" {...register('endDate')} />
          {errors.endDate && <span role="alert">{errors.endDate.message}</span>}
        </label>
      </div>
      <label>
        Reason
        <textarea {...register('reason')} rows={2} />
      </label>
      {apply.isError && (
        <p role="alert" className="form-error">
          {apply.error instanceof ApiError ? apply.error.message : 'Could not submit. Please try again.'}
        </p>
      )}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Submit</button>
      </div>
    </form>
  );
}

function MyLeaveTable() {
  const { data: requests, isLoading } = useMyLeaveRequests();
  if (isLoading) return <p>Loading…</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>From</th>
          <th>To</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {(requests ?? []).map((r: any) => (
          <tr key={r.id}>
            <td>{r.leave_type?.name}</td>
            <td>{new Date(r.start_date).toLocaleDateString()}</td>
            <td>{new Date(r.end_date).toLocaleDateString()}</td>
            <td><span className="status-badge">{r.status}</span></td>
          </tr>
        ))}
        {requests?.length === 0 && (
          <tr>
            <td colSpan={4} className="empty-state">No leave requests yet.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function PendingApprovalsTable() {
  const { data: requests, isLoading } = useLeaveRequests('pending');
  const review = useReviewLeaveRequest();

  if (isLoading) return <p>Loading…</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Type</th>
          <th>From</th>
          <th>To</th>
          <th>Reason</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {(requests ?? []).map((r: any) => (
          <tr key={r.id}>
            <td>{r.employee?.profile?.full_name}</td>
            <td>{r.leave_type?.name}</td>
            <td>{new Date(r.start_date).toLocaleDateString()}</td>
            <td>{new Date(r.end_date).toLocaleDateString()}</td>
            <td>{r.reason ?? '—'}</td>
            <td className="row-actions">
              <button type="button" onClick={() => review.mutate({ requestId: r.id, decision: 'approved' })}>
                Approve
              </button>
              <button type="button" className="danger" onClick={() => review.mutate({ requestId: r.id, decision: 'rejected' })}>
                Reject
              </button>
            </td>
          </tr>
        ))}
        {requests?.length === 0 && (
          <tr>
            <td colSpan={6} className="empty-state">No pending requests.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
