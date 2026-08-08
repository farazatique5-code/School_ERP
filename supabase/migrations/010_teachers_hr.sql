-- =====================================================================
-- PHASE 6: TEACHERS & HR
-- Depends on: 001 (departments, subjects, classes, sections), 002 (roles).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EMPLOYEES — every staff member (teaching and non-teaching), 1:1
-- with a profile. Unlike guardians/students, staff get a real portal
-- login immediately (they need to log in to do their job), so this
-- table is created for an EXISTING profile, not the other way around —
-- the admin invites the person first (Supabase Auth invite), then fills
-- in employment details here once they exist as a profile.
-- ---------------------------------------------------------------------
create table employees (
  profile_id          uuid primary key references profiles(id) on delete cascade,
  organization_id     uuid not null references organizations(id) on delete cascade,
  school_id           uuid not null references schools(id) on delete cascade,
  employee_code       text not null,
  department_id       uuid references departments(id) on delete set null,
  designation         text not null,             -- "Mathematics Teacher", "Front Office Executive"
  employment_type     text not null default 'full_time' check (employment_type in ('full_time','part_time','contract','substitute')),
  employment_status    text not null default 'active' check (employment_status in ('active','on_leave','suspended','terminated')),
  joining_date        date not null,
  date_of_birth       date,
  phone               text,
  address             text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, employee_code)
);
create index idx_employees_org_school on employees(organization_id, school_id);

create or replace function generate_employee_code(p_school_id uuid)
returns text
language plpgsql security definer
as $$
declare
  v_school_code text;
  v_next_seq int;
begin
  select code into v_school_code from schools where id = p_school_id;
  select coalesce(max((regexp_match(employee_code, '-(\d+)$'))[1]::int), 0) + 1
  into v_next_seq
  from employees where school_id = p_school_id and employee_code like v_school_code || '-EMP-%';
  return v_school_code || '-EMP-' || lpad(v_next_seq::text, 4, '0');
end;
$$;
grant execute on function generate_employee_code to authenticated;

-- Called by the invite-employee Edge Function after it creates the auth
-- user via admin.inviteUserByEmail — creates the profile + employee row
-- atomically, same pattern as provision_organization in migration 002.
create or replace function provision_employee(
  p_user_id uuid,
  p_organization_id uuid,
  p_school_id uuid,
  p_full_name text,
  p_email text,
  p_designation text,
  p_department_id uuid,
  p_employment_type text,
  p_joining_date date
) returns void
language plpgsql security definer
as $$
declare
  v_employee_code text;
begin
  insert into profiles (id, organization_id, full_name, email)
  values (p_user_id, p_organization_id, p_full_name, p_email);

  v_employee_code := generate_employee_code(p_school_id);

  insert into employees (profile_id, organization_id, school_id, employee_code, department_id, designation, employment_type, joining_date)
  values (p_user_id, p_organization_id, p_school_id, v_employee_code, p_department_id, p_designation, p_employment_type, p_joining_date);
end;
$$;
grant execute on function provision_employee to service_role;

-- ---------------------------------------------------------------------
-- 2. QUALIFICATIONS & EXPERIENCE
-- ---------------------------------------------------------------------
create table employee_qualifications (
  id                uuid primary key default uuid_generate_v4(),
  employee_profile_id uuid not null references employees(profile_id) on delete cascade,
  degree            text not null,
  institution       text,
  year_completed    integer,
  created_at        timestamptz not null default now()
);

