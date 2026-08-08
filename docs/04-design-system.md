# Design System

Goal: feel like SAP Fiori / Dynamics 365 / Salesforce Lightning — dense, calm, fast — not a bright consumer-app aesthetic.

## 1. Design Tokens (CSS variables, theme-swappable)

All colors are defined as HSL CSS variables so dark mode is a variable swap, never a duplicated component:

```css
:root {
  /* Neutrals — the bulk of enterprise UI is neutral, not colorful */
  --bg-canvas: 0 0% 98%;
  --bg-surface: 0 0% 100%;
  --bg-surface-secondary: 220 14% 96%;
  --border-default: 220 13% 91%;
  --text-primary: 222 47% 11%;
  --text-secondary: 220 9% 46%;
  --text-tertiary: 220 9% 65%;

  /* Brand — overridden per-organization at runtime from organizations.primary_color */
  --brand-primary: 243 75% 59%;      /* indigo default */
  --brand-secondary: 199 89% 48%;    /* sky default */

  /* Semantic */
  --success: 142 71% 45%;
  --warning: 38 92% 50%;
  --danger: 0 84% 60%;
  --info: 199 89% 48%;

  /* Elevation */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.08);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08);

  /* Radius & spacing scale */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --space-unit: 4px;   /* everything is a multiple of 4 */
}

[data-theme="dark"] {
  --bg-canvas: 222 47% 8%;
  --bg-surface: 222 39% 11%;
  --bg-surface-secondary: 222 33% 15%;
  --border-default: 222 25% 20%;
  --text-primary: 210 40% 96%;
  --text-secondary: 215 20% 65%;
  --text-tertiary: 215 15% 45%;
}
```

`organizations.primary_color` / `secondary_color` are written into `--brand-primary`/`--brand-secondary` at runtime via an inline `<style>` tag injected by `core/theme/ThemeProvider.tsx` — this is how white-label branding works without rebuilding CSS per tenant.

## 2. Typography

- Font: **Inter** (system fallback stack: `-apple-system, Segoe UI, Roboto`), tabular numerals (`font-variant-numeric: tabular-nums`) on every numeric table cell and KPI so digits align.
- Scale: 12 / 13 / 14 / 16 / 20 / 24 / 32px. Body default is **13px**, not 16px — enterprise data-density expectation is smaller, denser type than marketing sites.
- Weight: 400 body, 500 for table headers/labels, 600 for KPI numbers and page titles. Never above 600 — no black weight anywhere.

## 3. Layout Shell

```
┌─────────────────────────────────────────────────────────┐
│ Workspace Header: logo | org/school switcher | global   │
│ search (⌘K) | notifications | theme toggle | user menu  │
├───────────┬───────────────────────────────────────────────┤
│           │ Breadcrumb: Students / Grade 10 / Section A   │
│ Sidebar   ├───────────────────────────────────────────────┤
│ (collapsible,│                                            │
│  grouped by │        Page content                         │
│  module,    │                                            │
│  permission-│                                            │
│  filtered)  │                                            │
└───────────┴───────────────────────────────────────────────┘
```

- **Sidebar** groups by module (Academics, Admissions, Finance, HR, Operations, Reports, Settings) with collapsible sections; items are filtered client-side by the current user's resolved permission set (never render a nav item to a link the RLS layer would reject).
- **Command palette** (⌘K / Ctrl+K) is global: fuzzy-searches routes, students, teachers, invoices by number, etc. — implemented once in `core/`, modules register searchable entities into it via a hook (`useRegisterCommandSource`).
- **Workspace header** always shows current Organization + School context with a switcher for multi-school orgs; every list/dashboard query is implicitly scoped to whatever is selected here.

## 4. Core Components (built once in `components/ui/`, phase 2 delivers the first real set)

| Component | Enterprise behavior it must support |
|---|---|
| `DataTable` | server-side pagination, column sort, column visibility toggle, row density toggle, sticky header, row selection + bulk actions toolbar, empty/loading/error states, CSV/Excel export |
| `KPIWidget` | value, delta vs. previous period, sparkline, click-through to filtered list |
| `Drawer` | slide-over for create/edit forms without leaving list context |
| `CommandPalette` | ⌘K, keyboard nav, grouped results |
| `FormField` wrappers | wraps React Hook Form + Zod error state, consistent label/hint/error layout |
| `StatusBadge` | consistent color-coded status pills (paid/unpaid, active/inactive, present/absent) driven by a shared status→color map, not ad hoc per module |
| `AuditTrailPanel` | reusable "view history" drawer for any record, reads `audit_logs` filtered by table+row id |
| `Chart*` wrappers | thin Recharts wrappers pre-themed to the token system (no per-chart color hardcoding) |

## 5. Motion

Enterprise, not playful: 150–200ms ease-out on hover/press states, 200–250ms for drawers/modals sliding in, no bouncing, no spring physics. Reduced-motion media query respected everywhere.

## 6. Accessibility baseline

- All interactive elements keyboard-reachable, visible focus ring using `--brand-primary`.
- Color is never the only signal (status badges pair color + icon + text label).
- Minimum contrast 4.5:1 for body text in both themes — token values above were chosen to satisfy this and will be verified with automated contrast checks in Phase 2 CI.
