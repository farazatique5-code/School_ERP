// modules/ai-copilot/api/copilot.ts
import { ApiError } from '../../organizations/api/mutations';

const COPILOT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot-query`;

export async function askCopilot(accessToken: string, schoolId: string, question: string) {
  const response = await fetch(COPILOT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ question, schoolId }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'unknown_error', body?.error?.message ?? 'The AI Copilot could not answer that.');
  }
  return body.data.answer as string;
}
