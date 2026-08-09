// modules/dashboard/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { fetchDashboardKpis, fetchActivityTrend, fetchRecentActivity, fetchPlatformPhases } from '../api/queries';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  kpis: (orgId?: string) => [...dashboardKeys.all, 'kpis', orgId] as const,
  activityTrend: (orgId?: string) => [...dashboardKeys.all, 'activityTrend', orgId] as const,
  recentActivity: (orgId?: string) => [...dashboardKeys.all, 'recentActivity', orgId] as const,
  platformPhases: () => [...dashboardKeys.all, 'platformPhases'] as const,
};

export function useDashboardKpis() {
  const { organization, activeSchoolId } = useAuth();
  return useQuery({
    queryKey: [...dashboardKeys.kpis(organization?.id), activeSchoolId],
    enabled: !!organization?.id,
    queryFn: () => fetchDashboardKpis(organization!.id, activeSchoolId ?? null),
    // KPIs don't need to be second-fresh; avoid re-fetching on every focus.
    staleTime: 60_000,
  });
}

export function useActivityTrend(days = 14) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: [...dashboardKeys.activityTrend(organization?.id), days],
    enabled: !!organization?.id,
    queryFn: () => fetchActivityTrend(organization!.id, days),
    staleTime: 60_000,
  });
}

export function useRecentActivity(limit = 10) {
  const { organization } = useAuth();
  return useQuery({
    queryKey: [...dashboardKeys.recentActivity(organization?.id), limit],
    enabled: !!organization?.id,
    queryFn: () => fetchRecentActivity(organization!.id, limit),
    refetchInterval: 30_000, // activity feed feels "live" without needing a realtime subscription
  });
}

export function usePlatformPhases() {
  return useQuery({
    queryKey: dashboardKeys.platformPhases(),
    queryFn: fetchPlatformPhases,
    staleTime: 5 * 60_000,
  });
}
