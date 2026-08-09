# Phase 16 — AI Copilot & AI Features (final phase)

## Read this first: what's genuinely AI here, and what isn't

The original spec listed 16 "AI ___" features. Building 16 separate systems and labeling all of them "AI" would mean either faking most of them or stretching the term past what it means. Instead, every feature below is one of exactly three honest categories:

| Category | What it means | Features in this category |
|---|---|---|
| **Real LLM call** | An actual request to the Anthropic API, from a server-side Edge Function, with a real API key | AI Copilot, AI Report Card Comments, AI Exam Generator, AI Document Processing |
| **Real statistics, not ML** | A transparent, explainable formula — computed in SQL, auditable, not a trained model | Student Risk Scoring ("AI Student Performance Prediction"), Attendance Intelligence (Phase 5's low-attendance report), Fee Collection Intelligence (Phase 9's financial reports) |
| **Explicitly not built, and why** | A feature that would require infrastructure this project doesn't have, stated plainly rather than faked | AI Timetable Generator (see below) |

## What shipped

**Database** (`029_ai_features.sql`)
- `ai_copilot_logs` — every question asked and answered, audit-visible to the asker and to admins.
- `exam_report_comments` — AI-drafted comments are **always saved unpublished**; a teacher must explicitly review, edit, and publish. Never auto-published.
- `fn_student_risk_scores()` — a documented-in-the-function-itself weighted composite (40% attendance + 60% exam average). Explicitly commented as NOT a trained model, because it isn't one.

**Edge Functions** (four, all requiring the `ANTHROPIC_API_KEY` secret — see root README):
- `ai-copilot-query` — the AI Copilot. **Deliberately does not use the service role.** It runs every database query with the *caller's own forwarded JWT*, so RLS applies exactly as if the person queried directly — the Copilot can never surface data the asking user couldn't already see. It builds a small, keyword-routed context of real aggregates (never a raw row dump) and instructs the model to answer only from that context, saying plainly when it can't.
- `ai-generate-report-comments` — drafts a report card comment from a student's actual marks.
- `ai-generate-exam-questions` — generates real exam questions into the existing question bank, with strict JSON-only output parsing.
- `ai-extract-document` — a genuine vision-model call for admission document field extraction. Returns extracted fields as a **suggestion only**, with an explicit "review before saving" disclaimer — OCR/vision extraction on real-world scans is not reliable enough to auto-fill a student record unsupervised.

**Frontend** (`src/modules/ai-copilot/`)
- A floating Copilot widget, mounted globally in the admin layout, permission-gated (`ai.copilot_use`, granted to every role by default since its answers are already scoped by the asker's own visibility).
- Report comment editor, embedded directly in the Report Card page — staff see a "Draft with AI" button and an editable textarea; portal viewers (parents/students) see only the published, human-approved text.
- Exam question generator, embedded in the Question Bank page.
- Student Risk Scores page — its own page copy states plainly what the formula is, right at the top, before showing any numbers.
- AI Document Scanner — a standalone page rather than wired silently into the admissions upload flow, so the "this is a suggestion, verify it" framing is unmissable.

## The one feature explicitly NOT built: AI Timetable Generator

Automatically generating a conflict-free timetable is a **constraint satisfaction problem** — the right tool is a real solver (backtracking, constraint propagation, or an ILP solver), not a language model. LLMs are unreliable at hard constraint satisfaction at scale (teacher availability × room capacity × subject requirements × break rules, all simultaneously) and will confidently produce timetables with conflicts that Phase 7's own database-level unique indexes would then reject. Claiming an LLM call "generates an optimized timetable" here would be the same category of dishonesty this project has avoided everywhere else. What Phase 7 actually built — a manual editor with real, database-enforced conflict prevention — is the correct foundation for a future real CSP solver to sit on top of; that solver is a distinct engineering project, not a prompt.

## What this means for you, testing this project

1. Every Edge Function in this phase needs `ANTHROPIC_API_KEY` set (see root README's new step 4) or it will return a clear `501 not_configured` error — not a silent failure, not a fake response.
2. The Copilot's context-building logic in `ai-copilot-query/index.ts` is keyword-routed and intentionally simple — it recognizes questions about students, attendance, fees, exams, and HR. Questions outside those topics fall back to a general snapshot. Expanding it is additive (more `if` branches, more aggregate queries), not a redesign.
3. If you want to verify the "RLS still applies to the Copilot" claim: ask it a question as a Teacher scoped to one section, and compare the answer to what a School Administrator gets for the same question — the Teacher's context-building queries run under their own restricted RLS visibility, so section-scoped data differs correctly.
