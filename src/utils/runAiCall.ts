import { GeminiService } from './ai';
import { aiRequestQueue } from './aiRequestQueue';

export interface AiCallOptions<T> {
  label: string;
  buildPrompt: () => string;
  responseFormat?: 'json' | 'markdown';
  parse: (text: string) => T;
  liveCall: () => Promise<T>;
  onSuccess: (result: T) => void;
  onError: (err: Error) => void;
  onLoadingChange?: (loading: boolean) => void;
  showManualPrompt: (
    title: string,
    prompt: string,
    format: 'json' | 'markdown'
  ) => Promise<string | null>;
}

export async function runAiCall<T>(options: AiCallOptions<T>): Promise<void> {
  const {
    label, buildPrompt, responseFormat = 'json', parse, liveCall,
    onSuccess, onError, onLoadingChange, showManualPrompt,
  } = options;

  // Safety net: bail silently if AI is disabled. Buttons should already be
  // disabled, but this prevents any unchecked code path from reaching the API.
  if (!GeminiService.isAiEnabled()) return;

  if (GeminiService.isManualMode()) {
    const text = await showManualPrompt(label, buildPrompt(), responseFormat);
    if (text === null) return;
    try {
      onSuccess(parse(text));
    } catch (err: unknown) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
    return;
  }

  onLoadingChange?.(true);
  aiRequestQueue.enqueue(label, async () => {
    try {
      onSuccess(await liveCall());
    } catch (err: unknown) {
      onError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      onLoadingChange?.(false);
    }
  });
}
