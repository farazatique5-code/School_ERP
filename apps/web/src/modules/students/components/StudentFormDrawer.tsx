// modules/students/components/StudentFormDrawer.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { studentSchema, type StudentInput } from '../schemas/student.schema';
import { useCreateStudent } from '../hooks/useStudents';
import { useAcademicYears, useClasses } from '../../academics/hooks/useAcademics';
import { ApiError } from '../../organizations/api/mutations';

export function StudentFormDrawer({ onClose }: { onClose: () => void }) {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y) => y.is_current) ?? years?.[0];
  const { data: classes } = useClasses(currentYear?.id);
  const create = useCreateStudent();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      academicYearId: currentYear?.id,
      admissionDate: new Date().toISOString().slice(0, 10),
    },
  });

  const selectedClassId = watch('classId');
  const sectionsForSelectedClass = classes?.find((c: any) => c.id === selectedClassId)?.sections ?? [];

  const onSubmit = async (input: StudentInput) => {
    try {
      await create.mutateAsync(input);
      onClose();
    } catch {
      // surfaced via create.error below
    }
  };

  if (!currentYear) {
    return (
      <div className="drawer-overlay" role="dialog" aria-modal="true">
        <div className="drawer">
          <h2>Add student</h2>
          <p className="field-hint">
            No academic year is set up yet for this school. Go to <strong>Academic Setup</strong> and create the
            current academic year with at least one class and section before adding students.
          </p>
          <div className="drawer-actions">
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-label="Add student">
      <div className="drawer">
        <h2>Add student</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" {...register('academicYearId')} value={currentYear.id} />

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
              Date of birth
              <input type="date" {...register('dateOfBirth')} />
              {errors.dateOfBirth && <span role="alert">{errors.dateOfBirth.message}</span>}
            </label>
            <label>
              Gender
              <select {...register('gender')}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <label>
            Admission date
            <input type="date" {...register('admissionDate')} />
            {errors.admissionDate && <span role="alert">{errors.admissionDate.message}</span>}
          </label>

          <div className="form-row">
            <label>
              Class
              <select {...register('classId')}>
                <option value="">Select a class</option>
                {(classes ?? []).map((klass: any) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name}
                  </option>
                ))}
              </select>
              {errors.classId && <span role="alert">{errors.classId.message}</span>}
            </label>
            <label>
              Section
              <select {...register('sectionId')} disabled={!selectedClassId}>
                <option value="">Select a section</option>
                {sectionsForSelectedClass.map((section: any) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              {errors.sectionId && <span role="alert">{errors.sectionId.message}</span>}
            </label>
          </div>

          <label>
            Roll number (optional)
            <input {...register('rollNumber')} />
          </label>

          {create.isError && (
            <p role="alert" className="form-error">
              {create.error instanceof ApiError ? create.error.message : 'Could not create student. Please try again.'}
            </p>
          )}

          <div className="drawer-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
