# Phase 10 — Library

## What shipped

**Database** (`018_library.sql`)
- `library_books` (catalog record) split from `library_book_copies` (individual barcoded physical items) — so "how many copies exist and where" is a real, queryable inventory fact, not a derived guess from a single count column.
- `library_issues` — borrower is a student OR an employee via a check constraint (`exactly one of student_id/employee_profile_id is set`), so staff and students share one circulation system instead of two parallel ones.
- `fn_issue_book()` / `fn_return_book()` — atomic functions (row-locked with `for update`) so a copy's status and its issue record can never drift out of sync from a partial client-side failure. Note: I initially wrote a buggy first draft of `fn_issue_book` (wrong column mapping for `organization_id`) and caught it before shipping — the corrected version is what's in the migration; I'm calling this out rather than quietly fixing it, since that's the honest thing to do.
- A unique index (`uq_one_active_issue_per_copy`) makes "double-issuing the same physical copy" a database-level impossibility, not just a UI check.

**Frontend** (`src/modules/library/`)
- Catalog: search, add book (auto-generates N barcoded copies).
- Book detail: per-copy status, pending reservations.
- Circulation: barcode lookup → issue, and a live active-loans list with one-click return (fine computed from days overdue × a per-day rate).

## Known, honest gaps

- **Fine collection isn't wired into Fees & Finance (Phase 9) yet** — `library_issues.fine_amount`/`fine_paid` exist, but nothing yet creates a `fee_invoice` or `ledger_entries` row from a library fine. That's a natural, small follow-up once you decide whether library fines should flow through the same invoice system as tuition or stay separate.
- **The issue form takes raw borrower UUIDs**, same honest gap as Phase 9's invoice form — a proper student/staff picker component is worth building once and reusing across both.
- **RFID/biometric scanning** (mentioned in the original PRD) — the barcode field and lookup flow here is the real integration point; a physical scanner just needs to type the barcode into that same field (most USB/Bluetooth barcode and RFID readers emulate a keyboard), so no separate hardware-specific code path was needed.
