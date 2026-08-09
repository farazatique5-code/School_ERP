-- =====================================================================
-- PHASE 3: STUDENT INFORMATION SYSTEM
-- Depends on: 001_core_foundation.sql (schools, classes, sections,
-- academic_years, profiles, permissions, audit trigger fn), 002 (roles).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. STUDENTS
-- ---------------------------------------------------------------------
create table students (
  id                    uuid primary key default uuid_generate_v4(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  school_id             uuid not null references schools(id) on delete cascade,
  student_code          text not null,              -- generated on admission, e.g. "MAIN-2026-0042"
  first_name            text not null,
  last_name             text not null,
  date_of_birth         date not null,
  gender                text check (gender in ('male','female','other','prefer_not_to_say')),
  blood_group           text,
  nationality            text,
  religion              text,
  photo_url             text,
  admission_date        date not null default current_date,
  status                text not null default 'active' check (status in ('active','inactive','graduated','transferred_out','expelled')),
  house_id              uuid references houses(id) on delete set null,
  profile_id            uuid references profiles(id) on delete set null,  -- set once portal login is created (Phase 14)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  unique (organization_id, student_code)
);
create index idx_students_org_school on students(organization_id, school_id) where deleted_at is null;
create index idx_students_name on students(last_name, first_name);

-- Enrollment = which class/section a student is in for a given academic year.
-- Kept separate from `students` so promotion (Phase 3 automation) creates a
-- NEW row each year rather than overwriting history — a student's full
-- academic history is just their enrollment rows over time.
create table student_enrollments (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references students(id) on delete cascade,
  academic_year_id  uuid not null references academic_years(id) on delete cascade,
  class_id          uuid not null references classes(id) on delete cascade,
  section_id        uuid not null references sections(id) on delete cascade,
  roll_number       text,
  enrollment_status text not null default 'enrolled' check (enrollment_status in ('enrolled','promoted','retained','withdrawn')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (student_id, academic_year_id)
);
create index idx_enrollments_student on student_enrollments(student_id);
create index idx_enrollments_section on student_enrollments(section_id);
create index idx_enrollments_year on student_enrollments(academic_year_id);

-- ---------------------------------------------------------------------
-- 2. GUARDIANS (parents), linked many-to-many since siblings share guardians
-- and a student can have more than one guardian.
-- ---------------------------------------------------------------------
create table guardians (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  profile_id        uuid references profiles(id) on delete set null,  -- set once parent portal login exists (Phase 14)
  first_name        text not null,
  last_name         text not null,
  email             text,
  phone             text not null,
  occupation        text,
  address           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_guardians_org on guardians(organization_id);

create table student_guardians (
  student_id    uuid not null references students(id) on delete cascade,
  guardian_id   uuid not null references guardians(id) on delete cascade,
  relationship  text not null check (relationship in ('father','mother','guardian','other')),
  is_primary_contact boolean not null default false,
  is_emergency_contact boolean not null default false,
  primary key (student_id, guardian_id)
);
create index idx_student_guardians_guardian on student_guardians(guardian_id);
-- exactly one primary contact per student
create unique index uq_one_primary_contact on student_guardians(student_id) where is_primary_contact;

-- ---------------------------------------------------------------------
-- 3. MEDICAL RECORDS (one row per student, sensitive — locked-down RLS)
-- ---------------------------------------------------------------------
create table student_medical_records (
  student_id          uuid primary key references students(id) on delete cascade,
  blood_group         text,
  allergies           text,
  chronic_conditions  text,
  medications         text,
  emergency_instructions text,
  physician_name      text,
  physician_phone     text,
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. DOCUMENTS (metadata row; actual file lives in Supabase Storage)
-- ---------------------------------------------------------------------
create table student_documents (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  document_type text not null check (document_type in
    ('birth_certificate','previous_school_transcript','national_id','passport','medical_certificate','photo','other')),
  file_path     text not null,                     -- storage bucket path, e.g. "student-documents/{student_id}/{uuid}.pdf"
  file_name     text not null,
  uploaded_by_profile_id uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index idx_student_documents_student on student_documents(student_id);

-- ---------------------------------------------------------------------
-- 5. DISCIPLINE RECORDS
-- ---------------------------------------------------------------------
create table student_discipline_records (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references students(id) on delete cascade,
  incident_date     date not null,
  category          text not null check (category in ('minor','moderate','major')),
  description       text not null,
  action_taken      text,
  reported_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_discipline_student on student_discipline_records(student_id);

-- ---------------------------------------------------------------------
-- 6. ACHIEVEMENTS
-- ---------------------------------------------------------------------
create table student_achievements (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  title         text not null,
  category      text check (category in ('academic','sports','arts','leadership','other')),
  achieved_on   date not null,
  description   text,
  created_at    timestamptz not null default now()
);
create index idx_achievements_student on student_achievements(student_id);

-- ---------------------------------------------------------------------
-- 7. TRANSFERS (in/out) — a light audit trail distinct from the generic
-- audit_logs table, because transfers need structured fields (reason,
-- destination school) that a generic diff doesn't capture well.
-- ---------------------------------------------------------------------
create table student_transfers (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references students(id) on delete cascade,
  direction         text not null check (direction in ('in','out')),
  transfer_date     date not null,
  from_school_name  text,        -- free text if transferring in from outside the platform
  to_school_name    text,        -- free text if transferring out to outside the platform
  reason            text,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- AUDIT TRIGGERS — attach the shared fn_audit_trigger from Phase 1 to
-- every writable table in this phase.
-- ---------------------------------------------------------------------
create trigger audit_students after insert or update or delete on students
  for each row execute function fn_audit_trigger();
create trigger audit_student_enrollments after insert or update or delete on student_enrollments
  for each row execute function fn_audit_trigger();
create trigger audit_guardians after insert or update or delete on guardians
  for each row execute function fn_audit_trigger();
create trigger audit_student_medical_records after insert or update or delete on student_medical_records
  for each row execute function fn_audit_trigger();
create trigger audit_student_discipline_records after insert or update or delete on student_discipline_records
  for each row execute function fn_audit_trigger();

-- ---------------------------------------------------------------------
-- STUDENT CODE GENERATOR — "{school_code}-{year}-{sequence}"
-- Called by the application at creation time via RPC so the code is
-- assigned atomically (no race between two admissions officers).
-- ---------------------------------------------------------------------
create or replace function generate_student_code(p_school_id uuid)
returns text
language plpgsql security definer
as $$
declare
  v_school_code text;
  v_year text := to_char(now(), 'YYYY');
  v_next_seq int;
  v_code text;
begin
  select code into v_school_code from schools where id = p_school_id;

  select coalesce(max(
    (regexp_match(student_code, '-(\d+)$'))[1]::int
  ), 0) + 1
  into v_next_seq
  from students
  where school_id = p_school_id and student_code like v_school_code || '-' || v_year || '-%';

  v_code := v_school_code || '-' || v_year || '-' || lpad(v_next_seq::text, 4, '0');
  return v_code;
end;
$$;
grant execute on function generate_student_code to authenticated;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table students enable row level security;
alter table student_enrollments enable row level security;
alter table guardians enable row level security;
alter table student_guardians enable row level security;
alter table student_medical_records enable row level security;
alter table student_documents enable row level security;
alter table student_discipline_records enable row level security;
alter table student_achievements enable row level security;
alter table student_transfers enable row level security;

-- students: readable by anyone with students.view scoped to the school;
-- Class Teachers/Teachers see only students in their assigned section
-- once Phase 6/7 teacher-section assignments exist — for now, scope is
-- school-level, tightened further as those tables land (documented, not
-- silently deferred).
create policy students_select on students for select using (
  auth_has_school_access(school_id) and auth_has_permission('students.view'));
create policy students_insert on students for insert with check (
  auth_has_school_access(school_id) and auth_has_permission('students.create'));
create policy students_update on students for update using (
  auth_has_school_access(school_id) and auth_has_permission('students.update'));
create policy students_delete on students for update using ( -- soft delete only: enforced as update
  auth_has_school_access(school_id) and auth_has_permission('students.delete'));

create policy enrollments_select on student_enrollments for select using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.view'));
create policy enrollments_write on student_enrollments for all using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.update'));

create policy guardians_select on guardians for select using (
  organization_id = auth_organization_id() and auth_has_permission('students.view'));
create policy guardians_write on guardians for all using (
  organization_id = auth_organization_id() and auth_has_permission('students.update'));

create policy student_guardians_select on student_guardians for select using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.view'));
create policy student_guardians_write on student_guardians for all using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.update'));

-- Medical records are the most sensitive table in this phase: requires a
-- DEDICATED permission, not just students.view, so viewing a student's
-- basic profile never implies viewing medical data.
create policy medical_records_select on student_medical_records for select using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.view_medical'));
create policy medical_records_write on student_medical_records for all using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.view_medical'));

create policy documents_select on student_documents for select using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.view'));
create policy documents_write on student_documents for all using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.update'));

create policy discipline_select on student_discipline_records for select using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.view_discipline'));
create policy discipline_write on student_discipline_records for all using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.view_discipline'));

create policy achievements_select on student_achievements for select using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.view'));
create policy achievements_write on student_achievements for all using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.update'));

create policy transfers_select on student_transfers for select using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.view'));
create policy transfers_write on student_transfers for all using (
  student_id in (select id from students where auth_has_school_access(school_id))
  and auth_has_permission('students.update'));

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 3
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('students.view',            'students', 'View student profiles and enrollment'),
  ('students.create',          'students', 'Create new student records'),
  ('students.update',          'students', 'Edit student records, guardians, documents, achievements'),
  ('students.delete',          'students', 'Archive (soft-delete) student records'),
  ('students.view_medical',    'students', 'View and edit sensitive medical records'),
  ('students.view_discipline', 'students', 'View and edit discipline records')
on conflict (key) do nothing;

-- Grant the new keys to the role templates that should have them by default.
with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    (r.name in ('Super Admin','Organization Owner','School Administrator','Principal') and p.module = 'students')
    or (r.name in ('Vice Principal','Teacher','Class Teacher') and p.key in ('students.view','students.update'))
    or (r.name = 'Class Teacher' and p.key in ('students.view_discipline'))
    or (r.name = 'HR Manager' and p.key = 'students.view') -- read-only cross-reference for HR needs
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (3, 'Student Information System', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';
