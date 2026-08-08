// core/auth/AuthContext.tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/client';
import type { Database } from '../supabase/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Organization = Database['public']['Tables']['organizations']['Row'];
type School = Database['public']['Tables']['schools']['Row'];
type UserRoleRow = {
  school_id: string | null;
  role: { id: string; name: string; permissions: string[] };
};

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  schools: School[];
  activeSchoolId: string | null;
  setActiveSchoolId: (id: string) => void;
  userRoles: UserRoleRow[];
  permissions: Set<string>;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACTIVE_SCHOOL_STORAGE_KEY = 'erp.activeSchoolId';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [activeSchoolId, setActiveSchoolIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_SCHOOL_STORAGE_KEY),
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionResolved(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // Every query keyed by the authenticated user must be invalidated on
      // sign-in/sign-out, otherwise a previous user's cached data can flash
      // briefly for the next user on a shared device.
      queryClient.invalidateQueries();
    });

    return () => subscription.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['auth', 'profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ['auth', 'organization', profile?.organization_id],
    enabled: !!profile?.organization_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile!.organization_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: schools = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ['auth', 'schools', profile?.organization_id],
    enabled: !!profile?.organization_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('organization_id', profile!.organization_id)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: userRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['auth', 'userRoles', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('school_id, role:roles(id, name, role_permissions(permission:permissions(key)))')
        .eq('profile_id', userId!);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        school_id: row.school_id,
        role: {
          id: row.role.id,
          name: row.role.name,
          permissions: (row.role.role_permissions ?? []).map((rp: any) => rp.permission.key),
        },
      })) as UserRoleRow[];
    },
  });

  // Union of every permission granted by every role the user holds,
  // across every school — the UI-layer convenience check described in
  // 05-roles-permissions-matrix.md. RLS remains the real boundary.
  const permissions = useMemo(() => {
    const set = new Set<string>();
    for (const ur of userRoles) for (const p of ur.role.permissions) set.add(p);
    return set;
  }, [userRoles]);

  useEffect(() => {
    if (!activeSchoolId && schools.length > 0) {
      setActiveSchoolIdState(schools[0].id);
      localStorage.setItem(ACTIVE_SCHOOL_STORAGE_KEY, schools[0].id);
    }
  }, [schools, activeSchoolId]);

  const setActiveSchoolId = (id: string) => {
    setActiveSchoolIdState(id);
    localStorage.setItem(ACTIVE_SCHOOL_STORAGE_KEY, id);
    // Every module's list queries key off activeSchoolId, so switching
    // campuses must invalidate everything scoped to the old one.
    queryClient.invalidateQueries();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(ACTIVE_SCHOOL_STORAGE_KEY);
  };

  const isLoading =
    !sessionResolved || (!!userId && (profileLoading || orgLoading || schoolsLoading || rolesLoading));

  return (
    <AuthContext.Provider
      value={{
        session,
        profile: profile ?? null,
        organization: organization ?? null,
        schools,
        activeSchoolId,
        setActiveSchoolId,
        userRoles,
        permissions,
        isLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
