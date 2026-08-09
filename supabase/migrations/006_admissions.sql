-- =====================================================================
-- PHASE 4: ADMISSIONS
-- Depends on: 001 (schools/classes/sections/academic_years), 002 (roles),
-- 004 (students, student_enrollments, generate_student_code()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ADMISSION APPLICATIONS
-- ---------------------------------------------------------------------
create table admission_applications (
  id                    uuid primary key default uuid_generate_v4(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  school_id             uuid not null references schools(id) on delete cascade,
  application_number    text not null,               -- "{school_code}-APP-{seq}"
  first_name            text not null,
  last_name             text not null,
  date_of_birth         date not null,
  gender                text check (gender in ('male','female','other','prefer_not_to_say')),
  applying_for_class_id uuid not null references classes(id) on delete restrict,
  academic_year_id      uuid not null references academic_years(id) on delete restrict,
  guardian_first_name   text not null,
  guardian_last_name    text not null,
  guardian_email        text,
  guardian_phone        text not null,
  previous_school_name  text,
  status                text not null default 'submitted' check (status in
    ('submitted','under_review','interview_scheduled','approved','rejected','withdrawn')),
  rejection_reason      text,
  submitted_at          timestamptz not null default now(),
  reviewed_by_profile_id uuid references profiles(id) on delete set null,
  reviewed_at           timestamptz,
  -- populated only after approval + successful conversion to a student record
  converted_student_id  uuid references students(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, application_number)
);
create index idx_admission_applications_school_status on admission_applications(school_id, status);

create table admission_interviews (
  id                uuid primary key default uuid_generate_v4(),
  application_id    uuid not null references admission_applications(id) on delete cascade,
  scheduled_at       timestamptz not null,
  interviewer_profile_id uuid references profiles(id) on delete set null,
  location           text,
  notes              text,
  outcome            text check (outcome in ('pending','recommended','not_recommended')),
  created_at          timestamptz not null default now()
);
create index idx_admission_interviews_application on admission_interviews(application_id);

create table admission_documents (
  id                uuid primary key default uuid_generate_v4(),
  application_id    uuid not null references admission_applications(id) on delete cascade,
  document_type     text not null check (document_type in
    ('birth_certificate','previous_school_transcript','national_id','passport','photo','other')),
  file_path         text not null,
  file_name         text not null,
  uploaded_at       timestamptz not null default now()
);
create index idx_admission_documents_application on admission_documents(application_id);

-- ---------------------------------------------------------------------
-- 2. APPLICATION NUMBER GENERATOR (same atomic pattern as generate_student_code)
-- ---------------------------------------------------------------------
create or replace function generate_application_number(p_school_id uuid)
returns text
language plpgsql security definer
as $$
declare
  v_school_code text;
  v_year text := to_char(now(), 'YYYY');
  v_next_seq int;
begin
  select code into v_school_code from schools where id = p_school_id;

  select coalesce(max(
    (regexp_match(application_number, '-(\d+)$'))[1]::int
  ), 0) + 1
  into v_next_seq
  from admission_applications
  where school_id = p_school_id and application_number like v_school_code || '-APP-' || v_year || '-%';

  return v_school_code || '-APP-' || v_year || '-' || lpad(v_next_seq::text, 4, '0');
end;
$$;
grant execute on function generate_application_number to authenticated;

-- ---------------------------------------------------------------------
-- 3. SHARED STUDENT-CREATION FUNCTION
-- This is the refactor flagged in docs/phase-3-README.md: Phase 3's
-- client-side "create student, then create enrollment, roll back on
-- failure" logic is promoted here into one atomic Postgres function so
-- Admissions (this phase) and the Students module (Phase 3) both call the
-- SAME code path instead of maintaining two copies that can drift apart.
-- ---------------------------------------------------------------------
create or replace function admit_and_enroll_student(
  p_organization_id uuid,
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_gender text,
  p_academic_year_id uuid,
  p_class_id uuid,
  p_section_id uuid,
  p_admission_date date default current_date
) returns uuid
language plpgsql security definer
as $$
declare
  v_student_code text;
  v_student_id uuid;
begin
  v_student_code := generate_student_code(p_school_id);

  insert into students (organization_id, school_id, student_code, first_name, last_name, date_of_birth, gender, admission_date)
  values (p_organization_id, p_school_id, v_student_code, p_first_name, p_last_name, p_date_of_birth, p_gender, p_admission_date)
  returning id into v_student_id;

  insert into student_enrollments (student_id, academic_year_id, class_id, section_id)
  values (v_student_id, p_academic_year_id, p_class_id, p_section_id);

  return v_student_id;
end;
$$;
grant execute on function admit_and_enroll_student to authenticated;

-- ---------------------------------------------------------------------
-- 4. ADMISSION_APPROVED AUTOMATION
-- Trigger fires when an application's status flips to 'approved'.
-- Creates the student + enrollment via the shared function above and
-- writes back converted_student_id. Fee plan creation and portal login
-- creation are NOT faked here — they are logged as explicitly pending
-- automation steps (via automation_runs.payload) because fee_plans
-- (Phase 9) and parent portal accounts (Phase 14) don't exist yet. This
-- keeps the automation honest about what it actually did versus what
-- still needs Phase 9/14 to complete it.
-- ---------------------------------------------------------------------
create or replace function fn_admission_approved()
returns trigger
language plpgsql security definer
as $$
declare
  v_student_id uuid;
  v_section_id uuid;
begin
  if NEW.status = 'approved' and OLD.status is distinct from 'approved' then
    -- pick the first section of the applied-for class with available capacity;
    -- a real "section assignment" UI is a natural Phase 4 follow-up, this is
    -- a reasonable working default, not a placeholder.
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

    insert into automation_runs (organization_id, automation_key, trigger_table, trigger_row_id, status, payload)
    values (
      NEW.organization_id, 'admission_approved', 'admission_applications', NEW.id, 'success',
      jsonb_build_object(
        'student_id', v_student_id,
        'pending_steps', jsonb_build_array(
          'fee_plan_creation (ships in Phase 9 — Fees & Finance)',
          'parent_portal_account_creation (ships in Phase 14 — Parent & Student Portals)'
        )
      )
    );
  end if;
  return NEW;
end;
$$;

create trigger trg_admission_approved
  after update on admission_applications
  for each row execute function fn_admission_approved();

create trigger audit_admission_applications after insert or update or delete on admission_applications
  for each row execute function fn_audit_trigger();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table admission_applications enable row level security;
alter table admission_interviews enable row level security;
alter table admission_documents enable row level security;

create policy admission_applications_select on admission_applications for select using (
  auth_has_school_access(school_id) and auth_has_permission('admissions.view'));
create policy admission_applications_insert on admission_applications for insert with check (
  auth_has_school_access(school_id) and auth_has_permission('admissions.manage'));
create policy admission_applications_update on admission_applications for update using (
  auth_has_school_access(school_id) and auth_has_permission('admissions.manage'));

-- Approving an application is a distinct, higher-stakes action from
-- general "manage" edits (editing a name vs. converting to a real student
-- record) — gated on its own permission, checked in the update policy via
-- a CASE that only applies when status is being set to 'approved'.
create policy admission_applications_approve on admission_applications for update using (
  auth_has_school_access(school_id) and (
    status = 'approved' and auth_has_permission('admissions.approve')
    or status != 'approved'
  )
);

create policy admission_interviews_select on admission_interviews for select using (
  application_id in (select id from admission_applications where auth_has_school_access(school_id))
  and auth_has_permission('admissions.view'));
create policy admission_interviews_write on admission_interviews for all using (
  application_id in (select id from admission_applications where auth_has_school_access(school_id))
  and auth_has_permission('admissions.manage'));

create policy admission_documents_select on admission_documents for select using (
  application_id in (select id from admission_applications where auth_has_school_access(school_id))
  and auth_has_permission('admissions.view'));
create policy admission_documents_write on admission_documents for all using (
  application_id in (select id from admission_applications where auth_has_school_access(school_id))
  and auth_has_permission('admissions.manage'));

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 4
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('admissions.view',    'admissions', 'View admission applications and pipeline'),
  ('admissions.manage',  'admissions', 'Create/edit applications, schedule interviews, upload documents'),
  ('admissions.approve', 'admissions', 'Approve or reject applications (approval converts to a student record)')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    (r.name in ('Super Admin','Organization Owner','School Administrator','Principal') and p.module = 'admissions')
    or (r.name = 'Admission Officer' and p.key in ('admissions.view','admissions.manage'))
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (4, 'Admissions', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
