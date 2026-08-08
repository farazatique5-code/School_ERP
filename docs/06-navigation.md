# Navigation Architecture

## Sidebar structure (grouped by module, permission-filtered per user)

```
🏠 Dashboard                              (dashboard.view)

📚 Academics
  ├─ Students                             (students.view)         [Phase 3]
  ├─ Admissions                           (admissions.manage)     [Phase 4]
  ├─ Attendance                           (attendance.view)       [Phase 5]
  ├─ Timetable                            (timetable.manage)      [Phase 7]
  ├─ Examinations                         (exams.manage)          [Phase 8]
  └─ Learning Management                  (lms.view)              [Phase 8/16]

👥 People
  ├─ Teachers & Staff                     (hr.manage)             [Phase 6]
  ├─ HR & Payroll                         (payroll.manage)        [Phase 6]
  └─ Parents & Guardians                  (students.view)         [Phase 3]

💰 Finance
  ├─ Fees & Invoices                      (fees.manage)           [Phase 9]
  ├─ Accounting / Ledger                  (fees.view_reports)     [Phase 9]
  └─ Financial Reports                    (reports.export)        [Phase 9/15]

🏢 Operations
  ├─ Library                              (library.manage)        [Phase 10]
  ├─ Inventory & Assets                   (inventory.manage)      [Phase 11]
  ├─ Hostel                               (hostel.manage)         [Phase 12]
  └─ Transport                            (transport.manage)      [Phase 13]

📊 Reports & Analytics                    (reports.export)        [Phase 15]

🤖 AI Copilot                             (ai.copilot_use)        [Phase 16]

⚙️ Settings
  ├─ Organization & Branding              (organization.update)
  ├─ Schools / Campuses                   (schools.manage)
  ├─ Academic Setup                       (academics.manage)
  ├─ Roles & Permissions                  (roles.manage)
  ├─ Users                                (users.manage)
  ├─ Audit Logs                           (audit_logs.view)
  └─ Automation History                   (automation.view)
```

## Portal navigation (Phase 14) — structurally separate shell

Parents/Students get a distinct, simplified shell (not the admin sidebar with everything hidden) — different information architecture, mobile-first:

```
Home | My Child(ren) / My Profile | Attendance | Fees | Homework | Exams | Timetable | Notices | Chat
```

## Global elements present on every screen regardless of role

- **Breadcrumb**: derived automatically from the route tree (`app/routes/`), never hand-written per page.
- **Global search (⌘K)**: modules register searchable entity types; results are permission-filtered by the same RLS the direct queries use (search never leaks a record a direct link wouldn't show).
- **Notification bell**: reads `notifications` table, realtime-subscribed via Supabase Realtime.
- **Org/School switcher**: only rendered if the user's `user_roles` span more than one school; changes the active scope used by every query on screen.

## Routing conventions

```
/                              → dashboard
/students                      → student list
/students/:id                  → student profile (tabs: overview, academic, attendance, fees, documents)
/admissions/applications        → admissions pipeline (kanban + table toggle)
/admissions/applications/:id    → application detail/review
/settings/roles                 → role & permission matrix editor
/portal/*                       → separate route tree, separate layout, mounted only for Parent/Student roles
```

Route guards live in `app/router.tsx` as a `<RequirePermission perm="...">` wrapper per route — a route with no matching permission renders a 403 page, never a silent redirect that hides *why* access was denied.
