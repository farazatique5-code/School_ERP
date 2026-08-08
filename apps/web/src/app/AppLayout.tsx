// app/AppLayout.tsx
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../core/auth/AuthContext';
import { useTheme } from '../core/theme/ThemeProvider';
import { usePermission } from '../core/rbac/usePermission';
import { CopilotWidget } from '../modules/ai-copilot/components/CopilotWidget';

interface NavItem {
  label: string;
  to: string;
  perm: string;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

// Mirrors docs/06-navigation.md exactly. Modules not yet built (Phase 3+)
// are intentionally omitted here rather than linked-but-disabled — a nav
// item only appears once its route and permission actually exist.
const NAV_GROUPS: NavGroup[] = [
  { label: '', items: [{ label: 'Dashboard', to: '/', perm: 'dashboard.view' }] },
  {
    label: 'Academics',
    items: [
      { label: 'Students', to: '/students', perm: 'students.view' },
      { label: 'Admissions', to: '/admissions', perm: 'admissions.view' },
      { label: 'Mark Attendance', to: '/attendance/mark', perm: 'attendance.mark' },
      { label: 'Attendance Reports', to: '/attendance/reports', perm: 'attendance.view' },
      { label: 'Timetable Setup', to: '/timetable/sections', perm: 'timetable.manage' },
      { label: 'My Timetable', to: '/timetable/my', perm: 'dashboard.view' },
      { label: 'Examinations', to: '/exams', perm: 'exams.view' },
      { label: 'Question Bank', to: '/exams/question-bank', perm: 'exams.manage_question_bank' },
      { label: 'Academic Setup', to: '/academics/setup', perm: 'academics.manage' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Library Catalog', to: '/library/catalog', perm: 'library.view' },
      { label: 'Circulation', to: '/library/circulation', perm: 'library.manage' },
      { label: 'Inventory Items', to: '/inventory/items', perm: 'inventory.view' },
      { label: 'Suppliers', to: '/inventory/suppliers', perm: 'inventory.manage' },
      { label: 'Purchase Orders', to: '/inventory/purchase-orders', perm: 'inventory.manage' },
      { label: 'Hostel Buildings', to: '/hostel/buildings', perm: 'hostel.view' },
      { label: 'Hostel Visitors', to: '/hostel/visitors', perm: 'hostel.manage' },
      { label: 'Mess Menu', to: '/hostel/mess-menu', perm: 'dashboard.view' },
      { label: 'Transport Routes', to: '/transport/routes', perm: 'transport.view' },
      { label: 'Vehicles', to: '/transport/vehicles', perm: 'transport.manage' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Invoices', to: '/fees/invoices', perm: 'fees.view' },
      { label: 'Fee Setup', to: '/fees/setup', perm: 'fees.manage' },
      { label: 'Financial Reports', to: '/fees/reports', perm: 'fees.view_reports' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Teachers & Staff', to: '/hr/employees', perm: 'hr.manage' },
      { label: 'Leave', to: '/hr/leave', perm: 'dashboard.view' },
    ],
  },
  {
    label: 'AI',
    items: [
      { label: 'Risk Scores', to: '/ai/risk-scores', perm: 'reports.export' },
      { label: 'Document Scanner', to: '/ai/document-scanner', perm: 'ai.generate_content' },
    ],
  },
  {
    label: 'Reports',
    items: [{ label: 'Reports & Analytics', to: '/reports', perm: 'reports.export' }],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Organization & Branding', to: '/settings/organization', perm: 'organization.update' },
      { label: 'Schools', to: '/settings/schools', perm: 'schools.manage' },
      { label: 'Roles & Permissions', to: '/settings/roles', perm: 'roles.manage' },
      { label: 'Users', to: '/settings/users', perm: 'users.manage' },
      { label: 'Audit Logs', to: '/settings/audit-logs', perm: 'audit_logs.view' },
    ],
  },
];

export function AppLayout() {
  const { organization, schools, activeSchoolId, setActiveSchoolId, signOut, profile } = useAuth();
  const { resolvedMode, setMode, mode } = useTheme();
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="workspace-header">
        <div className="workspace-header-left">
          {organization?.logo_url ? (
            <img src={organization.logo_url} alt={organization.name} className="org-logo" />
          ) : (
            <span className="org-logo-placeholder">{organization?.name?.[0] ?? 'S'}</span>
          )}
          <span className="org-name">{organization?.name}</span>

          {schools.length > 1 && (
            <select
              aria-label="Active school"
              value={activeSchoolId ?? ''}
              onChange={(e) => setActiveSchoolId(e.target.value)}
              className="school-switcher"
            >
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="workspace-header-right">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
          >
            {resolvedMode === 'dark' ? '☀️' : '🌙'}
          </button>
          <span className="current-user">{profile?.full_name}</span>
          <button type="button" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="sidebar" aria-label="Main navigation">
          {NAV_GROUPS.map((group) => (
            <FilteredNavGroup key={group.label || 'root'} group={group} />
          ))}
        </nav>

        <main className="main-content">
          <Breadcrumb pathname={location.pathname} />
          <Outlet />
        </main>
      </div>

      <CopilotWidget />
    </div>
  );
}

function FilteredNavGroup({ group }: { group: NavGroup }) {
  return (
    <div className="nav-group">
      {group.label && <h3 className="nav-group-label">{group.label}</h3>}
      {group.items.map((item) => (
        <PermissionFilteredLink key={item.to} item={item} />
      ))}
    </div>
  );
}

function PermissionFilteredLink({ item }: { item: NavItem }) {
  const allowed = usePermission(item.perm);
  if (!allowed) return null;
  return (
    <NavLink to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
      {item.label}
    </NavLink>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <NavLink to="/">Home</NavLink>
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/');
        const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
        return (
          <span key={path}>
            {' '}
            / <NavLink to={path}>{label}</NavLink>
          </span>
        );
      })}
    </nav>
  );
}
