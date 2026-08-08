// modules/examinations/pages/ExamDetailPage.tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useExamDetail, useAddExamSchedule, useUpdateExamStatus } from '../hooks/useExams';
import { useAcademicYears, useClasses } from '../../academics/hooks/useAcademics';
import { useClassSubjects } from '../../timetable/hooks/useTimetable';
import { examScheduleSchema, type ExamScheduleInput } from '../schemas/exam.schema';
import { ApiError } from '../../organizations/api/mutations';

const NEXT_STATUS: Record<string, { next: string; label: string } | null> = {
  draft: { next: 'scheduled', label: 'Mark as scheduled' },
  scheduled: { next: 'ongoing', label: 'Mark as ongoing' },
  ongoing: { next: 'completed', label: 'Mark as completed' },
  completed: { next: 'published', label: 'Publish results' },
  published: null,
};

export function ExamDetailPage() {
  return (
    <RequirePermission perm="exams.view">
      <ExamDetailContent />
    </RequirePermission>
  );
}

function ExamDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: exam, isLoading } = useExamDetail(id);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const updateStatus = useUpdateExamStatus(id ?? '');

  if (isLoading) return <p>Loading…</p>;
  if (!exam) return <p>Exam not found.</p>;

  const transition = NEXT_STATUS[exam.status];

  return (
    <div className="exam-detail-page">
      <header className="student-detail-header">
        <div>
          <h1>{exam.name}</h1>
          <p className="text-secondary">{exam.exam_type.replace('_', ' ')} · {exam.grading_scale?.name}</p>
        </div>
        <span className="status-badge">{exam.status}</span>
      </header>

      {exam.status === 'published' && (
        <div className="card banner-success">
          Results published — grades and section rankings have been calculated.{' '}
          <Link to={`/exams/${exam.id}/rankings`}>View rankings</Link>. Each student's report card has a real
          "Download PDF" button now (Reports & Analytics).
        </div>
      )}

      <RequirePermission perm="exams.manage" fallback={null}>
        {transition && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (transition.next === 'published' && !confirm('Publish results? This calculates grades and rankings for every student immediately.')) return;
              updateStatus.mutate(transition.next as any);
            }}
            disabled={updateStatus.isPending}
            style={{ marginBottom: 16 }}
          >
            {updateStatus.isPending ? 'Updating…' : transition.label}
          </button>
        )}
      </RequirePermission>

      <div className="card">
        <div className="page-toolbar">
          <h2>Schedule</h2>
          <RequirePermission perm="exams.manage" fallback={null}>
            <button type="button" onClick={() => setShowScheduleForm((s) => !s)}>+ Add class/subject</button>
          </RequirePermission>
        </div>

        {showScheduleForm && <ScheduleForm examId={exam.id} onClose={() => setShowScheduleForm(false)} />}

        <table className="data-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Class</th>
              <th>Subject</th>
              <th>Date</th>
              <th>Time</th>
              <th>Max marks</th>
              <th>Room</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {(exam.exam_schedules ?? []).map((s: any) => (
              <tr key={s.id}>
                <td>{s.class?.name}</td>
                <td>{s.subject?.name}</td>
                <td>{new Date(s.exam_date).toLocaleDateString()}</td>
                <td>{s.start_time}–{s.end_time}</td>
                <td>{s.max_marks} (pass {s.passing_marks})</td>
                <td>{s.room_number ?? '—'}</td>
                <td>
                  <RequirePermission perm="exams.enter_marks" fallback={null}>
                    <Link to={`/exams/marks/${s.id}`}>Enter marks</Link>
                  </RequirePermission>
                </td>
              </tr>
            ))}
            {exam.exam_schedules?.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">No subjects scheduled yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScheduleForm({ examId, onClose }: { examId: string; onClose: () => void }) {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];
  const { data: classes } = useClasses(currentYear?.id);
  const add = useAddExamSchedule(examId);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExamScheduleInput>({ resolver: zodResolver(examScheduleSchema) });

  const classId = watch('classId');
  const { data: subjects } = useClassSubjects(classId || undefined);

  return (
    <form
      className="inline-form"
      onSubmit={handleSubmit(async (input) => {
        await add.mutateAsync(input);
        onClose();
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
          Subject
          <select {...register('subjectId')} disabled={!classId}>
            <option value="">Select</option>
            {(subjects ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {errors.subjectId && <span role="alert">{errors.subjectId.message}</span>}
        </label>
      </div>
      <div className="form-row">
        <label>
          Date
          <input type="date" {...register('examDate')} />
        </label>
        <label>
          Start time
          <input type="time" {...register('startTime')} />
        </label>
        <label>
          End time
          <input type="time" {...register('endTime')} />
        </label>
      </div>
      <div className="form-row">
        <label>
          Max marks
          <input type="number" step="0.01" {...register('maxMarks')} />
          {errors.maxMarks && <span role="alert">{errors.maxMarks.message}</span>}
        </label>
        <label>
          Passing marks
          <input type="number" step="0.01" {...register('passingMarks')} />
        </label>
        <label>
          Room
          <input {...register('roomNumber')} />
        </label>
      </div>

      {add.isError && (
        <p role="alert" className="form-error">
          {add.error instanceof ApiError ? add.error.message : 'Could not save. Please try again.'}
        </p>
      )}

      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Save</button>
      </div>
    </form>
  );
}
