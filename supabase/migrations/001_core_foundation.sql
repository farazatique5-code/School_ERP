-- =====================================================================
-- PHASE 1: CORE FOUNDATION SCHEMA
-- Multi-tenant organizations/schools, RBAC, audit logging, notifications
-- Every later phase's migrations FK into these tables. Do not alter
-- primary keys or the organization_id/school_id contract without a
-- full migration plan.
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. ORGANIZATIONS (billing + white-label tenant root)
-- ---------------------------------------------------------------------
create table organizations (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  slug                text not null unique,               -- used for subdomain routing: {slug}.app.com
  custom_domain       text unique,                          -- optional white-label custom domain
  logo_url            text,
  favicon_url         text,
  primary_color       text default '#4F46E5',
  secondary_color     text default '#0EA5E9',
  theme_mode_default  text not null default 'light' check (theme_mode_default in ('light','dark','system')),
  subscription_plan   text not null default 'trial' check (subscription_plan in ('trial','starter','growth','enterprise')),
  subscription_status text not null default 'active' check (subscription_status in ('active','past_due','suspended','cancelled')),
  billing_email       text,
  max_schools         integer not null default 1,
  max_students        integer not null default 500,
  settings            jsonb not null default '{}'::jsonb,   -- feature flags, email templates, sms sender id, etc.
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz                            -- soft delete
);
create index idx_organizations_slug on organizations(slug) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 2. SCHOOLS (a campus/school under an organization)
-- ---------------------------------------------------------------------
create table schools (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  name              text not null,
  code              text not null,                          -- short code, unique per org, e.g. "MAIN", "NORTH"
  type              text not null default 'school' check (type in ('school','college','academy','campus')),
  address           text,
  city              text,
  state             text,
  country           text,
  postal_code       text,
  phone             text,
  email             text,
  logo_url          text,                                    -- can override org logo per campus
  timezone          text not null default 'UTC',
  is_active         boolean not null default true,
  settings          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (organization_id, code)
);
create index idx_schools_org on schools(organization_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 3. ACADEMIC STRUCTURE: academic years, terms, classes, sections, subjects
-- ---------------------------------------------------------------------
create table academic_years (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,                 -- e.g. "2026-2027"
  start_date    date not null,
  end_date      date not null,
  is_current    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_date > start_date)
);
create index idx_academic_years_school on academic_years(school_id);
-- only one "current" academic year per school
create unique index uq_one_current_academic_year on academic_years(school_id) where is_current;

create table terms (
  id                  uuid primary key default uuid_generate_v4(),
  academic_year_id    uuid not null references academic_years(id) on delete cascade,
  name                text not null,           -- e.g. "Term 1"
  sequence            integer not null default 1,
  start_date          date not null,
  end_date            date not null,
  created_at          timestamptz not null default now(),
  check (end_date > start_date)
);
create index idx_terms_academic_year on terms(academic_year_id);

create table departments (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,
  code          text,
  created_at    timestamptz not null default now(),
  unique (school_id, name)
);

create table houses (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,
  color         text,
  created_at    timestamptz not null default now(),
  unique (school_id, name)
);

create table grading_scales (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,                 -- e.g. "Standard Percentage", "GPA 4.0"
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);

create table grading_scale_bands (
  id                uuid primary key default uuid_generate_v4(),
  grading_scale_id  uuid not null references grading_scales(id) on delete cascade,
  grade_label       text not null,             -- "A+", "B", etc.
  min_percent       numeric(5,2) not null,
  max_percent       numeric(5,2) not null,
  grade_point       numeric(4,2),
  remark            text,
  check (max_percent >= min_percent)
);

create table classes (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name          text not null,                 -- "Grade 10", "Class VIII"
  sequence      integer not null default 0,     -- for ordering Grade 1..12
  created_at    timestamptz not null default now(),
  unique (school_id, academic_year_id, name)
);
create index idx_classes_school_year on classes(school_id, academic_year_id);

create table sections (
  id            uuid primary key default uuid_generate_v4(),
  class_id      uuid not null references classes(id) on delete cascade,
  name          text not null,                 -- "A", "B", "Blue"
  capacity      integer,
  room_number   text,
  created_at    timestamptz not null default now(),
  unique (class_id, name)
);
create index idx_sections_class on sections(class_id);

create table subjects (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,
  code          text,
  department_id uuid references departments(id) on delete set null,
  is_elective   boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (school_id, code)
);

