-- =====================================================================
-- PHASE 15: REPORTS & ANALYTICS
-- No new tables — this phase is entirely a consumer of data every prior
-- phase already produced (report definitions, dashboard KPIs, PDF/Excel/
-- CSV export). The one schema change is the permission grant below.
-- =====================================================================

insert into permissions (key, module, description) values
  ('reports.export', 'reports', 'Run cross-module reports and export CSV/Excel/PDF')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    r.name in ('Super Admin','Organization Owner','School Administrator','Principal','Accountant','HR Manager','Examination Controller')
    and p.key = 'reports.export'
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

update platform_phases set status = 'live', completed_at = now() where id = 15;
