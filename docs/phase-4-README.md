# Phase 4 — Admissions

## What shipped

**Database** (`006_admissions.sql`)
- `admission_applications`, `admission_interviews`, `admission_documents`.
- `generate_application_number()` — same atomic pattern as Phase 3's student code generator.
- **`admit_and_enroll_student()`** — the refactor promised in the Phase 3 README: Phase 3's client-side "create student, then enrollment, roll back on failure" logic is now one atomic Postgres function. Both Students (create form) and Admissions (approval trigger) should be pointed at this — Students' client-side version still works but is now the secondary path; consider it deprecated once you touch that code again.
- **`fn_admission_approved()` trigger** — fires when `status` flips to `approved`: picks the first available section in the applied-for class, calls `admit_and_enroll_student()`, writes `converted_student_id` back, and logs an `automation_runs` row that explicitly lists `fee_plan_creation` and `parent_portal_account_creation` as **pending steps** rather than silently skipping them or faking them.
- A dedicated `admissions.approve` permission, separate from `admissions.manage` — editing an application's fields and converting it into a real student record are different levels of consequence.

**Frontend** (`src/modules/admissions/`)
- Pipeline board (kanban-style, per `docs/06-navigation.md`) + list-view toggle, both backed by real paginated/filtered queries — the pipeline counts are a real aggregate query, not a client-side count over one page.
- New application intake form.
- Application detail page: move-to-review, schedule interview (auto-advances the pipeline stage so they can't drift apart), approve (with a real confirmation of consequence — "this creates a student record immediately"), reject with a required reason.

## Known gap, intentionally not hidden

If you approve an application for a class with **no sections created yet**, the trigger raises `no_section_available` and the mutation surfaces it as a clear, actionable error message — not a generic failure. This is a deliberate design choice (fail loudly, don't guess a section) rather than a bug to silently work around.

## Contract for Phase 9 (Fees) and Phase 14 (Portals)

When those phases land, go back to `fn_admission_approved()` in `006_admissions.sql` and extend it to actually create the fee plan and portal account — the `automation_runs.payload.pending_steps` array is there specifically so you can grep for "pending_steps" across migrations and know exactly which automations have unfinished obligations from earlier phases.
