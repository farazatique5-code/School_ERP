// modules/ai-copilot/components/CopilotWidget.tsx
import { useState } from 'react';
import { usePermission } from '../../../core/rbac/usePermission';
import { useCopilot } from '../hooks/useCopilot';

export function CopilotWidget() {
  const canUseCopilot = usePermission('ai.copilot_use');
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, sendQuestion, isAsking } = useCopilot();

  if (!canUseCopilot) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const question = input;
    setInput('');
    await sendQuestion(question);
  };

  return (
    <>
      <button type="button" className="copilot-fab" onClick={() => setOpen((o) => !o)} aria-label="Open AI Copilot">
        {open ? '×' : '✨'}
      </button>

      {open && (
        <div className="copilot-panel" role="dialog" aria-label="AI Copilot">
          <header className="copilot-panel-header">
            <strong>AI Copilot</strong>
            <span className="text-secondary">Answers come only from your school's real data.</span>
          </header>

          <div className="copilot-messages">
            {messages.length === 0 && (
              <p className="text-secondary copilot-empty-hint">
                Try: "How many students are enrolled?" or "What's our outstanding fee balance?"
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`copilot-message copilot-message-${m.role}`}>
                {m.text}
              </div>
            ))}
            {isAsking && <div className="copilot-message copilot-message-assistant">Thinking…</div>}
          </div>

          <form onSubmit={handleSubmit} className="copilot-input-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your school's data…"
              disabled={isAsking}
            />
            <button type="submit" disabled={isAsking || !input.trim()}>Send</button>
          </form>
        </div>
      )}
    </>
  );
}
