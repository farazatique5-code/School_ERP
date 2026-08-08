# Phase 8 — Examination

## What shipped

**Database** (`014_examinations.sql`)
- `exams`, `exam_schedules` (per class/subject: date, max/passing marks, room), `question_bank_questions`, `student_marks`, `exam_rankings`.
- `fn_exam_published()` trigger — the real "Exam Published" automation from your original spec: calculates every student's grade from the exam's grading scale, computes per-section rankings (window-free, done with an explicit ranking loop for clarity and auditability), and notifies guardians with an existing portal account — logging exactly how many were and weren't reachable, same honest pattern as Phases 5 and 8's neighbors.
- Marks-entry RLS: a Teacher can only enter marks for schedules matching their own `teacher_assignments` (subject + class) — `exams.manage_all_marks` is the explicit admin-tier bypass, not an accidental gap.

**Frontend** (`src/modules/examinations/`)
- Exams list + create.
- Exam detail: schedule class/subjects (subject options come from real `class_subjects`), status workflow (draft → scheduled → ongoing → completed → **publish**, with a real confirmation of consequence on publish).
- Marks entry: roster grid per exam schedule, absent toggle, bulk save.
- Question Bank: MCQ/short/long answer, difficulty, Bloom's taxonomy level — the real data model the AI Exam Generator (Phase 16) will read from and write to, not a placeholder table.
- Rankings (per section) and a live Report Card view — explicitly the real data source that Phase 15's PDF export will render, not a stand-in to be thrown away later.

## Deliberately deferred within this phase

- **PDF export of result cards / transcripts** is Phase 15's job (Reports & Analytics) — this phase's Report Card page is the live view that export renders, so Phase 15 has real data to point a PDF generator at instead of inventing the query.
- **AI-generated question papers and auto-marking of MCQs** — Phase 16 (AI Exam Generator). The question bank's structure (options, correct_answer, marks, Bloom level) is deliberately shaped now so that automation has clean data to consume later.
