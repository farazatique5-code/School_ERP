// modules/examinations/pages/ReportCardPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useStudentReportCard } from '../hooks/useExams';
import { exportDocumentToPdf } from '../../../lib/export';
import { usePermission } from '../../../core/rbac/usePermission';
import { supabase } from '../../../core/supabase/client';
import { ReportCommentEditor } from '../../ai-copilot/components/ReportCommentEditor';

export function ReportCardPage() {
  return (
    <RequirePermission perm="exams.view">
      <ReportCardContent />
    </RequirePermission>
  );
}

function ReportCardContent() {
  const { examId, studentId } = useParams<{ examId: string; studentId: string }>();
  const { data, isLoading } = useStudentReportCard(examId, studentId);
  const canGenerateContent = usePermission('ai.generate_content');

  if (isLoading) return <p>Loading…</p>;
  if (!data) return <p>Not found.</p>;

  const { exam, marks, ranking } = data;

  if (exam.status !== 'published') {
    return (
      <div className="card">
        <p>Results for "{exam.name}" haven't been published yet.</p>
      </div>
    );
  }

  return (
    <div className="report-card-page">
      <div className="card report-card">
        <header className="report-card-header">
          <h1>{exam.name}</h1>
          <p className="text-secondary">Grading scale: {exam.grading_scale?.name}</p>
        </header>

        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Marks obtained</th>
              <th>Max marks</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {marks.map((m: any) => (
              <tr key={m.id}>
                <td>{m.exam_schedule?.subject?.name}</td>
                <td>{m.is_absent ? 'Absent' : m.marks_obtained}</td>
                <td>{m.exam_schedule?.max_marks}</td>
                <td><span className="status-badge">{m.grade_label ?? '—'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        {ranking && (
          <div className="report-card-summary">
            <div>
              <span className="kpi-label">Total</span>
              <span className="kpi-value">{ranking.total_marks} / {ranking.total_max_marks}</span>
            </div>
            <div>
              <span className="kpi-label">Percentage</span>
              <span className="kpi-value">{ranking.percentage}%</span>
            </div>
            <div>
              <span className="kpi-label">Section rank</span>
              <span className="kpi-value">#{ranking.rank_in_section}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            exportDocumentToPdf({
              filename: `report-card-${studentId}-${exam.name.replace(/\s+/g, '-')}`,
              title: exam.name,
              subtitle: `Grading scale: ${exam.grading_scale?.name}`,
              keyValuePairs: ranking
                ? [
                    ['Total', `${ranking.total_marks} / ${ranking.total_max_marks}`],
                    ['Percentage', `${ranking.percentage}%`],
                    ['Section rank', `#${ranking.rank_in_section}`],
                  ]
                : [],
              tableHead: ['Subject', 'Marks obtained', 'Max marks', 'Grade'],
              tableRows: marks.map((m: any) => [
                m.exam_schedule?.subject?.name ?? '',
                m.is_absent ? 'Absent' : m.marks_obtained,
                m.exam_schedule?.max_marks ?? '',
                m.grade_label ?? '—',
              ]),
            })
          }
          style={{ marginTop: 16 }}
        >
          Download PDF
        </button>
      </div>

      {canGenerateContent ? (
        <ReportCommentEditor examId={examId!} studentId={studentId!} />
      ) : (
        <PublishedCommentView examId={examId!} studentId={studentId!} />
      )}
    </div>
  );
}

function PublishedCommentView({ examId, studentId }: { examId: string; studentId: string }) {
  const { data } = useQuery({
    queryKey: ['reportComment', examId, studentId, 'published'],
    queryFn: async () => {
      const { data } = await supabase.from('exam_report_comments').select('*').eq('exam_id', examId).eq('student_id', studentId).eq('is_published', true).maybeSingle();
      return data;
    },
  });
  if (!data) return null;
  return (
    <div className="card">
      <h3>Teacher's comment</h3>
      <p>{data.comment_text}</p>
    </div>
  );
}
