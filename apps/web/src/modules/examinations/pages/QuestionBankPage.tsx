// modules/examinations/pages/QuestionBankPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useAcademicYears, useClasses } from '../../academics/hooks/useAcademics';
import { useClassSubjects } from '../../timetable/hooks/useTimetable';
import { useQuestions, useCreateQuestion } from '../hooks/useExams';
import { QuestionGeneratorForm } from '../../ai-copilot/components/QuestionGeneratorForm';
import { questionSchema, type QuestionInput } from '../schemas/exam.schema';
import { ApiError } from '../../organizations/api/mutations';

export function QuestionBankPage() {
  return (
    <RequirePermission perm="exams.manage_question_bank">
      <QuestionBankContent />
    </RequirePermission>
  );
}

function QuestionBankContent() {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];
  const { data: classes } = useClasses(currentYear?.id);
  const [classId, setClassId] = useState('');
  const { data: subjects } = useClassSubjects(classId || undefined);
  const [subjectFilter, setSubjectFilter] = useState('');
  const { data: questions, isLoading } = useQuestions(subjectFilter || undefined);
  const [showForm, setShowForm] = useState(false);
  const [showAiForm, setShowAiForm] = useState(false);

  return (
    <div className="question-bank-page">
      <div className="page-toolbar">
        <h1>Question Bank</h1>
        <div className="toolbar-actions">
          <button type="button" onClick={() => setShowAiForm((s) => !s)}>✨ Generate with AI</button>
          <button type="button" onClick={() => setShowForm((s) => !s)}>+ Add question</button>
        </div>
      </div>

      <div className="attendance-filters">
        <label>
          Class
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectFilter(''); }}>
            <option value="">All classes</option>
            {(classes ?? []).map((k: any) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} disabled={!classId}>
            <option value="">All subjects</option>
            {(subjects ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>

      {showAiForm && <QuestionGeneratorForm subjects={subjects ?? []} classId={classId || undefined} onClose={() => setShowAiForm(false)} />}
      {showForm && <QuestionForm classId={classId} onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <ul className="question-list">
          {(questions ?? []).map((q: any) => (
            <li key={q.id} className="card question-card">
              <div className="question-meta">
                <span className="status-badge">{q.question_type.replace('_', ' ')}</span>
                <span className="status-badge">{q.difficulty}</span>
                <span className="text-secondary">{q.marks} marks</span>
                {q.bloom_level && <span className="text-secondary">· {q.bloom_level}</span>}
                <span className="text-secondary">· {q.subject?.name}{q.class?.name ? ` (${q.class.name})` : ''}</span>
              </div>
              <p>{q.question_text}</p>
              {q.correct_answer && <p className="text-secondary">Answer: {q.correct_answer}</p>}
            </li>
          ))}
          {questions?.length === 0 && <li className="text-secondary">No questions yet.</li>}
        </ul>
      )}
    </div>
  );
}

function QuestionForm({ classId, onClose }: { classId: string; onClose: () => void }) {
  const { data: subjects } = useClassSubjects(classId || undefined);
  const create = useCreateQuestion();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<QuestionInput>({
    resolver: zodResolver(questionSchema),
    defaultValues: { questionType: 'short_answer', difficulty: 'medium', classId: classId || undefined },
  });

  return (
    <form
      className="inline-form"
      onSubmit={handleSubmit(async (input) => {
        await create.mutateAsync(input);
        onClose();
      })}
    >
      <label>
        Subject
        <select {...register('subjectId')}>
          <option value="">Select</option>
          {(subjects ?? []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {errors.subjectId && <span role="alert">{errors.subjectId.message}</span>}
      </label>
      <label>
        Question text
        <textarea {...register('questionText')} rows={3} />
        {errors.questionText && <span role="alert">{errors.questionText.message}</span>}
      </label>
      <div className="form-row">
        <label>
          Type
          <select {...register('questionType')}>
            <option value="mcq">Multiple choice</option>
            <option value="short_answer">Short answer</option>
            <option value="long_answer">Long answer</option>
          </select>
        </label>
        <label>
          Difficulty
          <select {...register('difficulty')}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label>
          Marks
          <input type="number" step="0.5" {...register('marks')} />
        </label>
      </div>
      <label>
        Bloom's taxonomy level
        <select {...register('bloomLevel')}>
          <option value="">— None —</option>
          <option value="remember">Remember</option>
          <option value="understand">Understand</option>
          <option value="apply">Apply</option>
          <option value="analyze">Analyze</option>
          <option value="evaluate">Evaluate</option>
          <option value="create">Create</option>
        </select>
      </label>
      <label>
        Correct answer / marking notes
        <textarea {...register('correctAnswer')} rows={2} />
      </label>

      {create.isError && (
        <p role="alert" className="form-error">
          {create.error instanceof ApiError ? create.error.message : 'Could not save. Please try again.'}
        </p>
      )}

      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Save</button>
      </div>
    </form>
  );
}
