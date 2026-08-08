// modules/examinations/pages/RankingsPage.tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useAcademicYears, useClasses } from '../../academics/hooks/useAcademics';
import { useExamDetail, useRankings } from '../hooks/useExams';

export function RankingsPage() {
  return (
    <RequirePermission perm="exams.view">
      <RankingsContent />
    </RequirePermission>
  );
}

function RankingsContent() {
  const { examId } = useParams<{ examId: string }>();
  const { data: exam } = useExamDetail(examId);
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];
  const { data: classes } = useClasses(currentYear?.id);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');

  const sections = classes?.find((c: any) => c.id === classId)?.sections ?? [];
  const { data: rankings, isLoading } = useRankings(examId, sectionId || undefined);

  return (
    <div className="rankings-page">
      <h1>Rankings — {exam?.name}</h1>

      {exam?.status !== 'published' ? (
        <p className="text-secondary">Rankings appear once this exam's results are published.</p>
      ) : (
        <>
          <div className="attendance-filters">
            <label>
              Class
              <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}>
                <option value="">Select a class</option>
                {(classes ?? []).map((k: any) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </label>
            <label>
              Section
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
                <option value="">Select a section</option>
                {sections.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>

          {!sectionId ? (
            <p className="text-secondary">Select a section to view its ranking table.</p>
          ) : isLoading ? (
            <p>Loading…</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Total</th>
                  <th>Percentage</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {(rankings ?? []).map((r: any) => (
                  <tr key={r.student_id}>
                    <td><strong>#{r.rank_in_section}</strong></td>
                    <td>{r.student?.first_name} {r.student?.last_name}</td>
                    <td>{r.total_marks} / {r.total_max_marks}</td>
                    <td>{r.percentage}%</td>
                    <td>
                      <Link to={`/exams/${examId}/report-card/${r.student_id}`}>View report card</Link>
                    </td>
                  </tr>
                ))}
                {rankings?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">No rankings for this section yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
