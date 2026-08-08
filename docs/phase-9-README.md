# Phase 9 — Fees & Finance

## What shipped

**Database** (`016_fees_finance.sql`)
- `fee_categories`, `fee_structures` (per class, per year), `scholarships` + `student_scholarships`, `fee_plans` + `fee_plan_items`, `fee_invoices` + `fee_invoice_items`, `fee_payments`, `ledger_entries`.
- `generate_fee_plan()` — generates a student's fee plan from their class's fee structures, applying scholarship discounts. **This is the exact function now called from Phase 4's admission approval trigger**, closing the gap that phase explicitly left open.
- `fn_fee_payment_recorded()` trigger — the full PRD automation chain, end to end, no stubs: generates the receipt number, updates invoice status (pending → partial → paid based on cumulative payments), writes a real ledger entry, and notifies the guardian if reachable.
- `fn_apply_overdue_fines()` — a callable function (meant to be invoked on a schedule, e.g. via `pg_cron` or a daily Edge Function trigger) rather than a fixed trigger, because fine amount and grace period are org-specific policy, not a hardcoded constant.

**Closing the Phase 4 gap**: `fn_admission_approved()` is redefined in this migration to call `generate_fee_plan()` — the exact same trigger, same function name, same automation key, just no longer stubbed for that one step. Its `pending_steps` payload now only lists the parent-portal-account step (Phase 14).

**Frontend** (`src/modules/fees-finance/`)
- Fee Setup: categories, per-class fee structure, scholarships.
- Invoices: list (paginated/filterable by status), manual create with line items, detail page with payment recording (each payment call generates a real receipt and updates the invoice atomically via the trigger above).
- Financial Reports: monthly income/expense chart, net cash-flow trend, and a real cash book (ledger) view filterable by date range.

## Known, honest gaps

- **No payment gateway is wired** — `fee_payments.payment_method` includes `'online'` as a value, but there's no Stripe/Razorpay/etc. integration yet, matching the PRD's own "Out of Scope for now" note in `01-PRD.md` Section 7. `recordPayment` currently assumes a staff member is manually recording a payment received through any channel.
- **The invoice-creation form takes a raw student UUID** rather than a proper search-and-select picker — flagged directly in the form's own help text rather than hidden, and is a natural small follow-up once the Students module exposes a reusable picker component.
