// modules/organizations/pages/OrganizationSettingsPage.tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../../core/auth/AuthContext';
import { RequirePermission } from '../../../core/rbac/RequirePermission';
import {
  organizationSettingsSchema,
  type OrganizationSettingsInput,
} from '../schemas/organization.schema';
import { useUpdateOrganizationSettings } from '../hooks/useOrganizationMutations';

export function OrganizationSettingsPage() {
  const { organization } = useAuth();

  if (!organization) return <p>Loading organization…</p>;

  return (
    <RequirePermission perm="organization.update">
      <OrganizationSettingsForm organizationId={organization.id} />
    </RequirePermission>
  );
}

function OrganizationSettingsForm({ organizationId }: { organizationId: string }) {
  const { organization } = useAuth();
  const update = useUpdateOrganizationSettings(organizationId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OrganizationSettingsInput>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: organization
      ? {
          name: organization.name,
          customDomain: organization.custom_domain ?? '',
          primaryColor: organization.primary_color,
          secondaryColor: organization.secondary_color,
          themeModeDefault: organization.theme_mode_default,
          billingEmail: organization.billing_email ?? '',
        }
      : undefined,
  });

  useEffect(() => {
    if (organization) {
      reset({
        name: organization.name,
        customDomain: organization.custom_domain ?? '',
        primaryColor: organization.primary_color,
        secondaryColor: organization.secondary_color,
        themeModeDefault: organization.theme_mode_default,
        billingEmail: organization.billing_email ?? '',
      });
    }
  }, [organization, reset]);

  return (
    <section className="settings-panel">
      <h2>Organization & Branding</h2>
      <p className="field-hint">
        These settings apply across every school in your organization and drive white-label branding
        (login screen, sidebar, emails).
      </p>

      <form onSubmit={handleSubmit((input) => update.mutate(input))}>
        <label>
          Organization name
          <input {...register('name')} />
          {errors.name && <span role="alert">{errors.name.message}</span>}
        </label>

        <label>
          Custom domain (optional)
          <input {...register('customDomain')} placeholder="portal.myschool.edu" />
          {errors.customDomain && <span role="alert">{errors.customDomain.message}</span>}
        </label>

        <div className="color-fields">
          <label>
            Primary color
            <input type="color" {...register('primaryColor')} />
            {errors.primaryColor && <span role="alert">{errors.primaryColor.message}</span>}
          </label>
          <label>
            Secondary color
            <input type="color" {...register('secondaryColor')} />
            {errors.secondaryColor && <span role="alert">{errors.secondaryColor.message}</span>}
          </label>
        </div>

        <label>
          Default theme mode for new users
          <select {...register('themeModeDefault')}>
            <option value="system">Match device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label>
          Billing email
          <input type="email" {...register('billingEmail')} />
          {errors.billingEmail && <span role="alert">{errors.billingEmail.message}</span>}
        </label>

        {update.isError && <p role="alert" className="form-error">Couldn't save changes. Please try again.</p>}
        {update.isSuccess && !isDirty && <p className="form-success">Saved.</p>}

        <button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </section>
  );
}