create table class_subjects (          -- which subjects apply to which class
  class_id      uuid not null references classes(id) on delete cascade,
  subject_id    uuid not null references subjects(id) on delete cascade,
  is_mandatory  boolean not null default true,
  primary key (class_id, subject_id)
);

create table school_timings (
  id              uuid primary key default uuid_generate_v4(),
  school_id       uuid not null references schools(id) on delete cascade,
  day_of_week     integer not null check (day_of_week between 0 and 6), -- 0=Sunday
  opens_at        time not null,
  closes_at       time not null,
  is_working_day  boolean not null default true,
  unique (school_id, day_of_week)
);

-- ---------------------------------------------------------------------
-- 4. RBAC: roles, permissions, role_permissions, org/school memberships
-- ---------------------------------------------------------------------

-- Permissions are fixed, code-level capability keys (e.g. "students.create").
-- New permission keys are added via migration as new modules ship;
-- they are never invented ad hoc in application code.
create table permissions (
  id            uuid primary key default uuid_generate_v4(),
  key           text not null unique,           -- "students.create", "fees.view", "reports.export"
  module        text not null,                  -- "students", "fees", "reports" — for grouping in UI
  description   text not null,
  created_at    timestamptz not null default now()
);

-- Roles are tenant-scoped so an org can create custom roles.
-- Roles with organization_id = null are system-level templates seeded
-- for every new organization at creation time (copy-on-create).
create table roles (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid references organizations(id) on delete cascade,
  name              text not null,               -- "Teacher", "Accountant", or a custom name
  is_system         boolean not null default false, -- system roles cannot be deleted, only their permission set edited
  description       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, name)
);
create index idx_roles_org on roles(organization_id);

create table role_permissions (
  role_id         uuid not null references roles(id) on delete cascade,
  permission_id   uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- profiles = 1:1 extension of Supabase auth.users, tenant-scoped.
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  organization_id   uuid not null references organizations(id) on delete cascade,
  full_name         text not null,
  email             text not null,
  phone             text,
  avatar_url        text,
  is_active         boolean not null default true,
  locale            text not null default 'en',
  theme_preference  text not null default 'system' check (theme_preference in ('light','dark','system')),
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_profiles_org on profiles(organization_id);

-- A user can hold a role scoped to a whole organization (school_id null)
-- or scoped to one specific school (e.g. a Teacher only at Campus North).
create table user_roles (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid not null references profiles(id) on delete cascade,
  role_id         uuid not null references roles(id) on delete cascade,
  school_id       uuid references schools(id) on delete cascade,   -- null = org-wide role (e.g. Org Owner)
  created_at      timestamptz not null default now(),
  unique (profile_id, role_id, school_id)
);
create index idx_user_roles_profile on user_roles(profile_id);
create index idx_user_roles_school on user_roles(school_id);

-- ---------------------------------------------------------------------
-- 5. AUDIT LOGS (append-only)
-- ---------------------------------------------------------------------
create table audit_logs (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  school_id         uuid references schools(id) on delete set null,
  actor_profile_id  uuid references profiles(id) on delete set null,
  action            text not null,               -- "insert" | "update" | "delete" | custom action names
  table_name        text not null,
  row_id            uuid,
  before_data       jsonb,
  after_data        jsonb,
  ip_address        inet,
  created_at        timestamptz not null default now()
);
create index idx_audit_logs_org_time on audit_logs(organization_id, created_at desc);
create index idx_audit_logs_table_row on audit_logs(table_name, row_id);
-- Audit logs are append-only: no update/delete grants issued to app roles (enforced in RLS section).

-- ---------------------------------------------------------------------
-- 6. AUTOMATION RUNS (observability for Section 6 automations)
-- ---------------------------------------------------------------------
create table automation_runs (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  automation_key    text not null,               -- "admission_approved", "fee_payment_recorded", etc.
  trigger_table     text not null,
  trigger_row_id    uuid,
  status            text not null default 'success' check (status in ('success','failed')),
  error_message     text,
  payload           jsonb,
  created_at        timestamptz not null default now()
);
create index idx_automation_runs_org_time on automation_runs(organization_id, created_at desc);

-- ---------------------------------------------------------------------
-- 7. NOTIFICATIONS (in-app + outbound channel log)
-- ---------------------------------------------------------------------
create table notifications (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  school_id         uuid references schools(id) on delete cascade,
  recipient_profile_id uuid references profiles(id) on delete cascade,
  channel           text not null default 'in_app' check (channel in ('in_app','email','sms','whatsapp','push')),
  title             text not null,
  body              text not null,
  link_url          text,
  is_read           boolean not null default false,
  sent_at           timestamptz,
  created_at        timestamptz not null default now()
);
create index idx_notifications_recipient on notifications(recipient_profile_id, is_read);

-- =====================================================================
-- HELPER FUNCTIONS used by RLS policies across ALL phases.
-- These are the single source of truth for "does the current user
-- belong to org X / school Y / hold permission Z" — every future
-- phase's RLS policies call these instead of re-deriving membership.
-- =====================================================================

create or replace function auth_organization_id()
returns uuid
language sql stable security definer
as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function auth_has_permission(perm_key text)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions p on p.id = rp.permission_id
    where ur.profile_id = auth.uid()
      and p.key = perm_key
  );