create table employee_experience (
  id                uuid primary key default uuid_generate_v4(),
  employee_profile_id uuid not null references employees(profile_id) on delete cascade,
  organization_name text not null,
  role_title        text not null,
  start_date        date not null,
  end_date          date,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. TEACHER SUBJECT/SECTION ASSIGNMENTS
-- This is the table Phase 3 (students RLS) and Phase 5 (attendance RLS)
-- both flagged as a documented gap: "scope tightens once teacher-section
-- assignments exist." They exist now — see the RLS updates below.
-- ---------------------------------------------------------------------
create table teacher_assignments (
  id                uuid primary key default uuid_generate_v4(),
  teacher_profile_id uuid not null references employees(profile_id) on delete cascade,
  academic_year_id  uuid not null references academic_years(id) on delete cascade,
  class_id          uuid not null references classes(id) on delete cascade,
  section_id        uuid not null references sections(id) on delete cascade,
  subject_id        uuid references subjects(id) on delete set null,  -- null = homeroom/class-teacher assignment
  is_class_teacher  boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (teacher_profile_id, section_id, subject_id, academic_year_id)
);
create index idx_teacher_assignments_teacher on teacher_assignments(teacher_profile_id, academic_year_id);
create index idx_teacher_assignments_section on teacher_assignments(section_id);
-- at most one class teacher per section
create unique index uq_one_class_teacher_per_section on teacher_assignments(section_id, academic_year_id) where is_class_teacher;

-- ---------------------------------------------------------------------
-- 4. LEAVE
-- ---------------------------------------------------------------------
create table leave_types (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,               -- "Sick Leave", "Casual Leave"
  days_per_year integer not null default 0,
  unique (school_id, name)
);

create table employee_leave_requests (
  id                uuid primary key default uuid_generate_v4(),
  employee_profile_id uuid not null references employees(profile_id) on delete cascade,
  leave_type_id     uuid not null references leave_types(id) on delete restrict,
  start_date        date not null,
  end_date          date not null,
  reason            text,
  status            text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by_profile_id uuid references profiles(id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_leave_requests_employee on employee_leave_requests(employee_profile_id);

-- ---------------------------------------------------------------------
-- 5. PAYROLL (structure + monthly slips — a working baseline; tax
-- rules, statutory deductions, and multi-currency are org-specific
-- enough that they belong in a payroll-focused follow-up, not invented
-- here as a fake one-size-fits-all formula)
-- ---------------------------------------------------------------------
create table salary_structures (
  employee_profile_id uuid primary key references employees(profile_id) on delete cascade,
  basic_salary      numeric(12,2) not null,
  allowances        jsonb not null default '{}'::jsonb,  -- {"housing": 500, "transport": 200}
  deductions        jsonb not null default '{}'::jsonb,  -- {"tax": 300}
  currency          text not null default 'USD',
  effective_from    date not null default current_date,
  updated_at        timestamptz not null default now()
);

create table salary_slips (
  id                uuid primary key default uuid_generate_v4(),
  employee_profile_id uuid not null references employees(profile_id) on delete cascade,
  period_month      integer not null check (period_month between 1 and 12),
  period_year       integer not null,
  basic_salary      numeric(12,2) not null,
  total_allowances  numeric(12,2) not null default 0,
  total_deductions  numeric(12,2) not null default 0,
  net_pay           numeric(12,2) not null,
  generated_at      timestamptz not null default now(),
  generated_by_profile_id uuid references profiles(id) on delete set null,
  unique (employee_profile_id, period_month, period_year)
);

-- ---------------------------------------------------------------------
-- 6. CONTRACTS & DOCUMENTS
-- ---------------------------------------------------------------------
create table employee_contracts (
  id                uuid primary key default uuid_generate_v4(),
  employee_profile_id uuid not null references employees(profile_id) on delete cascade,
  contract_type     text not null,
  start_date        date not null,
  end_date          date,
  file_path         text,
  created_at        timestamptz not null default now()
);

create table employee_documents (
  id                uuid primary key default uuid_generate_v4(),
  employee_profile_id uuid not null references employees(profile_id) on delete cascade,
  document_type     text not null check (document_type in ('id_document','resume','certificate','contract','other')),
  file_path         text not null,
  file_name         text not null,
  created_at        timestamptz not null default now()
);

create trigger audit_employees after insert or update or delete on employees
  for each row execute function fn_audit_trigger();
create trigger audit_teacher_assignments after insert or update or delete on teacher_assignments
  for each row execute function fn_audit_trigger();
create trigger audit_leave_requests after insert or update or delete on employee_leave_requests
  for each row execute function fn_audit_trigger();
create trigger audit_salary_slips after insert or update or delete on salary_slips
  for each row execute function fn_audit_trigger();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table employees enable row level security;
alter table employee_qualifications enable row level security;
alter table employee_experience enable row level security;
alter table teacher_assignments enable row level security;
alter table leave_types enable row level security;
alter table employee_leave_requests enable row level security;
alter table salary_structures enable row level security;
alter table salary_slips enable row level security;
alter table employee_contracts enable row level security;
alter table employee_documents enable row level security;

create policy employees_select on employees for select using (
  auth_has_school_access(school_id) and (auth_has_permission('hr.manage') or profile_id = auth.uid()));
create policy employees_write on employees for all using (
  auth_has_school_access(school_id) and auth_has_permission('hr.manage'));

create policy qualifications_select on employee_qualifications for select using (
  employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id))
  and auth_has_permission('hr.manage') or employee_profile_id = auth.uid());
create policy qualifications_write on employee_qualifications for all using (
  employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id))
  and auth_has_permission('hr.manage'));

