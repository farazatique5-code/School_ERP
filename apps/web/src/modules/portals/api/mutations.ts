// modules/portals/api/mutations.ts
import { ApiError } from '../../organizations/api/mutations';

const INVITE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-portal-user`;

export async function invitePortalUser(
  accessToken: string,
  organizationId: string,
  portalType: 'student' | 'guardian',
  targetId: string,
  fullName: string,
  email: string,
) {
  const response = await fetch(INVITE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ fullName, email, organizationId, portalType, targetId }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'unknown_error', body?.error?.message ?? 'Invite failed');
  }
  return body.data as { profile_id: string };
}
