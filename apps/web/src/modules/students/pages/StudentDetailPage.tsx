// modules/students/pages/StudentDetailPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { usePermission } from '../../../core/rbac/usePermission';
import { useInvitePortalUser } from '../../portals/hooks/usePortal';
import {
  useStudentDetail,
  useStudentMedicalRecord,
  useStudentDisciplineRecords,
  useAddGuardian,
  useSaveMedicalRecord,
  useAddDisciplineRecord,
  useAddAchievement,
} from '../hooks/useStudents';
import {
  guardianSchema,
  medicalRecordSchema,
  disciplineRecordSchema,
  achievementSchema,
  type GuardianInput,
  type MedicalRecordInput,
  type DisciplineRecordInput,
  type AchievementInput,
} from '../schemas/student.schema';

const TABS = ['Overview', 'Guardians', 'Medical', 'Discipline', 'Achievements', 'Documents'] as const;
type Tab = (typeof TABS)[number];

export function StudentDetailPage() {
  return (
    <RequirePermission perm="students.view">
      <StudentDetailContent />
    </RequirePermission>
  );
}

function StudentDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: student, isLoading } = useStudentDetail(id);
  const [tab, setTab] = useState<Tab>('Overview');
  const canViewMedical = usePermission('students.view_medical');
  const canViewDiscipline = usePermission('students.view_discipline');

  if (isLoading) return <p>Loading…</p>;
  if (!student) return <p>Student not found.</p>;

  const currentEnrollment = student.student_enrollments?.find((e: any) => e.academic_year?.is_current);

  const visibleTabs = TABS.filter((t) => {
    if (t === 'Medical') return canViewMedical;
    if (t === 'Discipline') return canViewDiscipline;
    return true;
  });

  return (
    <div className="student-detail-page">
      <header className="student-detail-header">
        {student.photo_url ? (
          <img src={student.photo_url} alt="" className="avatar-lg" />
        ) : (
          <span className="avatar-placeholder-lg">
            {student.first_name[0]}
            {student.last_name[0]}
          </span>
        )}
        <div>
          <h1>
            {student.first_name} {student.last_name}
          </h1>
          <p className="text-secondary">
            {student.student_code} · {currentEnrollment?.class?.name ?? 'Unassigned'}
            {currentEnrollment?.section?.name ? ` / ${currentEnrollment.section.name}` : ''}
          </p>
        </div>
        <span className={`status-badge ${student.status === 'active' ? 'status-active' : 'status-inactive'}`}>
          {student.status}
        </span>
      </header>

      <nav className="tab-bar" aria-label="Student sections">
        {visibleTabs.map((t) => (
          <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      <div className="tab-panel">
        {tab === 'Overview' && <OverviewTab student={student} enrollment={currentEnrollment} />}
        {tab === 'Guardians' && <GuardiansTab student={student} />}
        {tab === 'Medical' && canViewMedical && <MedicalTab studentId={student.id} />}
        {tab === 'Discipline' && canViewDiscipline && <DisciplineTab studentId={student.id} />}
        {tab === 'Achievements' && <AchievementsTab student={student} />}
        {tab === 'Documents' && <DocumentsTab student={student} />}
      </div>
    </div>
  );
}

function OverviewTab({ student, enrollment }: { student: any; enrollment: any }) {
  const invite = useInvitePortalUser();

  return (
    <div className="card">
      <dl className="detail-grid">
        <dt>Date of birth</dt>
        <dd>{new Date(student.date_of_birth).toLocaleDateString()}</dd>
        <dt>Gender</dt>
        <dd>{student.gender ?? '—'}</dd>
        <dt>Nationality</dt>
        <dd>{student.nationality ?? '—'}</dd>
        <dt>Admission date</dt>
        <dd>{new Date(student.admission_date).toLocaleDateString()}</dd>
        <dt>House</dt>
        <dd>{student.house?.name ?? '—'}</dd>
        <dt>Roll number</dt>
        <dd>{enrollment?.roll_number ?? '—'}</dd>
        <dt>Student portal</dt>
        <dd>
          {student.profile_id ? (
            <span className="status-badge status-active">Active</span>
          ) : (
            <RequirePermission perm="students.update" fallback={<span className="text-secondary">Not set up</span>}>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  const email = prompt(`Email for ${student.first_name}'s student portal login:`);
                  if (email) invite.mutate({ portalType: 'student', targetId: student.id, fullName: `${student.first_name} ${student.last_name}`, email });
                }}
                disabled={invite.isPending}
              >
                {invite.isPending ? 'Sending invite…' : 'Invite to student portal'}
              </button>
            </RequirePermission>
          )}
        </dd>
      </dl>
    </div>
  );
}

