# Phase 3 — Student Information System

## What shipped

**Database** (`supabase/migrations/004_students.sql`)
- `students`, `student_enrollments` (year-over-year history, not overwritten), `guardians` + `student_guardians` (many-to-many, one enforced primary contact per student), `student_medical_records` (separately permissioned — `students.view_medical`, distinct from `students.view`), `student_documents`, `student_discipline_records` (separately permissioned — `students.view_discipline`), `student_achievements`, `student_transfers`.
- `generate_student_code()` — atomic, race-safe student code generation (`{school_code}-{year}-{seq}`).
- Full RLS on every table, audit triggers on the mutable ones, new permission keys granted to the appropriate seed roles.

**Academics module** (`src/modules/academics/`) — an unplanned but necessary addition: Students can't be created without classes/sections to enroll into, and only the schema for those existed before this phase. Added the Academic Setup page (create academic years, classes, sections) so Students has something real to point at.

**Students module** (`src/modules/students/`)
- List page: server-side pagination, search (name/code), status filter.
- Create form: pulls real classes/sections from Academics, generates the student code server-side, creates the enrollment atomically with the student (rolls back the student row if enrollment fails).
- Detail page: tabbed (Overview, Guardians, Medical, Discipline, Achievements, Documents) — Medical and Discipline tabs only render for users holding those specific permissions, not just `students.view`.

## Contract for Phase 4 (Admissions)

Admissions' "approved → create student" automation should call the same `createStudent` + enrollment pattern already in `modules/students/api/mutations.ts` rather than duplicating it — the natural refactor is lifting that logic into a shared Postgres function (mirroring how `provision_organization` works) once Admissions needs it too, so both flows can't drift apart.
