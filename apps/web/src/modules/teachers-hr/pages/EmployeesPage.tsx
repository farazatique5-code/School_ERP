// modules/teachers-hr/pages/EmployeesPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useEmployeesList, useInviteEmployee } from '../hooks/useHr';
import { inviteEmployeeSchema, type InviteEmployeeInput } from '../schemas/hr.schema';
import { ApiError } from '../../organizations/api/mutations';

export function EmployeesPage() {
  return (
    <RequirePermission perm="hr.manage">
      <EmployeesPageContent />
    </RequirePermission>
  );
}

function EmployeesPageContent() {
  const { data: employees, isLoading } = useEmployeesList();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="employees-page">
      <div className="page-toolbar">
        <h1>Teachers & Staff</h1>
        <button type="button" onClick={() => setDrawerOpen(true)}>
          + Invite employee
        </button>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee code</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Department</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(employees ?? []).map((emp: any) => (
              <tr key={emp.profile_id}>
                <td className="mono-text">{emp.employee_code}</td>
                <td>
                  <Link to={`/hr/employees/${emp.profile_id}`}>{emp.profile?.full_name}</Link>
                </td>
                <td>{emp.designation}</td>
                <td>{emp.department?.name ?? '—'}</td>
                <td>{emp.employment_type.replace('_', ' ')}</td>
                <td>
                  <span className={`status-badge ${emp.employment_status === 'active' ? 'status-active' : 'status-inactive'}`}>
                    {emp.employment_status}
                  </span>
                </td>
              </tr>
            ))}
            {employees?.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">No employees yet — invite your first staff member.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {drawerOpen && <InviteEmployeeDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}

function InviteEmployeeDrawer({ onClose }: { onClose: () => void }) {
  const invite = useInviteEmployee();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InviteEmployeeInput>({
    resolver: zodResolver(inviteEmployeeSchema),
    defaultValues: { employmentType: 'full_time', joiningDate: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = async (input: InviteEmployeeInput) => {
    try {
      await invite.mutateAsync(input);
      onClose();
    } catch {
      // surfaced below
    }
  };

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-label="Invite employee">
      <div className="drawer">
        <h2>Invite employee</h2>
        <p className="field-hint">They'll receive an email invite to set their password and sign in.</p>
        <form onSubmit={handleSubmit(onSubmit)}>
          <label>
            Full name
            <input {...register('fullName')} />
            {errors.fullName && <span role="alert">{errors.fullName.message}</span>}
          </label>
          <label>
            Email
            <input type="email" {...register('email')} />
            {errors.email && <span role="alert">{errors.email.message}</span>}
          </label>
          <label>
            Designation
            <input {...register('designation')} placeholder="Mathematics Teacher" />
            {errors.designation && <span role="alert">{errors.designation.message}</span>}
          </label>
          <div className="form-row">
            <label>
              Employment type
              <select {...register('employmentType')}>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
                <option value="substitute">Substitute</option>
              </select>
            </label>
            <label>
              Joining date
              <input type="date" {...register('joiningDate')} />
            </label>
          </div>

          {invite.isError && (
            <p role="alert" className="form-error">
              {invite.error instanceof ApiError ? invite.error.message : 'Could not send invite. Please try again.'}
            </p>
          )}

          <div className="drawer-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending invite…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
