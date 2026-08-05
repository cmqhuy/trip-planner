export function getUtcOffsetMinutes(tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
    const offsetStr = fmt.formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? '';
    const m = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!m) return 0;
    return (m[1] === '+' ? 1 : -1) * (parseInt(m[2]) * 60 + parseInt(m[3] ?? '0'));
  } catch { return 0; }
}

export function formatTimezoneLabel(tz: string): string {
  const mins = getUtcOffsetMinutes(tz);
  const sign = mins >= 0 ? '+' : '-';
  const absMins = Math.abs(mins);
  const h = String(Math.floor(absMins / 60)).padStart(2, '0');
  const m = String(absMins % 60).padStart(2, '0');
  return `(GMT${sign}${h}:${m}) ${tz}`;
}

export const ALL_TIMEZONES: string[] = (() => {
  try {
    // Intl.supportedValuesOf is ES2022 but is not in the ES2023 lib typings.
    const supportedValuesOf = (Intl as unknown as {
      supportedValuesOf?: (key: 'timeZone') => string[];
    }).supportedValuesOf;
    if (!supportedValuesOf) throw new Error('Intl.supportedValuesOf unavailable');
    return [...supportedValuesOf('timeZone')].sort(
      (a, b) => getUtcOffsetMinutes(a) - getUtcOffsetMinutes(b)
    );
  } catch {
    return [
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
    ];
  }
})();

export function getBrowserTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
}
