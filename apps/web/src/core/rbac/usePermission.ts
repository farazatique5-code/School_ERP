// core/rbac/usePermission.ts
import { useAuth } from '../auth/AuthContext';

/** UI-layer convenience check only. RLS at the database is the real
 * security boundary — see 07-api-architecture.md and 05-roles-permissions-matrix.md.
 * Never gate a sensitive read/write on this hook alone. */
export function usePermission(permissionKey: string): boolean {
  const { permissions } = useAuth();
  return permissions.has(permissionKey);
}

export function usePermissions(permissionKeys: string[]): boolean[] {
  const { permissions } = useAuth();
  return permissionKeys.map((key) => permissions.has(key));
}

/** True if the user holds ANY of the given permission keys. Useful for
 * nav items reachable via more than one role (e.g. reports visible to
 * several admin-tier roles). */
export function useAnyPermission(permissionKeys: string[]): boolean {
  const { permissions } = useAuth();
  return permissionKeys.some((key) => permissions.has(key));
}
