// core/rbac/RequirePermission.tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermission, useAnyPermission } from './usePermission';

interface RequirePermissionProps {
  perm?: string;
  anyOf?: string[];
  children: ReactNode;
  /** Rendered instead of redirecting — use for inline UI (buttons, nav items)
   * where a 403 page would be wrong; omit for full route guards. */
  fallback?: ReactNode;
}

/**
 * Route usage:
 *   <Route path="/settings/roles" element={
 *     <RequirePermission perm="roles.manage"><RolesPage /></RequirePermission>
 *   } />
 * Inline usage:
 *   <RequirePermission perm="students.create" fallback={null}>
 *     <Button>Add Student</Button>
 *   </RequirePermission>
 */
export function RequirePermission({ perm, anyOf, children, fallback }: RequirePermissionProps) {
  const singleAllowed = perm ? usePermission(perm) : true;
  const anyAllowed = anyOf ? useAnyPermission(anyOf) : true;
  const allowed = singleAllowed && anyAllowed;

  if (allowed) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <Navigate
      to="/403"
      replace
      state={{ requiredPermission: perm ?? anyOf?.join(' | ') }}
    />
  );
}
