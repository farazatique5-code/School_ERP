-- =====================================================================
-- PHASE 8: EXAMINATION
-- Depends on: 001 (grading_scales/grading_scale_bands, classes, sections,
-- subjects, terms), 004 (students, student_enrollments), 006 (teacher_assignments).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXAMS
-- ---------------------------------------------------------------------
create table exams (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  academic_year_id  uuid not null references academic_years(id) on delete cascade,
  term_id           uuid references terms(id) on delete set null,
  grading_scale_id  uuid not null references grading_scales(id) on delete restrict,
  name              text not null,               -- "Mid-Term Examination 2026"
  exam_type         text not null default 'other' check (exam_type in ('unit_test','midterm','final','other')),
  status            text not null default 'draft' check (status in ('draft','scheduled','ongoing','completed','published')),
  start_date        date not null,
  end_date          date not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_date >= start_date)
);
create index idx_exams_school_year on exams(school_id, academic_year_id);

-- ---------------------------------------------------------------------
-- 2. EXAM SCHEDULES — one row per (exam, class, subject): when it's held,
-- out of how many marks, in which room.
-- ---------------------------------------------------------------------
create table exam_schedules (
  id                uuid primary key default uuid_generate_v4(),
  exam_id           uuid not null references exams(id) on delete cascade,
  class_id          uuid not null references classes(id) on delete cascade,
  subject_id        uuid not null references subjects(id) on delete cascade,
  exam_date         date not null,
  start_time        time not null,
  end_time          time not null,
  max_marks         numeric(6,2) not null,
  passing_marks     numeric(6,2) not null,
  room_number       text,
  created_at        timestamptz not null default now(),
  unique (exam_id, class_id, subject_id),
  check (end_time > start_time),
  check (passing_marks <= max_marks)
);
create index idx_exam_schedules_exam on exam_schedules(exam_id);

-- ---------------------------------------------------------------------
-- 3. QUESTION BANK
-- ---------------------------------------------------------------------
create table question_bank_questions (
  id                uuid primary key default uuid_generate_v4(),
  school_id         uuid not null references schools(id) on delete cascade,
  subject_id        uuid not null references subjects(id) on delete cascade,
  class_id          uuid references classes(id) on delete set null,
  question_text     text not null,
  question_type     text not null check (question_type in ('mcq','short_answer','long_answer')),
  difficulty        text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  marks             numeric(5,2) not null default 1,
  options           jsonb,                       -- for mcq: [{"label":"A","text":"..."}]
  correct_answer    text,
  bloom_level       text check (bloom_level in ('remember','understand','apply','analyze','evaluate','create')),
  created_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_question_bank_subject on question_bank_questions(subject_id, class_id);

-- ---------------------------------------------------------------------
-- 4. STUDENT MARKS
-- ---------------------------------------------------------------------
create table student_marks (
  id                uuid primary key default uuid_generate_v4(),
  exam_schedule_id  uuid not null references exam_schedules(id) on delete cascade,
  student_id        uuid not null references students(id) on delete cascade,
  marks_obtained    numeric(6,2),
  is_absent         boolean not null default false,
  grade_label       text,                        -- computed on publish, from the exam's grading_scale
  remarks           text,
  entered_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (exam_schedule_id, student_id),
  check (is_absent or marks_obtained is not null)
);
create index idx_student_marks_schedule on student_marks(exam_schedule_id);
create index idx_student_marks_student on student_marks(student_id);

-- ---------------------------------------------------------------------
-- 5. RANKINGS — per exam, per section, computed on publish (not maintained
-- live on every mark entry, since ranking only makes sense once all marks
-- for the exam are in).
-- ---------------------------------------------------------------------
create table exam_rankings (
  exam_id           uuid not null references exams(id) on delete cascade,
  student_id        uuid not null references students(id) on delete cascade,
  section_id        uuid not null references sections(id) on delete cascade,
  total_marks       numeric(8,2) not null,
  total_max_marks   numeric(8,2) not null,
  percentage        numeric(5,2) not null,
  rank_in_section   integer not null,
  computed_at       timestamptz not null default now(),
  primary key (exam_id, student_id)
);
create index idx_exam_rankings_section on exam_rankings(exam_id, section_id, rank_in_section);

-- ---------------------------------------------------------------------
-- 6. GRADE LOOKUP HELPER
-- ---------------------------------------------------------------------
create or replace function fn_grade_for_percentage(p_grading_scale_id uuid, p_percentage numeric)
returns text
language sql stable
as $$
  select grade_label from grading_scale_bands
  where grading_scale_id = p_grading_scale_id
    and p_percentage >= min_percent and p_percentage <= max_percent
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 7. EXAM_PUBLISHED AUTOMATION
-- Calculates every student's grade (from the exam's grading scale),
-- computes per-section rankings, and writes a real in-app notification
-- to each student's linked guardian(s) — same honest pattern as Phase 5:
-- notifies where a portal account already exists, logs what's pending
-- otherwise. Result-card PDF rendering is explicitly Phase 15's export
-- job (Reports & Analytics), not faked here.
-- ---------------------------------------------------------------------
create or replace function fn_exam_published()
returns trigger
language plpgsql security definer
as $$
declare
  v_schedule record;
  v_mark record;
  v_percentage numeric;
  v_section record;
  v_rank integer;
  v_notified_count integer := 0;
  v_total_students integer := 0;
