# Phase 14 — Parent & Student Portals

## The honest limit this phase runs into, stated up front

"Parent portal account creation," logged as a pending automation step since Phase 4, **can never be fully automated by a database trigger** — creating a Supabase Auth user requires the service-role Admin API, which only runs in an Edge Function, not in Postgres. This phase closes the part that *can* be closed (once an account exists, it sees the right data immediately) and replaces the automation with an honest manual trigger: an **"Invite to portal"** button, in the exact places staff already are (Student Overview tab, Student Guardians tab) when an email exists and no account does yet.

## What shipped

**Database** (`026_portals.sql`)
- `auth_is_self_student()` / `auth_is_guardian_of()` / `auth_can_view_student()` — the helper functions every portal RLS clause below is built on.
- **Widened RLS on six tables** (`students`, `student_enrollments`, `student_attendance`, `fee_invoices`, `fee_payments`, `student_marks`, `exam_rankings`, `timetable_entries`): each policy is extended with an OR clause granting self/guardian access, alongside the existing staff-permission access, unchanged. A family can now see their own child's attendance, fee status, exam results, and timetable — and structurally cannot see anyone else's.
- `provision_portal_profile()` RPC — same atomic-linking pattern as `provision_employee`, called by the Edge Function below.
- Redefined `fn_admission_approved()`'s `pending_steps` wording to state the real constraint (needs a staff action) instead of implying a future phase would make it fully automatic — that would have been a false promise.

**Edge Function** (`supabase/functions/invite-portal-user`) — fourth and last service-role use in this codebase, same shape as `invite-employee`: verifies the caller holds `students.update`, invites the auth user, links it to the existing student or guardian record, rolls back on failure.

**Frontend** (`src/modules/portals/`)
- A **structurally separate shell** (`PortalLayout`) — not the admin sidebar with items hidden, a genuinely different mobile-first layout with bottom nav, per `docs/06-navigation.md`.
- `ActiveChildContext` — resolves whether the signed-in user is a Student (viewing themselves) or a Parent (picking among possibly-multiple children, persisted across sessions).
- Pages: Home, Attendance, Fees, Exams (published results only — a family never sees an in-progress exam's partial marks), Timetable, Notices.
- "Invite to portal" actions added directly into the Students module where the gap actually lived — a guardian shows either "Portal account active" or an invite button (disabled with guidance if no email is on file); a student shows the same pattern on their Overview tab.

## Known, honest simplification

The student-portal invite button uses a plain browser `prompt()` for the email address rather than a proper form — every other invite flow in this codebase (`SignUpPage`, `EmployeesPage`) uses React Hook Form + Zod. This one cut a corner because the student record doesn't have its own email field (only guardians do) and building a small inline form felt like overkill for a single text input — but it's inconsistent with the rest of the project's standards and is a fair thing to clean up.
