import { useState } from 'react';
import ManualAiPromptModal from '../components/ManualAiPromptModal';

interface PendingManualPrompt {
  title: string;
  promptText: string;
  responseFormat: 'json' | 'markdown';
  onResponse: (text: string) => void;
  onCancel: () => void;
}

/**
 * Encapsulates the manual-mode AI prompt flow shared by PlaceModal,
 * AiGenerateModal, and TripPlanner: the pending-prompt state, the
 * `new Promise(resolve => setPending(...))` wrapper passed to `runAiCall`, and
 * the <ManualAiPromptModal> JSX.
 *
 * Usage:
 *   const { showManualPrompt, manualPromptModal, resetManualPrompt } = useManualPrompt();
 *   // pass showManualPrompt to runAiCall; render {manualPromptModal}
 */
export function useManualPrompt() {
  const [pending, setPending] = useState<PendingManualPrompt | null>(null);

  const showManualPrompt = (
    title: string,
    prompt: string,
    format: 'json' | 'markdown',
  ): Promise<string | null> =>
    new Promise(resolve => {
      setPending({
        title,
        promptText: prompt,
        responseFormat: format,
        onResponse: t => { setPending(null); resolve(t); },
        onCancel: () => { setPending(null); resolve(null); },
      });
    });

  const manualPromptModal = pending ? (
    <ManualAiPromptModal
      isOpen={true}
      title={pending.title}
      promptText={pending.promptText}
      responseFormat={pending.responseFormat}
      onResponse={pending.onResponse}
      onCancel={pending.onCancel}
    />
  ) : null;

  return { showManualPrompt, manualPromptModal, resetManualPrompt: () => setPending(null) };
}
