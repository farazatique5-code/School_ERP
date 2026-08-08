# Phase 7 — Timetable

## What shipped

**Database** (`012_timetable.sql`)
- `periods` (a school's daily period structure), `timetable_entries`.
- **Conflict detection is a database guarantee**, not a UI-only check: `uq_no_teacher_double_booking` and `uq_no_room_double_booking` are real unique indexes — a teacher or room genuinely cannot be double-booked at the database layer, no matter what client hits the API.
- `fn_validate_timetable_teacher()` trigger: a teacher can only be scheduled for a class/subject they're actually assigned to via Phase 6's `teacher_assignments` — surfaced as a specific, actionable error, not a silent allowance.
- **Closed the Phase 5 scope note**: `student_attendance` now has a nullable `period_id` — null still means whole-day attendance (unchanged behavior), populated means period-level. The old `(student_id, attendance_date)` unique constraint was widened accordingly.

**Frontend** (`src/modules/timetable/`)
- Periods setup.
- Section timetable grid — click a cell, assign subject/teacher/room in a drawer. Subject options come from the class's actual `class_subjects` (Phase 1 schema), not a placeholder empty select. Conflict errors from the database policies above are mapped to specific messages ("This teacher is already scheduled elsewhere," "This room is already booked," "This teacher isn't assigned to this class/subject yet").
- My Timetable — a teacher's own read-only weekly schedule.

## Deliberately deferred within this phase

- **Automatic AI-driven timetable generation** is explicitly Phase 16's job per the original spec (AI Timetable Generator) — this phase builds the real data model and manual editor it will operate on top of, not a fake auto-generate button that doesn't actually optimize anything.
- **Room allocation as a first-class entity** (with capacity/type) is currently just a free-text `room_number` on each entry; promoting rooms to their own table with capacity checks is a reasonable Inventory-phase (11) or Timetable-v2 follow-up once real usage shows it's needed.
