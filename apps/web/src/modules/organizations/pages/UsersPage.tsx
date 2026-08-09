// modules/organizations/pages/UsersPage.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../core/supabase/client';
import { useAuth } from '../../../core/auth/AuthContext';
import { RequirePermission } from '../../../core/rbac/RequirePermission';

export function UsersPage() {
  return (
    <RequirePermission perm="users.manage">
      <UsersPageContent />
    </RequirePermission>
  );
}

function UsersPageContent() {
  const { organization, schools } = useAuth();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_active, last_login_at, user_roles(school_id, role:roles(name))')
        .eq('organization_id', organization!.id)
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));

  return (
    <div className="users-page">
      <h1>Users</h1>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Last login</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((user: any) => (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>
                  {(user.user_roles ?? [])
                    .map((ur: any) =>
                      ur.school_id
                        ? `${ur.role.name} (${schoolNameById.get(ur.school_id) ?? 'Unknown school'})`
                        : `${ur.role.name} (org-wide)`,
                    )
                    .join(', ') || '—'}
                </td>
                <td>
                  <span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}</td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
