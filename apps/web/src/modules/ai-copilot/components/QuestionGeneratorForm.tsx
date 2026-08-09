// modules/ai-copilot/components/QuestionGeneratorForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../../core/auth/AuthContext';
import { ApiError } from '../../organizations/api/mutations';

const generatorSchema = z.object({
  subjectId: z.string().uuid('Select a subject'),
  topic: z.string().min(1, 'Topic is required').max(200),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questionType: z.enum(['mcq', 'short_answer', 'long_answer']),
  count: z.coerce.number().int().min(1).max(10),
});
type GeneratorInput = z.infer<typeof generatorSchema>;

const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-exam-questions`;

export function QuestionGeneratorForm({ subjects, classId, onClose }: { subjects: any[]; classId?: string; onClose: () => void }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GeneratorInput>({ resolver: zodResolver(generatorSchema), defaultValues: { difficulty: 'medium', questionType: 'short_answer', count: 3 } });

  const generate = useMutation({
    mutationFn: async (input: GeneratorInput) => {
      const response = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ ...input, classId }),
      });
      const body = await response.json();
      if (!response.ok) throw new ApiError(body?.error?.code ?? 'unknown_error', body?.error?.message ?? 'Could not generate questions.');
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams', 'questions'] });
      onClose();
    },
  });

  return (
    <form className="inline-form" onSubmit={handleSubmit((input) => generate.mutate(input))}>
      <p className="field-hint">
        Generates real questions via an LLM call and saves them straight into the question bank below — review
        them like any manually-entered question before using them in an exam.
      </p>
      <label>
        Subject
        <select {...register('subjectId')}>
          <option value="">Select</option>
          {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {errors.subjectId && <span role="alert">{errors.subjectId.message}</span>}
      </label>
      <label>
        Topic
        <input {...register('topic')} placeholder="e.g. Photosynthesis, Quadratic equations" />
        {errors.topic && <span role="alert">{errors.topic.message}</span>}
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
          How many
          <input type="number" min={1} max={10} {...register('count')} />
        </label>
      </div>

      {generate.isError && (
        <p role="alert" className="form-error">
          {generate.error instanceof ApiError ? generate.error.message : 'Could not generate. Please try again.'}
        </p>
      )}

      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting || generate.isPending}>
          {generate.isPending ? 'Generating…' : 'Generate with AI'}
        </button>
      </div>
    </form>
  );
}
