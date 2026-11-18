import { addDays, parseDayKey, startOfDay } from "@/lib/dates";

/**
 * Reads a course period from a form: a start date plus either a length in days or an end date.
 * Returns undefined fields when nothing was sent (leave as is), null to clear, or an error.
 */
export function readPeriod(body: Record<string, unknown>):
  | { startDate?: Date | null; endDate?: Date | null }
  | { error: string } {
  const has = (k: string) => body[k] !== undefined;
  if (!has("startDate") && !has("lengthDays") && !has("endDate")) return {};

  const rawStart = body.startDate;
  if (rawStart === null || rawStart === "") return { startDate: null, endDate: null };

  const startKey = parseDayKey(String(rawStart ?? ""));
  if (!startKey) return { error: "Pick the date the class starts" };

  let endKey: string | null = null;
  if (body.lengthDays !== undefined && body.lengthDays !== "" && body.lengthDays !== null) {
    const days = Number(body.lengthDays);
    if (!Number.isInteger(days) || days < 1 || days > 730) {
      return { error: "How long the class lasts must be between 1 and 730 days" };
    }
    endKey = addDays(startKey, days - 1);
  } else if (body.endDate) {
    endKey = parseDayKey(String(body.endDate));
    if (!endKey) return { error: "Pick a valid end date" };
  } else {
    return { error: "Enter how many days the class lasts" };
  }
  if (endKey < startKey) return { error: "The class can't end before it starts" };

  return { startDate: startOfDay(startKey), endDate: startOfDay(endKey) };
}
