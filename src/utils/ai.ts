
export const DEFAULT_AI_ICONS = [
  'Sparkles', 'Sparkle', 'Wand2', 'Brain', 'Bot',
  'Calendar', 'Ticket', 'Compass', 'AlertCircle', 'HelpCircle',
  'MapPin', 'Info', 'Smile', 'Camera', 'Utensils', 'ShoppingBag',
  'Coffee', 'DollarSign', 'BookOpen', 'Clock', 'Baby',
  'Activity', 'TrendingUp', 'Flame', 'Gem', 'Sun', 'Heart',
  'Globe', 'Languages', 'Map'
];

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
    key: 'area_guide',
    label: "Area Guide & Main Streets",
    icon: 'Compass',
    instruction: "For neighborhoods, shopping districts, or large parks/trails (like Shibuya, Hongdae, Myeong-dong, or Bukchon Hanok Village): detail the best station exits, main walking streets, and key landmark/shop clusters. For smaller spots, list immediate surrounding attractions.",
    placeholder: "e.g. Arrive at Myeong-dong Station Exit 6, walk down Myeong-dong Main Street for street food, cosmetics shops, and retail..."
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

export interface MergedAiField {
  key: string;
  title: string;
  description: string;
  icon: string;
  isDefault: boolean;
  disabled: boolean;
}

export function getOrderedPlaceFields(
  customAiFields: { title: string; key: string; description: string; icon?: string; disabled?: boolean }[] = [],
  disabledPlaceFields: string[] = [],
  placeFieldsOrder: string[] = []
): MergedAiField[] {
  const defaultFields = AI_DETAIL_FIELDS.map(f => ({
    key: f.key,
    title: f.label,
    description: f.instruction,
    icon: f.icon,
    isDefault: true,
    disabled: disabledPlaceFields.includes(f.key)
  }));

  const customFields = customAiFields.map(f => ({
    key: f.key,
    title: f.title,
    description: f.description,
    icon: f.icon || 'Sparkles',
    isDefault: false,
    disabled: !!f.disabled
  }));

  const allFields = [...defaultFields, ...customFields];

  if (placeFieldsOrder && placeFieldsOrder.length > 0) {
    allFields.sort((a, b) => {
      let idxA = placeFieldsOrder.indexOf(a.key);
      let idxB = placeFieldsOrder.indexOf(b.key);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      return idxA - idxB;
    });
  }

  return allFields;
}

export type AiMode = 'none' | 'manual' | 'live';

export const AI_NOT_CONFIGURED_TITLE = 'No AI Integration';
export const AI_NOT_CONFIGURED_MESSAGE = 'AI is not configured. Open AI Settings (top-right header) to set up AI.';
// Alias kept for existing tooltip usages
export const NO_API_KEY_TOOLTIP = AI_NOT_CONFIGURED_MESSAGE;
export const AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE = 'Not available in manual AI mode — file contents require a live API Key.';