create policy experience_select on employee_experience for select using (
  employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id))
  and auth_has_permission('hr.manage') or employee_profile_id = auth.uid());
create policy experience_write on employee_experience for all using (
  employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id))
  and auth_has_permission('hr.manage'));

create policy teacher_assignments_select on teacher_assignments for select using (
  section_id in (select id from sections sec join classes c on c.id = sec.class_id where auth_has_school_access(c.school_id))
  and (auth_has_permission('hr.manage') or auth_has_permission('academics.manage') or teacher_profile_id = auth.uid()));
create policy teacher_assignments_write on teacher_assignments for all using (
  section_id in (select id from sections sec join classes c on c.id = sec.class_id where auth_has_school_access(c.school_id))
  and auth_has_permission('academics.manage'));

create policy leave_types_select on leave_types for select using (auth_has_school_access(school_id));
create policy leave_types_write on leave_types for all using (
  auth_has_school_access(school_id) and auth_has_permission('hr.manage'));

create policy leave_requests_select on employee_leave_requests for select using (
  employee_profile_id = auth.uid()
  or employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id) and auth_has_permission('hr.manage')));
create policy leave_requests_insert on employee_leave_requests for insert with check (employee_profile_id = auth.uid());
create policy leave_requests_update_own on employee_leave_requests for update using (employee_profile_id = auth.uid() and status = 'pending');
create policy leave_requests_update_hr on employee_leave_requests for update using (
  employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id) and auth_has_permission('hr.manage')));

create policy salary_structures_select on salary_structures for select using (
  employee_profile_id = auth.uid()
  or employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id) and auth_has_permission('payroll.manage')));
create policy salary_structures_write on salary_structures for all using (
  employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id) and auth_has_permission('payroll.manage')));

create policy salary_slips_select on salary_slips for select using (
  employee_profile_id = auth.uid()
  or employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id) and auth_has_permission('payroll.manage')));
create policy salary_slips_write on salary_slips for all using (
  employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id) and auth_has_permission('payroll.manage')));

create policy contracts_select on employee_contracts for select using (
  employee_profile_id = auth.uid()
  or employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id) and auth_has_permission('hr.manage')));
create policy contracts_write on employee_contracts for all using (
  employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id) and auth_has_permission('hr.manage')));

create policy employee_documents_select on employee_documents for select using (
  employee_profile_id = auth.uid()
  or employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id) and auth_has_permission('hr.manage')));
create policy employee_documents_write on employee_documents for all using (
  employee_profile_id in (select profile_id from employees where auth_has_school_access(school_id) and auth_has_permission('hr.manage')));

-- =====================================================================
-- CLOSING THE PHASE 3 / PHASE 5 DOCUMENTED RLS GAP
-- Teachers and Class Teachers are now scoped to sections they're actually
-- assigned to via teacher_assignments, instead of the whole school.
-- =====================================================================

drop policy if exists students_select on students;
create policy students_select on students for select using (
  auth_has_permission('students.view') and (
    auth_has_permission('students.view_all_sections') -- admin-tier roles: unchanged, school-wide
    and auth_has_school_access(school_id)
    or exists ( -- Teacher/Class Teacher: only sections they're assigned to
      select 1 from teacher_assignments ta
      join student_enrollments se on se.section_id = ta.section_id
      where ta.teacher_profile_id = auth.uid() and se.student_id = students.id
    )
  )
);

drop policy if exists student_attendance_write on student_attendance;
create policy student_attendance_write on student_attendance for all using (
  auth_has_permission('attendance.mark') and (
    auth_has_permission('attendance.mark_all_sections') and auth_has_school_access(school_id)
    or exists (select 1 from teacher_assignments ta where ta.teacher_profile_id = auth.uid() and ta.section_id = student_attendance.section_id)
  )
);

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 6
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('hr.manage',                       'hr', 'Manage employee records, leave, contracts, documents'),
  ('payroll.manage',                  'hr', 'Manage salary structures and generate salary slips'),
  ('students.view_all_sections',       'students', 'View students across every section in the school, not just assigned ones'),
  ('attendance.mark_all_sections',     'attendance', 'Mark attendance for any section, not just assigned ones')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    (r.name in ('Super Admin','Organization Owner') and p.module = 'hr')
    or (r.name = 'HR Manager' and p.key in ('hr.manage'))
    or (r.name = 'Accountant' and p.key = 'payroll.manage')
    or (r.name in ('Super Admin','Organization Owner','School Administrator','Principal','Vice Principal')
        and p.key in ('students.view_all_sections','attendance.mark_all_sections'))
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (6, 'Teachers & HR', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
