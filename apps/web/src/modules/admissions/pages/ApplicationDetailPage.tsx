// modules/admissions/pages/ApplicationDetailPage.tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import {
  useApplicationDetail,
  useUpdateApplicationStatus,
  useApproveApplication,
  useRejectApplication,
  useScheduleInterview,
} from '../hooks/useAdmissions';
import { interviewSchema, rejectionSchema, type InterviewInput, type RejectionInput } from '../schemas/admission.schema';
import { ApiError } from '../../organizations/api/mutations';

export function ApplicationDetailPage() {
  return (
    <RequirePermission perm="admissions.view">
      <ApplicationDetailContent />
    </RequirePermission>
  );
}

function ApplicationDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: app, isLoading } = useApplicationDetail(id);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  const setUnderReview = useUpdateApplicationStatus(id ?? '');
  const approve = useApproveApplication(id ?? '');
  const reject = useRejectApplication(id ?? '');
  const scheduleInterview = useScheduleInterview(id ?? '');

  if (isLoading) return <p>Loading…</p>;
  if (!app) return <p>Application not found.</p>;

  return (
    <div className="application-detail-page">
      <header className="student-detail-header">
        <div>
          <h1>
            {app.first_name} {app.last_name}
          </h1>
          <p className="text-secondary mono-text">{app.application_number}</p>
        </div>
        <span className="status-badge">{app.status.replace(/_/g, ' ')}</span>
      </header>

      {app.status === 'approved' && app.converted_student && (
        <div className="card banner-success">
          Approved and converted to a student record —{' '}
          <Link to={`/students/${app.converted_student.id}`}>view {app.converted_student.student_code}</Link>.
        </div>
      )}
      {app.status === 'rejected' && app.rejection_reason && (
        <div className="card banner-danger">Rejected: {app.rejection_reason}</div>
      )}

      <div className="card">
        <h2>Application details</h2>
        <dl className="detail-grid">
          <dt>Date of birth</dt>
          <dd>{new Date(app.date_of_birth).toLocaleDateString()}</dd>
          <dt>Gender</dt>
          <dd>{app.gender ?? '—'}</dd>
          <dt>Applying for</dt>
          <dd>{app.applying_for_class?.name}</dd>
          <dt>Academic year</dt>
          <dd>{app.academic_year?.name}</dd>
          <dt>Previous school</dt>
          <dd>{app.previous_school_name ?? '—'}</dd>
          <dt>Guardian</dt>
          <dd>
            {app.guardian_first_name} {app.guardian_last_name} · {app.guardian_phone}
            {app.guardian_email ? ` · ${app.guardian_email}` : ''}
          </dd>
          <dt>Submitted</dt>
          <dd>{new Date(app.submitted_at).toLocaleString()}</dd>
        </dl>
      </div>

      <div className="card">
        <h2>Interviews</h2>
        <ul className="interview-list">
          {(app.admission_interviews ?? []).map((iv: any) => (
            <li key={iv.id}>
              <strong>{new Date(iv.scheduled_at).toLocaleString()}</strong>
              {iv.location ? ` · ${iv.location}` : ''}
              {iv.interviewer?.full_name ? ` · with ${iv.interviewer.full_name}` : ''}
              <span className={`status-badge outcome-${iv.outcome}`}>{iv.outcome}</span>
              {iv.notes && <p className="text-secondary">{iv.notes}</p>}
            </li>
          ))}
          {(!app.admission_interviews || app.admission_interviews.length === 0) && (
            <li className="text-secondary">No interviews scheduled.</li>
          )}
        </ul>

        {app.status !== 'approved' && app.status !== 'rejected' && (
          <RequirePermission perm="admissions.manage" fallback={null}>
            <button type="button" onClick={() => setShowInterviewForm((s) => !s)}>
              + Schedule interview
            </button>
            {showInterviewForm && (
              <InterviewForm
                onSubmit={async (input) => {
                  await scheduleInterview.mutateAsync(input);
                  setShowInterviewForm(false);
                }}
                onClose={() => setShowInterviewForm(false)}
                isSubmitting={scheduleInterview.isPending}
                error={scheduleInterview.error}
              />
            )}
          </RequirePermission>
        )}
      </div>

      {app.status !== 'approved' && app.status !== 'rejected' && app.status !== 'withdrawn' && (
        <div className="card">
          <h2>Decision</h2>
          <div className="decision-actions">
            {app.status === 'submitted' && (
              <RequirePermission perm="admissions.manage" fallback={null}>
                <button type="button" onClick={() => setUnderReview.mutate('under_review')}>
                  Move to review
                </button>
              </RequirePermission>
            )}
            <RequirePermission perm="admissions.approve" fallback={null}>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  if (confirm('Approve this application? This creates a real student record immediately.')) {
                    approve.mutate();
                  }
                }}
                disabled={approve.isPending}
              >
                {approve.isPending ? 'Approving…' : 'Approve'}
              </button>
            </RequirePermission>
            <RequirePermission perm="admissions.approve" fallback={null}>
              <button type="button" className="danger" onClick={() => setShowRejectForm((s) => !s)}>
                Reject
              </button>
            </RequirePermission>
          </div>

          {approve.isError && (
            <p role="alert" className="form-error">
              {approve.error instanceof ApiError ? approve.error.message : 'Could not approve. Please try again.'}
            </p>
          )}

          {showRejectForm && (
            <RejectForm
              onSubmit={async (input) => {
                await reject.mutateAsync(input);
                setShowRejectForm(false);
              }}
              onClose={() => setShowRejectForm(false)}
              isSubmitting={reject.isPending}
              error={reject.error}
            />
          )}
        </div>
      )}
    </div>
  );
}

function InterviewForm({
  onSubmit,
  onClose,
  isSubmitting,
  error,
}: {
  onSubmit: (input: InterviewInput) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
  error: unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InterviewInput>({ resolver: zodResolver(interviewSchema) });

  return (
    <form className="inline-form" onSubmit={handleSubmit(onSubmit)}>
      <label>
        Date & time
        <input type="datetime-local" {...register('scheduledAt')} />
        {errors.scheduledAt && <span role="alert">{errors.scheduledAt.message}</span>}
      </label>
      <label>
        Location
        <input {...register('location')} placeholder="Principal's office / Video call link" />
      </label>
      <label>
        Notes
        <textarea {...register('notes')} rows={2} />
      </label>
      {!!error && <p role="alert" className="form-error">Could not schedule. Please try again.</p>}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Scheduling…' : 'Schedule'}</button>
      </div>
    </form>
  );
}

function RejectForm({
  onSubmit,
  onClose,
  isSubmitting,
  error,
}: {
  onSubmit: (input: RejectionInput) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
  error: unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RejectionInput>({ resolver: zodResolver(rejectionSchema) });

  return (
    <form className="inline-form" onSubmit={handleSubmit(onSubmit)}>
      <label>
        Reason for rejection
        <textarea {...register('rejectionReason')} rows={3} />
        {errors.rejectionReason && <span role="alert">{errors.rejectionReason.message}</span>}
      </label>
      {!!error && <p role="alert" className="form-error">Could not save. Please try again.</p>}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" className="danger" disabled={isSubmitting}>
          {isSubmitting ? 'Rejecting…' : 'Confirm rejection'}
        </button>
      </div>
    </form>
  );
}