$$;

create or replace function auth_has_school_access(target_school_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from user_roles ur
    where ur.profile_id = auth.uid()
      and (ur.school_id = target_school_id or ur.school_id is null) -- null = org-wide role sees all schools in org
  )
  and (
    select organization_id from schools where id = target_school_id
  ) = auth_organization_id();
$$;

create or replace function is_super_admin()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.profile_id = auth.uid() and r.name = 'Super Admin' and r.is_system
  );
$$;

-- Generic audit trigger function, attached per-table in each phase's migration.
create or replace function fn_audit_trigger()
returns trigger
language plpgsql security definer
as $$
declare
  v_org_id uuid;
begin
  begin
    v_org_id := coalesce(NEW.organization_id, OLD.organization_id);
  exception when others then
    v_org_id := auth_organization_id();
  end;

  insert into audit_logs (organization_id, actor_profile_id, action, table_name, row_id, before_data, after_data)
  values (
    v_org_id,
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    coalesce((NEW).id, (OLD).id),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('UPDATE','INSERT') then to_jsonb(NEW) else null end
  );
  return coalesce(NEW, OLD);
end;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table organizations enable row level security;
alter table schools enable row level security;
alter table academic_years enable row level security;
alter table terms enable row level security;
alter table departments enable row level security;
alter table houses enable row level security;
alter table grading_scales enable row level security;
alter table grading_scale_bands enable row level security;
alter table classes enable row level security;
alter table sections enable row level security;
alter table subjects enable row level security;
alter table class_subjects enable row level security;
alter table school_timings enable row level security;
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table permissions enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table audit_logs enable row level security;
alter table automation_runs enable row level security;
alter table notifications enable row level security;

-- organizations: a user can only see their own organization; Super Admin sees all.
create policy org_select on organizations for select
  using (id = auth_organization_id() or is_super_admin());
create policy org_update on organizations for update
  using (id = auth_organization_id() and auth_has_permission('organization.update'));

-- schools: tenant-scoped, plus per-school access for non-org-wide roles.
create policy schools_select on schools for select
  using (organization_id = auth_organization_id());
create policy schools_write on schools for insert with check (
  organization_id = auth_organization_id() and auth_has_permission('schools.manage'));
create policy schools_update on schools for update using (
  organization_id = auth_organization_id() and auth_has_permission('schools.manage'));

-- academic structure tables: visible to anyone in the same org, editable by permission holders.
create policy academic_years_select on academic_years for select using (
  school_id in (select id from schools where organization_id = auth_organization_id()));
create policy academic_years_write on academic_years for insert with check (
  auth_has_school_access(school_id) and auth_has_permission('academics.manage'));
create policy academic_years_update on academic_years for update using (
  auth_has_school_access(school_id) and auth_has_permission('academics.manage'));

create policy terms_select on terms for select using (
  academic_year_id in (select id from academic_years where school_id in
    (select id from schools where organization_id = auth_organization_id())));
create policy terms_write on terms for insert with check (
  academic_year_id in (select id from academic_years ay where auth_has_school_access(ay.school_id))
  and auth_has_permission('academics.manage'));

create policy departments_select on departments for select using (
  school_id in (select id from schools where organization_id = auth_organization_id()));
create policy departments_write on departments for all using (
  auth_has_school_access(school_id) and auth_has_permission('academics.manage'));

create policy houses_select on houses for select using (
  school_id in (select id from schools where organization_id = auth_organization_id()));
create policy houses_write on houses for all using (
  auth_has_school_access(school_id) and auth_has_permission('academics.manage'));

create policy grading_scales_select on grading_scales for select using (
  school_id in (select id from schools where organization_id = auth_organization_id()));
create policy grading_scales_write on grading_scales for all using (
  auth_has_school_access(school_id) and auth_has_permission('academics.manage'));

