-- =====================================================================
-- PHASE 14: PARENT & STUDENT PORTALS
-- Depends on: 004 (students, guardians, student_guardians), 005
-- (student_attendance), 008 (exams/student_marks/exam_rankings), 009
-- (fee_invoices/fee_payments), 012 (timetable_entries), 001 (notifications).
--
-- IMPORTANT HONESTY NOTE: a database trigger cannot create a Supabase
-- Auth user (that requires the service-role Admin API, which only runs
-- in an Edge Function — see supabase/functions/invite-portal-user).
-- This means "parent_portal_account_creation," logged as a pending step
-- since Phase 4, can never be fully self-driving from inside a trigger.
-- What THIS migration closes is the other half: once a portal account
-- DOES exist (via the invite flow below), it can immediately see the
-- right data — that's the real gap that was open, and it's closed here.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HELPER FUNCTIONS — reused by every self-access RLS clause below.
-- ---------------------------------------------------------------------
create or replace function auth_is_self_student(p_student_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (select 1 from students where id = p_student_id and profile_id = auth.uid());
$$;

create or replace function auth_is_guardian_of(p_student_id uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from student_guardians sg
    join guardians g on g.id = sg.guardian_id
    where sg.student_id = p_student_id and g.profile_id = auth.uid()
  );
$$;

create or replace function auth_can_view_student(p_student_id uuid)
returns boolean
language sql stable
as $$
  select auth_is_self_student(p_student_id) or auth_is_guardian_of(p_student_id);
$$;

-- ---------------------------------------------------------------------
-- 2. PORTAL PROVISIONING RPC — called by invite-portal-user Edge
-- Function after it creates the auth user. Links the new profile to an
-- existing students.profile_id or guardians.profile_id.
-- ---------------------------------------------------------------------
create or replace function provision_portal_profile(
  p_user_id uuid,
  p_organization_id uuid,
  p_full_name text,
  p_email text,
  p_portal_type text,     -- 'student' or 'guardian'
  p_target_id uuid        -- students.id or guardians.id
) returns void
language plpgsql security definer
as $$
begin
  insert into profiles (id, organization_id, full_name, email)
  values (p_user_id, p_organization_id, p_full_name, p_email);

  if p_portal_type = 'student' then
    update students set profile_id = p_user_id where id = p_target_id;

    insert into user_roles (profile_id, role_id, school_id)
    select p_user_id, r.id, s.school_id
    from students s, roles r
    where s.id = p_target_id and r.organization_id = p_organization_id and r.name = 'Student';

  elsif p_portal_type = 'guardian' then
    update guardians set profile_id = p_user_id where id = p_target_id;

    -- org-wide Parent role: a guardian with children at more than one
    -- school in the same org shouldn't need a separate login per school.
    insert into user_roles (profile_id, role_id, school_id)
    select p_user_id, r.id, null
    from roles r
    where r.organization_id = p_organization_id and r.name = 'Parent';
  end if;
end;
$$;
grant execute on function provision_portal_profile to service_role;

-- ---------------------------------------------------------------------
-- 3. WIDEN RLS: self/guardian access alongside existing staff access.
-- Each policy below is dropped and recreated with an added OR clause —
-- staff/admin access is unchanged, portal access is additive.
-- ---------------------------------------------------------------------

-- STUDENTS (extends the Phase 6 teacher-scoped version)
drop policy if exists students_select on students;
create policy students_select on students for select using (
  auth_can_view_student(id)
  or (
    auth_has_permission('students.view') and (
      (auth_has_permission('students.view_all_sections') and auth_has_school_access(school_id))
      or exists (
        select 1 from teacher_assignments ta
        join student_enrollments se on se.section_id = ta.section_id
        where ta.teacher_profile_id = auth.uid() and se.student_id = students.id
      )
    )
  )
);

-- STUDENT ENROLLMENTS (needed so the portal can show class/section)
drop policy if exists enrollments_select on student_enrollments;
create policy enrollments_select on student_enrollments for select using (
  auth_can_view_student(student_id)
  or (student_id in (select id from students where auth_has_school_access(school_id)) and auth_has_permission('students.view'))
);

-- STUDENT ATTENDANCE
drop policy if exists student_attendance_select on student_attendance;
create policy student_attendance_select on student_attendance for select using (
  auth_can_view_student(student_id)
  or (auth_has_school_access(school_id) and auth_has_permission('attendance.view'))
);

-- FEE INVOICES (a family should see charges/payment status for their
-- own child, never anyone else's)
drop policy if exists fee_invoices_select on fee_invoices;
create policy fee_invoices_select on fee_invoices for select using (
  auth_can_view_student(student_id)
  or (auth_has_school_access(school_id) and auth_has_permission('fees.view'))
);

drop policy if exists fee_payments_select on fee_payments;
create policy fee_payments_select on fee_payments for select using (
  invoice_id in (select id from fee_invoices where auth_can_view_student(student_id))
  or (invoice_id in (select id from fee_invoices where auth_has_school_access(school_id)) and auth_has_permission('fees.view'))
);

-- EXAM RESULTS — a family sees their own child's marks/grades/rank,
-- never the class roster's.
drop policy if exists student_marks_select on student_marks;
create policy student_marks_select on student_marks for select using (
  auth_can_view_student(student_id)
  or (
    exam_schedule_id in (select id from exam_schedules es join exams e on e.id = es.exam_id where auth_has_school_access(e.school_id))
    and auth_has_permission('exams.view')
  )
);

drop policy if exists exam_rankings_select on exam_rankings;
create policy exam_rankings_select on exam_rankings for select using (
  auth_can_view_student(student_id)
  or (exam_id in (select id from exams where auth_has_school_access(school_id)) and auth_has_permission('exams.view'))
);

-- TIMETABLE — a student/guardian can see the timetable for whatever
-- section that student is currently enrolled in.
drop policy if exists timetable_select on timetable_entries;
create policy timetable_select on timetable_entries for select using (
  section_id in (select se.section_id from student_enrollments se where auth_can_view_student(se.student_id))
  or auth_has_school_access(school_id)
);

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 14
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('portal.student_access', 'portal', 'Access the student self-service portal'),
  ('portal.parent_access',  'portal', 'Access the parent/guardian self-service portal')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    (r.name = 'Student' and p.key = 'portal.student_access')
    or (r.name = 'Parent' and p.key = 'portal.parent_access')
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (14, 'Parent & Student Portals', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';

-- ---------------------------------------------------------------------
-- Update the Phase 4/9 automation's pending_steps note now that Phase 14
-- exists: portal account creation can never be a trigger's job (creating
-- a Supabase Auth user requires the service-role Admin API, which only
-- runs in an Edge Function) — so the honest wording is "needs a staff
-- action," not "ships automatically in a later phase."
-- ---------------------------------------------------------------------
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

    v_fee_plan_id := generate_fee_plan(v_student_id, NEW.applying_for_class_id, NEW.academic_year_id);

    insert into automation_runs (organization_id, automation_key, trigger_table, trigger_row_id, status, payload)
    values (
      NEW.organization_id, 'admission_approved', 'admission_applications', NEW.id, 'success',
      jsonb_build_object(
        'student_id', v_student_id,
        'fee_plan_id', v_fee_plan_id,
        'pending_steps', jsonb_build_array(
          'parent_portal_account_creation — cannot be automated by a trigger (creating an auth user requires the service-role Admin API); use the "Invite to portal" action on the student''s Guardians tab.'
        )
      )
    );
  end if;
  return NEW;
end;
$$;
