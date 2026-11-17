// Class days are counted in the institute's own time zone, never the server's.
// A server on Vercel runs in UTC; a laptop may be set to any zone. Without this,
// a class near midnight could be saved under the wrong day.
// Change the zone with APP_TIME_ZONE in .env (for example "Africa/Lagos").
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Africa/Lagos";

function parts(at: Date, timeZone: string) {
  const out: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

// How far the zone's clock is ahead of UTC at a given moment, in milliseconds
function zoneOffsetMs(at: Date, timeZone: string) {
  const p = parts(at, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// The calendar day ("2026-11-17") that a moment falls on, in the institute's zone
export function dayKey(at: Date, timeZone = APP_TIME_ZONE): string {
  const p = parts(at, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function todayKey(timeZone = APP_TIME_ZONE): string {
  return dayKey(new Date(), timeZone);
}

// Accepts only "YYYY-MM-DD"; anything else gives null
export function parseDayKey(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? value : null;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Midnight at the start of that day in the institute's zone
export function startOfDay(key: string, timeZone = APP_TIME_ZONE): Date {
  const [y, m, d] = key.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - zoneOffsetMs(new Date(guess), timeZone);
  t = guess - zoneOffsetMs(new Date(t), timeZone); // second pass handles daylight-saving changes
  return new Date(t);
}

export function startOfToday(): Date {
  return startOfDay(todayKey());
}

// A filter covering one whole day. Matching a range instead of one exact moment
// also finds records saved before this file existed, whatever clock they used.
export function dayRange(key: string) {
  return { gte: startOfDay(key), lt: startOfDay(addDays(key, 1)) };
}

// From the start of one day up to the end of another (both "YYYY-MM-DD", either may be missing)
export function daysBetween(from: string | null, to: string | null) {
  return {
    ...(from ? { gte: startOfDay(from) } : {}),
    ...(to ? { lt: startOfDay(addDays(to, 1)) } : {}),
  };
}