function GuardianPortalStatus({ guardian }: { guardian: any }) {
  const invite = useInvitePortalUser();

  if (guardian.profile_id) {
    return <span className="status-badge status-active" style={{ marginTop: 4 }}>Portal account active</span>;
  }
  if (!guardian.email) {
    return <p className="text-secondary" style={{ fontSize: 11 }}>Add an email to invite this guardian to the portal.</p>;
  }
  return (
    <RequirePermission perm="students.update" fallback={null}>
      <button
        type="button"
        className="link-button"
        onClick={() =>
          invite.mutate({
            portalType: 'guardian',
            targetId: guardian.id,
            fullName: `${guardian.first_name} ${guardian.last_name}`,
            email: guardian.email,
          })
        }
        disabled={invite.isPending}
      >
        {invite.isPending ? 'Sending invite…' : 'Invite to parent portal'}
      </button>
      {invite.isError && <p role="alert" className="form-error" style={{ fontSize: 11 }}>Could not send invite.</p>}
      {invite.isSuccess && <p className="form-success" style={{ fontSize: 11 }}>Invite sent.</p>}
    </RequirePermission>
  );
}

function GuardiansTab({ student }: { student: any }) {
  const [showForm, setShowForm] = useState(false);
  const addGuardian = useAddGuardian(student.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GuardianInput>({
    resolver: zodResolver(guardianSchema),
    defaultValues: { relationship: 'father', isPrimaryContact: false, isEmergencyContact: false },
  });

  return (
    <div className="card">
      <div className="page-toolbar">
        <h2>Guardians</h2>
        <RequirePermission perm="students.update" fallback={null}>
          <button type="button" onClick={() => setShowForm((s) => !s)}>
            + Add guardian
          </button>
        </RequirePermission>
      </div>

      <ul className="guardian-list">
        {(student.student_guardians ?? []).map((sg: any) => (
          <li key={sg.guardian.id}>
            <strong>
              {sg.guardian.first_name} {sg.guardian.last_name}
            </strong>{' '}
            <span className="text-secondary">({sg.relationship})</span>
            {sg.is_primary_contact && <span className="status-badge status-active">Primary</span>}
            <div className="text-secondary">
              {sg.guardian.phone} {sg.guardian.email ? `· ${sg.guardian.email}` : ''}
            </div>
            <GuardianPortalStatus guardian={sg.guardian} />
          </li>
        ))}
        {(!student.student_guardians || student.student_guardians.length === 0) && (
          <li className="text-secondary">No guardians added yet.</li>
        )}
      </ul>

      {showForm && (
        <form
          className="inline-form"
          onSubmit={handleSubmit(async (input) => {
            await addGuardian.mutateAsync(input);
            reset();
            setShowForm(false);
          })}
        >
          <div className="form-row">
            <label>
              First name
              <input {...register('firstName')} />
              {errors.firstName && <span role="alert">{errors.firstName.message}</span>}
            </label>
            <label>
              Last name
              <input {...register('lastName')} />
              {errors.lastName && <span role="alert">{errors.lastName.message}</span>}
            </label>
          </div>
          <div className="form-row">
            <label>
              Phone
              <input {...register('phone')} />
              {errors.phone && <span role="alert">{errors.phone.message}</span>}
            </label>
            <label>
              Email
              <input type="email" {...register('email')} />
            </label>
          </div>
          <label>
            Relationship
            <select {...register('relationship')}>
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" {...register('isPrimaryContact')} />
            Primary contact
          </label>
          <label className="checkbox-label">
            <input type="checkbox" {...register('isEmergencyContact')} />
            Emergency contact
          </label>

          {addGuardian.isError && <p role="alert" className="form-error">Could not save. Please try again.</p>}

          <div className="drawer-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}
    </div>
  );
}

function MedicalTab({ studentId }: { studentId: string }) {
  const { data: record, isLoading } = useStudentMedicalRecord(studentId, true);
  const save = useSaveMedicalRecord(studentId);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = useForm<MedicalRecordInput>({
    resolver: zodResolver(medicalRecordSchema),
    values: record
      ? {
          bloodGroup: record.blood_group ?? '',
          allergies: record.allergies ?? '',
          chronicConditions: record.chronic_conditions ?? '',
          medications: record.medications ?? '',
          emergencyInstructions: record.emergency_instructions ?? '',
          physicianName: record.physician_name ?? '',
          physicianPhone: record.physician_phone ?? '',
        }
      : undefined,
  });

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className="card">
      <h2>Medical record</h2>
      <p className="field-hint">Visible only to roles granted the dedicated "view medical" permission.</p>
      <form onSubmit={handleSubmit((input) => save.mutate(input))}>
        <div className="form-row">
          <label>
            Blood group
            <input {...register('bloodGroup')} />
          </label>
          <label>
            Physician name
            <input {...register('physicianName')} />
          </label>
          <label>
            Physician phone
            <input {...register('physicianPhone')} />
          </label>
        </div>
        <label>
          Allergies
          <textarea {...register('allergies')} rows={2} />
        </label>
        <label>
          Chronic conditions
          <textarea {...register('chronicConditions')} rows={2} />
        </label>
        <label>
          Current medications
          <textarea {...register('medications')} rows={2} />
        </label>
        <label>
          Emergency instructions
          <textarea {...register('emergencyInstructions')} rows={2} />
        </label>

        {save.isError && <p role="alert" className="form-error">Could not save. Please try again.</p>}
        {save.isSuccess && !isDirty && <p className="form-success">Saved.</p>}

        <button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Saving…' : 'Save medical record'}
        </button>
      </form>
    </div>
  );
}

function DisciplineTab({ studentId }: { studentId: string }) {
  const { data: records, isLoading } = useStudentDisciplineRecords(studentId, true);
  const [showForm, setShowForm] = useState(false);
  const add = useAddDisciplineRecord(studentId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DisciplineRecordInput>({
    resolver: zodResolver(disciplineRecordSchema),
    defaultValues: { category: 'minor', incidentDate: new Date().toISOString().slice(0, 10) },
  });

  return (
    <div className="card">
      <div className="page-toolbar">
        <h2>Discipline records</h2>
        <button type="button" onClick={() => setShowForm((s) => !s)}>
          + Log incident
        </button>
      </div>

      {showForm && (
        <form
          className="inline-form"
          onSubmit={handleSubmit(async (input) => {
            await add.mutateAsync(input);
            reset();
            setShowForm(false);
          })}
        >
          <div className="form-row">
            <label>
              Date
              <input type="date" {...register('incidentDate')} />
            </label>
            <label>
              Category
              <select {...register('category')}>
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="major">Major</option>
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea {...register('description')} rows={2} />
            {errors.description && <span role="alert">{errors.description.message}</span>}
          </label>
          <label>
            Action taken
            <textarea {...register('actionTaken')} rows={2} />
          </label>
          {add.isError && <p role="alert" className="form-error">Could not save. Please try again.</p>}
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <ul className="discipline-list">
          {(records ?? []).map((r: any) => (
            <li key={r.id}>
              <span className={`status-badge category-${r.category}`}>{r.category}</span>{' '}
              <strong>{new Date(r.incident_date).toLocaleDateString()}</strong>
              <p>{r.description}</p>
              {r.action_taken && <p className="text-secondary">Action: {r.action_taken}</p>}
            </li>
          ))}
          {records?.length === 0 && <li className="text-secondary">No discipline records — a clean history.</li>}
        </ul>
      )}
    </div>
  );
}

function AchievementsTab({ student }: { student: any }) {
  const [showForm, setShowForm] = useState(false);
  const add = useAddAchievement(student.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AchievementInput>({
    resolver: zodResolver(achievementSchema),
    defaultValues: { achievedOn: new Date().toISOString().slice(0, 10) },
  });

  return (
    <div className="card">
      <div className="page-toolbar">
        <h2>Achievements</h2>
        <button type="button" onClick={() => setShowForm((s) => !s)}>
          + Add achievement
        </button>
      </div>

      {showForm && (
        <form
          className="inline-form"
          onSubmit={handleSubmit(async (input) => {
            await add.mutateAsync(input);
            reset();
            setShowForm(false);
          })}
        >
          <label>
            Title
            <input {...register('title')} />
            {errors.title && <span role="alert">{errors.title.message}</span>}
          </label>
          <div className="form-row">
            <label>
              Category
              <select {...register('category')}>
                <option value="academic">Academic</option>
                <option value="sports">Sports</option>
                <option value="arts">Arts</option>
                <option value="leadership">Leadership</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Date
              <input type="date" {...register('achievedOn')} />
            </label>
          </div>
          <label>
            Description
            <textarea {...register('description')} rows={2} />
          </label>
          {add.isError && <p role="alert" className="form-error">Could not save. Please try again.</p>}
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}

      <ul className="achievement-list">
        {(student.student_achievements ?? []).map((a: any) => (
          <li key={a.id}>
            <strong>{a.title}</strong> <span className="text-secondary">({a.category})</span>
            <div className="text-secondary">{new Date(a.achieved_on).toLocaleDateString()}</div>
            {a.description && <p>{a.description}</p>}
          </li>
        ))}
        {(!student.student_achievements || student.student_achievements.length === 0) && (
          <li className="text-secondary">No achievements logged yet.</li>
        )}
      </ul>
    </div>
  );
}

function DocumentsTab({ student }: { student: any }) {
  return (
    <div className="card">
      <h2>Documents</h2>
      <ul className="document-list">
        {(student.student_documents ?? []).map((doc: any) => (
          <li key={doc.id}>
            {doc.file_name} <span className="text-secondary">({doc.document_type})</span>
          </li>
        ))}
        {(!student.student_documents || student.student_documents.length === 0) && (
          <li className="text-secondary">No documents uploaded yet.</li>
        )}
      </ul>
      <p className="field-hint">
        Document upload uses the `uploadStudentDocument` helper in the students API layer, writing to the
        `student-documents` Storage bucket — wire a file input here when the admissions upload flow (Phase 4) needs it.
      </p>
    </div>
  );
}
