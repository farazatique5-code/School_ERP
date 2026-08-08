// modules/organizations/pages/SignUpPage.tsx
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { signUpSchema, slugify, type SignUpInput } from '../schemas/organization.schema';
import { useSignUpOrganization } from '../hooks/useOrganizationMutations';
import { ApiError } from '../api/mutations';

const STEPS = ['Your account', 'Your organization', 'First school'] as const;

export function SignUpPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [slugTouched, setSlugTouched] = useState(false);
  const signUp = useSignUpOrganization();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
  });

  const organizationName = watch('organizationName');
  useEffect(() => {
    if (!slugTouched && organizationName) {
      setValue('organizationSlug', slugify(organizationName));
    }
  }, [organizationName, slugTouched, setValue]);

  const stepFields: Record<number, (keyof SignUpInput)[]> = {
    0: ['fullName', 'email', 'password'],
    1: ['organizationName', 'organizationSlug'],
    2: ['schoolName', 'schoolCode'],
  };

  const goNext = async () => {
    const valid = await trigger(stepFields[step]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = async (input: SignUpInput) => {
    try {
      await signUp.mutateAsync(input);
      navigate('/', { replace: true });
    } catch {
      // surfaced via signUp.error below; no rethrow needed here
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Create your School ERP workspace</h1>

        <ol className="step-indicator" aria-label="Sign-up progress">
          {STEPS.map((label, i) => (
            <li key={label} data-active={i === step} data-complete={i < step}>
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <form onSubmit={handleSubmit(onSubmit)}>
          {step === 0 && (
            <fieldset>
              <label>
                Full name
                <input {...register('fullName')} autoComplete="name" />
                {errors.fullName && <span role="alert">{errors.fullName.message}</span>}
              </label>
              <label>
                Work email
                <input type="email" {...register('email')} autoComplete="email" />
                {errors.email && <span role="alert">{errors.email.message}</span>}
              </label>
              <label>
                Password
                <input type="password" {...register('password')} autoComplete="new-password" />
                {errors.password && <span role="alert">{errors.password.message}</span>}
              </label>
            </fieldset>
          )}

          {step === 1 && (
            <fieldset>
              <label>
                Organization name
                <input {...register('organizationName')} placeholder="Riverdale Education Group" />
                {errors.organizationName && <span role="alert">{errors.organizationName.message}</span>}
              </label>
              <label>
                Workspace URL
                <div className="input-with-suffix">
                  <input
                    {...register('organizationSlug', { onChange: () => setSlugTouched(true) })}
                    placeholder="riverdale"
                  />
                  <span>.schoolerp.app</span>
                </div>
                {errors.organizationSlug && <span role="alert">{errors.organizationSlug.message}</span>}
              </label>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset>
              <p className="field-hint">
                Add your first campus now — you can add more schools later from Settings.
              </p>
              <label>
                School name
                <input {...register('schoolName')} placeholder="Riverdale Main Campus" />
                {errors.schoolName && <span role="alert">{errors.schoolName.message}</span>}
              </label>
              <label>
                School code
                <input {...register('schoolCode')} placeholder="MAIN" style={{ textTransform: 'uppercase' }} />
                {errors.schoolCode && <span role="alert">{errors.schoolCode.message}</span>}
              </label>
            </fieldset>
          )}

          {signUp.error && (
            <p role="alert" className="form-error">
              {signUp.error instanceof ApiError ? signUp.error.message : 'Something went wrong. Please try again.'}
            </p>
          )}

          <div className="step-actions">
            {step > 0 && (
              <button type="button" onClick={goBack} disabled={isSubmitting}>
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={goNext}>
                Continue
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating your workspace…' : 'Create workspace'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
