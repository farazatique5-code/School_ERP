-- =====================================================================
-- PHASE 2: SYSTEM ROLE TEMPLATES, ORGANIZATION PROVISIONING, PHASE TRACKING
-- Depends on: 001_core_foundation.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SYSTEM ROLE TEMPLATES (organization_id = null, seeded once)
-- These are copied into every new organization at provisioning time.
-- ---------------------------------------------------------------------
insert into roles (organization_id, name, is_system, description) values
  (null, 'Super Admin',         true, 'Platform-level administrator across all organizations'),
  (null, 'Organization Owner',  true, 'Owns billing and top-level configuration for the organization'),
  (null, 'School Administrator',true, 'Administers a single school/campus'),
  (null, 'Principal',           true, 'Academic head of a school'),
  (null, 'Vice Principal',      true, 'Deputy academic head'),
  (null, 'HR Manager',          true, 'Manages staff records and payroll'),
  (null, 'Accountant',          true, 'Manages fees and financial records'),
  (null, 'Admission Officer',   true, 'Manages the admissions pipeline'),
  (null, 'Teacher',             true, 'Teaches assigned classes and subjects'),
  (null, 'Class Teacher',       true, 'Teacher with homeroom responsibility for one section'),
  (null, 'Examination Controller', true, 'Manages exam scheduling and result publication'),
  (null, 'Librarian',           true, 'Manages library catalog and circulation'),
  (null, 'Hostel Manager',      true, 'Manages hostel operations'),
  (null, 'Transport Manager',   true, 'Manages transport fleet and routes'),
  (null, 'Parent',              true, 'Guardian portal access, scoped to own children'),
  (null, 'Student',             true, 'Student portal access, scoped to own record')
on conflict (organization_id, name) do nothing;

-- System-role → permission seed mapping for the Phase 1 permission catalog.
-- (Later phases append more rows here as they add permission keys.)
with role_perm_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    (r.name in ('Super Admin','Organization Owner') ) -- gets everything in Phase 1 catalog
    or (r.name = 'School Administrator' and p.key in
        ('schools.manage','academics.manage','roles.manage','users.manage','audit_logs.view','automation.view','dashboard.view'))
    or (r.name = 'Principal' and p.key in ('academics.manage','audit_logs.view','dashboard.view'))
    or (r.name = 'Vice Principal' and p.key in ('academics.manage','dashboard.view'))
    or (r.name = 'HR Manager' and p.key in ('users.manage','dashboard.view'))
    or (r.name not in ('Super Admin','Organization Owner','School Administrator','Principal','Vice Principal','HR Manager')
        and p.key = 'dashboard.view')
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from role_perm_map
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------
-- 2. PLATFORM PHASE TRACKING
-- Real, queried-by-the-dashboard record of which build phases are live.
-- This is NOT decorative — the Dashboard's "Platform Modules" widget
-- reads this table so it only ever shows KPIs for modules that actually
-- have data behind them.
-- ---------------------------------------------------------------------
create table platform_phases (
  id            integer primary key,
  name          text not null,
  status        text not null default 'planned' check (status in ('planned','in_progress','live')),
  completed_at  timestamptz
);

insert into platform_phases (id, name, status, completed_at) values
  (1, 'Foundation: PRD, Schema, Design System', 'live', now()),
  (2, 'Auth, Organization Setup, Dashboard', 'in_progress', null),
  (3, 'Student Information System', 'planned', null),
  (4, 'Admissions', 'planned', null),
  (5, 'Attendance', 'planned', null),
  (6, 'Teachers & HR', 'planned', null),
  (7, 'Timetable', 'planned', null),
  (8, 'Examination', 'planned', null),
  (9, 'Fees & Finance', 'planned', null),
  (10, 'Library', 'planned', null),
  (11, 'Inventory', 'planned', null),
  (12, 'Hostel', 'planned', null),
  (13, 'Transport', 'planned', null),
  (14, 'Parent & Student Portals', 'planned', null),
  (15, 'Reports & Analytics', 'planned', null),
  (16, 'AI Copilot & AI Features', 'planned', null)
on conflict (id) do nothing;

alter table platform_phases enable row level security;
create policy platform_phases_select on platform_phases for select using (true); -- same for every tenant

-- ---------------------------------------------------------------------
-- 3. ORGANIZATION PROVISIONING RPC
-- Called by the `provision-organization` Edge Function AFTER it creates
-- the Supabase auth user (auth.users row) with the service role key.
-- This function does everything else atomically: organization row,
-- first school, copies system role templates into org-owned roles,
-- creates the profile, and assigns "Organization Owner".
-- security definer because a brand-new user has no rows/permissions
-- yet for RLS to key off; this function is the one deliberate,
-- narrowly-scoped exception, and it is NOT exposed except via the
-- Edge Function, which requires a valid just-created auth session.
-- ---------------------------------------------------------------------
create or replace function provision_organization(
  p_user_id uuid,
  p_user_email text,
  p_user_full_name text,
  p_org_name text,
  p_org_slug text,
  p_school_name text,
  p_school_code text
) returns jsonb
language plpgsql security definer
as $$
declare
  v_org_id uuid;
  v_school_id uuid;
  v_owner_role_id uuid;
  v_template record;
  v_new_role_id uuid;
begin
  if exists (select 1 from organizations where slug = p_org_slug) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;

  insert into organizations (name, slug) values (p_org_name, p_org_slug)
  returning id into v_org_id;

  insert into schools (organization_id, name, code)
  values (v_org_id, p_school_name, p_school_code)
  returning id into v_school_id;

  -- Copy every system role template into this org as its own editable rows,
  -- carrying over the template's default permission grants.
  for v_template in select * from roles where organization_id is null loop
    insert into roles (organization_id, name, is_system, description)
    values (v_org_id, v_template.name, false, v_template.description)
    returning id into v_new_role_id;

    insert into role_permissions (role_id, permission_id)
    select v_new_role_id, rp.permission_id
    from role_permissions rp where rp.role_id = v_template.id;

    if v_template.name = 'Organization Owner' then
      v_owner_role_id := v_new_role_id;
    end if;
  end loop;

  insert into profiles (id, organization_id, full_name, email)
  values (p_user_id, v_org_id, p_user_full_name, p_user_email);

  -- Organization Owner role is org-wide: school_id = null.
  insert into user_roles (profile_id, role_id, school_id)
  values (p_user_id, v_owner_role_id, null);

  return jsonb_build_object(
    'organization_id', v_org_id,
    'school_id', v_school_id
  );
end;
$$;

revoke all on function provision_organization from public;
grant execute on function provision_organization to service_role;
