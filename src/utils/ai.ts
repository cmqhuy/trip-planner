
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
    places: { id: string; title: string; description?: string; lat?: number; lng?: number }[],
    city: string,
    country: string,
    apiKey: string,
    model = 'gemini-2.5-flash',
    customAiFields?: { title: string; key: string; description: string }[]
  ): Promise<{ id: string; suggestedMarkers?: any[]; [key: string]: any }[]> {
    if (places.length === 0) return [];

    const properties: any = { id: { type: 'STRING' } };
    const required = ['id'];
    const fieldsPrompt: string[] = [];

    for (const field of AI_DETAIL_FIELDS) {
      properties[field.key] = { type: 'STRING' };
      required.push(field.key);
      fieldsPrompt.push(`- "${field.key}": ${field.instruction}`);
    }

    if (customAiFields && customAiFields.length > 0) {
      for (const field of customAiFields) {
        if (field.key && field.title) {
          properties[field.key] = { type: 'STRING' };
          required.push(field.key);
          fieldsPrompt.push(`- "${field.key}": (${field.title}) ${field.description}`);
        }
      }
    }

    // Add suggested coordinates list
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

    const promptText = `You are a professional local travel planner and guide. Provide concise, high-value insights for the following places in ${city || 'unknown city'}, ${country || 'unknown country'}:
${places.map(p => `- ID: "${p.id}", Place Title: "${p.title}" (Description: "${p.description || 'N/A'}", Latitude: ${p.lat || 'N/A'}, Longitude: ${p.lng || 'N/A'})`).join('\n')}

For each place, fill in the details below.
IMPORTANT: Keep each field's description brief and highly readable (2 to 3 concise sentences or a short bulleted list of 2-3 items. Do NOT write long paragraphs or verbose essays):
${fieldsPrompt.join('\n')}

IMPORTANT DIRECTIONS REQUIREMENT:
If a place is a broad, generic area or neighborhood (such as Shinjuku, Shibuya, Myeongdong, Soho, etc.), the "directions" field MUST specify a concrete arrival point (e.g. which station, exit, or street corner to arrive at) in a single concise sentence.

IMPORTANT AREA MAP MARKERS REQUIREMENT:
For neighborhoods, trails, or large areas (e.g. Shibuya, Hongdae, Myeong-dong, or Bukchon Hanok Village), you MUST generate a list of 2-5 key spots, street points, or famous landmarks in the "suggestedMarkers" array.
For example, for "Hongdae": suggest coordinates for the main busking/shopping street, and a famous store or exit.
For Myeong-dong or Bukchon Hanok Village: suggest coordinates for the main shopping/walking street/path and key landmarks (e.g. Myeongdong Cathedral, Bukchon viewpoints).
Ensure the coordinates (lat/lng) are highly accurate and geographically near the main place's coordinates (shown above).
Return an empty array if the place is a small, single-coordinate point of interest where sub-markers are not useful.

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
    places: { id: string; title: string; description?: string; lat?: number; lng?: number }[],
    city: string,
    country: string,
    customAiFields?: { title: string; key: string; description: string }[],
    model?: string
  ): Promise<{ id: string; suggestedMarkers?: any[]; [key: string]: any }[]> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) {
      throw new Error('No Gemini API keys configured. Please add one in AI Settings.');
    }

    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;

    for (const key of keys) {
      try {
        return await this.generatePlaceAiDetails(places, city, country, key, selectedModel, customAiFields);
      } catch (err) {
        console.warn(`Gemini call failed with key starting with "${key.substring(0, 5)}...". Error:`, err);
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
  }

  /**
   * Generates Daily Tips for plan days.
   */
  static async generateDailyTips(
    days: {
      dateStr: string;
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
    enableBabyLogistics = false
  ): Promise<{
    dateStr: string;
    tips: string;
    babyLogistics?: string;
  }[]> {
    if (days.length === 0) return [];

    const properties: any = {
      dateStr: { type: 'STRING' },
      tips: { type: 'STRING' }
    };
    const required = ['dateStr', 'tips'];

    if (enableBabyLogistics) {
      properties['babyLogistics'] = { type: 'STRING' };
      required.push('babyLogistics');
    }

    const daysPrompt = days.map((d, i) => {
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
      return `Day ${i + 1} (${d.dateStr}) in ${d.locationCity || 'unknown city'}, ${d.locationCountry || 'unknown country'}:
Scheduled Places (in planned sequence order):
${placesList || 'None'}
Hotels:
${hotelsList || 'None'}
Transports:
${transportsList || 'None'}`;
    }).join('\n\n');

    const promptText = `You are a professional local travel planner and guide. Provide daily itinerary summaries and practical daily travel tips for the following days:

${daysPrompt}

For each day, write daily tips (in Markdown format). Keep the response structured, clear, and relatively brief (under 8-10 sentences total or a clean, bulleted checklist/list of tips, avoiding long essays).
Specifically, cover the following in the tips field:

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
Since the user is traveling with a baby, generate a specific "babyLogistics" text (in Markdown format) for each day, describing what to be aware of regarding having a baby (e.g. stroller friendliness, diaper changing spots, safety, nursing facilities, nap planning). Keep it brief, 2-3 sentences or bullet points.` : ''}

Ensure the returned JSON lists the exact "dateStr" for each day so it can be matched.`;

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
    model?: string
  ): Promise<{
    dateStr: string;
    tips: string;
    babyLogistics?: string;
  }[]> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) {
      throw new Error('No Gemini API keys configured. Please add one in AI Settings.');
    }

    const selectedModel = model || this.getSelectedModel();
    let lastError: any = null;

    for (const key of keys) {
      try {
        return await this.generateDailyTips(days, key, selectedModel, enableBabyLogistics);
      } catch (err) {
        console.warn(`Gemini daily tips call failed with key starting with "${key.substring(0, 5)}...". Error:`, err);
        lastError = err;
      }
    }
    throw lastError || new Error('All configured API keys failed to execute.');
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

    const promptText = `You are a professional travel checklist planner. Generate a concise, high-priority preparation checklist (in Markdown format) for a trip named "${tripInfo.name}" starting on ${tripInfo.startDate} and ending on ${tripInfo.endDate}.

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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
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
      throw new Error('No Gemini API keys configured. Please add one in AI Settings.');
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
   * Generates local essentials.
   */
  static async generateLocalEssentials(
    location: { city: string; country: string },
    apiKey: string,
    model = 'gemini-2.5-flash'
  ): Promise<string> {
    const promptText = `You are a local travel guide expert. Provide a very concise Local Essentials Reference (in Markdown format) for ${location.city}, ${location.country}.

Please organize the guide with clean subheadings, keeping each section extremely brief (max 2-3 concise bullet points or 1-2 short sentences per section, avoiding any wordiness):
1. **Convenience Stores & Essentials**: Best popular chains (e.g. 7-Eleven, Lawson, etc.), what you can find there, and payment options.
2. **Currency & Payments**: Local currency, acceptance of credit cards vs cash, and tipping culture.
3. **Local Apps**: Must-have transit/mapping, ride-sharing, and translation apps.
4. **Dress Code & Etiquette**: Cultural norms and seasonal packing/clothing tips.
5. **Other Utilities**: Power plugs & voltage, tap water safety, and emergency phone numbers.

Output ONLY raw Markdown. Do not include any greeting or conversational filler.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
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
   * Generates local essentials rotating through API keys.
   */
  static async generateLocalEssentialsWithRotation(
    location: { city: string; country: string },
    model?: string
  ): Promise<string> {
    const keys = this.getApiKeys().filter(k => k.trim());
    if (keys.length === 0) {
      throw new Error('No Gemini API keys configured. Please add one in AI Settings.');
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
}

