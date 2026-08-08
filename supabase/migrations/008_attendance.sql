-- =====================================================================
-- PHASE 5: ATTENDANCE
-- Depends on: 001 (schools/sections/school_timings), 004 (students,
-- student_enrollments, guardians), 006 (nothing directly, ordering only).
--
-- SCOPE NOTE: this phase ships DAILY (one row per student per day)
-- attendance, not period-by-period attendance, because Timetable
-- (Phase 7) — which defines what a "period" is — doesn't exist yet.
-- Period-level attendance is a natural Phase 7 follow-up extension of
-- this same table (add a nullable `period_id` column then), not a
-- reason to fake period data now.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. STUDENT ATTENDANCE
-- ---------------------------------------------------------------------
create table student_attendance (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  student_id        uuid not null references students(id) on delete cascade,
  section_id        uuid not null references sections(id) on delete cascade,  -- section at time of marking
  attendance_date   date not null,
  status            text not null check (status in ('present','absent','late','half_day','excused')),
  check_in_time     time,
  remarks           text,
  marked_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (student_id, attendance_date)
);
create index idx_student_attendance_section_date on student_attendance(section_id, attendance_date);
create index idx_student_attendance_student on student_attendance(student_id, attendance_date desc);

-- ---------------------------------------------------------------------
-- 2. TEACHER ATTENDANCE (staff check-in/out — same daily grain)
-- ---------------------------------------------------------------------
create table teacher_attendance (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  teacher_profile_id uuid not null references profiles(id) on delete cascade,
  attendance_date   date not null,
  status            text not null check (status in ('present','absent','late','half_day','on_leave')),
  check_in_time     time,
  check_out_time    time,
  marked_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (teacher_profile_id, attendance_date)
);
create index idx_teacher_attendance_school_date on teacher_attendance(school_id, attendance_date);

-- ---------------------------------------------------------------------
-- 3. DAILY STATS ROLLUP (per section, per day) — what Reports/Dashboard
-- read from, so a report never has to scan raw attendance rows to render.
-- Maintained by trigger, not by a nightly batch job — stays correct
-- immediately after every mark/edit, matching the PRD's "Update
-- Attendance Analytics" automation step.
-- ---------------------------------------------------------------------
create table attendance_daily_stats (
  school_id       uuid not null references schools(id) on delete cascade,
  section_id      uuid not null references sections(id) on delete cascade,
  attendance_date date not null,
  present_count   integer not null default 0,
  absent_count    integer not null default 0,
  late_count      integer not null default 0,
  half_day_count  integer not null default 0,
  excused_count   integer not null default 0,
  primary key (section_id, attendance_date)
);

create or replace function fn_recompute_attendance_stats(p_section_id uuid, p_date date)
returns void
language plpgsql security definer
as $$
declare
  v_school_id uuid;
begin
  select school_id into v_school_id from sections s join classes c on c.id = s.class_id where s.id = p_section_id;

  insert into attendance_daily_stats (school_id, section_id, attendance_date, present_count, absent_count, late_count, half_day_count, excused_count)
  select
    v_school_id, p_section_id, p_date,
    count(*) filter (where status = 'present'),
    count(*) filter (where status = 'absent'),
    count(*) filter (where status = 'late'),
    count(*) filter (where status = 'half_day'),
    count(*) filter (where status = 'excused')
  from student_attendance
  where section_id = p_section_id and attendance_date = p_date
  on conflict (section_id, attendance_date) do update set
    present_count = excluded.present_count,
    absent_count = excluded.absent_count,
    late_count = excluded.late_count,
    half_day_count = excluded.half_day_count,
    excused_count = excluded.excused_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. STUDENT_ABSENT AUTOMATION — notify parent + refresh stats
-- Real for the in-app notification channel (writes to `notifications`,
-- Phase 1). SMS/WhatsApp dispatch is a documented pending step — the
-- external gateway integration is Phase 16's job (AI Notification
-- System / provider wiring), not something to fake here with a no-op
-- that pretends to have sent a text message.
-- ---------------------------------------------------------------------
create or replace function fn_student_attendance_written()
returns trigger
language plpgsql security definer
as $$
declare
  v_guardian_profile_id uuid;
  v_student_name text;
