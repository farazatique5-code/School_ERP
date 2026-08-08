// modules/portals/components/PortalLayout.tsx
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { ActiveChildProvider, useActiveChild } from '../context/ActiveChildContext';

const PORTAL_NAV = [
  { label: 'Home', to: '/portal' },
  { label: 'Attendance', to: '/portal/attendance' },
  { label: 'Fees', to: '/portal/fees' },
  { label: 'Exams', to: '/portal/exams' },
  { label: 'Timetable', to: '/portal/timetable' },
  { label: 'Notices', to: '/portal/notices' },
];

export function PortalLayout() {
  return (
    <ActiveChildProvider>
      <PortalShell />
    </ActiveChildProvider>
  );
}

function PortalShell() {
  const { profile, organization, signOut } = useAuth();
  const { resolvedMode, setMode } = useTheme();
  const { isParent, children, activeChild, setActiveChildId } = useActiveChild();

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <span className="portal-org-name">{organization?.name}</span>
        <div className="portal-header-right">
          <button type="button" onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {resolvedMode === 'dark' ? '☀️' : '🌙'}
          </button>
          <button type="button" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      {isParent && children.length > 1 && (
        <div className="child-switcher">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              className={activeChild?.id === child.id ? 'active' : ''}
              onClick={() => setActiveChildId(child.id)}
            >
              {child.firstName}
            </button>
          ))}
        </div>
      )}

      <main className="portal-content">
        <Outlet />
      </main>

      <nav className="portal-bottom-nav" aria-label="Portal navigation">
        {PORTAL_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/portal'} className={({ isActive }) => (isActive ? 'active' : '')}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <p className="portal-signed-in-as">{profile?.full_name}</p>
    </div>
  );
}
