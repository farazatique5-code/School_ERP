// modules/organizations/api/mutations.ts
import { supabase } from '../../../core/supabase/client';
import { signUpSchema, loginSchema, organizationSettingsSchema } from '../schemas/organization.schema';
import type { SignUpInput, LoginInput, OrganizationSettingsInput } from '../schemas/organization.schema';

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const PROVISION_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provision-organization`;

/** Creates the auth user + organization + first school + roles atomically
 * via the provision-organization Edge Function (see supabase/functions),
 * then signs the new user in. */
export async function signUpOrganization(input: SignUpInput) {
  const parsed = signUpSchema.parse(input);

  const response = await fetch(PROVISION_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'unknown_error', body?.error?.message ?? 'Sign up failed');
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });
  if (signInError) throw new ApiError('sign_in_failed', signInError.message);

  return body.data as { organization_id: string; school_id: string };
}

export async function login(input: LoginInput) {
  const parsed = loginSchema.parse(input);
  const { data, error } = await supabase.auth.signInWithPassword(parsed);
  if (error) throw new ApiError('invalid_credentials', 'Incorrect email or password.');
  return data;
}

export async function updateOrganizationSettings(organizationId: string, input: OrganizationSettingsInput) {
  const parsed = organizationSettingsSchema.parse(input);
  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: parsed.name,
      custom_domain: parsed.customDomain || null,
      primary_color: parsed.primaryColor,
      secondary_color: parsed.secondaryColor,
      theme_mode_default: parsed.themeModeDefault,
      billing_email: parsed.billingEmail || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select()
    .single();
  if (error) throw new ApiError(error.code ?? 'update_failed', error.message);
  return data;
}
