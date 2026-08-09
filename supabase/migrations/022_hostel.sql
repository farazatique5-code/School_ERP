-- =====================================================================
-- PHASE 12: HOSTEL
-- Depends on: 001 (schools), 004 (students), 006 (employees — wardens).
-- =====================================================================

create table hostel_buildings (
  id                uuid primary key default uuid_generate_v4(),
  school_id         uuid not null references schools(id) on delete cascade,
  name              text not null,
  warden_profile_id uuid references employees(profile_id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (school_id, name)
);

create table hostel_rooms (
  id            uuid primary key default uuid_generate_v4(),
  building_id   uuid not null references hostel_buildings(id) on delete cascade,
  room_number   text not null,
  room_type     text not null default 'dormitory' check (room_type in ('single','double','dormitory')),
  created_at    timestamptz not null default now(),
  unique (building_id, room_number)
);

create table hostel_beds (
  id            uuid primary key default uuid_generate_v4(),
  room_id       uuid not null references hostel_rooms(id) on delete cascade,
  bed_number    text not null,
  status        text not null default 'vacant' check (status in ('vacant','occupied','maintenance')),
  created_at    timestamptz not null default now(),
  unique (room_id, bed_number)
);
create index idx_hostel_beds_room on hostel_beds(room_id);

-- ---------------------------------------------------------------------
-- ALLOCATIONS — a student's assignment to a bed for a year. Bed status
-- is kept in sync by functions below, never edited by hand, so
-- "occupied" always genuinely means "has an active allocation."
-- ---------------------------------------------------------------------
create table hostel_allocations (
  id                uuid primary key default uuid_generate_v4(),
  bed_id            uuid not null references hostel_beds(id) on delete cascade,
  student_id        uuid not null references students(id) on delete cascade,
  academic_year_id  uuid not null references academic_years(id) on delete cascade,
  allocated_date    date not null default current_date,
  vacated_date      date,
  status            text not null default 'active' check (status in ('active','vacated')),
  allocated_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_hostel_allocations_student on hostel_allocations(student_id);
-- a bed can only have one active allocation at a time
create unique index uq_one_active_allocation_per_bed on hostel_allocations(bed_id) where status = 'active';
-- a student can only have one active hostel allocation at a time (across
-- any building/room), so they can't accidentally be billed/assigned twice
create unique index uq_one_active_allocation_per_student on hostel_allocations(student_id) where status = 'active';

create or replace function fn_allocate_bed(p_bed_id uuid, p_student_id uuid, p_academic_year_id uuid, p_allocated_by uuid)
returns uuid
language plpgsql security definer
as $$
declare
  v_bed_status text;
  v_allocation_id uuid;
begin
  select status into v_bed_status from hostel_beds where id = p_bed_id for update;
  if v_bed_status != 'vacant' then
    raise exception 'bed_not_vacant' using errcode = 'P0004';
  end if;

  insert into hostel_allocations (bed_id, student_id, academic_year_id, allocated_by_profile_id)
  values (p_bed_id, p_student_id, p_academic_year_id, p_allocated_by)
  returning id into v_allocation_id;

  update hostel_beds set status = 'occupied' where id = p_bed_id;

  return v_allocation_id;
end;
$$;
grant execute on function fn_allocate_bed to authenticated;

create or replace function fn_vacate_bed(p_allocation_id uuid)
returns void
language plpgsql security definer
as $$
declare
  v_bed_id uuid;
begin
  select bed_id into v_bed_id from hostel_allocations where id = p_allocation_id for update;

  update hostel_allocations set status = 'vacated', vacated_date = current_date where id = p_allocation_id;
  update hostel_beds set status = 'vacant' where id = v_bed_id;
end;
$$;
grant execute on function fn_vacate_bed to authenticated;

-- ---------------------------------------------------------------------
-- VISITORS LOG
-- ---------------------------------------------------------------------
create table hostel_visitors (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references students(id) on delete cascade,
  visitor_name      text not null,
  relationship      text,
  visit_date        date not null default current_date,
  check_in_time     time not null default current_time,
  check_out_time    time,
  purpose           text,
  logged_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_hostel_visitors_student on hostel_visitors(student_id, visit_date desc);

-- ---------------------------------------------------------------------
-- MESS MENU
-- ---------------------------------------------------------------------
create table mess_menus (
  id                uuid primary key default uuid_generate_v4(),
  school_id         uuid not null references schools(id) on delete cascade,
  day_of_week       integer not null check (day_of_week between 0 and 6),
  meal_type         text not null check (meal_type in ('breakfast','lunch','snacks','dinner')),
  menu_description  text not null,
  unique (school_id, day_of_week, meal_type)
);

-- ---------------------------------------------------------------------
-- HOSTEL ATTENDANCE (evening roll call — distinct from academic
-- attendance in Phase 5, since it happens outside class hours)
-- ---------------------------------------------------------------------
create table hostel_attendance (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references students(id) on delete cascade,
  attendance_date   date not null,
  status            text not null check (status in ('present','absent','on_leave')),
  marked_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create trigger audit_hostel_allocations after insert or update or delete on hostel_allocations
  for each row execute function fn_audit_trigger();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table hostel_buildings enable row level security;
alter table hostel_rooms enable row level security;
alter table hostel_beds enable row level security;
alter table hostel_allocations enable row level security;
alter table hostel_visitors enable row level security;
alter table mess_menus enable row level security;
alter table hostel_attendance enable row level security;

create policy hostel_buildings_select on hostel_buildings for select using (auth_has_school_access(school_id));
create policy hostel_buildings_write on hostel_buildings for all using (
  auth_has_school_access(school_id) and auth_has_permission('hostel.manage'));

create policy hostel_rooms_select on hostel_rooms for select using (
  building_id in (select id from hostel_buildings where auth_has_school_access(school_id)));
create policy hostel_rooms_write on hostel_rooms for all using (
  building_id in (select id from hostel_buildings where auth_has_school_access(school_id)) and auth_has_permission('hostel.manage'));

create policy hostel_beds_select on hostel_beds for select using (
  room_id in (select r.id from hostel_rooms r join hostel_buildings b on b.id = r.building_id where auth_has_school_access(b.school_id)));
create policy hostel_beds_write on hostel_beds for all using (
  room_id in (select r.id from hostel_rooms r join hostel_buildings b on b.id = r.building_id where auth_has_school_access(b.school_id))
  and auth_has_permission('hostel.manage'));

create policy hostel_allocations_select on hostel_allocations for select using (
  bed_id in (select hb.id from hostel_beds hb join hostel_rooms r on r.id = hb.room_id join hostel_buildings b on b.id = r.building_id where auth_has_school_access(b.school_id)));
create policy hostel_allocations_write on hostel_allocations for all using (
  bed_id in (select hb.id from hostel_beds hb join hostel_rooms r on r.id = hb.room_id join hostel_buildings b on b.id = r.building_id where auth_has_school_access(b.school_id))
  and auth_has_permission('hostel.manage'));

create policy hostel_visitors_select on hostel_visitors for select using (
  student_id in (select id from students where auth_has_school_access(school_id)) and auth_has_permission('hostel.manage'));
create policy hostel_visitors_write on hostel_visitors for all using (
  student_id in (select id from students where auth_has_school_access(school_id)) and auth_has_permission('hostel.manage'));

create policy mess_menus_select on mess_menus for select using (auth_has_school_access(school_id));
create policy mess_menus_write on mess_menus for all using (
  auth_has_school_access(school_id) and auth_has_permission('hostel.manage'));

create policy hostel_attendance_select on hostel_attendance for select using (
  student_id in (select id from students where auth_has_school_access(school_id)) and auth_has_permission('hostel.manage'));
create policy hostel_attendance_write on hostel_attendance for all using (
  student_id in (select id from students where auth_has_school_access(school_id)) and auth_has_permission('hostel.manage'));

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 12
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('hostel.view',   'hostel', 'View hostel occupancy and records'),
  ('hostel.manage', 'hostel', 'Manage buildings, rooms, beds, allocations, visitors, mess menu, and hostel attendance')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    r.name in ('Super Admin','Organization Owner','School Administrator','Hostel Manager') and p.module = 'hostel'
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (12, 'Hostel', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
