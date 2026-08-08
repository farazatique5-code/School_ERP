// modules/organizations/hooks/useOrganizationMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signUpOrganization, login, updateOrganizationSettings } from '../api/mutations';
import type { SignUpInput, LoginInput, OrganizationSettingsInput } from '../schemas/organization.schema';

export function useSignUpOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SignUpInput) => signUpOrganization(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
  });
}

export function useUpdateOrganizationSettings(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OrganizationSettingsInput) => updateOrganizationSettings(organizationId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'organization', organizationId], data);
    },
  });
}
