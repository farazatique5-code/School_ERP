// modules/teachers-hr/pages/EmployeeDetailPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { usePermission } from '../../../core/rbac/usePermission';
import {
  useEmployeeDetail,
  useAddTeacherAssignment,
  useRemoveTeacherAssignment,
  useSaveSalaryStructure,
  useGenerateSalarySlip,
  useSalarySlips,
} from '../hooks/useHr';
import { useAcademicYears, useClasses } from '../../academics/hooks/useAcademics';
import {
  teacherAssignmentSchema,
  salaryStructureSchema,
  type TeacherAssignmentInput,
  type SalaryStructureInput,
} from '../schemas/hr.schema';
import { ApiError } from '../../organizations/api/mutations';

const TABS = ['Overview', 'Assignments', 'Leave', 'Payroll', 'Documents'] as const;
type Tab = (typeof TABS)[number];

export function EmployeeDetailPage() {
  return (
    <RequirePermission perm="hr.manage">
      <EmployeeDetailContent />
    </RequirePermission>
  );
}

function EmployeeDetailContent() {
  const { profileId } = useParams<{ profileId: string }>();
  const { data: employee, isLoading } = useEmployeeDetail(profileId);
  const [tab, setTab] = useState<Tab>('Overview');
  const canManagePayroll = usePermission('payroll.manage');

  if (isLoading) return <p>Loading…</p>;
  if (!employee) return <p>Employee not found.</p>;

  const visibleTabs = TABS.filter((t) => t !== 'Payroll' || canManagePayroll);

  return (
    <div className="employee-detail-page">
      <header className="student-detail-header">
        <span className="avatar-placeholder-lg">{employee.profile?.full_name?.[0] ?? '?'}</span>
        <div>
          <h1>{employee.profile?.full_name}</h1>
          <p className="text-secondary mono-text">
            {employee.employee_code} · {employee.designation}
          </p>
        </div>
        <span className={`status-badge ${employee.employment_status === 'active' ? 'status-active' : 'status-inactive'}`}>
          {employee.employment_status}
        </span>
      </header>

      <nav className="tab-bar" aria-label="Employee sections">
        {visibleTabs.map((t) => (
          <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      <div className="tab-panel">
        {tab === 'Overview' && <OverviewTab employee={employee} />}
        {tab === 'Assignments' && <AssignmentsTab employee={employee} />}
        {tab === 'Leave' && <LeaveTab employeeProfileId={employee.profile_id} />}
        {tab === 'Payroll' && canManagePayroll && <PayrollTab employee={employee} />}
        {tab === 'Documents' && <DocumentsTab employee={employee} />}
      </div>
    </div>
  );
}

function OverviewTab({ employee }: { employee: any }) {
  return (
    <div className="card">
      <dl className="detail-grid">
        <dt>Email</dt>
        <dd>{employee.profile?.email}</dd>
        <dt>Department</dt>
        <dd>{employee.department?.name ?? '—'}</dd>
        <dt>Employment type</dt>
        <dd>{employee.employment_type.replace('_', ' ')}</dd>
        <dt>Joining date</dt>
        <dd>{new Date(employee.joining_date).toLocaleDateString()}</dd>
        <dt>Phone</dt>
        <dd>{employee.phone ?? '—'}</dd>
      </dl>

      <h2>Qualifications</h2>
      <ul className="guardian-list">
        {(employee.employee_qualifications ?? []).map((q: any) => (
          <li key={q.id}>
            <strong>{q.degree}</strong> {q.institution ? `· ${q.institution}` : ''} {q.year_completed ? `· ${q.year_completed}` : ''}
          </li>
        ))}
        {(!employee.employee_qualifications || employee.employee_qualifications.length === 0) && (
          <li className="text-secondary">No qualifications recorded yet.</li>
        )}
      </ul>
    </div>
  );
}

function AssignmentsTab({ employee }: { employee: any }) {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];
  const { data: classes } = useClasses(currentYear?.id);
  const [showForm, setShowForm] = useState(false);
  const add = useAddTeacherAssignment(employee.profile_id, currentYear?.id ?? '');
  const remove = useRemoveTeacherAssignment(employee.profile_id);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TeacherAssignmentInput>({
    resolver: zodResolver(teacherAssignmentSchema),
    defaultValues: { isClassTeacher: false },
  });
  const selectedClassId = watch('classId');
  const sections = classes?.find((c: any) => c.id === selectedClassId)?.sections ?? [];

  return (
    <div className="card">
      <div className="page-toolbar">
        <h2>Class & subject assignments</h2>
        {currentYear && (
          <button type="button" onClick={() => setShowForm((s) => !s)}>
            + Add assignment
          </button>
        )}
      </div>
      {!currentYear && <p className="text-secondary">Set up an academic year in Academic Setup first.</p>}

      {showForm && (
        <form
          className="inline-form"
          onSubmit={handleSubmit(async (input) => {
            await add.mutateAsync(input);
            reset();
            setShowForm(false);
          })}
        >
          <div className="form-row">
            <label>
              Class
              <select {...register('classId')}>
                <option value="">Select</option>
                {(classes ?? []).map((k: any) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
              {errors.classId && <span role="alert">{errors.classId.message}</span>}
            </label>
            <label>
              Section
              <select {...register('sectionId')} disabled={!selectedClassId}>
                <option value="">Select</option>
                {sections.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {errors.sectionId && <span role="alert">{errors.sectionId.message}</span>}
            </label>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" {...register('isClassTeacher')} />
            This is a class teacher (homeroom) assignment, not a subject
          </label>
          {add.isError && (
            <p role="alert" className="form-error">
              {add.error instanceof ApiError ? add.error.message : 'Could not save. Please try again.'}
            </p>
          )}
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}

      <ul className="guardian-list" style={{ marginTop: 12 }}>
        {(employee.teacher_assignments ?? []).map((a: any) => (
          <li key={a.id}>
            <strong>{a.class?.name} / {a.section?.name}</strong>
            {a.subject?.name ? ` — ${a.subject.name}` : ''}
            {a.is_class_teacher && <span className="status-badge status-active">Class Teacher</span>}
            <button type="button" className="danger link-button" onClick={() => remove.mutate(a.id)}>
              Remove
            </button>
          </li>
        ))}
        {(!employee.teacher_assignments || employee.teacher_assignments.length === 0) && (
          <li className="text-secondary">No assignments yet.</li>
        )}
      </ul>
    </div>
  );
}

function LeaveTab({ employeeProfileId }: { employeeProfileId: string }) {
  return (
    <div className="card">
      <h2>Leave history</h2>
      <p className="field-hint">
        Full leave application/approval workflow (with balances) is on the Leave Management page — this tab is a
        quick reference for this employee specifically once that page's queries are reused here in a follow-up.
      </p>
      <p className="text-secondary">Employee ID: {employeeProfileId}</p>
    </div>
  );
}

function PayrollTab({ employee }: { employee: any }) {
  const { data: slips } = useSalarySlips(employee.profile_id);
  const saveStructure = useSaveSalaryStructure(employee.profile_id);
  const generateSlip = useGenerateSalarySlip(employee.profile_id);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SalaryStructureInput>({
    resolver: zodResolver(salaryStructureSchema),
    defaultValues: employee.salary_structures
      ? {
          basicSalary: employee.salary_structures.basic_salary,
          housingAllowance: employee.salary_structures.allowances?.housing ?? 0,
          transportAllowance: employee.salary_structures.allowances?.transport ?? 0,
          taxDeduction: employee.salary_structures.deductions?.tax ?? 0,
          currency: employee.salary_structures.currency ?? 'USD',
        }
      : { currency: 'USD' },
  });

  return (
    <div className="card">
      <h2>Salary structure</h2>
      <form onSubmit={handleSubmit((input) => saveStructure.mutate(input))}>
        <div className="form-row">
          <label>
            Basic salary
            <input type="number" step="0.01" {...register('basicSalary')} />
          </label>
          <label>
            Currency
            <input {...register('currency')} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Housing allowance
            <input type="number" step="0.01" {...register('housingAllowance')} />
          </label>
          <label>
            Transport allowance
            <input type="number" step="0.01" {...register('transportAllowance')} />
          </label>
          <label>
            Tax deduction
            <input type="number" step="0.01" {...register('taxDeduction')} />
          </label>
        </div>
        {saveStructure.isError && <p role="alert" className="form-error">Could not save. Please try again.</p>}
        <button type="submit" disabled={isSubmitting}>Save structure</button>
      </form>

      <h2 style={{ marginTop: 20 }}>Salary slips</h2>
      <div className="form-row" style={{ alignItems: 'flex-end' }}>
        <label>
          Month
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Year
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </label>
        <button
          type="button"
          onClick={() => generateSlip.mutate({ month, year })}
          disabled={generateSlip.isPending || !employee.salary_structures}
        >
          {generateSlip.isPending ? 'Generating…' : 'Generate slip'}
        </button>
      </div>
      {!employee.salary_structures && <p className="text-secondary">Save a salary structure above first.</p>}
      {generateSlip.isError && (
        <p role="alert" className="form-error">
          {generateSlip.error instanceof ApiError ? generateSlip.error.message : 'Could not generate. Please try again.'}
        </p>
      )}

      <table className="data-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Period</th>
            <th>Basic</th>
            <th>Allowances</th>
            <th>Deductions</th>
            <th>Net pay</th>
          </tr>
        </thead>
        <tbody>
          {(slips ?? []).map((slip: any) => (
            <tr key={slip.id}>
              <td>{slip.period_month}/{slip.period_year}</td>
              <td>{slip.basic_salary}</td>
              <td>{slip.total_allowances}</td>
              <td>{slip.total_deductions}</td>
              <td><strong>{slip.net_pay}</strong></td>
            </tr>
          ))}
          {slips?.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-state">No slips generated yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsTab({ employee }: { employee: any }) {
  return (
    <div className="card">
      <h2>Documents</h2>
      <ul className="document-list">
        {(employee.employee_documents ?? []).map((doc: any) => (
          <li key={doc.id}>
            {doc.file_name} <span className="text-secondary">({doc.document_type})</span>
          </li>
        ))}
        {(!employee.employee_documents || employee.employee_documents.length === 0) && (
          <li className="text-secondary">No documents uploaded yet.</li>
        )}
      </ul>
    </div>
  );
}
