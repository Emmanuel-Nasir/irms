import { parseDayKey } from "@/lib/dates";

const STATUSES = ["DRAFT", "READY", "TAUGHT"];

type PlanInput = {
  title?: string;
  date?: string | null;
  scriptures?: string | null;
  objectives?: string | null;
  activities?: string | null;
  notes?: string | null;
  status?: string;
  shared?: boolean;
};

function text(value: unknown, label: string, max: number): string | null | { error: string } {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return { error: `${label} isn't valid` };
  const v = value.trim();
  if (v.length > max) return { error: `${label} is too long (${max} characters at most)` };
  return v || null;
}

// Reads a lesson plan from a request body. With requireTitle, the title must be there.
export function readPlan(body: Record<string, unknown>, requireTitle: boolean): { data: PlanInput } | { error: string } {
  const data: PlanInput = {};

  if (body.title !== undefined || requireTitle) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    if (t.length < 2) return { error: "Give the lesson a title" };
    if (t.length > 150) return { error: "The title is too long (150 characters at most)" };
    data.title = t;
  }
  if (body.date !== undefined) {
    if (body.date === null || body.date === "") data.date = null;
    else {
      const d = parseDayKey(String(body.date));
      if (!d) return { error: "Pick a valid date" };
      data.date = d;
    }
  }
  for (const [key, label, max] of [
    ["scriptures", "Scriptures", 500],
    ["objectives", "Objectives", 3000],
    ["activities", "Activities", 5000],
    ["notes", "Notes", 5000],
  ] as const) {
    if (body[key] !== undefined) {
      const r = text(body[key], label, max);
      if (r && typeof r === "object") return r;
      data[key] = r;
    }
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(String(body.status))) return { error: "Unknown status" };
    data.status = String(body.status);
  }
  if (body.shared !== undefined) data.shared = body.shared === true;
  return { data };
}