const KEYS_STORAGE_KEY = 'vacation-itineraries-gemini-api-keys';
const MODEL_STORAGE_KEY = 'vacation-itineraries-gemini-model';
const SYNC_STORAGE_KEY = 'vacation-itineraries-gemini-sync-drive';
const CONCURRENT_REQUEST_STORAGE_KEY = 'vacation-itineraries-gemini-concurrent';
const MANUAL_MODE_STORAGE_KEY = 'vacation-itineraries-gemini-manual-mode';
const AI_MODE_STORAGE_KEY = 'vacation-itineraries-gemini-ai-mode';

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

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
      // Fallback for simple newline separated strings
      return raw.split('\n').map(k => k.trim()).filter(Boolean);
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

  static getMaxConcurrentRequests(): number {
    return parseInt(localStorage.getItem(CONCURRENT_REQUEST_STORAGE_KEY) || '1', 10) || 1;
  }

  static saveMaxConcurrentRequests(n: number): void {
    localStorage.setItem(CONCURRENT_REQUEST_STORAGE_KEY, String(Math.max(1, Math.min(10, n))));
  }

  static getAiMode(): AiMode {
    const stored = localStorage.getItem(AI_MODE_STORAGE_KEY);
    if (stored === 'none' || stored === 'manual' || stored === 'live') return stored;
    // Backward compat: migrate from old separate manualMode boolean
    if (localStorage.getItem(MANUAL_MODE_STORAGE_KEY) === 'true') return 'manual';
    return this.hasApiKey() ? 'live' : 'none';
  }

  static saveAiMode(mode: AiMode): void {
    localStorage.setItem(AI_MODE_STORAGE_KEY, mode);
  }

  static isManualMode(): boolean {
    return this.getAiMode() === 'manual';
  }

  static isAiEnabled(): boolean {
    return this.getAiMode() !== 'none';
  }

  /**
   * Verifies if an API key is valid using a minor query.
   */
  static async testConnection(key: string): Promise<boolean> {
    if (!key || !key.trim()) return false;
    try {
      const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key.trim()}`, {
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

  static buildPlaceAiDetailsPrompt(
    places: { id: string; title: string; description?: string; lat?: number; lng?: number }[],
    city: string,
    country: string,
    customAiFields?: { title: string; key: string; description: string; disabled?: boolean }[],
    disabledPlaceFields?: string[],
    placeFieldsOrder?: string[]
  ): string {
    const orderedFields = getOrderedPlaceFields(customAiFields, disabledPlaceFields, placeFieldsOrder);
    const fieldsPrompt: string[] = [];
    const enabledFieldKeys: string[] = [];

    for (const field of orderedFields) {
      if (field.disabled) continue;
      enabledFieldKeys.push(field.key);
      if (field.isDefault) {
        fieldsPrompt.push(`- "${field.key}": ${field.description}`);
      } else {
        fieldsPrompt.push(`- "${field.key}": (${field.title}) ${field.description}`);
      }
    }

    const includeMarkers = !disabledPlaceFields?.includes('area_guide');
    const schemaExample = `{
  "places": [
    {
      "id": "<place id from the list above>",
      ${enabledFieldKeys.map(k => `"${k}": "<text>"`).join(',\n      ')}${includeMarkers ? ',\n      "suggestedMarkers": [{"title":"...","lat":0.0,"lng":0.0,"description":"...","type":"landmark"}]' : ''}
    }
  ]
}`;

    return `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a professional local travel planner and guide. Provide concise, high-value insights for the following places in ${city || 'unknown city'}, ${country || 'unknown country'}:
${places.map(p => `- ID: "${p.id}", Place Title: "${p.title}" (Description: "${p.description || 'N/A'}", Latitude: ${p.lat || 'N/A'}, Longitude: ${p.lng || 'N/A'})`).join('\n')}

For each place, fill in the details below.
IMPORTANT: Keep each field's description brief and highly readable (2 to 3 concise sentences or a short bulleted list of 2-3 items. Do NOT write long paragraphs or verbose essays):
${fieldsPrompt.join('\n')}

IMPORTANT DIRECTIONS REQUIREMENT:
If a place is a broad, generic area or neighborhood (such as Shinjuku, Shibuya, Myeongdong, Soho, etc.), the "directions" field MUST specify a concrete arrival point (e.g. which station, exit, or street corner to arrive at) in a single concise sentence.
${includeMarkers ? `
IMPORTANT AREA MAP MARKERS REQUIREMENT:
For neighborhoods, trails, or large areas (e.g. Shibuya, Hongdae, Myeong-dong, or Bukchon Hanok Village), you MUST generate a list of 2-5 key spots, street points, or famous landmarks in the "suggestedMarkers" array.
Ensure the coordinates (lat/lng) are highly accurate and geographically near the main place's coordinates (shown above).
Return an empty array if the place is a small, single-coordinate point of interest where sub-markers are not useful.
` : ''}
Ensure the returned JSON lists the exact "id" for each place so it can be matched.

Please respond with JSON in this exact format:
${schemaExample}`;
  }

  static parsePlaceAiDetailsResponse(text: string): { id: string; suggestedMarkers?: any[]; [key: string]: any }[] {
    const parsed = JSON.parse(text);
    if (!parsed.places || !Array.isArray(parsed.places)) {
      throw new Error('Invalid response structure: expected { "places": [...] }');
    }
    return parsed.places;
  }

  /**
   * Direct API call to Gemini for a list of places.
   */
  static async generatePlaceAiDetails(
    places: { id: string; title: string; description?: string; lat?: number; lng?: number }[],
    city: string,
    country: string,
    apiKey: string,
    model = 'gemini-2.5-flash',
    customAiFields?: { title: string; key: string; description: string; disabled?: boolean }[],
    disabledPlaceFields?: string[],
    placeFieldsOrder?: string[]
  ): Promise<{ id: string; suggestedMarkers?: any[]; [key: string]: any }[]> {
    if (places.length === 0) return [];

    const properties: any = { id: { type: 'STRING' } };
    const required = ['id'];
    const fieldsPrompt: string[] = [];

    const orderedFields = getOrderedPlaceFields(customAiFields, disabledPlaceFields, placeFieldsOrder);

    for (const field of orderedFields) {
      if (field.disabled) continue;
      properties[field.key] = { type: 'STRING' };
      required.push(field.key);
      if (field.isDefault) {
        fieldsPrompt.push(`- "${field.key}": ${field.description}`);
      } else {
        fieldsPrompt.push(`- "${field.key}": (${field.title}) ${field.description}`);
      }
    }

    // Only include suggestedMarkers when area_guide is active — skipping saves ~150 tokens per call
    const includeMarkers = !disabledPlaceFields?.includes('area_guide');
    if (includeMarkers) {
      properties['suggestedMarkers'] = {
        type: 'ARRAY',
        description: 'Suggested key spots, street segments, or landmarks inside or near this place (especially if it is an area/neighborhood/trail like Shibuya, Hongdae, Myeong-dong, or Bukchon Hanok Village). Return empty array if not applicable.',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Name of the spot/street (e.g. Hongdae Shopping Street, Hachiko Statue, Ewha Womans University Main Entrance)' },
            lat: { type: 'NUMBER', description: 'Latitude coordinate of this specific spot' },
            lng: { type: 'NUMBER', description: 'Longitude coordinate of this specific spot' },
            description: { type: 'STRING', description: 'Very short explanation of what to do here (e.g. Main street for busking, best station exit to start walking, famous flagship store)' },
            type: { type: 'STRING', description: 'One of: street, landmark, shop, station, cafe, other' }
          },
          required: ['title', 'lat', 'lng', 'description', 'type']
        }
      };
      required.push('suggestedMarkers');
    }

    const promptText = `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a professional local travel planner and guide. Provide concise, high-value insights for the following places in ${city || 'unknown city'}, ${country || 'unknown country'}:
${places.map(p => `- ID: "${p.id}", Place Title: "${p.title}" (Description: "${p.description || 'N/A'}", Latitude: ${p.lat || 'N/A'}, Longitude: ${p.lng || 'N/A'})`).join('\n')}

For each place, fill in the details below.
IMPORTANT: Keep each field's description brief and highly readable (2 to 3 concise sentences or a short bulleted list of 2-3 items. Do NOT write long paragraphs or verbose essays):
${fieldsPrompt.join('\n')}

IMPORTANT DIRECTIONS REQUIREMENT:
If a place is a broad, generic area or neighborhood (such as Shinjuku, Shibuya, Myeongdong, Soho, etc.), the "directions" field MUST specify a concrete arrival point (e.g. which station, exit, or street corner to arrive at) in a single concise sentence.
${includeMarkers ? `
IMPORTANT AREA MAP MARKERS REQUIREMENT:
For neighborhoods, trails, or large areas (e.g. Shibuya, Hongdae, Myeong-dong, or Bukchon Hanok Village), you MUST generate a list of 2-5 key spots, street points, or famous landmarks in the "suggestedMarkers" array.
For example, for "Hongdae": suggest coordinates for the main busking/shopping street, and a famous store or exit.
For Myeong-dong or Bukchon Hanok Village: suggest coordinates for the main shopping/walking street/path and key landmarks (e.g. Myeongdong Cathedral, Bukchon viewpoints).
Ensure the coordinates (lat/lng) are highly accurate and geographically near the main place's coordinates (shown above).
Return an empty array if the place is a small, single-coordinate point of interest where sub-markers are not useful.
` : ''}
Ensure the returned JSON lists the exact "id" for each place so it can be matched.`;

    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
    places: { id: string; title: string; description?: string; lat?: number; lng?: number }[],
    city: string,
    country: string,
    customAiFields?: { title: string; key: string; description: string; disabled?: boolean }[],
    model?: string,
    disabledPlaceFields?: string[],
    placeFieldsOrder?: string[]
  ): Promise<{ id: string; suggestedMarkers?: any[]; [key: string]: any }[]> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) {
      throw new Error(AI_NOT_CONFIGURED_MESSAGE);
    }

    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;

    for (const key of keys) {
      try {
        return await this.generatePlaceAiDetails(places, city, country, key, selectedModel, customAiFields, disabledPlaceFields, placeFieldsOrder);
      } catch (err) {
        console.warn(`Gemini call failed with key starting with "${key.substring(0, 5)}...". Error:`, err);
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
  }

  static buildDailyTipsPrompt(
    days: {
      dateStr: string;
      dayNumber: number;
      locationCity: string;
      locationCountry: string;
      places: { title: string; description?: string; openingHours?: string; lat?: number; lng?: number; notes?: string }[];
      hotels: string[];
      transports: string[];
    }[],
    enableBabyLogistics = false,
    disabledDayFields?: string[]
  ): string {
    const tipsDisabled = disabledDayFields?.includes('daily_tips');
    const daysPrompt = days.map(d => {
      const placesList = d.places.map(p => {
        const details: string[] = [];
        if (p.description) details.push(`description: ${p.description}`);
        if (p.openingHours) details.push(`opening hours: ${p.openingHours}`);
        if (p.notes) details.push(`notes: ${p.notes}`);
        if (p.lat !== undefined && p.lng !== undefined) details.push(`coordinates: ${p.lat}, ${p.lng}`);
        return `- ${p.title}${details.length > 0 ? ` (${details.join('; ')})` : ''}`;
      }).join('\n');
      const hotelsList = d.hotels.map(h => `- Hotel: ${h}`).join('\n');
      const transportsList = d.transports.map(t => `- Transit: ${t}`).join('\n');
      return `Day ${d.dayNumber} (${d.dateStr}) in ${d.locationCity || 'unknown city'}, ${d.locationCountry || 'unknown country'}:
Scheduled Places (in planned sequence order):
${placesList || 'None'}
Hotels:
${hotelsList || 'None'}
Transports:
${transportsList || 'None'}`;
    }).join('\n\n');

    const schemaFields = [];
    if (!tipsDisabled) schemaFields.push('"daily_tips": "<markdown tips>"');
    if (enableBabyLogistics) schemaFields.push('"baby_logistics": "<markdown baby tips>"');

    return `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a professional local travel planner and guide. Provide daily itinerary summaries and practical daily travel tips for the following days:

${daysPrompt}

For each day, write daily tips (in Markdown format). Keep the response structured, clear, and relatively brief (under 8-10 sentences total or a clean, bulleted checklist/list of tips, avoiding long essays).
Specifically, cover the following in the daily_tips field under the aiDetails object:

1. **Daily Route Sequence & Summary**: Provide a short, station-to-station or road-by-road route summary based on the planned sequence of places and coordinates.
2. **Timing & Optimization Suggestions**: Give suggestions if any place takes a long time, sequence/route suggestions based on opening hours, and warn if a place is likely closed on this specific day.
3. **Logistics & Alerts**: Recommended departure time, transit lines to use, weather check reminders, essential safety warnings.

${enableBabyLogistics ? `IMPORTANT BABY LOGISTICS REQUIREMENT:
Since the user is traveling with a baby, generate a specific "baby_logistics" text (in Markdown format) under the "baby_logistics" key of the aiDetails object for each day. Keep it brief, 2-3 sentences or bullet points.` : ''}

Ensure the returned JSON lists the exact "dateStr" for each day so it can be matched.

Please respond with JSON in this exact format:
{
  "days": [
    {
      "dateStr": "<YYYY-MM-DD>",
      "aiDetails": { ${schemaFields.join(', ')} }
    }
  ]
}`;
  }

  static parseDailyTipsResponse(text: string): { dateStr: string; aiDetails?: { [key: string]: string } }[] {
    const parsed = JSON.parse(text);
    if (!parsed.days || !Array.isArray(parsed.days)) {
      throw new Error('Invalid response structure: expected { "days": [...] }');
    }
    return parsed.days;
  }

  /**
   * Generates Daily Tips for plan days.
   */
  static async generateDailyTips(
    days: {
      dateStr: string;
      dayNumber: number;
      locationCity: string;
      locationCountry: string;
      places: {
        title: string;
        description?: string;
        openingHours?: string;
        lat?: number;
        lng?: number;
        notes?: string;
      }[];
      hotels: string[];
      transports: string[];
    }[],
    apiKey: string,
    model = 'gemini-2.5-flash',
    enableBabyLogistics = false,
    disabledDayFields?: string[]
  ): Promise<{
    dateStr: string;
    aiDetails?: {
      [key: string]: string;
    };
  }[]> {
    if (days.length === 0) return [];

    const aiDetailsProps: any = {};
    const aiDetailsRequired: string[] = [];

    const tipsDisabled = disabledDayFields?.includes('daily_tips');
    if (!tipsDisabled) {
      aiDetailsProps['daily_tips'] = { type: 'STRING' };
      aiDetailsRequired.push('daily_tips');
    }

    if (enableBabyLogistics) {
      aiDetailsProps['baby_logistics'] = { type: 'STRING' };
      aiDetailsRequired.push('baby_logistics');
    }

    const properties: any = {
      dateStr: { type: 'STRING' }
    };
    const required = ['dateStr'];

    if (Object.keys(aiDetailsProps).length > 0) {
      properties['aiDetails'] = {
        type: 'OBJECT',
        properties: aiDetailsProps,
        required: aiDetailsRequired
      };
      required.push('aiDetails');
    }

    const daysPrompt = days.map(d => {
      const placesList = d.places.map(p => {
        const details = [];
        if (p.description) details.push(`description: ${p.description}`);
        if (p.openingHours) details.push(`opening hours: ${p.openingHours}`);
        if (p.notes) details.push(`notes: ${p.notes}`);
        if (p.lat !== undefined && p.lng !== undefined) details.push(`coordinates: ${p.lat}, ${p.lng}`);
        return `- ${p.title}${details.length > 0 ? ` (${details.join('; ')})` : ''}`;
      }).join('\n');
      const hotelsList = d.hotels.map(h => `- Hotel: ${h}`).join('\n');
      const transportsList = d.transports.map(t => `- Transit: ${t}`).join('\n');
      return `Day ${d.dayNumber} (${d.dateStr}) in ${d.locationCity || 'unknown city'}, ${d.locationCountry || 'unknown country'}:
Scheduled Places (in planned sequence order):
${placesList || 'None'}
Hotels:
${hotelsList || 'None'}
Transports:
${transportsList || 'None'}`;
    }).join('\n\n');

    const promptText = `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a professional local travel planner and guide. Provide daily itinerary summaries and practical daily travel tips for the following days:

${daysPrompt}

For each day, write daily tips (in Markdown format). Keep the response structured, clear, and relatively brief (under 8-10 sentences total or a clean, bulleted checklist/list of tips, avoiding long essays).
Specifically, cover the following in the daily_tips field under the aiDetails object:

1. **Daily Route Sequence & Summary**: Provide a short, station-to-station or road-by-road route summary based on the planned sequence of places and coordinates. For example: "Start at [Hotel], take [transit] to [station X] for [Place 1], then walk along [street/path Y] to get to [Place 2], then take [transit] to [station Z]...".
2. **Timing & Optimization Suggestions**:
   - Give suggestions if any place takes a long time (e.g., "This place will take a long time to explore, so plan carefully").
   - Give sequence/route suggestions based on opening hours or spatial layout (e.g., "It is recommended to visit X before Y because Y closes earlier/at [time]" or "Visiting X before Y offers a more optimal routing path").
   - Warn the user if a place is likely closed on this specific day of the week or date.
3. **Logistics & Alerts**:
   - Recommended departure time from the hotel/starting point.
   - Which local transit lines to use.
   - Weather check reminders.
   - Essential safety warnings (pickpocket warnings, local scams, walking terrain/comfort).

${enableBabyLogistics ? `IMPORTANT BABY LOGISTICS REQUIREMENT:
Since the user is traveling with a baby, generate a specific "baby_logistics" text (in Markdown format) under the "baby_logistics" key of the aiDetails object for each day, describing what to be aware of regarding having a baby (e.g. stroller friendliness, diaper changing spots, safety, nursing facilities, nap planning). Keep it brief, 2-3 sentences or bullet points.` : ''}

Ensure the returned JSON lists the exact "dateStr" for each day so it can be matched.`;

    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              days: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties,
                  required
                }
              }
            },
            required: ['days']
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
    if (!parsed.days || !Array.isArray(parsed.days)) {
      throw new Error('Invalid response structure from Gemini API.');
    }

    return parsed.days;
  }

  /**
   * Generates Daily Tips rotating through API keys.
   */
  static async generateDailyTipsWithRotation(
    days: {
      dateStr: string;
      dayNumber: number;
      locationCity: string;
      locationCountry: string;
      places: {
        title: string;
        description?: string;
        openingHours?: string;
        lat?: number;
        lng?: number;
        notes?: string;
      }[];
      hotels: string[];
      transports: string[];
    }[],
    enableBabyLogistics = false,
    model?: string,
    disabledDayFields?: string[]
  ): Promise<{
    dateStr: string;
    aiDetails?: {
      [key: string]: string;
    };
  }[]> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) {
      throw new Error(AI_NOT_CONFIGURED_MESSAGE);
    }

    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;

    for (const key of keys) {
      try {
        return await this.generateDailyTips(days, key, selectedModel, enableBabyLogistics, disabledDayFields);
      } catch (err) {
        console.warn(`Gemini daily tips call failed with key starting with "${key.substring(0, 5)}...". Error:`, err);
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
  }

  static buildTripChecklistPrompt(
    tripInfo: {
      name: string;
      startDate: string;
      endDate: string;
      locations: { city: string; country: string }[];
      hotels: { name: string; checkInDate: string; checkOutDate: string }[];
      transports: { type: string; departureLocationName: string; arrivalLocationName: string; departureDate: string }[];
      places: { title: string; reservationDetails?: string }[];
    },
    enableBabyLogistics = false
  ): string {
    const locationsList = tripInfo.locations.map(l => `- ${l.city}, ${l.country}`).join('\n');
    const hotelsList = tripInfo.hotels.map(h => `- ${h.name} (${h.checkInDate} to ${h.checkOutDate})`).join('\n');
    const transportsList = tripInfo.transports.map(t => `- ${t.type.toUpperCase()}: ${t.departureLocationName} -> ${t.arrivalLocationName} on ${t.departureDate}`).join('\n');
    const placesList = tripInfo.places.map(p => `- ${p.title} (Reservation info: ${p.reservationDetails || 'None'})`).join('\n');

    return `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a professional travel checklist planner. Generate a concise, high-priority preparation checklist (in Markdown format) for a trip named "${tripInfo.name}" starting on ${tripInfo.startDate} and ending on ${tripInfo.endDate}.

Locations to visit:
${locationsList || 'None'}

Accommodations booked:
${hotelsList || 'None'}

Transportation scheduled:
${transportsList || 'None'}

Scheduled places of interest:
${placesList || 'None'}

Please pay attention to essential details to make the trip complete. Keep the response concise, punchy, and avoid long-winded paragraphs. Limit the output to maximum 3-4 core categories:
1. Booking Gaps & Ticketing: Identify missing accommodations, missing transit, or places requiring early reservations/tickets.
2. Entry & Visa Requirements: Note if visa/immigration documents are needed.
3. Essential Prep & Gear: 3-5 high-priority packing or preparation tasks specific to these destinations.
${enableBabyLogistics ? '4. Baby Logistics: 4-6 essential baby travel prep/packing items (stroller check-in, baby documents, food, etc.).' : ''}

Keep each bullet point short (1-2 sentences max). Do NOT write introductory or concluding remarks. Output ONLY raw Markdown.`;
  }

  /**
   * Generates checklist for the trip.
   */
  static async generateTripChecklist(
    tripInfo: {
      name: string;
      startDate: string;
      endDate: string;
      locations: { city: string; country: string }[];
      hotels: { name: string; checkInDate: string; checkOutDate: string }[];
      transports: { type: string; departureLocationName: string; arrivalLocationName: string; departureDate: string }[];
      places: { title: string; reservationDetails?: string }[];
    },
    apiKey: string,
    model = 'gemini-2.5-flash',
    enableBabyLogistics = false
  ): Promise<string> {
    const locationsList = tripInfo.locations.map(l => `- ${l.city}, ${l.country}`).join('\n');
    const hotelsList = tripInfo.hotels.map(h => `- ${h.name} (${h.checkInDate} to ${h.checkOutDate})`).join('\n');
    const transportsList = tripInfo.transports.map(t => `- ${t.type.toUpperCase()}: ${t.departureLocationName} -> ${t.arrivalLocationName} on ${t.departureDate}`).join('\n');
    const placesList = tripInfo.places.map(p => `- ${p.title} (Reservation info: ${p.reservationDetails || 'None'})`).join('\n');

    const promptText = `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a professional travel checklist planner. Generate a concise, high-priority preparation checklist (in Markdown format) for a trip named "${tripInfo.name}" starting on ${tripInfo.startDate} and ending on ${tripInfo.endDate}.

Locations to visit:
${locationsList || 'None'}

Accommodations booked:
${hotelsList || 'None'}

Transportation scheduled:
${transportsList || 'None'}

Scheduled places of interest:
${placesList || 'None'}

Please pay attention to essential details to make the trip complete. Keep the response concise, punchy, and avoid long-winded paragraphs. Limit the output to maximum 3-4 core categories:
1. Booking Gaps & Ticketing: Identify missing accommodations (if there are gaps between ${tripInfo.startDate} and ${tripInfo.endDate} with no hotel booked), missing transit, or places requiring early reservations/tickets.
2. Entry & Visa Requirements: Note if visa/immigration documents are needed.
3. Essential Prep & Gear: 3-5 high-priority packing or preparation tasks specific to these destinations.
4. ${enableBabyLogistics ? 'Baby Logistics: 4-6 essential baby travel prep/packing items (stroller check-in, baby documents, food, etc.).' : ''}

Keep each bullet point short (1-2 sentences max). Do NOT write introductory or concluding remarks. Output ONLY raw Markdown.`;

    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        tools: [{ google_search: {} }]
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

    return resultText;
  }

  /**
   * Generates checklist rotating through API keys.
   */
  static async generateTripChecklistWithRotation(
    tripInfo: {
      name: string;
      startDate: string;
      endDate: string;
      locations: { city: string; country: string }[];
      hotels: { name: string; checkInDate: string; checkOutDate: string }[];
      transports: { type: string; departureLocationName: string; arrivalLocationName: string; departureDate: string }[];
      places: { title: string; reservationDetails?: string }[];
    },
    enableBabyLogistics = false,
    model?: string
  ): Promise<string> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) {
      throw new Error(AI_NOT_CONFIGURED_MESSAGE);
    }

    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;

    for (const key of keys) {
      try {
        return await this.generateTripChecklist(tripInfo, key, selectedModel, enableBabyLogistics);
      } catch (err) {
        console.warn(`Gemini checklist call failed with key starting with "${key.substring(0, 5)}...". Error:`, err);
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
  }

  /**
   * Generates basic place info (title, description, hours, notes, coordinates) from a name query.
   */
  static buildPlaceBasicInfoPrompt(query: string, city: string, country: string): string {
    const locationContext = [city, country].filter(Boolean).join(', ') || 'unknown location';
    return `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a knowledgeable travel information assistant. For the following place in ${locationContext}, provide accurate basic information.

Place name: "${query}"

Fill in:
- title: The official or most commonly used name of this specific place
- description: A factual 2-sentence description of what this place is and why it is notable
- openingHours: Typical visiting/opening hours (e.g. "09:00 - 18:00", "24/7", "Mon-Sat 10:00-20:00"). Use empty string if truly unknown.
- notes: The single most useful practical tip for a first-time visitor (1-2 sentences)
- lat: Precise decimal latitude coordinate
- lng: Precise decimal longitude coordinate
- photoUrl: A real, publicly accessible image URL from Wikimedia Commons (e.g. https://upload.wikimedia.org/wikipedia/commons/...) for this place. Use empty string if you are not certain the URL exists.

Use the location context to resolve ambiguous names. Ensure coordinates are accurate.

Please respond with JSON in this exact format:
{ "title": "...", "description": "...", "openingHours": "...", "notes": "...", "lat": 0.0, "lng": 0.0, "photoUrl": "..." }`;
  }

  static parsePlaceBasicInfoResponse(text: string): { title: string; description: string; openingHours: string; notes: string; lat: number; lng: number; photoUrl: string } {
    const parsed = JSON.parse(text);
    if (!parsed.title || typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') {
      throw new Error('Invalid response structure: expected title, lat, lng fields.');
    }
    return parsed;
  }

  static async generatePlaceBasicInfo(
    query: string,
    city: string,
    country: string,
    apiKey: string,
    model = 'gemini-2.5-flash'
  ): Promise<{
    title: string;
    description: string;
    openingHours: string;
    notes: string;
    lat: number;
    lng: number;
    photoUrl: string;
  }> {
    const promptText = GeminiService.buildPlaceBasicInfoPrompt(query, city, country);

    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              description: { type: 'STRING' },
              openingHours: { type: 'STRING' },
              notes: { type: 'STRING' },
              lat: { type: 'NUMBER' },
              lng: { type: 'NUMBER' },
              photoUrl: { type: 'STRING' }
            },
            required: ['title', 'description', 'openingHours', 'notes', 'lat', 'lng', 'photoUrl']
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
    if (!parsed.title || typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') {
      throw new Error('Invalid response structure from Gemini API.');
    }

    return parsed;
  }

  /**
   * Generates basic place info rotating through configured API keys.
   */
  static async generatePlaceBasicInfoWithRotation(
    query: string,
    city: string,
    country: string,
    model?: string
  ): Promise<{
    title: string;
    description: string;
    openingHours: string;
    notes: string;
    lat: number;
    lng: number;
    photoUrl: string;
  }> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) {
      throw new Error(AI_NOT_CONFIGURED_MESSAGE);
    }

    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;

    for (const key of keys) {
      try {
        return await this.generatePlaceBasicInfo(query, city, country, key, selectedModel);
      } catch (err) {
        console.warn(`Gemini basic info call failed with key starting with "${key.substring(0, 5)}...". Error:`, err);
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
  }

  static buildLocalEssentialsPrompt(location: { city: string; country: string }): string {
    return `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a local travel guide expert. Provide a very concise Local Essentials Reference (in Markdown format) for ${location.city}, ${location.country}.

Please organize the guide with clean subheadings, keeping each section extremely brief (max 2-3 concise bullet points or 1-2 short sentences per section, avoiding any wordiness):
1. **Convenience Stores & Essentials**: Best popular chains, what you can find there, and payment options.
2. **Currency & Payments**: Local currency, acceptance of credit cards vs cash, and tipping culture.
3. **Transportation & Cards**: Primary means of transportation, what transit card/payment to use, and how to pay.
4. **Local Apps**: Must-have transit/mapping, ride-sharing, and translation apps.
5. **Dress Code & Etiquette**: Cultural norms and seasonal packing/clothing tips.
6. **Other Utilities**: Power plugs & voltage, tap water safety, and emergency phone numbers.

Output ONLY raw Markdown. Do not include any greeting or conversational filler.`;
  }

  /**
   * Generates local essentials.
   */
  static async generateLocalEssentials(
    location: { city: string; country: string },
    apiKey: string,
    model = 'gemini-2.5-flash'
  ): Promise<string> {
    const promptText = `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a local travel guide expert. Provide a very concise Local Essentials Reference (in Markdown format) for ${location.city}, ${location.country}.

Please organize the guide with clean subheadings, keeping each section extremely brief (max 2-3 concise bullet points or 1-2 short sentences per section, avoiding any wordiness):
1. **Convenience Stores & Essentials**: Best popular chains (e.g. 7-Eleven, Lawson, etc.), what you can find there, and payment options.
2. **Currency & Payments**: Local currency, acceptance of credit cards vs cash, and tipping culture.
3. **Transportation & Cards**: Primary means of transportation (e.g. subway, train, bus), what transit card/payment to use (e.g. Suica, Oyster), and how to pay.
4. **Local Apps**: Must-have transit/mapping, ride-sharing, and translation apps.
5. **Dress Code & Etiquette**: Cultural norms and seasonal packing/clothing tips.
6. **Other Utilities**: Power plugs & voltage, tap water safety, and emergency phone numbers.

Output ONLY raw Markdown. Do not include any greeting or conversational filler.`;

    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        tools: [{ google_search: {} }]
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

    return resultText;
  }

  static buildSuggestedPlacesPrompt(city: string, country: string, existingPlaceTitles: string[]): string {
    const locationContext = [city, country].filter(Boolean).join(', ') || 'unknown location';
    const excludeList = existingPlaceTitles.length > 0
      ? `\nExclude these places (already in the user's list): ${existingPlaceTitles.join(', ')}.`
      : '';
    return `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a travel expert. Suggest 10 diverse, must-visit places in ${locationContext} for tourists.${excludeList}

Include a mix of categories: iconic attractions, hidden gems, popular restaurants/food spots, shopping areas, and unique local experiences.

For each place provide:
- title: Official or most commonly used name
- description: 2-sentence factual description of what it is and why it is notable
- openingHours: Typical hours (e.g. "09:00-18:00", "24/7"). Use empty string if unknown.
- notes: The single most useful tip for a first-time visitor (1-2 sentences)
- lat: Precise decimal latitude coordinate
- lng: Precise decimal longitude coordinate
- photoUrl: Use empty string (you cannot provide reliable URLs in a manual context)
- category: Exactly one of "attractions", "restaurants", "shopping", "other"

Please respond with JSON in this exact format:
{
  "places": [
    {
      "title": "...", "description": "...", "openingHours": "...", "notes": "...",
      "lat": 0.0, "lng": 0.0, "photoUrl": "", "category": "attractions"
    }
  ]
}`;
  }

  static parseSuggestedPlacesResponse(text: string): Array<{
    title: string; description: string; openingHours: string; notes: string;
    lat: number; lng: number; photoUrl: string; category: string;
  }> {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.places)) {
      throw new Error('Invalid response structure: expected { "places": [...] }');
    }
    return parsed.places;
  }

  /**
   * Suggests must-visit places for a given city.
   */
  static async generateSuggestedPlaces(
    city: string,
    country: string,
    existingPlaceTitles: string[],
    apiKey: string,
    model = 'gemini-2.5-flash'
  ): Promise<Array<{
    title: string;
    description: string;
    openingHours: string;
    notes: string;
    lat: number;
    lng: number;
    photoUrl: string;
    category: string;
  }>> {
    const locationContext = [city, country].filter(Boolean).join(', ') || 'unknown location';
    const excludeList = existingPlaceTitles.length > 0
      ? `\nExclude these places (already in the user's list): ${existingPlaceTitles.join(', ')}.`
      : '';
    const promptText = `Today's date is ${new Date().toISOString().split('T')[0]}. Use your most up-to-date knowledge as of this date.
You are a travel expert. Suggest 10 diverse, must-visit places in ${locationContext} for tourists.${excludeList}

Include a mix of categories: iconic attractions, hidden gems, popular restaurants/food spots, shopping areas, and unique local experiences.

For each place provide:
- title: Official or most commonly used name
- description: 2-sentence factual description of what it is and why it is notable
- openingHours: Typical hours (e.g. "09:00-18:00", "24/7", "Mon-Sun 10:00-22:00"). Use empty string if unknown.
- notes: The single most useful tip for a first-time visitor (1-2 sentences)
- lat: Precise decimal latitude coordinate
- lng: Precise decimal longitude coordinate
- photoUrl: A real, publicly accessible image URL for this place. Wikipedia or other well-known sources are good options. Only provide a URL you are highly confident is correct and resolves to an actual image file. Use empty string if you are not certain.
- category: Exactly one of "attractions", "restaurants", "shopping", "other"

Ensure coordinates are accurate and the places span a variety of types.`;

    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
                  properties: {
                    title: { type: 'STRING' },
                    description: { type: 'STRING' },
                    openingHours: { type: 'STRING' },
                    notes: { type: 'STRING' },
                    lat: { type: 'NUMBER' },
                    lng: { type: 'NUMBER' },
                    photoUrl: { type: 'STRING' },
                    category: { type: 'STRING', enum: ['attractions', 'restaurants', 'shopping', 'other'] }
                  },
                  required: ['title', 'description', 'openingHours', 'notes', 'lat', 'lng', 'photoUrl', 'category']
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
    if (!resultText) throw new Error('Gemini API returned an empty response.');

    const parsed = JSON.parse(resultText);
    if (!Array.isArray(parsed.places)) throw new Error('Invalid response structure from Gemini API.');

    // Validate photo URLs in parallel — clear any that don't resolve to a real image
    const validated = await Promise.all(
      parsed.places.map(async (place: any) => {
        if (!place.photoUrl) return place;
        try {
          const res = await fetch(place.photoUrl, { method: 'HEAD' });
          return { ...place, photoUrl: res.ok ? place.photoUrl : '' };
        } catch {
          return { ...place, photoUrl: '' };
        }
      })
    );

    return validated;
  }

  /**
   * Generates suggested places rotating through API keys.
   */
  static async generateSuggestedPlacesWithRotation(
    city: string,
    country: string,
    existingPlaceTitles: string[],
    model?: string
  ): Promise<Array<{
    title: string;
    description: string;
    openingHours: string;
    notes: string;
    lat: number;
    lng: number;
    photoUrl: string;
    category: string;
  }>> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) {
      throw new Error(AI_NOT_CONFIGURED_MESSAGE);
    }

    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;

    for (const key of keys) {
      try {
        return await this.generateSuggestedPlaces(city, country, existingPlaceTitles, key, selectedModel);
      } catch (err) {
        console.warn(`Gemini suggested places call failed with key starting with "${key.substring(0, 5)}...". Error:`, err);
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
  }

  /**
   * Generates local essentials rotating through API keys.
   */
  static async generateLocalEssentialsWithRotation(
    location: { city: string; country: string },
    model?: string
  ): Promise<string> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) {
      throw new Error(AI_NOT_CONFIGURED_MESSAGE);
    }

    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;

    for (const key of keys) {
      try {
        return await this.generateLocalEssentials(location, key, selectedModel);
      } catch (err) {
        console.warn(`Gemini local essentials call failed with key starting with "${key.substring(0, 5)}...". Error:`, err);
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
  }

  // ── File-based reservation auto-fill ─────────────────────────────────────

  static buildHotelDetailsFromFilesPrompt(): string {
    return `You are a travel assistant. The user has uploaded one or more files (photos, PDFs, or email screenshots) of a hotel reservation or booking confirmation. Extract the hotel details from these files and return them as JSON. For fields other than address, lat, and lng, return only the fields you can confidently identify from the files (leave uncertain fields as empty strings; do not guess or invent information not clearly visible). For address, lat, and lng: if they are not explicitly mentioned or clear in the files, you must search your knowledge base or infer the hotel's correct street address, latitude, and longitude based on the hotel name and city/region, and fill them in.`;
  }

  static buildTransitDetailsFromFilesPrompt(): string {
    return `You are a travel assistant. The user has uploaded one or more files (photos, PDFs, or email screenshots) of a flight ticket, train booking, or other transit reservation. Extract the transit details from these files and return them as JSON matching the schema.

IMPORTANT INSTRUCTIONS:
1. MULTIPLE SEGMENTS: If the reservation contains multiple segments/legs (e.g. connecting flights, multi-stop train journeys, or round trips), extract ALL segments and list them in order under the "segments" array. If there is only one segment, place it in the "segments" array as a single element. Also fill in the top-level departure/arrival fields using the details of the first segment (or overall summary) for compatibility.
2. MISSING DETAILS & HUB LOOKUP: For details like departure/arrival location names, addresses, coordinates (latitude/longitude), and timezones, if they are not explicitly present in the files, you MUST search your knowledge base or infer them:
   - For airports (e.g., "SFO", "JFK", "HND") or major train stations, lookup and fill in the official location name, standard street address/location, precise latitude and longitude, and the correct local IANA timezone name (e.g., "America/New_York", "Asia/Tokyo") or offset (e.g., "UTC+9").
   - Do not leave address, coordinates, or timezones empty if they can be determined/inferred from the airport codes, station names, or cities.
3. FORMATS:
   - Departure and arrival times must use HH:MM (24-hour) format.
   - Dates must use YYYY-MM-DD format.
4. NAME FIELD: For the "name" field at the top-level, use a route-based description derived from the departure and arrival locations of the trip (e.g. "Flight to Tokyo", "SFO → CDG", "Train to Paris") — do NOT use the passenger name printed on the ticket.`;
  }

  static async generateHotelDetailsFromFiles(
    fileContents: { base64: string; mimeType: string }[],
    apiKey: string,
    model = 'gemini-2.5-flash'
  ): Promise<{
    name?: string; address?: string; checkInDate?: string; checkInTime?: string;
    checkOutDate?: string; checkOutTime?: string; confirmationNo?: string; notes?: string;
    bookedThrough?: string; price?: number; currency?: string; lat?: number; lng?: number;
  }> {
    const totalBase64Size = fileContents.reduce((sum, f) => sum + f.base64.length, 0);
    if (totalBase64Size > 10 * 1024 * 1024) {
      throw new Error('Total file size exceeds 10MB. Please reduce file size before using AI fill.');
    }

    const parts: any[] = [{ text: GeminiService.buildHotelDetailsFromFilesPrompt() }];
    for (const f of fileContents) {
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } });
    }

    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                address: { type: 'STRING' },
                checkInDate: { type: 'STRING' },
                checkInTime: { type: 'STRING' },
                checkOutDate: { type: 'STRING' },
                checkOutTime: { type: 'STRING' },
                confirmationNo: { type: 'STRING' },
                notes: { type: 'STRING' },
                bookedThrough: { type: 'STRING' },
                price: { type: 'NUMBER' },
                currency: { type: 'STRING' },
                lat: { type: 'NUMBER' },
                lng: { type: 'NUMBER' },
              },
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (Status ${response.status}): ${errText}`);
    }
    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error('Gemini API returned an empty response.');
    return JSON.parse(resultText);
  }

  static async generateHotelDetailsFromFilesWithRotation(
    fileContents: { base64: string; mimeType: string }[],
    model?: string
  ): Promise<{
    name?: string; address?: string; checkInDate?: string; checkInTime?: string;
    checkOutDate?: string; checkOutTime?: string; confirmationNo?: string; notes?: string;
    bookedThrough?: string; price?: number; currency?: string; lat?: number; lng?: number;
  }> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) throw new Error(AI_NOT_CONFIGURED_MESSAGE);
    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;
    for (const key of keys) {
      try {
        return await this.generateHotelDetailsFromFiles(fileContents, key, selectedModel);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
  }

  static async generateTransitDetailsFromFiles(
    fileContents: { base64: string; mimeType: string }[],
    apiKey: string,
    model = 'gemini-2.5-flash'
  ): Promise<{
    type?: string; departureLocationName?: string; arrivalLocationName?: string;
    departureDate?: string; departureTime?: string; departureTimezone?: string;
    arrivalDate?: string; arrivalTime?: string; arrivalTimezone?: string;
    carrier?: string; transitCode?: string; confirmationNo?: string; notes?: string;
    name?: string; bookedThrough?: string; price?: number; currency?: string;
    departureAddress?: string; departureLat?: number; departureLng?: number;
    arrivalAddress?: string; arrivalLat?: number; arrivalLng?: number;
    segments?: {
      carrier?: string;
      transitCode?: string;
      departureLocationName?: string;
      departureAddress?: string;
      departureDate?: string;
      departureTime?: string;
      departureTimezone?: string;
      departureLat?: number;
      departureLng?: number;
      arrivalLocationName?: string;
      arrivalAddress?: string;
      arrivalDate?: string;
      arrivalTime?: string;
      arrivalTimezone?: string;
      arrivalLat?: number;
      arrivalLng?: number;
    }[];
  }> {
    const totalBase64Size = fileContents.reduce((sum, f) => sum + f.base64.length, 0);
    if (totalBase64Size > 10 * 1024 * 1024) {
      throw new Error('Total file size exceeds 10MB. Please reduce file size before using AI fill.');
    }

    const parts: any[] = [{ text: GeminiService.buildTransitDetailsFromFilesPrompt() }];
    for (const f of fileContents) {
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } });
    }

    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                type: { type: 'STRING' },
                name: { type: 'STRING' },
                confirmationNo: { type: 'STRING' },
                bookedThrough: { type: 'STRING' },
                price: { type: 'NUMBER' },
                currency: { type: 'STRING' },
                notes: { type: 'STRING' },
                departureLocationName: { type: 'STRING' },
                arrivalLocationName: { type: 'STRING' },
                departureDate: { type: 'STRING' },
                departureTime: { type: 'STRING' },
                departureTimezone: { type: 'STRING' },
                arrivalDate: { type: 'STRING' },
                arrivalTime: { type: 'STRING' },
                arrivalTimezone: { type: 'STRING' },
                carrier: { type: 'STRING' },
                transitCode: { type: 'STRING' },
                departureAddress: { type: 'STRING' },
                departureLat: { type: 'NUMBER' },
                departureLng: { type: 'NUMBER' },
                arrivalAddress: { type: 'STRING' },
                arrivalLat: { type: 'NUMBER' },
                arrivalLng: { type: 'NUMBER' },
                segments: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      carrier: { type: 'STRING' },
                      transitCode: { type: 'STRING' },
                      departureLocationName: { type: 'STRING' },
                      departureAddress: { type: 'STRING' },
                      departureDate: { type: 'STRING' },
                      departureTime: { type: 'STRING' },
                      departureTimezone: { type: 'STRING' },
                      departureLat: { type: 'NUMBER' },
                      departureLng: { type: 'NUMBER' },
                      arrivalLocationName: { type: 'STRING' },
                      arrivalAddress: { type: 'STRING' },
                      arrivalDate: { type: 'STRING' },
                      arrivalTime: { type: 'STRING' },
                      arrivalTimezone: { type: 'STRING' },
                      arrivalLat: { type: 'NUMBER' },
                      arrivalLng: { type: 'NUMBER' },
                    }
                  }
                }
              },
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (Status ${response.status}): ${errText}`);
    }
    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error('Gemini API returned an empty response.');
    return JSON.parse(resultText);
  }

  static async generateTransitDetailsFromFilesWithRotation(
    fileContents: { base64: string; mimeType: string }[],
    model?: string
  ): Promise<{
    type?: string; departureLocationName?: string; arrivalLocationName?: string;
    departureDate?: string; departureTime?: string; departureTimezone?: string;
    arrivalDate?: string; arrivalTime?: string; arrivalTimezone?: string;
    carrier?: string; transitCode?: string; confirmationNo?: string; notes?: string;
    name?: string; bookedThrough?: string; price?: number; currency?: string;
    departureAddress?: string; departureLat?: number; departureLng?: number;
    arrivalAddress?: string; arrivalLat?: number; arrivalLng?: number;
    segments?: {
      carrier?: string;
      transitCode?: string;
      departureLocationName?: string;
      departureAddress?: string;
      departureDate?: string;
      departureTime?: string;
      departureTimezone?: string;
      departureLat?: number;
      departureLng?: number;
      arrivalLocationName?: string;
      arrivalAddress?: string;
      arrivalDate?: string;
      arrivalTime?: string;
      arrivalTimezone?: string;
      arrivalLat?: number;
      arrivalLng?: number;
    }[];
  }> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) throw new Error(AI_NOT_CONFIGURED_MESSAGE);
    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;
    for (const key of keys) {
      try {
        return await this.generateTransitDetailsFromFiles(fileContents, key, selectedModel);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
  }
}
