// modules/organizations/pages/AuditLogsPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../core/supabase/client';
import { useAuth } from '../../../core/auth/AuthContext';
import { RequirePermission } from '../../../core/rbac/RequirePermission';

const PAGE_SIZE = 25;

export function AuditLogsPage() {
  return (
    <RequirePermission perm="audit_logs.view">
      <AuditLogsContent />
    </RequirePermission>
  );
}

function AuditLogsContent() {
  const { organization } = useAuth();
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', organization?.id, page],
    enabled: !!organization?.id,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('audit_logs')
        .select('id, action, table_name, row_id, created_at, actor:profiles(full_name, email)', { count: 'exact' })
        .eq('organization_id', organization!.id)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: data ?? [], totalCount: count ?? 0 };
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="audit-logs-page">
      <h1>Audit Logs</h1>
      <p className="field-hint">Every create, update, and delete across the platform, append-only.</p>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Table</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row: any) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.actor?.full_name ?? 'System'}</td>
                  <td>
                    <span className={`status-badge action-${row.action}`}>{row.action}</span>
                  </td>
                  <td>{row.table_name}</td>
                  <td className="mono-text">{row.row_id?.slice(0, 8) ?? '—'}</td>
                </tr>
              ))}
              {data?.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">No audit activity recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pagination">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