begin
  if NEW.status = 'published' and OLD.status is distinct from 'published' then

    -- 7a. Compute grade_label for every mark tied to this exam.
    for v_mark in
      select sm.id, sm.marks_obtained, es.max_marks
      from student_marks sm
      join exam_schedules es on es.id = sm.exam_schedule_id
      where es.exam_id = NEW.id and not sm.is_absent
    loop
      v_percentage := (v_mark.marks_obtained / v_mark.max_marks) * 100;
      update student_marks
      set grade_label = fn_grade_for_percentage(NEW.grading_scale_id, v_percentage)
      where id = v_mark.id;
    end loop;

    -- 7b. Compute per-section rankings from total marks across all of a
    -- student's exam_schedules for this exam.
    delete from exam_rankings where exam_id = NEW.id;

    for v_section in
      select distinct se.section_id
      from student_enrollments se
      join exam_schedules es on es.class_id = se.class_id
      where es.exam_id = NEW.id
    loop
      v_rank := 0;
      for v_mark in (
        select se.student_id,
               sum(coalesce(sm.marks_obtained, 0)) as total_marks,
               sum(es.max_marks) as total_max_marks
        from student_enrollments se
        join exam_schedules es on es.class_id = se.class_id
        left join student_marks sm on sm.exam_schedule_id = es.id and sm.student_id = se.student_id
        where es.exam_id = NEW.id and se.section_id = v_section.section_id
        group by se.student_id
        order by sum(coalesce(sm.marks_obtained, 0)) desc
      ) loop
        v_rank := v_rank + 1;
        insert into exam_rankings (exam_id, student_id, section_id, total_marks, total_max_marks, percentage, rank_in_section)
        values (
          NEW.id, v_mark.student_id, v_section.section_id, v_mark.total_marks, v_mark.total_max_marks,
          case when v_mark.total_max_marks > 0 then round((v_mark.total_marks / v_mark.total_max_marks) * 100, 2) else 0 end,
          v_rank
        );
      end loop;
    end loop;

    -- 7c. Notify guardians with an existing portal account; count both
    -- ways so the automation log is honest about coverage.
    for v_mark in
      select distinct se.student_id, s.first_name, s.last_name, g.profile_id as guardian_profile_id
      from student_enrollments se
      join students s on s.id = se.student_id
      join exam_schedules es on es.class_id = se.class_id
      left join student_guardians sg on sg.student_id = se.student_id and sg.is_primary_contact
      left join guardians g on g.id = sg.guardian_id
      where es.exam_id = NEW.id
    loop
      v_total_students := v_total_students + 1;
      if v_mark.guardian_profile_id is not null then
        insert into notifications (organization_id, school_id, recipient_profile_id, channel, title, body)
        values (
          NEW.organization_id, NEW.school_id, v_mark.guardian_profile_id, 'in_app',
          'Exam results published',
          'Results for "' || NEW.name || '" are now available for ' || v_mark.first_name || ' ' || v_mark.last_name || '.'
        );
        v_notified_count := v_notified_count + 1;
      end if;
    end loop;

    insert into automation_runs (organization_id, automation_key, trigger_table, trigger_row_id, status, payload)
    values (
      NEW.organization_id, 'exam_published', 'exams', NEW.id, 'success',
      jsonb_build_object(
        'grades_calculated', true,
        'rankings_computed', true,
        'guardians_notified', v_notified_count,
        'guardians_without_portal', v_total_students - v_notified_count,
        'pending_steps', jsonb_build_array('result_card_pdf_export (ships in Phase 15 — Reports & Analytics)')
      )
    );
  end if;
  return NEW;
