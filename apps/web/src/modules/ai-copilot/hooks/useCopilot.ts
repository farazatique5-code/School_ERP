// modules/ai-copilot/hooks/useCopilot.ts
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../core/auth/AuthContext';
import { askCopilot } from '../api/copilot';
import { ApiError } from '../../organizations/api/mutations';

export interface CopilotMessage {
  role: 'user' | 'assistant' | 'error';
  text: string;
}

export function useCopilot() {
  const { session, activeSchoolId } = useAuth();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);

  const ask = useMutation({
    mutationFn: (question: string) => askCopilot(session!.access_token, activeSchoolId!, question),
  });

  const sendQuestion = async (question: string) => {
    setMessages((m) => [...m, { role: 'user', text: question }]);
    try {
      const answer = await ask.mutateAsync(question);
      setMessages((m) => [...m, { role: 'assistant', text: answer }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' },
      ]);
    }
  };

  return { messages, sendQuestion, isAsking: ask.isPending };
}
