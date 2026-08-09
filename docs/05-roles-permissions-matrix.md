# Roles & Permission Matrix

Permissions are stored as rows in `permissions` (see schema) and granted to roles via `role_permissions`. This document is the seed mapping loaded for every new organization; Organization Owners can edit it per-org from Settings → Roles without any code change, because the mapping lives in data, not in code.

Legend: ✅ granted by default seed · — not granted by default (can be added per-org)

Permission keys below use the `module.action` convention established in Phase 1 schema; modules not yet built (Students, Fees, etc.) will add their own keys in their own phase, following the same convention, and this matrix will be extended with new columns — never restructured.

| Permission key | Super Admin | Org Owner | School Admin | Principal | VP | HR Mgr | Accountant | Admission Officer | Teacher | Class Teacher | Exam Controller | Librarian | Hostel Mgr | Transport Mgr | Parent | Student |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| organization.update | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| schools.manage | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — | — | — |
| academics.manage | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| roles.manage | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — | — | — |
| users.manage | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — | — | — | — | — | — | — | — |
| audit_logs.view | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — | — |
| automation.view | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — | — | — | — |
| dashboard.view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Future phase keys will slot into this table in this pattern (illustrative — actual keys ship with their phase):

| Planned key | Owner phase | Default grantees |
|---|---|---|
| students.view / students.create / students.update / students.delete | Phase 3 | Admin roles + Class Teacher (view/update own class), Teacher (view own class) |
| admissions.manage / admissions.approve | Phase 4 | School Admin, Principal, Admission Officer |
| attendance.mark / attendance.view | Phase 5 | Teacher, Class Teacher (mark); most roles (view, scoped) |
| hr.manage / payroll.manage | Phase 6 | HR Manager, School Admin |
| timetable.manage | Phase 7 | School Admin, Principal, VP |
| exams.manage / exams.publish_results | Phase 8 | Examination Controller, Principal |
| fees.manage / fees.collect / fees.view_reports | Phase 9 | Accountant, School Admin |
| library.manage | Phase 10 | Librarian |
| inventory.manage | Phase 11 | School Admin, HR Manager |
| hostel.manage | Phase 12 | Hostel Manager |
| transport.manage | Phase 13 | Transport Manager |
| portal.parent_access / portal.student_access | Phase 14 | Parent, Student (own-record-only via RLS, not just UI hiding) |
| reports.export | Phase 15 | Admin-tier roles + module-owner roles |
| ai.copilot_use | Phase 16 | All roles, response content itself is permission-filtered per query |

## Design rule this enforces

**Permission checks always happen at two layers**: RLS at the database (the real security boundary) and `auth_has_permission()` / `<RequirePermission>` in the UI (for good UX — hiding buttons/nav a user can't use). The UI check is a convenience, never the security boundary; every table's RLS policy is what actually prevents unauthorized access, which is why Phase 1 shipped `auth_has_permission()` as a database function rather than only a frontend utility.
