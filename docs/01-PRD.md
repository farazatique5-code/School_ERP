# Product Requirements Document (PRD)
## Enterprise School ERP SaaS Platform

**Version:** 1.0 (Phase 1 baseline)
**Status:** Living document — updated at the end of every phase.

---

## 1. Product Vision

A multi-tenant, white-label, AI-augmented ERP platform for K-12 schools, colleges, and multi-campus education groups. Every operational department (admissions, academics, finance, HR, library, transport, hostel, inventory) runs on one shared data model so that an action in one module (e.g. "Admission Approved") automatically drives state changes in every dependent module (student record, fee plan, portal login, ID card) without manual re-entry.

The platform must feel and perform like SAP/Oracle/Dynamics/Salesforce-class enterprise software: dense information design used well, fast data tables, real dashboards backed by real queries (not static mockups), and configurable RBAC rather than hard-coded roles.

## 2. Tenancy Model

**Tenancy strategy: Shared database, shared schema, row-level isolation via RLS.**

Rationale: Supabase Postgres + RLS gives strong per-row isolation without the operational overhead of per-tenant databases or schemas. This scales to thousands of small/medium tenants (individual schools) cheaply. Large "education group" tenants (multiple campuses under one legal entity) are modeled as one `organizations` row with multiple `schools` rows underneath it — not as separate database tenants.

Hierarchy:
```
organizations (billing entity, white-label branding, subscription plan)
  └── schools (a physical or virtual campus/school under the org)
        └── academic_years
              └── terms
        └── classes → sections
```

Every tenant-scoped table carries an `organization_id` (and usually `school_id`). RLS policies key off `organization_id`/`school_id` matched against the requesting user's membership, enforced at the database layer so no application bug can leak cross-tenant data.

## 3. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Isolation | No tenant can read/write another tenant's rows under any circumstance, enforced by RLS, verified by automated tests per phase |
| Availability | Stateless frontend on Vercel edge/CDN; Supabase manages HA Postgres |
| Performance | Dashboard KPI queries < 300ms p95 via materialized views/indexes; list views paginated server-side, never full-table client fetch |
| Auditability | Every insert/update/delete on business tables writes an `audit_logs` row (actor, tenant, table, row id, diff, timestamp) |
| Extensibility | New modules must be addable as new schema + RLS + routes without modifying core auth/tenant tables |
| Accessibility | WCAG 2.1 AA on all forms and data tables |
| i18n | All user-facing strings resource-keyed from day one, even though only English ships in Phase 1–15 |
| Theming | Dark/light mode is a CSS-variable driven design token system, not a duplicated component set |

## 4. Roles (Phase 1 canonical list)

Super Admin, Organization Owner, School Administrator, Principal, Vice Principal, HR Manager, Accountant, Admission Officer, Teacher, Class Teacher, Examination Controller, Librarian, Hostel Manager, Transport Manager, Parent, Student.

Roles are **not hard-coded to features** — see `roles-permissions.md`. Role → Permission is a configurable many-to-many mapping stored in the database (`role_permissions`), editable by Organization Owner/Super Admin from Settings → Roles. Shipped roles above are seed data, not enum constraints, so a school can create custom roles later without a schema migration.

## 5. Module Inventory & Phase Mapping

| # | Module | Phase | Depends on |
|---|---|---|---|
| 1 | Multi-tenant foundation, Auth, Org/School setup | 2 | Phase 1 schema |
| 2 | Dashboard (KPIs, charts, activity feed) | 2 | Auth, and read-access to all module tables as they land |
| 3 | Student Information System | 3 | Org/School, Classes/Sections |
| 4 | Admissions | 4 | SIS (creates Student rows), Fees (creates Fee Plan) |
| 5 | Attendance | 5 | SIS, Timetable (for period-based attendance) |
| 6 | Teachers & HR | 6 | Org/School |
| 7 | Timetable | 7 | Teachers, Classes/Sections, Subjects |
| 8 | Examination | 8 | SIS, Subjects, Timetable |
| 9 | Fees & Finance | 9 | SIS, Admissions |
| 10 | Library | 10 | SIS, Teachers (as members) |
| 11 | Inventory | 11 | Org/School (standalone-ish) |
| 12 | Hostel | 12 | SIS |
| 13 | Transport | 13 | SIS |
| 14 | Parent & Student Portals | 14 | All of the above (read + limited write) |
| 15 | Reports & Analytics | 15 | All of the above |
| 16 | AI Copilot + AI features | 16 | All of the above |

This ordering is intentional: modules are sequenced so that each phase's foreign keys always point at tables that already exist.

## 6. Automation Rules (contract, implemented progressively)

Automations are implemented as Postgres functions + triggers (not flaky client-side chains), so they fire regardless of which client (web, mobile, API) performs the triggering action. Each automation is logged to `automation_runs` for observability.

- `admission_approved` → creates `students` row, `guardians` link, `fee_plans` row, invites parent auth user, generates `student_code`.
- `fee_payment_recorded` → generates receipt row, updates `fee_invoices.status`, writes ledger entry, queues parent notification.
- `attendance_marked_absent` → queues parent notification, increments `attendance_stats` rollup.
- `exam_result_published` → computes grade from `grading_scales`, recomputes class rank, queues parent notification.
- `student_promoted` → new `student_enrollments` row for next `academic_year`, archives current enrollment, regenerates fee plan.

Each of these ships in the phase that owns its trigger table, wired against tables that exist at that point (e.g. `fee_payment_recorded` ships in Phase 9, but its notification hook is a no-op stub interface until Phase 16 fills in real AI-driven copy — never a fake/placeholder feature, just a real, working, simple template-based notification that AI enhances later).

## 7. Out of Scope for now (explicitly deferred, not abandoned)

- Native mobile binaries (iOS/Android) — Phase 14 ships mobile-responsive PWA-grade web portals first; a native app wrapper is a post-Phase-16 initiative.
- Payment gateway-specific integrations (Stripe/Razorpay/etc.) — Phase 9 ships the finance data model and a pluggable `payment_providers` interface; wiring a specific gateway is a configuration step per deployment.
- Biometric/RFID hardware SDKs — Phase 5 ships the attendance data model and an ingestion API that hardware integrators call; we do not ship device drivers.

## 8. Definition of Done (applies to every phase)

A phase is not complete until it has: migration SQL (tables + indexes + RLS policies), TypeScript types generated from the schema, TanStack Query hooks, Zod validation schemas shared between forms and API boundaries, React Hook Form-driven forms, list/detail pages with server-side pagination/sort/filter, at least one automation trigger if the module has one per Section 6, audit logging wired, and a short module README.
