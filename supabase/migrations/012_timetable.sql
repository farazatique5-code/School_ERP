-- =====================================================================
-- PHASE 7: TIMETABLE
-- Depends on: 001 (school_timings, classes, sections, subjects),
-- 006 (teacher_assignments — used to validate a teacher is actually
-- qualified for the class/subject being scheduled).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PERIODS — the daily period structure for a school (shared across
-- all sections; a section's timetable just fills in these slots).
-- ---------------------------------------------------------------------
create table periods (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,           -- "Period 1", "Lunch Break"
  sequence      integer not null,
  start_time    time not null,
  end_time      time not null,
  is_break      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (school_id, sequence),
  check (end_time > start_time)
);

-- ---------------------------------------------------------------------
-- 2. TIMETABLE ENTRIES
-- Conflict prevention is a DATABASE guarantee (unique indexes), not just
-- a UI check — the exact PRD requirement "Conflict Detection" is real,
-- enforceable at the schema level, not something the frontend merely
-- warns about and can be bypassed.
-- ---------------------------------------------------------------------
create table timetable_entries (
  id                uuid primary key default uuid_generate_v4(),
  school_id         uuid not null references schools(id) on delete cascade,
  academic_year_id  uuid not null references academic_years(id) on delete cascade,
  section_id        uuid not null references sections(id) on delete cascade,
  day_of_week       integer not null check (day_of_week between 0 and 6),
  period_id         uuid not null references periods(id) on delete cascade,
  subject_id        uuid references subjects(id) on delete set null,
  teacher_profile_id uuid references employees(profile_id) on delete set null,
  room_number       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- one entry per section, per day, per period — a section can't be in
  -- two subjects at once
  unique (section_id, day_of_week, period_id, academic_year_id)
);

-- a teacher can't be scheduled in two sections at the same day+period
create unique index uq_no_teacher_double_booking
  on timetable_entries(teacher_profile_id, day_of_week, period_id, academic_year_id)
  where teacher_profile_id is not null;

-- a room can't hold two sections at the same day+period
create unique index uq_no_room_double_booking
  on timetable_entries(room_number, day_of_week, period_id, academic_year_id)
  where room_number is not null;

create index idx_timetable_section on timetable_entries(section_id, academic_year_id);
create index idx_timetable_teacher on timetable_entries(teacher_profile_id, academic_year_id);

create trigger audit_timetable_entries after insert or update or delete on timetable_entries
  for each row execute function fn_audit_trigger();

-- ---------------------------------------------------------------------
-- 3. VALIDATION: teacher must actually be assigned to teach this
-- class/subject (via Phase 6's teacher_assignments) before they can be
-- scheduled for it — surfaced as a clear error, not a silent allowance.
-- ---------------------------------------------------------------------
create or replace function fn_validate_timetable_teacher()
returns trigger
language plpgsql security definer
as $$
declare
  v_class_id uuid;
  v_is_assigned boolean;
begin
  if NEW.teacher_profile_id is null then
    return NEW;
  end if;

  select class_id into v_class_id from sections where id = NEW.section_id;

  select exists (
    select 1 from teacher_assignments ta
    where ta.teacher_profile_id = NEW.teacher_profile_id
      and ta.section_id = NEW.section_id
      and ta.academic_year_id = NEW.academic_year_id
      and (ta.subject_id = NEW.subject_id or ta.subject_id is null)
  ) into v_is_assigned;

  if not v_is_assigned then
    raise exception 'teacher_not_assigned' using errcode = 'P0002',
      hint = 'Assign this teacher to the class/subject in Teachers & HR before scheduling them here.';
  end if;

  return NEW;
end;
$$;

create trigger trg_validate_timetable_teacher
  before insert or update on timetable_entries
  for each row execute function fn_validate_timetable_teacher();

-- ---------------------------------------------------------------------
-- 4. CLOSE PHASE 5's SCOPE NOTE: period-level attendance is now possible.
-- Nullable so daily attendance (Phase 5's original grain) keeps working
-- unchanged; a null period_id means "whole-day attendance," a populated
-- one means "attendance for this specific period."
-- ---------------------------------------------------------------------
alter table student_attendance add column period_id uuid references periods(id) on delete set null;
-- the Phase 5 unique constraint was (student_id, attendance_date) — widen
-- it so period-level rows for the same day don't collide with each other
-- or with the whole-day row.
alter table student_attendance drop constraint student_attendance_student_id_attendance_date_key;
create unique index uq_student_attendance_day_or_period
  on student_attendance(student_id, attendance_date, coalesce(period_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table periods enable row level security;
alter table timetable_entries enable row level security;

create policy periods_select on periods for select using (auth_has_school_access(school_id));
create policy periods_write on periods for all using (
  auth_has_school_access(school_id) and auth_has_permission('timetable.manage'));

create policy timetable_select on timetable_entries for select using (auth_has_school_access(school_id));
create policy timetable_write on timetable_entries for all using (
  auth_has_school_access(school_id) and auth_has_permission('timetable.manage'));

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 7
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('timetable.manage', 'timetable', 'Create and edit periods and timetable entries')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    r.name in ('Super Admin','Organization Owner','School Administrator','Principal','Vice Principal')
    and p.key = 'timetable.manage'
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (7, 'Timetable', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
