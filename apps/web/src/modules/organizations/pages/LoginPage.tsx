// modules/organizations/pages/LoginPage.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '../schemas/organization.schema';
import { useLogin } from '../hooks/useOrganizationMutations';
import { ApiError } from '../api/mutations';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const redirectTo = (location.state as { from?: string })?.from ?? '/';

  const onSubmit = async (input: LoginInput) => {
    try {
      await login.mutateAsync(input);
      navigate(redirectTo, { replace: true });
    } catch {
      // surfaced via login.error below
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Sign in</h1>
        <form onSubmit={handleSubmit(onSubmit)}>
          <label>
            Email
            <input type="email" {...register('email')} autoComplete="email" autoFocus />
            {errors.email && <span role="alert">{errors.email.message}</span>}
          </label>
          <label>
            Password
            <input type="password" {...register('password')} autoComplete="current-password" />
            {errors.password && <span role="alert">{errors.password.message}</span>}
          </label>

          {login.error && (
            <p role="alert" className="form-error">
              {login.error instanceof ApiError ? login.error.message : 'Sign in failed. Please try again.'}
            </p>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="auth-footer-link">
          New organization? <Link to="/sign-up">Create a workspace</Link>
        </p>
      </div>
    </div>
  );
}
