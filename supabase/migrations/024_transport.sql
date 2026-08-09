-- =====================================================================
-- PHASE 13: TRANSPORT
-- Depends on: 001 (schools), 004 (students), 006 (employees — drivers),
-- 016 (ledger_entries — fuel/maintenance costs post real expenses,
-- same cross-module pattern established in Phase 11's Inventory).
-- =====================================================================

create table transport_vehicles (
  id                uuid primary key default uuid_generate_v4(),
  school_id         uuid not null references schools(id) on delete cascade,
  registration_number text not null,
  vehicle_type      text not null default 'bus' check (vehicle_type in ('bus','van','car')),
  capacity          integer not null check (capacity > 0),
  driver_profile_id uuid references employees(profile_id) on delete set null,
  -- "GPS Ready" per the PRD: a field to attach a real device/tracker ID
  -- to, so a GPS provider's data can be joined against this vehicle —
  -- no fake live-map is rendered without a real device behind it.
  gps_device_id     text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (school_id, registration_number)
);

create table transport_routes (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,
  vehicle_id    uuid references transport_vehicles(id) on delete set null,
  description   text,
  created_at    timestamptz not null default now(),
  unique (school_id, name)
);

create table transport_stops (
  id            uuid primary key default uuid_generate_v4(),
  route_id      uuid not null references transport_routes(id) on delete cascade,
  name          text not null,
  sequence      integer not null default 0,
  pickup_time   time,
  drop_time     time,
  created_at    timestamptz not null default now(),
  unique (route_id, sequence)
);
create index idx_transport_stops_route on transport_stops(route_id);

create table student_transport_allocations (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references students(id) on delete cascade,
  route_id          uuid not null references transport_routes(id) on delete cascade,
  stop_id           uuid not null references transport_stops(id) on delete cascade,
  academic_year_id  uuid not null references academic_years(id) on delete cascade,
  status            text not null default 'active' check (status in ('active','cancelled')),
  created_at        timestamptz not null default now(),
  unique (student_id, academic_year_id)
);
create index idx_transport_allocations_route on student_transport_allocations(route_id);

create table vehicle_fuel_logs (
  id                uuid primary key default uuid_generate_v4(),
  vehicle_id        uuid not null references transport_vehicles(id) on delete cascade,
  fill_date         date not null default current_date,
  liters            numeric(8,2) not null check (liters > 0),
  cost              numeric(10,2) not null check (cost >= 0),
  odometer_reading  integer,
  recorded_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_fuel_logs_vehicle on vehicle_fuel_logs(vehicle_id, fill_date desc);

create table vehicle_maintenance_logs (
  id                uuid primary key default uuid_generate_v4(),
  vehicle_id        uuid not null references transport_vehicles(id) on delete cascade,
  maintenance_date  date not null default current_date,
  description       text not null,
  cost              numeric(10,2) not null check (cost >= 0),
  next_due_date     date,
  recorded_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_maintenance_logs_vehicle on vehicle_maintenance_logs(vehicle_id, maintenance_date desc);

-- ---------------------------------------------------------------------
-- FUEL/MAINTENANCE → LEDGER AUTOMATION
-- Same real cross-module posting established in Phase 11: transport
-- running costs actually show up in Financial Reports, not just a note
-- that they should.
-- ---------------------------------------------------------------------
create or replace function fn_post_transport_expense()
returns trigger
language plpgsql security definer
as $$
declare
  v_school_id uuid;
  v_org_id uuid;
  v_category text;
  v_registration text;
begin
  select school_id into v_school_id from transport_vehicles where id = NEW.vehicle_id;
  select organization_id into v_org_id from schools where id = v_school_id;
  select registration_number into v_registration from transport_vehicles where id = NEW.vehicle_id;

  v_category := case TG_TABLE_NAME when 'vehicle_fuel_logs' then 'Transport Fuel' else 'Transport Maintenance' end;

  insert into ledger_entries (organization_id, school_id, entry_type, category, amount, entry_date, description, recorded_by_profile_id)
  values (
    v_org_id, v_school_id, 'expense', v_category, NEW.cost,
    case TG_TABLE_NAME when 'vehicle_fuel_logs' then NEW.fill_date else NEW.maintenance_date end,
    v_category || ' — ' || v_registration,
    NEW.recorded_by_profile_id
  );

  return NEW;
end;
$$;

create trigger trg_fuel_log_ledger after insert on vehicle_fuel_logs
  for each row execute function fn_post_transport_expense();
create trigger trg_maintenance_log_ledger after insert on vehicle_maintenance_logs
  for each row execute function fn_post_transport_expense();

create trigger audit_transport_vehicles after insert or update or delete on transport_vehicles
  for each row execute function fn_audit_trigger();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table transport_vehicles enable row level security;
alter table transport_routes enable row level security;
alter table transport_stops enable row level security;
alter table student_transport_allocations enable row level security;
alter table vehicle_fuel_logs enable row level security;
alter table vehicle_maintenance_logs enable row level security;

create policy transport_vehicles_select on transport_vehicles for select using (auth_has_school_access(school_id));
create policy transport_vehicles_write on transport_vehicles for all using (
  auth_has_school_access(school_id) and auth_has_permission('transport.manage'));

create policy transport_routes_select on transport_routes for select using (auth_has_school_access(school_id));
create policy transport_routes_write on transport_routes for all using (
  auth_has_school_access(school_id) and auth_has_permission('transport.manage'));

create policy transport_stops_select on transport_stops for select using (
  route_id in (select id from transport_routes where auth_has_school_access(school_id)));
create policy transport_stops_write on transport_stops for all using (
  route_id in (select id from transport_routes where auth_has_school_access(school_id)) and auth_has_permission('transport.manage'));

create policy transport_allocations_select on student_transport_allocations for select using (
  student_id in (select id from students where auth_has_school_access(school_id)) and auth_has_permission('transport.view'));
create policy transport_allocations_write on student_transport_allocations for all using (
  student_id in (select id from students where auth_has_school_access(school_id)) and auth_has_permission('transport.manage'));

create policy fuel_logs_select on vehicle_fuel_logs for select using (
  vehicle_id in (select id from transport_vehicles where auth_has_school_access(school_id)) and auth_has_permission('transport.manage'));
create policy fuel_logs_write on vehicle_fuel_logs for all using (
  vehicle_id in (select id from transport_vehicles where auth_has_school_access(school_id)) and auth_has_permission('transport.manage'));

create policy maintenance_logs_select on vehicle_maintenance_logs for select using (
  vehicle_id in (select id from transport_vehicles where auth_has_school_access(school_id)) and auth_has_permission('transport.manage'));
create policy maintenance_logs_write on vehicle_maintenance_logs for all using (
  vehicle_id in (select id from transport_vehicles where auth_has_school_access(school_id)) and auth_has_permission('transport.manage'));

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 13
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('transport.view',   'transport', 'View routes, stops, and student allocations'),
  ('transport.manage', 'transport', 'Manage vehicles, routes, stops, allocations, fuel, and maintenance logs')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    r.name in ('Super Admin','Organization Owner','School Administrator','Transport Manager') and p.module = 'transport'
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (13, 'Transport', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
