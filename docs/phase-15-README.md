# Phase 15 — Reports & Analytics

## What shipped

**Real export utilities** (`src/lib/export.ts`) — genuinely working, not stubs:
- `exportToCsv` — proper RFC 4180 quoting, not a naive `.join(',')`.
- `exportToExcel` — real `.xlsx` via SheetJS (`xlsx` package, added to `package.json`), opens correctly in Excel/Sheets/Numbers.
- `exportToPdf` / `exportDocumentToPdf` — real PDF generation via `jspdf` + `jspdf-autotable`.

**Closing two explicit promises**: Phase 8's Report Card page and Phase 9's Invoice detail page both said "PDF export ships in Phase 15" — both now have a real, working **Download PDF** button, generating an actual document client-side, not a "coming soon" message.

**`ExportMenu`** (`src/components/ui/ExportMenu.tsx`) — one shared component, CSV/Excel/PDF, dropped into the Students list as the first adopter; any other list page can add the same three lines.

**Reports Hub** (`src/modules/reports/`) — the "Custom Report Builder" from the PRD, built the responsible way. A generic ad-hoc SQL/query builder exposed to end users would be a real security hole against RLS-protected tables (a knowledgeable user could construct queries that walk data they shouldn't reach, or at minimum hammer the database with unbounded queries). Instead: **8 pre-registered report definitions** across Academics, Attendance, Finance, Examination, HR, Inventory, Library, and Transport — each a specific, reviewed query, still executed as the signed-in user so RLS fully applies, with date-range filters where relevant and full CSV/Excel/PDF export. Explained plainly in the page's own copy, not silently narrower than what was asked for.

**Dashboard Analytics enhancement** — the Phase 2 dashboard only had schools/users/roles/notifications because no other module existed yet. Now that Students and Fees are real, added **Active Students** and **Fee Collected This Month** as genuine KPIs (the latter reads real `ledger_entries` rows tagged `Fee Collection`, so it's the exact same number Financial Reports shows, not a separately-computed estimate).

## Deliberately out of scope

A full drag-and-drop report designer (arbitrary column/filter/grouping selection across arbitrary joins) is a materially larger project than "add export buttons" — the 8-report registry is extensible (adding report #9 is copy-paste-and-adjust-the-query, documented inline in `reportDefinitions.ts`) but isn't the same thing as a true ad-hoc builder. If usage shows a specific missing report, the fix is a 15-line addition to that file, not a redesign.
