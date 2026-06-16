import { useState, useRef } from 'react';
import { X, Copy, Check, Bot, ClipboardPaste } from 'lucide-react';

interface ManualAiPromptModalProps {
  isOpen: boolean;
  title: string;
  promptText: string;
  responseFormat: 'json' | 'markdown';
  onResponse: (text: string) => void;
  onCancel: () => void;
}

export default function ManualAiPromptModal({
  isOpen,
  title,
  promptText,
  responseFormat,
  onResponse,
  onCancel,
}: ManualAiPromptModalProps) {
  const [copied, setCopied] = useState(false);
  const [response, setResponse] = useState('');
  const [parseError, setParseError] = useState('');
  const responseRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select all in textarea
      const ta = document.querySelector<HTMLTextAreaElement>('.manual-ai-prompt-textarea--prompt');
      ta?.select();
    }
  };

  const handleSubmit = () => {
    const trimmed = response.trim();
    if (!trimmed) {
      setParseError('Please paste the AI response first.');
      return;
    }
    if (responseFormat === 'json') {
      try {
        JSON.parse(trimmed);
      } catch {
        setParseError('The pasted text is not valid JSON. Make sure you copied the full JSON response from the chatbot.');
        return;
      }
    }
    setParseError('');
    onResponse(trimmed);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content glass-panel manual-ai-prompt-modal scrollable"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-header-title">
            <Bot size={18} className="text-accent" />
            {title}
          </h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-scroll-body modal-scroll-body--mt12 manual-ai-prompt-body">
          {/* Step 1: Prompt */}
          <div className="manual-ai-step">
            <div className="manual-ai-step-header">
              <span className="manual-ai-step-number">1</span>
              <span className="manual-ai-step-title">Copy this prompt and paste it into any AI chatbot</span>
              <button className="manual-ai-copy-btn btn-secondary" onClick={handleCopy}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy prompt'}
              </button>
            </div>
            <textarea
              className="manual-ai-prompt-textarea manual-ai-prompt-textarea--prompt"
              value={promptText}
              readOnly
              rows={10}
            />
            <p className="manual-ai-hint">
              Paste into <strong>ChatGPT</strong>, <strong>Claude</strong>, <strong>Gemini</strong>, or any AI assistant.
              {responseFormat === 'json'
                ? ' Copy the full JSON block the AI responds with.'
                : ' Copy the full Markdown text the AI responds with.'}
            </p>
          </div>

          {/* Step 2: Response */}
          <div className="manual-ai-step">
            <div className="manual-ai-step-header">
              <span className="manual-ai-step-number">2</span>
              <span className="manual-ai-step-title">Paste the AI's response here</span>
              <button
                className="manual-ai-copy-btn btn-secondary"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    setResponse(text);
                    setParseError('');
                    responseRef.current?.focus();
                  } catch { /* permission denied */ }
                }}
              >
                <ClipboardPaste size={13} /> Paste
              </button>
            </div>
            <textarea
              ref={responseRef}
              className="manual-ai-prompt-textarea manual-ai-prompt-textarea--response"
              placeholder={responseFormat === 'json'
                ? 'Paste the JSON response here...'
                : 'Paste the Markdown response here...'}
              value={response}
              onChange={e => { setResponse(e.target.value); setParseError(''); }}
              rows={10}
            />
            {parseError && <p className="manual-ai-error">{parseError}</p>}
          </div>
        </div>

        <div className="modal-actions modal-actions--mt24">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit}>
            Apply Response
          </button>
        </div>
      </div>
    </div>
  );
}
