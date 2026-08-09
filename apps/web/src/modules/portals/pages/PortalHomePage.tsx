// modules/portals/pages/PortalHomePage.tsx
import { Link } from 'react-router-dom';
import { useActiveChild } from '../context/ActiveChildContext';
import { usePortalOverview } from '../hooks/usePortal';

export function PortalHomePage() {
  const { activeChild, isLoading: childLoading } = useActiveChild();
  const { data: overview, isLoading } = usePortalOverview(activeChild?.id);

  if (childLoading || isLoading) return <p>Loading…</p>;
  if (!activeChild) return <p className="text-secondary">No student record is linked to your account yet.</p>;

  const enrollment = overview?.student_enrollments?.find((e: any) => e.academic_year?.is_current);

  return (
    <div className="portal-home-page">
      <div className="portal-profile-card">
        {activeChild.photoUrl ? (
          <img src={activeChild.photoUrl} alt="" className="avatar-lg" />
        ) : (
          <span className="avatar-placeholder-lg">{activeChild.firstName[0]}</span>
        )}
        <div>
          <h1>{activeChild.firstName} {activeChild.lastName}</h1>
          <p className="text-secondary">
            {activeChild.studentCode} · {enrollment?.class?.name ?? 'Unassigned'}{enrollment?.section?.name ? ` / ${enrollment.section.name}` : ''}
          </p>
        </div>
      </div>

      <div className="portal-quick-links">
        <Link to="/portal/attendance" className="card portal-quick-link">Attendance</Link>
        <Link to="/portal/fees" className="card portal-quick-link">Fees</Link>
        <Link to="/portal/exams" className="card portal-quick-link">Exams</Link>
        <Link to="/portal/timetable" className="card portal-quick-link">Timetable</Link>
      </div>
    </div>
  );
}
