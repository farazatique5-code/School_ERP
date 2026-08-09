# Phase 6 — Teachers & HR

## What shipped

**Database** (`010_teachers_hr.sql`)
- `employees` (1:1 with a profile — staff get real portal logins immediately, unlike guardians/students), `employee_qualifications`, `employee_experience`, `employee_contracts`, `employee_documents`.
- **`teacher_assignments`** — the table Phase 3 and Phase 5 both explicitly flagged as missing. Their RLS policies are now tightened in this same migration: `students_select` and `student_attendance_write` scope Teachers/Class Teachers to only the sections they're actually assigned to (admin-tier roles keep school-wide access via the new `students.view_all_sections` / `attendance.mark_all_sections` permissions).
- `leave_types`, `employee_leave_requests` (apply/approve workflow).
- `salary_structures`, `salary_slips` — a real, simple net-pay computation (basic + allowances − deductions). Statutory tax tables and multi-currency rules are genuinely jurisdiction-specific and are called out as a deliberate follow-up rather than a fake universal formula.

**Edge Function** (`supabase/functions/invite-employee`) — third and last service-role use so far, following the exact `provision-organization` pattern: verifies the caller actually holds `hr.manage` (checked against the same RLS-backing function the rest of the app uses, so this can't be used to bypass permissions), invites the auth user, then calls `provision_employee()` to create the profile + employee row atomically, rolling back the auth user on failure.

**Frontend** (`src/modules/teachers-hr/`)
- Employees list + invite drawer.
- Employee detail (tabs: Overview, Assignments, Leave, Payroll — Payroll tab only renders for `payroll.manage` holders, Documents).
- Class/subject assignment management, including the class-teacher-per-section uniqueness constraint surfaced as a clear error, not a generic one.
- Leave Management page: self-service apply (visible to everyone) + an HR approval queue (visible only to `hr.manage` holders) on the same page.
- Salary structure editor + slip generation with a real computed net pay.

## Known, honest gap

The Employee Detail page's "Leave" tab is currently a stub pointing at the full Leave Management page rather than a real embedded history — noted in the component itself rather than silently left blank. Wire it to reuse `getMyLeaveRequests`-style query scoped by employee ID as a small follow-up.