create policy grading_bands_select on grading_scale_bands for select using (
  grading_scale_id in (select id from grading_scales where school_id in
    (select id from schools where organization_id = auth_organization_id())));
create policy grading_bands_write on grading_scale_bands for all using (
  grading_scale_id in (select id from grading_scales gs where auth_has_school_access(gs.school_id))
  and auth_has_permission('academics.manage'));

create policy classes_select on classes for select using (
  school_id in (select id from schools where organization_id = auth_organization_id()));
create policy classes_write on classes for all using (
  auth_has_school_access(school_id) and auth_has_permission('academics.manage'));

create policy sections_select on sections for select using (
  class_id in (select id from classes where school_id in
    (select id from schools where organization_id = auth_organization_id())));
create policy sections_write on sections for all using (
  class_id in (select id from classes c where auth_has_school_access(c.school_id))
  and auth_has_permission('academics.manage'));

create policy subjects_select on subjects for select using (
  school_id in (select id from schools where organization_id = auth_organization_id()));
create policy subjects_write on subjects for all using (
  auth_has_school_access(school_id) and auth_has_permission('academics.manage'));

create policy class_subjects_select on class_subjects for select using (
  class_id in (select id from classes where school_id in
    (select id from schools where organization_id = auth_organization_id())));
create policy class_subjects_write on class_subjects for all using (
  class_id in (select id from classes c where auth_has_school_access(c.school_id))
  and auth_has_permission('academics.manage'));

create policy school_timings_select on school_timings for select using (
  school_id in (select id from schools where organization_id = auth_organization_id()));
create policy school_timings_write on school_timings for all using (
  auth_has_school_access(school_id) and auth_has_permission('academics.manage'));

-- RBAC tables
create policy permissions_select on permissions for select using (true); -- global read-only catalog
create policy roles_select on roles for select using (
  organization_id is null or organization_id = auth_organization_id());
create policy roles_write on roles for insert with check (
  organization_id = auth_organization_id() and auth_has_permission('roles.manage'));
create policy roles_update on roles for update using (
  organization_id = auth_organization_id() and auth_has_permission('roles.manage') and not is_system);

create policy role_permissions_select on role_permissions for select using (
  role_id in (select id from roles where organization_id is null or organization_id = auth_organization_id()));
create policy role_permissions_write on role_permissions for all using (
  role_id in (select id from roles where organization_id = auth_organization_id())
  and auth_has_permission('roles.manage'));

-- profiles: users see profiles within their own org only.
create policy profiles_select on profiles for select using (
  organization_id = auth_organization_id());
create policy profiles_update_self on profiles for update using (id = auth.uid());
create policy profiles_update_admin on profiles for update using (
  organization_id = auth_organization_id() and auth_has_permission('users.manage'));

create policy user_roles_select on user_roles for select using (
  profile_id in (select id from profiles where organization_id = auth_organization_id()));
create policy user_roles_write on user_roles for all using (
  profile_id in (select id from profiles where organization_id = auth_organization_id())
  and auth_has_permission('roles.manage'));

-- audit logs: read-only to those with permission; no update/delete policy exists (append-only).
create policy audit_logs_select on audit_logs for select using (
  organization_id = auth_organization_id() and auth_has_permission('audit_logs.view'));
create policy audit_logs_insert on audit_logs for insert with check (
  organization_id = auth_organization_id());

create policy automation_runs_select on automation_runs for select using (
  organization_id = auth_organization_id() and auth_has_permission('automation.view'));

-- notifications: a user can only see their own notifications.
create policy notifications_select on notifications for select using (
  recipient_profile_id = auth.uid());
create policy notifications_update_self on notifications for update using (
  recipient_profile_id = auth.uid());

-- =====================================================================
-- SEED DATA: base permission catalog for Phase 1 + Phase 2 scope.
-- Later phases append their own permission keys in their own migrations.
-- =====================================================================
insert into permissions (key, module, description) values
  ('organization.update', 'organization', 'Edit organization profile and branding'),
  ('schools.manage',      'schools',      'Create and edit school/campus records'),
  ('academics.manage',    'academics',    'Manage academic years, terms, classes, sections, subjects'),
  ('roles.manage',        'settings',     'Create roles and assign permissions'),
  ('users.manage',        'settings',     'Manage user accounts and role assignments'),
  ('audit_logs.view',     'settings',     'View audit log history'),
  ('automation.view',     'settings',     'View automation run history'),
  ('dashboard.view',      'dashboard',    'View the operational dashboard');
