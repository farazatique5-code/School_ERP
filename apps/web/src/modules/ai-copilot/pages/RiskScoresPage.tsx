// modules/ai-copilot/pages/RiskScoresPage.tsx
import { useQuery } from '@tanstack/react-query';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { useAuth } from '../../../core/auth/AuthContext';
import { useAcademicYears } from '../../academics/hooks/useAcademics';
import { supabase } from '../../../core/supabase/client';
import { ExportMenu } from '../../../components/ui/ExportMenu';

export function RiskScoresPage() {
  return (
    <RequirePermission perm="reports.export">
      <RiskScoresContent />
    </RequirePermission>
  );
}

function RiskScoresContent() {
  const { activeSchoolId } = useAuth();
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y: any) => y.is_current) ?? years?.[0];

  const { data: scores, isLoading } = useQuery({
    queryKey: ['riskScores', activeSchoolId, currentYear?.id],
    enabled: !!activeSchoolId && !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_student_risk_scores', {
        p_school_id: activeSchoolId!,
        p_academic_year_id: currentYear!.id,
      });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="risk-scores-page">
      <h1>Student Risk Scores</h1>
      <div className="card banner-info">
        <strong>What this actually is:</strong> a transparent weighted formula — 40% attendance rate + 60% exam
        average, inverted to a 0-100 "risk" number — not a trained machine learning model. A genuine predictive
        model would need a labeled historical dataset and a training pipeline this project doesn't have.
        Calling this "AI-predicted" would overstate what it does; it's a real, explainable composite that surfaces
        the same signal a counselor would compute by hand, just automatically.
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <>
          <div className="page-toolbar">
            <span className="text-secondary">{scores?.length ?? 0} students</span>
            <ExportMenu
              filename="student-risk-scores"
              title="Student Risk Scores"
              data={scores ?? []}
              columns={[
                { header: 'Name', accessor: (r: any) => `${r.first_name} ${r.last_name}` },
                { header: 'Attendance rate', accessor: (r: any) => r.attendance_rate ?? 'No data' },
                { header: 'Exam average', accessor: (r: any) => r.exam_average ?? 'No data' },
                { header: 'Risk score', accessor: (r: any) => r.risk_score },
                { header: 'Risk level', accessor: (r: any) => r.risk_level },
              ]}
            />
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Student</th><th>Attendance rate</th><th>Exam average</th><th>Risk score</th><th>Level</th></tr>
            </thead>
            <tbody>
              {(scores ?? []).map((s: any) => (
                <tr key={s.student_id}>
                  <td>{s.first_name} {s.last_name}</td>
                  <td>{s.attendance_rate != null ? `${s.attendance_rate}%` : 'No data yet'}</td>
                  <td>{s.exam_average != null ? `${s.exam_average}%` : 'No data yet'}</td>
                  <td>{s.risk_score}</td>
                  <td>
                    <span className={`status-badge risk-${s.risk_level}`}>{s.risk_level}</span>
                  </td>
                </tr>
              ))}
              {scores?.length === 0 && <tr><td colSpan={5} className="empty-state">No enrolled students to score.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
