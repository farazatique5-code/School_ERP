-- =====================================================================
-- PHASE 10: LIBRARY
-- Depends on: 001 (schools), 004 (students), 006 (employees).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BOOKS (catalog record) and COPIES (individual barcoded physical
-- items) — split so "how many copies of Book X do we own and where are
-- they" (Inventory, per the PRD) is a real query, not a derived guess.
-- ---------------------------------------------------------------------
create table library_books (
  id                uuid primary key default uuid_generate_v4(),
  school_id         uuid not null references schools(id) on delete cascade,
  isbn              text,
  title             text not null,
  author            text,
  publisher         text,
  category          text,
  shelf_location    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_library_books_school on library_books(school_id);
create index idx_library_books_title on library_books using gin (to_tsvector('english', title || ' ' || coalesce(author, '')));

create table library_book_copies (
  id                uuid primary key default uuid_generate_v4(),
  book_id           uuid not null references library_books(id) on delete cascade,
  barcode           text not null,
  status            text not null default 'available' check (status in ('available','issued','reserved','lost','damaged','withdrawn')),
  created_at        timestamptz not null default now(),
  unique (barcode)
);
create index idx_library_copies_book on library_book_copies(book_id);
create index idx_library_copies_status on library_book_copies(status);

-- ---------------------------------------------------------------------
-- 2. ISSUES (borrower is a student OR an employee, never both/neither)
-- ---------------------------------------------------------------------
create table library_issues (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  book_copy_id      uuid not null references library_book_copies(id) on delete cascade,
  student_id        uuid references students(id) on delete cascade,
  employee_profile_id uuid references employees(profile_id) on delete cascade,
  issue_date        date not null default current_date,
  due_date          date not null,
  return_date       date,
  fine_amount       numeric(10,2) not null default 0,
  fine_paid         boolean not null default false,
  status            text not null default 'issued' check (status in ('issued','returned','overdue','lost')),
  issued_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  check ((student_id is not null)::int + (employee_profile_id is not null)::int = 1),
  check (due_date >= issue_date)
);
create index idx_library_issues_copy on library_issues(book_copy_id);
create index idx_library_issues_student on library_issues(student_id) where student_id is not null;
create index idx_library_issues_employee on library_issues(employee_profile_id) where employee_profile_id is not null;
-- a copy can only be actively issued once at a time
create unique index uq_one_active_issue_per_copy on library_issues(book_copy_id) where status in ('issued','overdue');

-- ---------------------------------------------------------------------
-- 3. RESERVATIONS
-- ---------------------------------------------------------------------
create table library_reservations (
  id                uuid primary key default uuid_generate_v4(),
  book_id           uuid not null references library_books(id) on delete cascade,
  student_id        uuid references students(id) on delete cascade,
  employee_profile_id uuid references employees(profile_id) on delete cascade,
  reserved_at       timestamptz not null default now(),
  status            text not null default 'pending' check (status in ('pending','fulfilled','cancelled')),
  check ((student_id is not null)::int + (employee_profile_id is not null)::int = 1)
);
create index idx_library_reservations_book on library_reservations(book_id, status);

-- ---------------------------------------------------------------------
-- 4. ISSUE / RETURN AS ATOMIC OPERATIONS
-- Issuing and returning both touch two tables (the copy's status and the
-- issue record) — done as functions so the two writes can never partially
-- succeed from a client-side bug.
-- ---------------------------------------------------------------------
create or replace function fn_issue_book(
  p_book_copy_id uuid, p_student_id uuid, p_employee_profile_id uuid,
  p_due_date date, p_issued_by uuid
) returns uuid
language plpgsql security definer
as $$
declare
  v_copy record;
  v_org_id uuid;
  v_school_id uuid;
  v_issue_id uuid;
begin
  select c.*, b.school_id into v_copy from library_book_copies c join library_books b on b.id = c.book_id where c.id = p_book_copy_id for update;
  if v_copy.status != 'available' then
    raise exception 'copy_not_available' using errcode = 'P0003';
  end if;

  select organization_id, id into v_org_id, v_school_id from schools where id = v_copy.school_id;

  insert into library_issues (organization_id, school_id, book_copy_id, student_id, employee_profile_id, due_date, issued_by_profile_id)
  values (v_org_id, v_school_id, p_book_copy_id, p_student_id, p_employee_profile_id, p_due_date, p_issued_by)
  returning id into v_issue_id;

  update library_book_copies set status = 'issued' where id = p_book_copy_id;

  return v_issue_id;
end;
$$;
grant execute on function fn_issue_book(uuid, uuid, uuid, date, uuid) to authenticated;

create or replace function fn_return_book(p_issue_id uuid, p_fine_per_day numeric default 0)
returns numeric
language plpgsql security definer
as $$
declare
  v_issue record;
  v_days_late integer;
  v_fine numeric := 0;
begin
  select * into v_issue from library_issues where id = p_issue_id for update;

  v_days_late := greatest(0, current_date - v_issue.due_date);
  v_fine := v_days_late * p_fine_per_day;

  update library_issues
  set return_date = current_date, status = 'returned', fine_amount = v_fine
  where id = p_issue_id;

  update library_book_copies set status = 'available' where id = v_issue.book_copy_id;

  return v_fine;
end;
$$;
grant execute on function fn_return_book(uuid, numeric) to authenticated;

create trigger audit_library_issues after insert or update or delete on library_issues
  for each row execute function fn_audit_trigger();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table library_books enable row level security;
alter table library_book_copies enable row level security;
alter table library_issues enable row level security;
alter table library_reservations enable row level security;

create policy library_books_select on library_books for select using (auth_has_school_access(school_id));
create policy library_books_write on library_books for all using (
  auth_has_school_access(school_id) and auth_has_permission('library.manage'));

create policy library_copies_select on library_book_copies for select using (
  book_id in (select id from library_books where auth_has_school_access(school_id)));
create policy library_copies_write on library_book_copies for all using (
  book_id in (select id from library_books where auth_has_school_access(school_id)) and auth_has_permission('library.manage'));

create policy library_issues_select on library_issues for select using (
  auth_has_school_access(school_id) and (
    auth_has_permission('library.manage') or student_id in (select id from students where profile_id = auth.uid())
    or employee_profile_id = auth.uid()
  ));
create policy library_issues_write on library_issues for all using (
  auth_has_school_access(school_id) and auth_has_permission('library.manage'));

create policy library_reservations_select on library_reservations for select using (
  book_id in (select id from library_books where auth_has_school_access(school_id)));
create policy library_reservations_write on library_reservations for all using (
  book_id in (select id from library_books where auth_has_school_access(school_id)));

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 10
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('library.view',   'library', 'Browse the library catalog'),
  ('library.manage', 'library', 'Manage books, copies, issues, returns, and reservations')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    (r.name in ('Super Admin','Organization Owner','Librarian') and p.module = 'library')
    or (r.name in ('School Administrator','Principal','Teacher','Class Teacher') and p.key = 'library.view')
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (10, 'Library', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
