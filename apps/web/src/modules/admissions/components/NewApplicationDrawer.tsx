// modules/admissions/components/NewApplicationDrawer.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { admissionApplicationSchema, type AdmissionApplicationInput } from '../schemas/admission.schema';
import { useCreateApplication } from '../hooks/useAdmissions';
import { useAcademicYears, useClasses } from '../../academics/hooks/useAcademics';
import { ApiError } from '../../organizations/api/mutations';

export function NewApplicationDrawer({ onClose }: { onClose: () => void }) {
  const { data: years } = useAcademicYears();
  const currentYear = years?.find((y) => y.is_current) ?? years?.[0];
  const { data: classes } = useClasses(currentYear?.id);
  const create = useCreateApplication();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdmissionApplicationInput>({
    resolver: zodResolver(admissionApplicationSchema),
    defaultValues: { academicYearId: currentYear?.id },
  });

  const onSubmit = async (input: AdmissionApplicationInput) => {
    try {
      await create.mutateAsync(input);
      onClose();
    } catch {
      // surfaced below via create.error
    }
  };

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-label="New application">
      <div className="drawer">
        <h2>New admission application</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" {...register('academicYearId')} value={currentYear?.id ?? ''} />

          <h3>Applicant</h3>
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
            Applying for class
            <select {...register('applyingForClassId')}>
              <option value="">Select a class</option>
              {(classes ?? []).map((klass: any) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name}
                </option>
              ))}
            </select>
            {errors.applyingForClassId && <span role="alert">{errors.applyingForClassId.message}</span>}
          </label>
          <label>
            Previous school (optional)
            <input {...register('previousSchoolName')} />
          </label>

          <h3>Guardian</h3>
          <div className="form-row">
            <label>
              First name
              <input {...register('guardianFirstName')} />
              {errors.guardianFirstName && <span role="alert">{errors.guardianFirstName.message}</span>}
            </label>
            <label>
              Last name
              <input {...register('guardianLastName')} />
              {errors.guardianLastName && <span role="alert">{errors.guardianLastName.message}</span>}
            </label>
          </div>
          <div className="form-row">
            <label>
              Phone
              <input {...register('guardianPhone')} />
              {errors.guardianPhone && <span role="alert">{errors.guardianPhone.message}</span>}
            </label>
            <label>
              Email (optional)
              <input type="email" {...register('guardianEmail')} />
            </label>
          </div>

          {create.isError && (
            <p role="alert" className="form-error">
              {create.error instanceof ApiError ? create.error.message : 'Could not submit. Please try again.'}
            </p>
          )}

          <div className="drawer-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
