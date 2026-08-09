// modules/portals/pages/PortalExamsPage.tsx
import { useActiveChild } from '../context/ActiveChildContext';
import { usePortalExams } from '../hooks/usePortal';

export function PortalExamsPage() {
  const { activeChild } = useActiveChild();
  const { data: marks, isLoading } = usePortalExams(activeChild?.id);

  if (isLoading) return <p>Loading…</p>;

  const publishedOnly = (marks ?? []).filter((m: any) => m.exam_schedule?.exam?.status === 'published');
  const byExam = new Map<string, any[]>();
  for (const mark of publishedOnly) {
    const examId = mark.exam_schedule.exam.id;
    const list = byExam.get(examId) ?? [];
    list.push(mark);
    byExam.set(examId, list);
  }

  return (
    <div className="portal-exams-page">
      <h1>Exams</h1>
      {Array.from(byExam.entries()).map(([examId, rows]) => (
        <div className="card" key={examId} style={{ marginBottom: 12 }}>
          <h2>{rows[0].exam_schedule.exam.name}</h2>
          <ul className="portal-list">
            {rows.map((m: any) => (
              <li key={m.id}>
                <span>{m.exam_schedule.subject?.name}</span>
                <span>{m.is_absent ? 'Absent' : `${m.marks_obtained} / ${m.exam_schedule.max_marks}`} {m.grade_label ? `(${m.grade_label})` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {byExam.size === 0 && <p className="text-secondary">No published results yet.</p>}
    </div>
  );
}
