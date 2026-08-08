# Phase 2 — Authentication, Organization Setup, Multi-Tenant Foundation, Dashboard

## What shipped

**Database** (`supabase/migrations/002_org_provisioning.sql`, `003_phase2_complete.sql`)
- System role templates (16 seed roles, `organization_id = null`) with their default permission grants.
- `platform_phases` table — a real table the Dashboard queries, so "build progress" is never a hardcoded UI list.
- `provision_organization()` Postgres function: atomically creates an organization, its first school, org-owned copies of every system role (with permissions), and the owner's profile + role assignment.

**Edge Function** (`supabase/functions/provision-organization`)
- The only place in the codebase that uses the Supabase service role. Creates the `auth.users` row, calls `provision_organization()`, and rolls back the auth user if provisioning fails (no orphaned logins).

**Frontend core** (`src/core/`)
- `auth/AuthContext.tsx` — session, profile, organization, schools list, active-school switcher, and the resolved permission set (union of every role the user holds, across every school).
- `rbac/usePermission.ts` + `RequirePermission.tsx` — UI-layer permission checks and route/inline guards. Documented everywhere as a convenience layer only; RLS remains the real boundary.
- `theme/ThemeProvider.tsx` — dark/light mode plus white-label brand color injection (org's `primary_color`/`secondary_color` → CSS variables) with zero component duplication.
- `supabase/client.ts` + `database.types.ts` — typed Supabase client. **`database.types.ts` is checked in as a generated artifact; regenerate it after every migration** with `supabase gen types typescript --local > src/core/supabase/database.types.ts`.

**Organizations module** (`src/modules/organizations/`)
- Sign-up wizard (account → organization → first school) calling the Edge Function.
- Login page.
- Organization & Branding settings (white-label controls).
- Schools management (list/create/edit/archive — soft delete only, per the `deleted_at` column).
- Users list (read-only view of org members and their role assignments).
- Audit Logs viewer (paginated, read-only, append-only by RLS design).

**Dashboard module** (`src/modules/dashboard/`)
- KPIs backed by real queries against tables that exist today: school count, active user count, roles configured, unread notifications. **Deliberately does not show student/attendance/fee KPIs yet** — those ship with real data in Phases 3, 5, and 9 respectively, not as zeroed-out placeholders now.
- 14-day activity trend chart from `audit_logs`.
- Live-feeling recent activity feed (polling, not yet a realtime subscription — realtime upgrade is a Phase 3+ enhancement once there's higher-frequency data worth subscribing to).
- Platform build progress widget reading `platform_phases`.

**App shell** (`src/app/`)
- Router with an auth guard, permission-guarded routes, 403/404 pages.
- Layout: workspace header (org branding, school switcher, theme toggle), permission-filtered sidebar matching `docs/06-navigation.md` exactly, auto-generated breadcrumb.

## Deliberately deferred within Phase 2

- **Role & permission matrix editor UI** — the roles×permissions grid described in `docs/05-roles-permissions-matrix.md` needs a dedicated editor larger than the other Phase 2 pages. The data model (`roles`, `permissions`, `role_permissions`) is live and the Users/Schools pages already read from it; the editing UI for it is the first item of the next increment.
- **Realtime notification bell** — `notifications` table and RLS exist (Phase 1); the bell UI component ships when Phase 3+ modules start writing real notifications worth surfacing live.

## Contract for Phase 3 (Student Information System)

Phase 3 can now rely on: an authenticated `profile` with `organization_id`, an `activeSchoolId` from `useAuth()`, the `usePermission`/`RequirePermission` guards, the `DataTable`-style page patterns established in `SchoolsPage.tsx`/`AuditLogsPage.tsx`, and the `classes`/`sections`/`academic_years` tables already in the Phase 1 schema for students to be enrolled against. No Phase 3 migration should need to alter anything in `001_core_foundation.sql` or `002_org_provisioning.sql`.
