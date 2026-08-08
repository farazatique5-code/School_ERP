-- =====================================================================
-- PHASE 16: AI COPILOT & AI FEATURES
-- Depends on: everything. This migration is deliberately modest — most
-- of Phase 16 lives in Edge Functions (real LLM calls need a server-side
-- API key, never the browser), not new tables. What's here supports
-- observability and the two genuinely LLM-shaped features (report
-- comments, exam question generation) plus one real statistical feature
-- that does NOT use an LLM (risk scoring) — see 01-PRD.md's honesty
-- rule: don't call something "AI" just because the phase is named AI.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COPILOT QUERY LOG — every question asked and answered, for audit
-- and for improving the context-building logic later. Mirrors the
-- automation_runs pattern already established.
-- ---------------------------------------------------------------------
create table ai_copilot_logs (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  school_id         uuid references schools(id) on delete set null,
  asked_by_profile_id uuid references profiles(id) on delete set null,
  question           text not null,
  context_summary    text,     -- what data categories were pulled into context, for debugging/audit
  answer             text,
  model              text,
  created_at         timestamptz not null default now()
);
create index idx_ai_copilot_logs_org on ai_copilot_logs(organization_id, created_at desc);

alter table ai_copilot_logs enable row level security;
create policy ai_copilot_logs_select on ai_copilot_logs for select using (
  asked_by_profile_id = auth.uid()
  or (auth_has_school_access(school_id) and auth_has_permission('automation.view'))
);
create policy ai_copilot_logs_insert on ai_copilot_logs for insert with check (organization_id = auth_organization_id());

-- ---------------------------------------------------------------------
-- 2. AI-DRAFTED REPORT CARD COMMENTS — genuinely LLM-generated text,
-- always teacher-reviewed before publish (never auto-published).
-- ---------------------------------------------------------------------
create table exam_report_comments (
  id                uuid primary key default uuid_generate_v4(),
  exam_id           uuid not null references exams(id) on delete cascade,
  student_id        uuid not null references students(id) on delete cascade,
  comment_text      text not null,
  was_ai_generated  boolean not null default false,
  is_published      boolean not null default false,
  edited_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (exam_id, student_id)
);

alter table exam_report_comments enable row level security;
create policy report_comments_select on exam_report_comments for select using (
  auth_can_view_student(student_id)
  or (exam_id in (select id from exams where auth_has_school_access(school_id)) and auth_has_permission('exams.view'))
);
create policy report_comments_write on exam_report_comments for all using (
  exam_id in (select id from exams where auth_has_school_access(school_id)) and auth_has_permission('exams.manage')
);

create trigger audit_exam_report_comments after insert or update or delete on exam_report_comments
  for each row execute function fn_audit_trigger();

-- ---------------------------------------------------------------------
-- 3. STUDENT RISK SCORING — a REAL, EXPLAINABLE STATISTICAL COMPOSITE,
-- deliberately NOT dressed up as a trained ML model. Combines attendance
-- rate and exam average over the current academic year into a 0-100
-- score with a plain-language reason. A genuine predictive ML model
-- would need a labeled training set and a training pipeline this
-- project does not have — claiming one would be dishonest, so this is
-- presented as what it actually is: a transparent weighted formula.
-- ---------------------------------------------------------------------
create or replace function fn_student_risk_scores(p_school_id uuid, p_academic_year_id uuid)
returns table (
  student_id uuid,
  first_name text,
  last_name text,
  attendance_rate numeric,
  exam_average numeric,
  risk_score numeric,
  risk_level text
)
language sql stable security definer
as $$
  with attendance as (
    select se.student_id,
      case when count(sa.id) = 0 then null
        else round(100.0 * count(*) filter (where sa.status in ('present','late')) / count(sa.id), 1)
      end as attendance_rate
    from student_enrollments se
    left join student_attendance sa on sa.student_id = se.student_id
    where se.academic_year_id = p_academic_year_id
    group by se.student_id
  ),
  exams_avg as (
    select sm.student_id,
      round(avg(sm.marks_obtained / es.max_marks * 100), 1) as exam_average
    from student_marks sm
    join exam_schedules es on es.id = sm.exam_schedule_id
    join exams e on e.id = es.exam_id
    where e.academic_year_id = p_academic_year_id and not sm.is_absent
    group by sm.student_id
  )
  select
    s.id, s.first_name, s.last_name,
    a.attendance_rate,
    ex.exam_average,
    -- weighted composite: attendance 40%, exam performance 60%, missing
    -- data treated as neutral (75) rather than falsely penalizing a
    -- student with simply no exams recorded yet
    round(100 - (0.4 * coalesce(a.attendance_rate, 75) + 0.6 * coalesce(ex.exam_average, 75)), 1) as risk_score,
    case
      when (0.4 * coalesce(a.attendance_rate, 75) + 0.6 * coalesce(ex.exam_average, 75)) < 50 then 'high'
      when (0.4 * coalesce(a.attendance_rate, 75) + 0.6 * coalesce(ex.exam_average, 75)) < 70 then 'moderate'
      else 'low'
    end as risk_level
  from students s
  join student_enrollments se on se.student_id = s.id and se.academic_year_id = p_academic_year_id
  left join attendance a on a.student_id = s.id
  left join exams_avg ex on ex.student_id = s.id
  where s.school_id = p_school_id
  order by risk_score desc;
$$;
grant execute on function fn_student_risk_scores to authenticated;

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 16
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('ai.copilot_use',       'ai', 'Use the AI Copilot to ask questions about school data'),
  ('ai.generate_content',  'ai', 'Use AI-assisted content generation (report card comments, exam questions, document extraction)')
on conflict (key) do nothing;

-- Copilot is available to every role (its answers are already scoped by
-- the asking user's own RLS-visible data — see the Edge Function).
with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    p.key = 'ai.copilot_use'
    or (p.key = 'ai.generate_content' and r.name in ('Super Admin','Organization Owner','School Administrator','Principal','Teacher','Class Teacher','Examination Controller','Admission Officer'))
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (16, 'AI Copilot & AI Features', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