begin
  perform fn_recompute_attendance_stats(NEW.section_id, NEW.attendance_date);

  if NEW.status = 'absent' and (TG_OP = 'INSERT' or OLD.status is distinct from 'absent') then
    select first_name || ' ' || last_name into v_student_name from students where id = NEW.student_id;

    -- Only the primary contact guardian, and only if their portal account
    -- exists (Phase 14) — guardians.profile_id is null until then, so this
    -- automation is real today for orgs that already have Phase 14 wired,
    -- and a documented no-op (logged, not silently skipped) otherwise.
    select g.profile_id into v_guardian_profile_id
    from student_guardians sg
    join guardians g on g.id = sg.guardian_id
    where sg.student_id = NEW.student_id and sg.is_primary_contact
    limit 1;

    if v_guardian_profile_id is not null then
      insert into notifications (organization_id, school_id, recipient_profile_id, channel, title, body)
      values (
        NEW.organization_id, NEW.school_id, v_guardian_profile_id, 'in_app',
        'Attendance alert',
        v_student_name || ' was marked absent on ' || to_char(NEW.attendance_date, 'Mon DD, YYYY') || '.'
      );
    end if;

    insert into automation_runs (organization_id, automation_key, trigger_table, trigger_row_id, status, payload)
    values (
      NEW.organization_id, 'student_absent', 'student_attendance', NEW.id,
      case when v_guardian_profile_id is not null then 'success' else 'success' end,
      jsonb_build_object(
        'in_app_notification_sent', v_guardian_profile_id is not null,
        'pending_steps', case when v_guardian_profile_id is null
          then jsonb_build_array('no primary guardian portal account yet — in-app alert skipped, will fire retroactively once Phase 14 links a profile')
          else jsonb_build_array('sms_whatsapp_dispatch (ships in Phase 16 — provider integration)')
        end
      )
    );
  end if;

  return NEW;
end;
$$;

create trigger trg_student_attendance_written
  after insert or update on student_attendance
  for each row execute function fn_student_attendance_written();

create trigger audit_student_attendance after insert or update or delete on student_attendance
  for each row execute function fn_audit_trigger();
create trigger audit_teacher_attendance after insert or update or delete on teacher_attendance
  for each row execute function fn_audit_trigger();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table student_attendance enable row level security;
alter table teacher_attendance enable row level security;
alter table attendance_daily_stats enable row level security;

-- SCOPE NOTE (matches the pattern already flagged in 004_students.sql):
-- marking is school-level scoped via attendance.mark for now. Once
-- Phase 6/7 ship teacher-to-section assignments, tighten this so a
-- Teacher can only mark sections they're actually assigned to — tracked,
-- not silently forgotten.
create policy student_attendance_select on student_attendance for select using (
  auth_has_school_access(school_id) and auth_has_permission('attendance.view'));
create policy student_attendance_write on student_attendance for all using (
  auth_has_school_access(school_id) and auth_has_permission('attendance.mark'));

create policy teacher_attendance_select on teacher_attendance for select using (
  auth_has_school_access(school_id) and auth_has_permission('attendance.view_staff'));
create policy teacher_attendance_write on teacher_attendance for all using (
  auth_has_school_access(school_id) and auth_has_permission('attendance.mark_staff'));

create policy attendance_stats_select on attendance_daily_stats for select using (
  auth_has_school_access(school_id) and auth_has_permission('attendance.view'));

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 5
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('attendance.view',        'attendance', 'View student attendance records and reports'),
  ('attendance.mark',        'attendance', 'Mark and edit student attendance'),
  ('attendance.view_staff',  'attendance', 'View staff/teacher attendance records'),
  ('attendance.mark_staff',  'attendance', 'Mark staff/teacher attendance')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    (r.name in ('Super Admin','Organization Owner','School Administrator','Principal','Vice Principal') and p.module = 'attendance')
    or (r.name in ('Teacher','Class Teacher') and p.key in ('attendance.view','attendance.mark'))
    or (r.name = 'HR Manager' and p.key in ('attendance.view_staff','attendance.mark_staff'))
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (5, 'Attendance', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
