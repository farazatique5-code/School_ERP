// modules/portals/pages/PortalNoticesPage.tsx
import { useMyNotifications } from '../hooks/usePortal';

export function PortalNoticesPage() {
  const { data: notifications, isLoading } = useMyNotifications();

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className="portal-notices-page">
      <h1>Notices</h1>
      <ul className="portal-list">
        {(notifications ?? []).map((n: any) => (
          <li key={n.id} className="portal-notice-item">
            <strong>{n.title}</strong>
            <p>{n.body}</p>
            <span className="text-secondary">{new Date(n.created_at).toLocaleString()}</span>
          </li>
        ))}
        {notifications?.length === 0 && <li className="text-secondary">No notices yet.</li>}
      </ul>
    </div>
  );
}
