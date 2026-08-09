-- =====================================================================
-- PHASE 9: FEES & FINANCE
-- Depends on: 001 (classes, academic_years, terms), 004 (students),
-- 006 (admit_and_enroll_student, fn_admission_approved from Phase 4 —
-- this migration extends that function to close its documented gap).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FEE STRUCTURE — what a class is charged, per category, per year.
-- ---------------------------------------------------------------------
create table fee_categories (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,               -- "Tuition", "Transport", "Library"
  created_at    timestamptz not null default now(),
  unique (school_id, name)
);

create table fee_structures (
  id                uuid primary key default uuid_generate_v4(),
  school_id         uuid not null references schools(id) on delete cascade,
  academic_year_id  uuid not null references academic_years(id) on delete cascade,
  class_id          uuid not null references classes(id) on delete cascade,
  fee_category_id   uuid not null references fee_categories(id) on delete cascade,
  amount            numeric(12,2) not null check (amount >= 0),
  frequency         text not null default 'annual' check (frequency in ('one_time','monthly','quarterly','annual')),
  created_at        timestamptz not null default now(),
  unique (class_id, fee_category_id, academic_year_id)
);

-- ---------------------------------------------------------------------
-- 2. SCHOLARSHIPS & DISCOUNTS
-- ---------------------------------------------------------------------
create table scholarships (
  id                uuid primary key default uuid_generate_v4(),
  school_id         uuid not null references schools(id) on delete cascade,
  name              text not null,
  discount_type     text not null check (discount_type in ('percentage','fixed')),
  discount_value    numeric(12,2) not null check (discount_value >= 0),
  created_at        timestamptz not null default now()
);

