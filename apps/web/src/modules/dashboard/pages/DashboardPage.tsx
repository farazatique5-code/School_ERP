// modules/dashboard/pages/DashboardPage.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../../../core/auth/AuthContext';
import { useDashboardKpis, useActivityTrend, useRecentActivity, usePlatformPhases } from '../hooks/useDashboard';

export function DashboardPage() {
  const { organization, profile } = useAuth();
  const kpis = useDashboardKpis();
  const trend = useActivityTrend(14);
  const activity = useRecentActivity(10);
  const phases = usePlatformPhases();

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>Welcome back{profile ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
        <p className="text-secondary">{organization?.name}</p>
      </header>

      <section className="kpi-grid" aria-label="Key metrics">
        <KpiCard label="Active students" value={kpis.data?.activeStudentCount} loading={kpis.isLoading} />
        <KpiCard label="Fee collected this month" value={kpis.data?.feeCollectedThisMonth} loading={kpis.isLoading} />
        <KpiCard label="Schools" value={kpis.data?.schoolCount} loading={kpis.isLoading} />
        <KpiCard label="Active users" value={kpis.data?.activeUserCount} loading={kpis.isLoading} />
        <KpiCard
          label="Unread notifications"
          value={kpis.data?.unreadNotificationCount}
          loading={kpis.isLoading}
          tone={kpis.data && kpis.data.unreadNotificationCount > 0 ? 'warning' : 'default'}
        />
      </section>

      <section className="dashboard-grid">
        <div className="card activity-chart-card">
          <h2>Platform activity (14 days)</h2>
          {trend.isLoading ? (
            <p>Loading…</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-default))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  stroke="hsl(var(--text-tertiary))"
                  fontSize={12}
                />
                <YAxis allowDecimals={false} stroke="hsl(var(--text-tertiary))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--bg-surface))',
                    border: '1px solid hsl(var(--border-default))',
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--brand-primary))"
                  strokeWidth={2}
                  dot={false}
                  name="Actions logged"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card activity-feed-card">
          <h2>Recent activity</h2>
          {activity.isLoading ? (
            <p>Loading…</p>
          ) : activity.data && activity.data.length > 0 ? (
            <ul className="activity-feed">
              {activity.data.map((item) => (
                <li key={item.id}>
                  <span className="actor">{item.actorName ?? 'System'}</span>{' '}
                  <span className="action">{describeAction(item.action, item.tableName)}</span>
                  <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-secondary">No activity yet — actions across the platform will show up here.</p>
          )}
        </div>

        <div className="card platform-progress-card">
          <h2>Platform build progress</h2>
          <ul className="phase-list">
            {(phases.data ?? []).map((phase) => (
              <li key={phase.id} data-status={phase.status}>
                <span className="phase-index">Phase {phase.id}</span>
                <span className="phase-name">{phase.name}</span>
                <span className="phase-status-badge">{formatPhaseStatus(phase.status)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  loading,
  tone = 'default',
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="card kpi-card" data-tone={tone}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{loading ? '—' : value ?? 0}</span>
    </div>
  );
}

function describeAction(action: string, tableName: string): string {
  const readableTable = tableName.replace(/_/g, ' ');
  switch (action) {
    case 'insert':
      return `created a ${singularize(readableTable)}`;
    case 'update':
      return `updated a ${singularize(readableTable)}`;
    case 'delete':
      return `deleted a ${singularize(readableTable)}`;
    default:
      return `${action} on ${readableTable}`;
  }
}

function singularize(word: string): string {
  return word.endsWith('s') ? word.slice(0, -1) : word;
}

function formatPhaseStatus(status: 'planned' | 'in_progress' | 'live'): string {
  return { planned: 'Planned', in_progress: 'In progress', live: 'Live' }[status];
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
