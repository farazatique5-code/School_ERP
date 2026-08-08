// modules/portals/context/ActiveChildContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePermission } from '../../../core/rbac/usePermission';
import { useMyChildren, useMyOwnStudentRecord } from '../hooks/usePortal';
import type { PortalChild } from '../api/queries';

interface ActiveChildContextValue {
  isStudent: boolean;
  isParent: boolean;
  children: PortalChild[];
  activeChild: PortalChild | null;
  setActiveChildId: (id: string) => void;
  isLoading: boolean;
}

const ActiveChildContext = createContext<ActiveChildContextValue | undefined>(undefined);
const STORAGE_KEY = 'erp.portal.activeChildId';

export function ActiveChildProvider({ children: reactChildren }: { children: ReactNode }) {
  const isStudent = usePermission('portal.student_access');
  const isParent = usePermission('portal.parent_access');

  const { data: ownRecord, isLoading: ownLoading } = useMyOwnStudentRecord();
  const { data: myChildren, isLoading: childrenLoading } = useMyChildren();

  const [activeChildId, setActiveChildIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const children = isStudent && ownRecord ? [ownRecord] : myChildren ?? [];

  useEffect(() => {
    if (!activeChildId && children.length > 0) {
      setActiveChildIdState(children[0].id);
      localStorage.setItem(STORAGE_KEY, children[0].id);
    }
  }, [children, activeChildId]);

  const setActiveChildId = (id: string) => {
    setActiveChildIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const activeChild = children.find((c) => c.id === activeChildId) ?? children[0] ?? null;

  return (
    <ActiveChildContext.Provider
      value={{
        isStudent,
        isParent,
        children,
        activeChild,
        setActiveChildId,
        isLoading: ownLoading || childrenLoading,
      }}
    >
      {reactChildren}
    </ActiveChildContext.Provider>
  );
}

export function useActiveChild() {
  const ctx = useContext(ActiveChildContext);
  if (!ctx) throw new Error('useActiveChild must be used within an ActiveChildProvider');
  return ctx;
}
