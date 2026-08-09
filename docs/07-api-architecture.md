# API Architecture

## 1. Where "the API" actually lives

There is no separate REST/Node backend for CRUD. Supabase's auto-generated PostgREST API + client SDK **is** the data API, and RLS is the authorization layer — this is deliberate: it removes an entire tier of boilerplate CRUD backend code that would otherwise duplicate what RLS already enforces correctly.

**Supabase Edge Functions (Deno)** are used only for logic that cannot or should not run as a plain client → Postgres call:
- Calling third-party services (payment gateways, SMS/WhatsApp/email providers, OCR, AI model calls)
- Multi-step operations that must run with elevated (service-role) privileges beyond what RLS grants a normal user (e.g. provisioning a brand-new organization + its seed roles atomically)
- Scheduled/cron jobs (fee due-date reminders, attendance rollups, AI prediction batch jobs)

Everything else — list students, create an invoice, mark attendance — is a direct, typed Supabase client call from the React app, wrapped in a TanStack Query hook.

## 2. Client data-access pattern (every module follows this exactly)

```
modules/students/
  ├── api/
  │   ├── queries.ts     // pure functions: (supabase, params) => Promise<Student[]>
  │   └── mutations.ts   // pure functions: (supabase, input) => Promise<Student>
  ├── hooks/
  │   ├── useStudents.ts        // useQuery wrapping queries.ts, owns the query key
  │   └── useCreateStudent.ts   // useMutation wrapping mutations.ts, invalidates useStudents key
  └── schemas/
      └── student.schema.ts     // zod schema — used by React Hook Form AND as a runtime guard
                                  // before any mutation is sent, so bad data never reaches Postgres
```

Example (illustrative shape, not phase-specific):

```ts
// modules/students/schemas/student.schema.ts
export const studentSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().date(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
  guardianEmail: z.string().email(),
});
export type StudentInput = z.infer<typeof studentSchema>;

// modules/students/api/mutations.ts
export async function createStudent(supabase: SupabaseClient, input: StudentInput) {
  const parsed = studentSchema.parse(input); // throws on invalid data before any network call
  const { data, error } = await supabase.from('students').insert(parsed).select().single();
  if (error) throw new ApiError(error);
  return data;
}

// modules/students/hooks/useCreateStudent.ts
export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StudentInput) => createStudent(supabase, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: studentKeys.list() }),
  });
}
```

## 3. Query key strategy (TanStack Query)

Every module exports a key factory so invalidation is centralized and typo-proof:

```ts
export const studentKeys = {
  all: ['students'] as const,
  list: (filters?: StudentFilters) => [...studentKeys.all, 'list', filters] as const,
  detail: (id: string) => [...studentKeys.all, 'detail', id] as const,
};
```

## 4. Server-side pagination/sort/filter contract

Every list query follows the same signature so `DataTable` can drive any module generically:

```ts
type ListParams = {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
  search?: string;
};
type ListResult<T> = { rows: T[]; totalCount: number };
```

Implemented via `.range()` + `.order()` + `.textSearch()`/`.ilike()` on the Supabase query builder, never fetched in full and paginated client-side.

## 5. Realtime

Supabase Realtime channels are used for: notification bell (`notifications` table), live attendance dashboards, admissions pipeline board updates. Pattern: subscribe in a `useEffect` inside the relevant hook, invalidate the corresponding TanStack Query key on `postgres_changes` events rather than manually patching cache — keeps one source of truth for "what the data looks like."

## 6. Edge Functions contract

```
supabase/functions/
  ├── provision-organization/     # Phase 2 — creates org + seed roles + first admin, service-role
  ├── send-notification/          # dispatches to email/SMS/WhatsApp/push provider based on channel
  ├── process-fee-payment-webhook/# Phase 9 — payment gateway webhook receiver
  ├── ai-copilot-query/           # Phase 16 — receives NL query, calls Anthropic API with scoped context
  └── generate-report-export/     # Phase 15 — heavy PDF/Excel generation off the main thread
```

Every Edge Function: validates its input with a Zod schema (shared type definitions live in `packages/shared-schemas` if we introduce a monorepo package boundary, otherwise duplicated deliberately with a comment linking the source of truth), authenticates the caller via the forwarded Supabase JWT, and never trusts a client-supplied `organization_id` — it re-derives tenant scope server-side from the authenticated user.

## 7. Error handling contract

All API-layer functions throw a typed `ApiError { code, message, details }`. TanStack Query's `onError` at the `QueryClientProvider` level reports to the notification/toast system with a human-readable message; raw Postgres/RLS error codes are mapped to friendly copy in `core/query/errorMessages.ts` (e.g. a `42501` RLS denial always renders as "You don't have permission to do this," never a raw Postgres error to an end user).