create table student_scholarships (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references students(id) on delete cascade,
  scholarship_id    uuid not null references scholarships(id) on delete cascade,
  academic_year_id  uuid not null references academic_years(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (student_id, scholarship_id, academic_year_id)
);

-- ---------------------------------------------------------------------
-- 3. FEE PLANS — a student's actual, possibly-customized set of charges
-- for a year, generated from fee_structures at creation time (so future
-- fee_structure edits don't retroactively change what an already-billed
-- student owes).
-- ---------------------------------------------------------------------
create table fee_plans (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references students(id) on delete cascade,
  academic_year_id  uuid not null references academic_years(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (student_id, academic_year_id)
);

create table fee_plan_items (
  id                uuid primary key default uuid_generate_v4(),
  fee_plan_id       uuid not null references fee_plans(id) on delete cascade,
  fee_category_id   uuid not null references fee_categories(id) on delete cascade,
  base_amount       numeric(12,2) not null,
  discount_amount   numeric(12,2) not null default 0,
  frequency         text not null,
  created_at        timestamptz not null default now()
);

-- Generates a fee plan for a student from their class's fee_structures,
-- applying any active scholarship as a discount. This is the shared
-- function both Admissions (Phase 4's automation, extended below) and a
-- manual "create fee plan" action call — one code path, not two.
create or replace function generate_fee_plan(p_student_id uuid, p_class_id uuid, p_academic_year_id uuid)
returns uuid
language plpgsql security definer
as $$
declare
  v_fee_plan_id uuid;
  v_structure record;
  v_discount_percent numeric := 0;
  v_discount_fixed numeric := 0;
begin
  insert into fee_plans (student_id, academic_year_id) values (p_student_id, p_academic_year_id)
  on conflict (student_id, academic_year_id) do nothing
  returning id into v_fee_plan_id;

  if v_fee_plan_id is null then
    select id into v_fee_plan_id from fee_plans where student_id = p_student_id and academic_year_id = p_academic_year_id;
    return v_fee_plan_id; -- plan already exists, don't duplicate items
  end if;

  select coalesce(sum(s.discount_value), 0) into v_discount_percent
  from student_scholarships ss join scholarships s on s.id = ss.scholarship_id
  where ss.student_id = p_student_id and ss.academic_year_id = p_academic_year_id and s.discount_type = 'percentage';

  select coalesce(sum(s.discount_value), 0) into v_discount_fixed
  from student_scholarships ss join scholarships s on s.id = ss.scholarship_id
  where ss.student_id = p_student_id and ss.academic_year_id = p_academic_year_id and s.discount_type = 'fixed';

  for v_structure in
    select * from fee_structures where class_id = p_class_id and academic_year_id = p_academic_year_id
  loop
    insert into fee_plan_items (fee_plan_id, fee_category_id, base_amount, discount_amount, frequency)
    values (
      v_fee_plan_id, v_structure.fee_category_id, v_structure.amount,
      round(v_structure.amount * (v_discount_percent / 100), 2) + (v_discount_fixed / greatest((select count(*) from fee_structures where class_id = p_class_id and academic_year_id = p_academic_year_id), 1)),
      v_structure.frequency
    );
  end loop;

  return v_fee_plan_id;
end;
$$;
grant execute on function generate_fee_plan to authenticated;

-- ---------------------------------------------------------------------
-- 4. INVOICES & PAYMENTS
-- ---------------------------------------------------------------------
create table fee_invoices (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  student_id        uuid not null references students(id) on delete cascade,
  fee_plan_id       uuid references fee_plans(id) on delete set null,
  invoice_number    text not null,
  term_id           uuid references terms(id) on delete set null,
  due_date          date not null,
  amount_due        numeric(12,2) not null,
  fine_amount       numeric(12,2) not null default 0,
  amount_paid       numeric(12,2) not null default 0,
  status            text not null default 'pending' check (status in ('pending','partial','paid','overdue','cancelled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, invoice_number)
);
create index idx_fee_invoices_student on fee_invoices(student_id);
create index idx_fee_invoices_status on fee_invoices(school_id, status);

create table fee_invoice_items (
  id                uuid primary key default uuid_generate_v4(),
  invoice_id        uuid not null references fee_invoices(id) on delete cascade,
  fee_category_id   uuid not null references fee_categories(id) on delete cascade,
  amount            numeric(12,2) not null
);

create table fee_payments (
  id                uuid primary key default uuid_generate_v4(),
  invoice_id        uuid not null references fee_invoices(id) on delete cascade,
  amount            numeric(12,2) not null check (amount > 0),
  payment_date      date not null default current_date,
  payment_method    text not null check (payment_method in ('cash','bank_transfer','card','online','cheque')),
  transaction_reference text,
  receipt_number    text not null,
  recorded_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (receipt_number)
);
create index idx_fee_payments_invoice on fee_payments(invoice_id);

create or replace function generate_invoice_number(p_school_id uuid)
returns text
language plpgsql security definer
as $$
declare
  v_school_code text;
  v_year text := to_char(now(), 'YYYY');
  v_next_seq int;
begin
  select code into v_school_code from schools where id = p_school_id;
  select coalesce(max((regexp_match(invoice_number, '-(\d+)$'))[1]::int), 0) + 1 into v_next_seq
  from fee_invoices where school_id = p_school_id and invoice_number like v_school_code || '-INV-' || v_year || '-%';
  return v_school_code || '-INV-' || v_year || '-' || lpad(v_next_seq::text, 5, '0');
end;
$$;
grant execute on function generate_invoice_number to authenticated;

create or replace function generate_receipt_number(p_school_id uuid)
returns text
language plpgsql security definer
as $$
declare
  v_school_code text;
  v_year text := to_char(now(), 'YYYY');
  v_next_seq int;
begin
  select code into v_school_code from schools where id = p_school_id;
  select coalesce(max((regexp_match(receipt_number, '-(\d+)$'))[1]::int), 0) + 1 into v_next_seq
  from fee_payments fp join fee_invoices fi on fi.id = fp.invoice_id
  where fi.school_id = p_school_id and fp.receipt_number like v_school_code || '-RCT-' || v_year || '-%';
  return v_school_code || '-RCT-' || v_year || '-' || lpad(v_next_seq::text, 5, '0');
end;
$$;
grant execute on function generate_receipt_number to authenticated;

-- ---------------------------------------------------------------------
-- 5. FINE CALCULATION — a scheduled job (called via pg_cron or an Edge
-- Function on a cron trigger) marks overdue invoices and applies a fine.
-- Exposed as a callable function rather than a fixed trigger because the
-- "how much fine, after how many days" policy varies per org and belongs
-- in organizations.settings, read here rather than hardcoded.
-- ---------------------------------------------------------------------
create or replace function fn_apply_overdue_fines(p_school_id uuid, p_fine_amount numeric, p_grace_days integer)
returns integer
language plpgsql security definer
as $$
declare
  v_count integer;
begin
  update fee_invoices
  set status = 'overdue', fine_amount = p_fine_amount, updated_at = now()
  where school_id = p_school_id
    and status in ('pending','partial')
    and due_date < (current_date - p_grace_days)
    and fine_amount = 0;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function fn_apply_overdue_fines to authenticated;

-- ---------------------------------------------------------------------
-- 6. LEDGER (Cash Book / Income / Expenses) — a single table with a
-- `type` column rather than three separate ones, since a cash book is
-- literally the union of income and expense entries ordered by date.
-- ---------------------------------------------------------------------
create table ledger_entries (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  entry_type        text not null check (entry_type in ('income','expense')),
  category          text not null,             -- "Fee Collection", "Salaries", "Utilities", "Maintenance"
  amount            numeric(12,2) not null check (amount > 0),
  entry_date        date not null default current_date,
  description       text,
  reference_invoice_id uuid references fee_invoices(id) on delete set null,
  recorded_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_ledger_school_date on ledger_entries(school_id, entry_date desc);

-- ---------------------------------------------------------------------
-- 7. FEE_PAYMENT_RECORDED AUTOMATION
-- Generates the receipt number, updates the invoice, writes the ledger
-- entry, and notifies the guardian — the exact PRD automation chain,
-- fully real end to end (this one has no external dependency to stub).
-- ---------------------------------------------------------------------
create or replace function fn_fee_payment_recorded()
returns trigger
language plpgsql security definer
as $$
declare
  v_invoice record;
  v_new_paid numeric;
  v_new_status text;
  v_guardian_profile_id uuid;
  v_student_name text;
begin
  select * into v_invoice from fee_invoices where id = NEW.invoice_id;
  v_new_paid := v_invoice.amount_paid + NEW.amount;
  v_new_status := case
    when v_new_paid >= (v_invoice.amount_due + v_invoice.fine_amount) then 'paid'
    when v_new_paid > 0 then 'partial'
    else v_invoice.status
  end;

  update fee_invoices set amount_paid = v_new_paid, status = v_new_status, updated_at = now() where id = NEW.invoice_id;

  insert into ledger_entries (organization_id, school_id, entry_type, category, amount, entry_date, description, reference_invoice_id, recorded_by_profile_id)
  values (v_invoice.organization_id, v_invoice.school_id, 'income', 'Fee Collection', NEW.amount, NEW.payment_date,
          'Payment for invoice ' || v_invoice.invoice_number, NEW.invoice_id, NEW.recorded_by_profile_id);

  select s.first_name || ' ' || s.last_name, g.profile_id into v_student_name, v_guardian_profile_id
  from students s
  left join student_guardians sg on sg.student_id = s.id and sg.is_primary_contact
  left join guardians g on g.id = sg.guardian_id
  where s.id = v_invoice.student_id;

  if v_guardian_profile_id is not null then
    insert into notifications (organization_id, school_id, recipient_profile_id, channel, title, body)
    values (
      v_invoice.organization_id, v_invoice.school_id, v_guardian_profile_id, 'in_app',
      'Payment received',
      'Receipt ' || NEW.receipt_number || ': payment of ' || NEW.amount || ' received for ' || v_student_name || '.'
    );
  end if;

  insert into automation_runs (organization_id, automation_key, trigger_table, trigger_row_id, status, payload)
  values (
    v_invoice.organization_id, 'fee_payment_recorded', 'fee_payments', NEW.id, 'success',
    jsonb_build_object('receipt_number', NEW.receipt_number, 'invoice_status', v_new_status, 'guardian_notified', v_guardian_profile_id is not null)
  );

  return NEW;
end;
$$;

create trigger trg_fee_payment_recorded
  after insert on fee_payments
  for each row execute function fn_fee_payment_recorded();

create trigger audit_fee_invoices after insert or update or delete on fee_invoices
  for each row execute function fn_audit_trigger();
create trigger audit_fee_payments after insert or update or delete on fee_payments
  for each row execute function fn_audit_trigger();
create trigger audit_ledger_entries after insert or update or delete on ledger_entries
  for each row execute function fn_audit_trigger();

-- =====================================================================
-- CLOSING THE PHASE 4 GAP: admission_approved now creates a real fee plan.
-- Redefine fn_admission_approved (Phase 4) to call generate_fee_plan()
-- and update its automation_runs payload accordingly — same function
-- name, same trigger, just no longer stubbed for this one step.
-- =====================================================================
create or replace function fn_admission_approved()
returns trigger
language plpgsql security definer
as $$
declare
  v_student_id uuid;
  v_section_id uuid;
  v_fee_plan_id uuid;
begin
  if NEW.status = 'approved' and OLD.status is distinct from 'approved' then
    select s.id into v_section_id
    from sections s
    where s.class_id = NEW.applying_for_class_id
    order by s.name
    limit 1;

    if v_section_id is null then
      raise exception 'no_section_available' using errcode = 'P0001';
    end if;

    v_student_id := admit_and_enroll_student(
      NEW.organization_id, NEW.school_id, NEW.first_name, NEW.last_name,
      NEW.date_of_birth, NEW.gender, NEW.academic_year_id, NEW.applying_for_class_id, v_section_id
    );

    update admission_applications set converted_student_id = v_student_id where id = NEW.id;

    -- Previously a pending step (see Phase 4 README) — now real.
    v_fee_plan_id := generate_fee_plan(v_student_id, NEW.applying_for_class_id, NEW.academic_year_id);

    insert into automation_runs (organization_id, automation_key, trigger_table, trigger_row_id, status, payload)
    values (
      NEW.organization_id, 'admission_approved', 'admission_applications', NEW.id, 'success',
      jsonb_build_object(
        'student_id', v_student_id,
        'fee_plan_id', v_fee_plan_id,
        'pending_steps', jsonb_build_array(
          'parent_portal_account_creation (ships in Phase 14 — Parent & Student Portals)'
        )
      )
    );
  end if;
  return NEW;
end;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table fee_categories enable row level security;
alter table fee_structures enable row level security;
alter table scholarships enable row level security;
alter table student_scholarships enable row level security;
alter table fee_plans enable row level security;
alter table fee_plan_items enable row level security;
alter table fee_invoices enable row level security;
alter table fee_invoice_items enable row level security;
alter table fee_payments enable row level security;
alter table ledger_entries enable row level security;

create policy fee_categories_select on fee_categories for select using (auth_has_school_access(school_id));
create policy fee_categories_write on fee_categories for all using (
  auth_has_school_access(school_id) and auth_has_permission('fees.manage'));

create policy fee_structures_select on fee_structures for select using (auth_has_school_access(school_id));
create policy fee_structures_write on fee_structures for all using (
  auth_has_school_access(school_id) and auth_has_permission('fees.manage'));

create policy scholarships_select on scholarships for select using (auth_has_school_access(school_id));
create policy scholarships_write on scholarships for all using (
  auth_has_school_access(school_id) and auth_has_permission('fees.manage'));

create policy student_scholarships_select on student_scholarships for select using (
  student_id in (select id from students where auth_has_school_access(school_id)));
create policy student_scholarships_write on student_scholarships for all using (
  student_id in (select id from students where auth_has_school_access(school_id)) and auth_has_permission('fees.manage'));

create policy fee_plans_select on fee_plans for select using (
  student_id in (select id from students where auth_has_school_access(school_id)) and auth_has_permission('fees.view'));
create policy fee_plans_write on fee_plans for all using (
  student_id in (select id from students where auth_has_school_access(school_id)) and auth_has_permission('fees.manage'));

create policy fee_plan_items_select on fee_plan_items for select using (
  fee_plan_id in (select fp.id from fee_plans fp join students s on s.id = fp.student_id where auth_has_school_access(s.school_id))
  and auth_has_permission('fees.view'));
create policy fee_plan_items_write on fee_plan_items for all using (
  fee_plan_id in (select fp.id from fee_plans fp join students s on s.id = fp.student_id where auth_has_school_access(s.school_id))
  and auth_has_permission('fees.manage'));

create policy fee_invoices_select on fee_invoices for select using (
  auth_has_school_access(school_id) and auth_has_permission('fees.view'));
create policy fee_invoices_write on fee_invoices for all using (
  auth_has_school_access(school_id) and auth_has_permission('fees.manage'));

create policy fee_invoice_items_select on fee_invoice_items for select using (
  invoice_id in (select id from fee_invoices where auth_has_school_access(school_id)) and auth_has_permission('fees.view'));
create policy fee_invoice_items_write on fee_invoice_items for all using (
  invoice_id in (select id from fee_invoices where auth_has_school_access(school_id)) and auth_has_permission('fees.manage'));

create policy fee_payments_select on fee_payments for select using (
  invoice_id in (select id from fee_invoices where auth_has_school_access(school_id)) and auth_has_permission('fees.view'));
create policy fee_payments_insert on fee_payments for insert with check (
  invoice_id in (select id from fee_invoices where auth_has_school_access(school_id)) and auth_has_permission('fees.collect'));

create policy ledger_entries_select on ledger_entries for select using (
  auth_has_school_access(school_id) and auth_has_permission('fees.view_reports'));
create policy ledger_entries_write on ledger_entries for all using (
  auth_has_school_access(school_id) and auth_has_permission('fees.manage'));

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 9
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('fees.view',          'fees', 'View fee plans, invoices, and payment history'),
  ('fees.manage',        'fees', 'Manage fee structures, scholarships, and invoices'),
  ('fees.collect',       'fees', 'Record fee payments'),
  ('fees.view_reports',  'fees', 'View ledger and financial reports')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    (r.name in ('Super Admin','Organization Owner','Accountant') and p.module = 'fees')
    or (r.name in ('School Administrator','Principal') and p.key in ('fees.view','fees.view_reports'))
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (9, 'Fees & Finance', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
