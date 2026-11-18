import * as v from "@/lib/validate";

type Ok = { ok: true; value: { title: string; description: string | null; venue: string | null; date: Date; semesterId: string | null } };
type Bad = { ok: false; error: string };

/**
 * Reads an event from a form. Date and time are taken as Abeokuta time (UTC+1, no daylight saving).
 * `partial` lets an edit send only the fields it changes.
 */
export function readEvent(body: Record<string, unknown>, current?: { title: string; description: string | null; venue: string | null; date: Date; semesterId: string | null }): Ok | Bad {
  const title = v.name(body.title ?? current?.title, "Title");
  if (!title.ok) return { ok: false, error: title.error };
  if (title.value.length > 120) return { ok: false, error: "Title is too long (120 characters at most)" };

  const description = v.optionalText(body.description === undefined ? current?.description : body.description, "Description", 1500);
  if (!description.ok) return { ok: false, error: description.error };
  const venue = v.optionalText(body.venue === undefined ? current?.venue : body.venue, "Venue", 150);
  if (!venue.ok) return { ok: false, error: venue.error };

  let date = current?.date;
  if (body.date !== undefined || body.time !== undefined) {
    const day = String(body.date ?? "");
    const time = String(body.time || "10:00");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "Choose the event's date" };
    if (!/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: "Choose a valid start time" };
    const at = new Date(`${day}T${time}:00+01:00`);
    if (Number.isNaN(at.getTime())) return { ok: false, error: "That date isn't valid" };
    date = at;
  }
  if (!date) return { ok: false, error: "Choose the event's date" };

  let semesterId = current?.semesterId ?? null;
  if (body.semesterId !== undefined) semesterId = typeof body.semesterId === "string" && body.semesterId ? body.semesterId : null;

  return { ok: true, value: { title: title.value, description: description.value, venue: venue.value, date, semesterId } };
}
