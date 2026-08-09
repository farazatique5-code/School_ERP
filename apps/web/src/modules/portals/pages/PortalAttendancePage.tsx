// modules/portals/pages/PortalAttendancePage.tsx
import { useActiveChild } from '../context/ActiveChildContext';
import { usePortalAttendance } from '../hooks/usePortal';

export function PortalAttendancePage() {
  const { activeChild } = useActiveChild();
  const { data: records, isLoading } = usePortalAttendance(activeChild?.id);

  if (isLoading) return <p>Loading…</p>;

  const presentCount = (records ?? []).filter((r) => r.status === 'present' || r.status === 'late').length;
  const percent = records?.length ? Math.round((presentCount / records.length) * 100) : null;

  return (
    <div className="portal-attendance-page">
      <h1>Attendance</h1>
      {percent !== null && (
        <div className="card portal-summary-card">
          <span className="kpi-label">Last 30 days</span>
          <span className="kpi-value">{percent}%</span>
        </div>
      )}
      <ul className="portal-list">
        {(records ?? []).map((r, i) => (
          <li key={i}>
            <span>{new Date(r.attendance_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className={`status-badge ${r.status === 'absent' ? 'status-inactive' : 'status-active'}`}>{r.status}</span>
          </li>
        ))}
        {records?.length === 0 && <li className="text-secondary">No attendance records in this range.</li>}
      </ul>
    </div>
  );
}
