// modules/dashboard/api/queries.ts
import { supabase } from '../../../core/supabase/client';

export interface DashboardKpis {
  schoolCount: number;
  activeUserCount: number;
  roleCount: number;
  unreadNotificationCount: number;
  activeStudentCount: number;
  feeCollectedThisMonth: number;
}

export async function fetchDashboardKpis(organizationId: string, schoolId: string | null): Promise<DashboardKpis> {
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const [schools, users, roles, notifications, students, payments] = await Promise.all([
    supabase.from('schools').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_active', true),
    supabase.from('roles').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_read', false),
    schoolId
      ? supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active').is('deleted_at', null)
      : Promise.resolve({ count: 0, error: null }),
    schoolId
      ? supabase.from('ledger_entries').select('amount').eq('school_id', schoolId).eq('entry_type', 'income').eq('category', 'Fee Collection').gte('entry_date', monthStartStr)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [schools, users, roles, notifications, students, payments]) {
    if ((result as any).error) throw (result as any).error;
  }

  const feeCollectedThisMonth = ((payments as any).data ?? []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);

  return {
    schoolCount: schools.count ?? 0,
    activeUserCount: users.count ?? 0,
    roleCount: roles.count ?? 0,
    unreadNotificationCount: notifications.count ?? 0,
    activeStudentCount: (students as any).count ?? 0,
    feeCollectedThisMonth,
  };
}

export interface ActivityPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

/** Daily audit-log activity for the last N days — a real signal (writes
 * across the whole platform), not a placeholder chart. */
export async function fetchActivityTrend(organizationId: string, days = 14): Promise<ActivityPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('audit_logs')
    .select('created_at')
    .eq('organization_id', organizationId)
    .gte('created_at', since.toISOString());
  if (error) throw error;

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

export interface ActivityFeedItem {
  id: string;
  action: string;
  tableName: string;
  actorName: string | null;
  createdAt: string;
}

export async function fetchRecentActivity(organizationId: string, limit = 10): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, table_name, created_at, actor:profiles(full_name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    action: row.action,
    tableName: row.table_name,
    actorName: row.actor?.full_name ?? null,
    createdAt: row.created_at,
  }));
}

export interface PlatformPhase {
  id: number;
  name: string;
  status: 'planned' | 'in_progress' | 'live';
  completedAt: string | null;
}

export async function fetchPlatformPhases(): Promise<PlatformPhase[]> {
  const { data, error } = await supabase.from('platform_phases').select('*').order('id');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    completedAt: row.completed_at,
  }));
}
