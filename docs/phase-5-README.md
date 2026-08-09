# Phase 5 — Attendance

## What shipped

**Database** (`008_attendance.sql`)
- `student_attendance` (one row per student per day — see scope note below), `teacher_attendance`, `attendance_daily_stats` (trigger-maintained rollup per section per day, so reports never scan raw rows).
- `fn_student_attendance_written()` trigger: recomputes stats immediately on every mark/edit, and on a fresh absence, writes a real in-app notification to the primary guardian **if their portal account already exists** — otherwise it logs why it didn't (no guardian profile yet), rather than silently doing nothing or pretending to send an SMS that has no gateway behind it yet.
- New permissions: `attendance.view`, `attendance.mark`, `attendance.view_staff`, `attendance.mark_staff` — staff attendance is permission-separated from student attendance since HR Manager needs the former without necessarily needing the latter.

**Scope note — read this before Phase 7**: this is **daily** attendance (one status per student per day), not period-by-period, because Timetable (Phase 7) — which defines what a "period" even is — doesn't exist yet. When Phase 7 ships, extend `student_attendance` with a nullable `period_id` rather than building a second parallel table.

**Frontend** (`src/modules/attendance/`)
- Mark Attendance: pick class → section → date, roster loads with any already-saved statuses pre-filled (re-opening a marked date edits in place, via upsert on the `(student_id, attendance_date)` constraint), "mark all present" shortcut, radio-button grid.
- Attendance Reports: stacked bar chart of a section's daily present/late/absent/excused counts over a date range, plus a **students-below-threshold** report — this is the real, directly queryable version of "Show students with attendance below 75%" from your original AI Copilot spec (Phase 16), built now as an actual report so Phase 16 has something real to wrap in natural language later instead of inventing the query from scratch.

## Known, documented gap

RLS currently scopes attendance marking at the **school** level (`attendance.mark`), not per-teacher-per-section — because teacher-to-section assignments don't exist until Phase 6/7. This mirrors the same gap already flagged in Phase 3's student RLS. Tighten both together once Phase 7 lands.
