# School ERP — Deployment Model: GitHub + Supabase + Vercel

## Project status: all 16 phases complete

| Phase | Status | README |
|---|---|---|
| 1. Foundation | ✅ | `docs/01-PRD.md` through `07-api-architecture.md` |
| 2. Auth, Org Setup, Dashboard | ✅ | `docs/phase-2-README.md` |
| 3. Student Information System | ✅ | `docs/phase-3-README.md` |
| 4. Admissions | ✅ | `docs/phase-4-README.md` |
| 5. Attendance | ✅ | `docs/phase-5-README.md` |
| 6. Teachers & HR | ✅ | `docs/phase-6-README.md` |
| 7. Timetable | ✅ | `docs/phase-7-README.md` |
| 8. Examination | ✅ | `docs/phase-8-README.md` |
| 9. Fees & Finance | ✅ | `docs/phase-9-README.md` |
| 10. Library | ✅ | `docs/phase-10-README.md` |
| 11. Inventory | ✅ | `docs/phase-11-README.md` |
| 12. Hostel | ✅ | `docs/phase-12-README.md` |
| 13. Transport | ✅ | `docs/phase-13-README.md` |
| 14. Parent & Student Portals | ✅ | `docs/phase-14-README.md` |
| 15. Reports & Analytics | ✅ | `docs/phase-15-README.md` |
| 16. AI Copilot & AI Features | ✅ | `docs/phase-16-README.md` |

**Read each phase's README before touching that module** — every one documents real decisions made, known gaps left honestly unfixed (or fixed later and noted), and what the next phase can rely on existing. A few threads worth knowing about before you start testing:

- **Phase 13's PersonPicker retrofit**: a shared searchable student/staff picker replaced raw-UUID inputs across five modules (Fees, Library, Hostel, Transport) — if you find a form that still asks for a pasted UUID, that's a page this retrofit missed, not intended behavior.
- **Phase 14's honest limit**: parent/student portal *account creation* needs a staff-clicked "Invite to portal" button (in the Students module) — it can never be a database trigger, because creating a login requires the Supabase Admin API, which only runs server-side.
- **Phase 16's honest scoping**: the AI Timetable Generator from the original spec was not built — automatic conflict-free scheduling is a constraint-satisfaction problem, not a language-model task, and faking it would produce timetables that Phase 7's own database constraints would then reject. See `docs/phase-16-README.md` for the full reasoning.
- **No payment gateway is wired** (Phase 9) — fee collection is staff-recorded, matching the PRD's own "out of scope for now" note.

This repo is built for exactly one deployment model. Don't deviate from it —
every phase's files are placed assuming this flow.


```
Developer → git push → GitHub repo (main branch protected, PRs required)
                          │
                          ├─→ GitHub Actions: CI (every PR)
                          │     builds apps/web, typechecks — catches breaks before merge
                          │
                          ├─→ GitHub Actions: Deploy Supabase (on merge to main,
                          │     only if supabase/** changed)
                          │     runs migrations in order, deploys edge functions,
                          │     regenerates + commits database.types.ts
                          │
                          └─→ Vercel GitHub integration (on merge to main)
                                builds apps/web, deploys to production
```

Migrations and frontend deploy **independently**, triggered by the same push,
because Vercel's own GitHub integration handles the frontend — you do not
need a GitHub Actions step for that part.

## One-time setup

### 1. GitHub repo
```bash
git init
git add .
git commit -m "Initial commit: Phase 1 + Phase 2 + Phase 3 in progress"
git branch -M main
git remote add origin https://github.com/<your-org>/school-erp.git
git push -u origin main
```
Then in GitHub: **Settings → Branches** → add a branch protection rule on
`main` requiring the `CI` check to pass before merge.

### 2. Supabase project
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push        # applies every migration in supabase/migrations/ once, manually, the first time
npx supabase functions deploy provision-organization
```

Add these as **GitHub repo secrets** (Settings → Secrets and variables → Actions)
so `deploy-supabase.yml` can run on every future merge:
| Secret | Where to find it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF` | Project Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | Project Settings → Database |

From this point on: **never run `supabase db push` from your laptop against
production.** Add a migration file, push to a branch, open a PR, merge —
the Action applies it. This is what keeps the migration history in Git as
the single source of truth instead of drifting from whatever any one
developer's machine has run.

### 3. Vercel project
- Import the GitHub repo in the Vercel dashboard.
- **Root Directory: `apps/web`** — this is the one Vercel dashboard setting
  that makes the monorepo layout work; without it Vercel looks for
  `package.json` at the repo root and won't find the app.
- Framework preset: Vite (auto-detected once Root Directory is set).
- Environment variables (Project Settings → Environment Variables), same
  three environments (Production/Preview/Development) all pointing at your
  one Supabase project for now:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

Every PR now gets its own Vercel preview URL automatically (Vercel's GitHub
integration does this with zero extra config) — a real, clickable preview
of that PR's frontend changes, running against the same Supabase project.

### 4. AI features (Phase 16) — one more secret

The AI Copilot, AI report-card comments, AI exam question generation, and
the AI document scanner all call the Anthropic API from Edge Functions.
Set the key as a Supabase secret (never a `VITE_` browser variable —
it must never reach client code):
```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```
Without this secret, those four Edge Functions return a clear
"not configured" error instead of failing silently or faking a response.

## Adding a new phase from here on

1. Create a branch: `git checkout -b phase-4-admissions`
2. Add the migration: `supabase/migrations/00N_<name>.sql`
3. Add the module: `apps/web/src/modules/<name>/{api,hooks,schemas,pages,components}/`
4. Open a PR → CI runs → review → merge to `main`
5. Merge triggers: Supabase migration deploy (Action) + Vercel production deploy (Vercel's own integration), automatically, in parallel.

No manual deploy step, ever, once this is wired — that's the entire point
of this model.
