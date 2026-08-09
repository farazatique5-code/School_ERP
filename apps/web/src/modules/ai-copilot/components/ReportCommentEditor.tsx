// modules/ai-copilot/components/ReportCommentEditor.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { supabase } from '../../../core/supabase/client';
import { ApiError } from '../../organizations/api/mutations';

const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-report-comments`;

export function ReportCommentEditor({ examId, studentId }: { examId: string; studentId: string }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [draftText, setDraftText] = useState<string | null>(null);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['reportComment', examId, studentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exam_report_comments').select('*').eq('exam_id', examId).eq('student_id', studentId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const response = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ examId, studentId }),
      });
      const body = await response.json();
      if (!response.ok) throw new ApiError(body?.error?.code ?? 'unknown_error', body?.error?.message ?? 'Could not generate a comment.');
      return body.data;
    },
    onSuccess: (data) => {
      setDraftText(data.comment_text);
      queryClient.invalidateQueries({ queryKey: ['reportComment', examId, studentId] });
    },
  });

  const { register, handleSubmit, reset } = useForm<{ commentText: string }>({ values: { commentText: draftText ?? existing?.comment_text ?? '' } });

  const save = useMutation({
    mutationFn: async ({ commentText, publish }: { commentText: string; publish: boolean }) => {
      const { error } = await supabase
        .from('exam_report_comments')
        .upsert({ exam_id: examId, student_id: studentId, comment_text: commentText, is_published: publish }, { onConflict: 'exam_id,student_id' });
      if (error) throw new ApiError(error.code ?? 'save_failed', error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reportComment', examId, studentId] }),
  });

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className="card report-comment-editor">
      <div className="page-toolbar">
        <h3>Report card comment</h3>
        {existing?.is_published && <span className="status-badge status-active">Published</span>}
      </div>

      <RequirePermission perm="ai.generate_content" fallback={null}>
        <button type="button" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? 'Generating…' : existing ? 'Regenerate with AI' : 'Draft with AI'}
        </button>
        {generate.isError && (
          <p role="alert" className="form-error">
            {generate.error instanceof ApiError ? generate.error.message : 'Could not generate. Please try again.'}
          </p>
        )}
      </RequirePermission>

      <form
        onSubmit={handleSubmit((input) => save.mutate({ commentText: input.commentText, publish: existing?.is_published ?? false }))}
        style={{ marginTop: 8 }}
      >
        <textarea {...register('commentText')} rows={4} placeholder="AI-drafted comment appears here for you to edit before publishing." />
        <div className="drawer-actions">
          <button type="submit" disabled={save.isPending}>Save draft</button>
          <button
            type="button"
            className="primary"
            onClick={handleSubmit((input) => save.mutate({ commentText: input.commentText, publish: true }))}
            disabled={save.isPending}
          >
            Save & publish
          </button>
        </div>
      </form>
      <p className="field-hint">AI drafts are never published automatically — review and edit before publishing.</p>
    </div>
  );
}
