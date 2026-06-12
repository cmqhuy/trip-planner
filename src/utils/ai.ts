
export interface AiDetailField {
  key: string;
  label: string;
  icon: string; // Used to pick corresponding Lucide icons
  instruction: string;
  placeholder: string;
}

export const AI_DETAIL_FIELDS: AiDetailField[] = [
  {
    key: 'what_special',
    label: "Story & What's Special",
    icon: 'Sparkles',
    instruction: "Interesting historical, romantic, pop-culture/movie, or cultural stories behind this place, and what makes it unique.",
    placeholder: "e.g. Famed for its appearance in movies, has historical context..."
  },
  {
    key: 'best_time',
    label: "Best Time to Visit",
    icon: 'Calendar',
    instruction: "Recommended seasons, days, or times to visit, plus crowd/weather details.",
    placeholder: "e.g. Early mornings to avoid crowds, spring for cherry blossoms..."
  },
  {
    key: 'reservation',
    label: "Booking & Reservations",
    icon: 'Ticket',
    instruction: "Advanced ticket details, reservation requirements, or booking tips.",
    placeholder: "e.g. Advanced reservations are required 2 months in advance..."
  },
  {
    key: 'directions',
    label: "How to Get There",
    icon: 'Compass',
    instruction: "Specific directions, arrival points, stations, exits, or main walking routes. If it is a large area, specify where to arrive.",
    placeholder: "e.g. Take JR Yamanote Line to Shibuya Station, Hachiko Exit..."
  },
  {
    key: 'pro_tips',
    label: "Pro-Tips & Gotchas",
    icon: 'AlertCircle',
    instruction: "Insider advice, local etiquette, avoiding common scams, mistakes, or other details.",
    placeholder: "e.g. Watch out for tourist traps nearby, cash only..."
  },
  {
    key: 'other_info',
    label: "Other Useful Info",
    icon: 'HelpCircle',
    instruction: "Any other useful information to help a traveler have a comfortable and enjoyable time.",
    placeholder: "e.g. Stroller accessible, restrooms available nearby..."
  }
];

const KEYS_STORAGE_KEY = 'vacation-itineraries-gemini-api-keys';
const MODEL_STORAGE_KEY = 'vacation-itineraries-gemini-model';
const SYNC_STORAGE_KEY = 'vacation-itineraries-gemini-sync-drive';

export class GeminiService {
  /**
   * Gets preference for syncing AI settings to Google Drive.
   */
  static getSyncToDrive(): boolean {
    return localStorage.getItem(SYNC_STORAGE_KEY) === 'true';
  }

  /**
   * Saves preference for syncing AI settings to Google Drive.
   */
  static setSyncToDrive(enabled: boolean): void {
    localStorage.setItem(SYNC_STORAGE_KEY, String(enabled));
  }

  /**
   * Retrieves keys list from localStorage.
   */
  static getApiKeys(): string[] {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
      return [String(raw)];
    } catch {
      // Fallback for simple comma/newline separated strings
      return raw.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    }
  }

  /**
   * Saves API keys list in localStorage.
   */
  static saveApiKeys(keys: string[]): void {
    const cleaned = keys.map(k => k.trim()).filter(Boolean);
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(cleaned));
  }

  /**
   * Gets selected model or defaults to gemini-2.5-flash.
   */
  static getSelectedModel(): string {
    return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-2.5-flash';
  }

  /**
   * Saves selected model in localStorage.
   */
  static saveSelectedModel(model: string): void {
    localStorage.setItem(MODEL_STORAGE_KEY, model.trim());
  }

  /**
   * Checks if at least one API key is set.
   */
  static hasApiKey(): boolean {
    return this.getApiKeys().length > 0;
  }

  /**
   * Verifies if an API key is valid using a minor query.
   */
  static async testConnection(key: string): Promise<boolean> {
    if (!key || !key.trim()) return false;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello, respond with exactly "OK" if you can read this.' }] }]
        })
      });
      if (!response.ok) return false;
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return !!text;
    } catch (e) {
      console.error('Gemini connection test failed:', e);
      return false;
    }
  }

  /**
   * Direct API call to Gemini for a list of places.
   */
  static async generatePlaceAiDetails(
    places: { id: string; title: string; description?: string }[],
    city: string,
    country: string,
    apiKey: string,
    model = 'gemini-2.5-flash'
  ): Promise<{ id: string; [key: string]: string }[]> {
    if (places.length === 0) return [];

    const properties: any = { id: { type: 'STRING' } };
    const required = ['id'];
    const fieldsPrompt: string[] = [];

    for (const field of AI_DETAIL_FIELDS) {
      properties[field.key] = { type: 'STRING' };
      required.push(field.key);
      fieldsPrompt.push(`- "${field.key}": ${field.instruction}`);
    }

    const promptText = `You are a professional local travel planner and guide. Provide detailed insights for the following places in ${city || 'unknown city'}, ${country || 'unknown country'}:
${places.map(p => `- ID: "${p.id}", Place Title: "${p.title}" (Description: "${p.description || 'N/A'}")`).join('\n')}

For each place, fill in the following details (return detailed, specific paragraph descriptions for each field, do NOT give short one-word or simple answers):
${fieldsPrompt.join('\n')}

IMPORTANT DIRECTIONS REQUIREMENT:
If a place is a broad, generic area or neighborhood (such as Shinjuku, Shibuya, Myeongdong, Soho, etc.), the "directions" field MUST specify a concrete arrival point (e.g. which station, exit, or street corner to arrive at) and where the primary attractions/sights are centered within that area.

IMPORTANT STORY REQUIREMENT:
The "what_special" field must cover the story, history, romance, pop-culture/movie connections, or unique features that make the place special.

IMPORTANT PRO-TIPS REQUIREMENT:
Provide actionable gotchas, etiquette, scams to avoid, best spots for photos, or local secrets.

Ensure the returned JSON lists the exact "id" for each place so it can be matched.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              places: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties,
                  required
                }
              }
            },
            required: ['places']
          }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (Status ${response.status}): ${errText}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      throw new Error('Gemini API returned an empty response.');
    }

    const parsed = JSON.parse(resultText);
    if (!parsed.places || !Array.isArray(parsed.places)) {
      throw new Error('Invalid response structure from Gemini API.');
    }

    return parsed.places;
  }

  /**
   * Generates AI details rotating through configured keys.
   */
  static async generatePlaceAiDetailsWithRotation(
    places: { id: string; title: string; description?: string }[],
    city: string,
    country: string,
    model?: string
  ): Promise<{ id: string; [key: string]: string }[]> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) {
      throw new Error('No Gemini API keys configured. Please add one in AI Settings.');
    }

    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;

    for (const key of keys) {
      try {
        return await this.generatePlaceAiDetails(places, city, country, key, selectedModel);
      } catch (err) {
        console.warn(`Gemini call failed with key starting with "${key.substring(0, 5)}...". Error:`, err);
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
  }
}
