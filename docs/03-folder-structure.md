# Folder Architecture

Feature-based, not type-based — each business module owns its own components/hooks/schemas so modules can be built, tested, and reasoned about independently while sharing a common core.

```
school-erp/
├── apps/
│   └── web/                          # the Vite React app
│       ├── src/
│       │   ├── app/                  # app shell: router, providers, layout
│       │   │   ├── router.tsx
│       │   │   ├── providers.tsx     # QueryClientProvider, ThemeProvider, AuthProvider
│       │   │   ├── AppLayout.tsx     # sidebar + header + breadcrumb shell
│       │   │   └── routes/           # route-level page components, one per URL
│       │   │
│       │   ├── core/                 # cross-cutting, module-agnostic code
│       │   │   ├── auth/             # session, current user, current org/school context
│       │   │   ├── rbac/             # usePermission(), <RequirePermission>, permission cache
│       │   │   ├── supabase/         # supabase client, generated database.types.ts
│       │   │   ├── theme/            # design tokens, dark/light mode provider
│       │   │   ├── audit/            # audit log viewer widgets (shared)
│       │   │   ├── notifications/    # notification bell, toast system
│       │   │   └── query/            # queryClient config, shared query key factories
│       │   │
│       │   ├── modules/               # ONE FOLDER PER BUSINESS MODULE (matches PRD phases)
│       │   │   ├── organizations/     # Phase 2
│       │   │   ├── dashboard/         # Phase 2
│       │   │   ├── students/          # Phase 3
│       │   │   ├── admissions/        # Phase 4
│       │   │   ├── attendance/        # Phase 5
│       │   │   ├── teachers-hr/       # Phase 6
│       │   │   ├── timetable/         # Phase 7
│       │   │   ├── examinations/      # Phase 8
│       │   │   ├── fees-finance/      # Phase 9
│       │   │   ├── library/           # Phase 10
│       │   │   ├── inventory/         # Phase 11
│       │   │   ├── hostel/            # Phase 12
│       │   │   ├── transport/         # Phase 13
│       │   │   ├── portals/           # Phase 14 (parent/student views)
│       │   │   ├── reports/           # Phase 15
│       │   │   ├── ai-copilot/        # Phase 16
│       │   │   │
│       │   │   └── <each module folder looks like>/
│       │   │       ├── api/           # supabase queries/mutations for this module only
│       │   │       ├── hooks/         # useStudents(), useCreateStudent(), etc. (TanStack Query)
│       │   │       ├── schemas/       # zod schemas — shared by forms AND api layer
│       │   │       ├── components/    # module-local UI (tables, cards, drawers)
│       │   │       ├── pages/         # route-mounted page components
│       │   │       ├── types.ts       # module-local TS types (derived from database.types.ts)
│       │   │       └── README.md      # module purpose, entities, automations owned
│       │   │
│       │   ├── components/ui/        # shared design-system primitives (Button, Table, DataGrid,
│       │   │                         # Card, KPIWidget, CommandPalette, Drawer, DatePicker...)
│       │   │                         # these are the ONLY place Tailwind utility soup lives;
│       │   │                         # everywhere else uses these components.
│       │   │
│       │   ├── lib/                  # framework-agnostic utilities (formatting, date math)
│       │   └── main.tsx
│       │
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       └── package.json
│
├── supabase/
│   ├── migrations/                   # 001_core_foundation.sql, 002_org_school.sql, ... numbered, append-only
│   ├── seed.sql                      # permission catalog + system role templates
│   └── config.toml
│
├── docs/                             # PRD, ER diagrams, design system, per-phase notes
│   └── phases/
│       ├── phase-1/
│       ├── phase-2/
│       └── ...
│
└── e2e/                              # Playwright tests, one spec folder per module
```

## Rules this structure enforces

- **A module never imports another module's `components/` or `hooks/` directly.** Cross-module data needs go through a published hook in that module's `api/index.ts` barrel, or through `core/` shared state (current org/school/user). This is what keeps 19 modules from turning into a tangled ball.
- **`components/ui/` is the only place enterprise look-and-feel lives.** Every module's table is a `<DataTable>` from `components/ui`, configured with columns — not a hand-rolled `<table>`. This is how we get SAP/Dynamics-style visual consistency across 19+ modules without 19 slightly different table implementations.
- **`database.types.ts` is generated, never hand-edited** (`supabase gen types typescript`), and is the single source of truth every module's `types.ts` narrows from.
- **Route files in `app/routes/` are thin** — they just compose a module's page component inside the layout and resolve route params; real logic lives in the module.
