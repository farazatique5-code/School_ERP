// modules/examinations/pages/ExamsListPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { supabase } from '../../../core/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useAuth } from '../../../core/auth/AuthContext';
import { useAcademicYears } from '../../academics/hooks/useAcademics';
import { useExamsList, useCreateExam } from '../hooks/useExams';
import { examSchema, type ExamInput } from '../schemas/exam.schema';
import { ApiError } from '../../organizations/api/mutations';

export function ExamsListPage() {
  return (
    <RequirePermission perm="exams.view">
      <ExamsListContent />
    </RequirePermission>
  );
}

function ExamsListContent() {
  const { data: exams, isLoading } = useExamsList();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="exams-list-page">
      <div className="page-toolbar">
        <h1>Examinations</h1>
        <RequirePermission perm="exams.manage" fallback={null}>
          <button type="button" onClick={() => setShowForm((s) => !s)}>+ New exam</button>
        </RequirePermission>
      </div>

      {showForm && <NewExamForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Term</th>
              <th>Dates</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(exams ?? []).map((exam: any) => (
              <tr key={exam.id}>
                <td><Link to={`/exams/${exam.id}`}>{exam.name}</Link></td>
                <td>{exam.exam_type.replace('_', ' ')}</td>
                <td>{exam.term?.name ?? '—'}</td>
                <td>{new Date(exam.start_date).toLocaleDateString()} – {new Date(exam.end_date).toLocaleDateString()}</td>
                <td><span className="status-badge">{exam.status}</span></td>
              </tr>
            ))}
            {exams?.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">No exams yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewExamForm({ onClose }: { onClose: () => void }) {
  const { activeSchoolId } = useAuth();
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];
  const create = useCreateExam();

  const { data: gradingScales } = useQuery({
    queryKey: ['gradingScales', activeSchoolId],
    enabled: !!activeSchoolId,
    queryFn: async () => {
      const { data, error } = await supabase.from('grading_scales').select('*').eq('school_id', activeSchoolId!);
      if (error) throw error;
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExamInput>({ resolver: zodResolver(examSchema), defaultValues: { examType: 'unit_test' } });

  return (
    <form
      className="inline-form"
      onSubmit={handleSubmit(async (input) => {
        await create.mutateAsync({ academicYearId: currentYear!.id, input });
        onClose();
      })}
    >
      <label>
        Exam name
        <input {...register('name')} placeholder="Mid-Term Examination" />
        {errors.name && <span role="alert">{errors.name.message}</span>}
      </label>
      <div className="form-row">
        <label>
          Type
          <select {...register('examType')}>
            <option value="unit_test">Unit test</option>
            <option value="midterm">Midterm</option>
            <option value="final">Final</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Grading scale
          <select {...register('gradingScaleId')}>
            <option value="">Select</option>
            {(gradingScales ?? []).map((gs: any) => (
              <option key={gs.id} value={gs.id}>{gs.name}</option>
            ))}
          </select>
          {errors.gradingScaleId && <span role="alert">{errors.gradingScaleId.message}</span>}
        </label>
      </div>
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

      {create.isError && (
        <p role="alert" className="form-error">
          {create.error instanceof ApiError ? create.error.message : 'Could not create exam. Please try again.'}
        </p>
      )}
      {!gradingScales?.length && (
        <p className="field-hint">
          No grading scales exist yet for this school — add one directly in Supabase's table editor
          (`grading_scales` / `grading_scale_bands`) until a dedicated settings page ships.
        </p>
      )}

      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Create exam</button>
      </div>
    </form>
  );
}