end;
$$;

create trigger trg_exam_published
  after update on exams
  for each row execute function fn_exam_published();

create trigger audit_exams after insert or update or delete on exams
  for each row execute function fn_audit_trigger();
create trigger audit_student_marks after insert or update or delete on student_marks
  for each row execute function fn_audit_trigger();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table exams enable row level security;
alter table exam_schedules enable row level security;
alter table question_bank_questions enable row level security;
alter table student_marks enable row level security;
alter table exam_rankings enable row level security;

create policy exams_select on exams for select using (auth_has_school_access(school_id));
create policy exams_write on exams for all using (
  auth_has_school_access(school_id) and auth_has_permission('exams.manage'));

create policy exam_schedules_select on exam_schedules for select using (
  exam_id in (select id from exams where auth_has_school_access(school_id)));
create policy exam_schedules_write on exam_schedules for all using (
  exam_id in (select id from exams where auth_has_school_access(school_id))
  and auth_has_permission('exams.manage'));

create policy question_bank_select on question_bank_questions for select using (
  auth_has_school_access(school_id) and auth_has_permission('exams.manage_question_bank'));
create policy question_bank_write on question_bank_questions for all using (
  auth_has_school_access(school_id) and auth_has_permission('exams.manage_question_bank'));

-- Marks entry: a Teacher can only enter marks for schedules matching
-- their own assignment (subject + section, via teacher_assignments);
-- admin-tier roles bypass via exams.manage_all_marks.
create policy student_marks_select on student_marks for select using (
  exam_schedule_id in (select es.id from exam_schedules es join exams e on e.id = es.exam_id where auth_has_school_access(e.school_id))
  and auth_has_permission('exams.view'));
create policy student_marks_write on student_marks for all using (
  auth_has_permission('exams.enter_marks') and (
    auth_has_permission('exams.manage_all_marks')
    or exam_schedule_id in (
      select es.id from exam_schedules es
      join teacher_assignments ta on ta.subject_id = es.subject_id
      where ta.teacher_profile_id = auth.uid()
        and ta.class_id = es.class_id
    )
  )
);

create policy exam_rankings_select on exam_rankings for select using (
  exam_id in (select id from exams where auth_has_school_access(school_id)) and auth_has_permission('exams.view'));

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 8
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('exams.view',                  'exams', 'View exams, schedules, marks, and rankings'),
  ('exams.manage',                'exams', 'Create exams, schedule subjects, publish results'),
  ('exams.enter_marks',           'exams', 'Enter/edit marks for assigned classes and subjects'),
  ('exams.manage_all_marks',      'exams', 'Enter/edit marks for any class or subject, not just assigned ones'),
  ('exams.manage_question_bank',  'exams', 'Create and manage question bank questions')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    (r.name in ('Super Admin','Organization Owner','Examination Controller') and p.module = 'exams')
    or (r.name in ('School Administrator','Principal') and p.key in ('exams.view','exams.manage','exams.manage_all_marks'))
    or (r.name in ('Teacher','Class Teacher') and p.key in ('exams.view','exams.enter_marks','exams.manage_question_bank'))
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (8, 'Examination', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
