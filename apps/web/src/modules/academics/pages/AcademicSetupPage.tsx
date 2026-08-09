// modules/academics/pages/AcademicSetupPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import { academicYearSchema, classSchema, sectionSchema } from '../schemas/academics.schema';
import type { AcademicYearInput, ClassInput, SectionInput } from '../schemas/academics.schema';
import { useAcademicYears, useCreateAcademicYear, useClasses, useCreateClass, useCreateSection } from '../hooks/useAcademics';

export function AcademicSetupPage() {
  return (
    <RequirePermission perm="academics.manage">
      <AcademicSetupContent />
    </RequirePermission>
  );
}

function AcademicSetupContent() {
  const { data: years, isLoading: yearsLoading } = useAcademicYears();
  const [selectedYearId, setSelectedYearId] = useState<string | undefined>(years?.find((y) => y.is_current)?.id);
  const [showYearForm, setShowYearForm] = useState(false);

  const activeYearId = selectedYearId ?? years?.find((y) => y.is_current)?.id ?? years?.[0]?.id;

  return (
    <div className="academic-setup-page">
      <h1>Academic Setup</h1>
      <p className="field-hint">
        Classes and sections created here are what Students, Admissions, Timetable, and Examination will all
        reference — set this up once per academic year before enrolling students.
      </p>

      <section className="card">
        <div className="page-toolbar">
          <h2>Academic Years</h2>
          <button type="button" onClick={() => setShowYearForm(true)}>
            + Add academic year
          </button>
        </div>

        {yearsLoading ? (
          <p>Loading…</p>
        ) : (
          <ul className="year-tabs">
            {(years ?? []).map((year) => (
              <li key={year.id}>
                <button
                  type="button"
                  className={activeYearId === year.id ? 'active' : ''}
                  onClick={() => setSelectedYearId(year.id)}
                >
                  {year.name} {year.is_current && <span className="status-badge status-active">Current</span>}
                </button>
              </li>
            ))}
            {years?.length === 0 && <li className="text-secondary">No academic years yet.</li>}
          </ul>
        )}

        {showYearForm && <AcademicYearForm onClose={() => setShowYearForm(false)} />}
      </section>

      {activeYearId && <ClassesPanel academicYearId={activeYearId} />}
    </div>
  );
}

function AcademicYearForm({ onClose }: { onClose: () => void }) {
  const create = useCreateAcademicYear();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcademicYearInput>({ resolver: zodResolver(academicYearSchema), defaultValues: { isCurrent: false } });

  return (
    <form
      className="inline-form"
      onSubmit={handleSubmit(async (input) => {
        await create.mutateAsync(input);
        onClose();
      })}
    >
      <label>
        Name
        <input {...register('name')} placeholder="2026-2027" />
        {errors.name && <span role="alert">{errors.name.message}</span>}
      </label>
      <label>
        Start date
        <input type="date" {...register('startDate')} />
        {errors.startDate && <span role="alert">{errors.startDate.message}</span>}
      </label>
      <label>
        End date
        <input type="date" {...register('endDate')} />
        {errors.endDate && <span role="alert">{errors.endDate.message}</span>}
      </label>
      <label className="checkbox-label">
        <input type="checkbox" {...register('isCurrent')} />
        Set as current year
      </label>
      {create.isError && <p role="alert" className="form-error">Could not save. Please try again.</p>}
      <div className="drawer-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>Save</button>
      </div>
    </form>
  );
}

function ClassesPanel({ academicYearId }: { academicYearId: string }) {
  const { data: classes, isLoading } = useClasses(academicYearId);
  const [showClassForm, setShowClassForm] = useState(false);
  const createClass = useCreateClass(academicYearId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassInput>({ resolver: zodResolver(classSchema), defaultValues: { sequence: 0 } });

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="page-toolbar">
        <h2>Classes & Sections</h2>
        <button type="button" onClick={() => setShowClassForm((s) => !s)}>
          + Add class
        </button>
      </div>

      {showClassForm && (
        <form
          className="inline-form"
          onSubmit={handleSubmit(async (input) => {
            await createClass.mutateAsync(input);
            reset();
            setShowClassForm(false);
          })}
        >
          <label>
            Class name
            <input {...register('name')} placeholder="Grade 10" />
            {errors.name && <span role="alert">{errors.name.message}</span>}
          </label>
          <label>
            Display order
            <input type="number" {...register('sequence')} />
          </label>
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowClassForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <ul className="class-list">
          {(classes ?? []).map((klass: any) => (
            <ClassRow key={klass.id} klass={klass} academicYearId={academicYearId} />
          ))}
          {classes?.length === 0 && <li className="text-secondary">No classes yet for this academic year.</li>}
        </ul>
      )}
    </section>
  );
}

function ClassRow({ klass, academicYearId }: { klass: any; academicYearId: string }) {
  const [showSectionForm, setShowSectionForm] = useState(false);
  const createSection = useCreateSection(klass.id, academicYearId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SectionInput>({ resolver: zodResolver(sectionSchema) });

  return (
    <li className="class-row">
      <div className="class-row-header">
        <strong>{klass.name}</strong>
        <span className="text-secondary">
          {klass.sections?.length ?? 0} section{klass.sections?.length === 1 ? '' : 's'}
        </span>
        <button type="button" onClick={() => setShowSectionForm((s) => !s)}>
          + Add section
        </button>
      </div>

      {klass.sections?.length > 0 && (
        <div className="section-chips">
          {klass.sections.map((section: any) => (
            <span key={section.id} className="section-chip">
              {section.name}
              {section.capacity ? ` (cap. ${section.capacity})` : ''}
            </span>
          ))}
        </div>
      )}

      {showSectionForm && (
        <form
          className="inline-form"
          onSubmit={handleSubmit(async (input) => {
            await createSection.mutateAsync(input);
            reset();
            setShowSectionForm(false);
          })}
        >
          <label>
            Section name
            <input {...register('name')} placeholder="A" />
            {errors.name && <span role="alert">{errors.name.message}</span>}
          </label>
          <label>
            Capacity
            <input type="number" {...register('capacity')} />
          </label>
          <label>
            Room number
            <input {...register('roomNumber')} />
          </label>
          <div className="drawer-actions">
            <button type="button" onClick={() => setShowSectionForm(false)}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>Save</button>
          </div>
        </form>
      )}
    </li>
  );
}
