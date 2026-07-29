/*
 * Local visual-verification harness (dev only).
 *
 * Drives the running dev server with a headless system Chrome via playwright-core,
 * injecting a sample trip into localStorage so the catalog / day-view / reservation
 * cards render without needing Google sign-in or real data. Used to eyeball CSS
 * changes (card padding, dropdowns, mobile layout) before committing.
 *
 * Usage:
 *   1. npm run dev            (defaults to http://localhost:5173/trip-planner/)
 *   2. node scripts/screenshot.mjs [prefix]
 *
 * Env overrides:
 *   SCREENSHOT_BASE   dev server URL (default http://localhost:5173/trip-planner/)
 *   CHROME_PATH       path to Chrome/Chromium executable
 *
 * Screenshots are written to scripts/.screenshots/ (git-ignored).
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '.screenshots');
mkdirSync(OUT, { recursive: true });

const BASE = process.env.SCREENSHOT_BASE || 'http://localhost:5173/trip-planner/';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PRE = process.argv[2] || 'shot';

const placeGroups = [
  { id: 'attractions', name: 'Attractions', color: '#ef4444', icon: 'landmark' },
  { id: 'restaurants', name: 'Food & Dining', color: '#10b981', icon: 'utensils' },
];
const places = [
  { id: 'pl1', title: 'Palais Garnier', description: '10:00 - 17:00', openingHours: '10:00 - 17:00', lat: 48.87, lng: 2.33, placeGroupId: 'attractions', notes: 'Book timed entry' },
  { id: 'pl2', title: 'Louvre Museum', description: '09:00 - 18:00', openingHours: '09:00 - 18:00', lat: 48.86, lng: 2.34, placeGroupId: 'attractions' },
];
const paris = { id: 'loc1', city: 'Paris', country: 'France', countryCode: 'FR', color: '#6366f1', lat: 48.8566, lng: 2.3522, places };
const day = (d, items = []) => ({ dateStr: d, locationId: 'loc1', placeIds: items.filter(i => i.type === 'place').map(i => i.placeId), scheduleItems: items });
const hotels = [
  { id: 'h1', name: 'Holiday Inn Paris Opera', address: '38 Rue de l Echiquier, Paris', checkInDate: '2026-09-06', checkInTime: '15:00', checkOutDate: '2026-09-08', checkOutTime: '12:00', status: 'Confirmed', lat: 48.87, lng: 2.34 },
  { id: 'h2', name: 'Holiday Inn Paris Opera', address: '38 Rue de l Echiquier, Paris', checkInDate: '2026-09-08', checkInTime: '15:00', checkOutDate: '2026-09-10', checkOutTime: '12:00', status: 'Confirmed', lat: 48.87, lng: 2.34 },
];
const transports = [{ id: 't1', type: 'flight', name: 'Flight to London', status: 'Confirmed', confirmationNo: 'ABC123', segments: [{ id: 's1', departureLocationName: 'Paris CDG', departureDate: '2026-09-08', departureTime: '08:00', departureTimezone: 'Europe/Paris', arrivalLocationName: 'London Heathrow', arrivalDate: '2026-09-08', arrivalTime: '08:40', arrivalTimezone: 'Europe/London' }] }];
const plan = {
  id: 'plan1', name: 'Main Plan', startDate: '2026-09-06', endDate: '2026-09-10',
  days: { '2026-09-06': day('2026-09-06', [{ type: 'place', placeId: 'pl1' }, { type: 'place', placeId: 'pl2' }]), '2026-09-07': day('2026-09-07'), '2026-09-08': day('2026-09-08'), '2026-09-09': day('2026-09-09'), '2026-09-10': day('2026-09-10') },
  hotels, transports, placeReservations: [],
};
const trip = { id: 'trip1', name: 'Europe Trip', startDate: '2026-09-06', endDate: '2026-09-10', locations: [paris], plans: [plan], placeGroups };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(([t]) => {
  localStorage.setItem('vacation-itineraries', JSON.stringify([t]));
  localStorage.setItem('vacation-itineraries-active-trip-id', JSON.stringify('trip1'));
}, [trip]);
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const card = page.getByText('Europe Trip').first();
if (await card.count()) { await card.click(); await page.waitForTimeout(1200); }

await page.screenshot({ path: join(OUT, `${PRE}-desktop.png`) });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, `${PRE}-mobile.png`) });

await browser.close();
console.log(`Screenshots written to ${OUT} (prefix "${PRE}")`);
