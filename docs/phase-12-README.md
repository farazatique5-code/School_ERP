# Phase 12 — Hostel

## What shipped

**Database** (`022_hostel.sql`)
- `hostel_buildings` → `hostel_rooms` → `hostel_beds` → `hostel_allocations`, mirroring the same real hierarchy used everywhere else in this project (organizations → schools → classes → sections).
- `fn_allocate_bed()` / `fn_vacate_bed()` — row-locked atomic functions, same pattern as Library's issue/return in Phase 10: a bed's `status` column and its allocation record can never drift apart from a partial write.
- Two unique partial indexes make double-booking structurally impossible: a bed can't have two active allocations, and a student can't hold two active allocations at once (across any building).
- `hostel_visitors`, `mess_menus`, `hostel_attendance` (a separate evening roll call from Phase 5's academic attendance, since hostel check happens outside class hours and against a different roster — students in the hostel that night, not students in a class that period).

**Frontend** (`src/modules/hostel/`)
- Buildings overview with real occupancy counts (occupied/total beds).
- Building detail: room/bed grid, allocate/vacate directly from the bed chip.
- Visitors log with check-in/check-out.
- Mess Menu: a weekly grid, editable per day/meal-slot.

## Known, honest gaps

- **The bed allocation and visitor-logging forms take raw student UUIDs**, the same pattern (and the same acknowledged gap) as Phases 9, 10, and 11 — a proper student search-and-select component is overdue as a shared piece across all four modules rather than something to build four separate times.
- **`hostel_attendance` has no dedicated UI yet** in this phase — the table and RLS exist, but the roll-call entry page is a natural next increment, likely reusing the same roster-grid pattern from Phase 5's `MarkAttendancePage`.
