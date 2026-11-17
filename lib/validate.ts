// Cleans and checks what people type into forms, in one place.
// Each function returns the cleaned value, or a message saying what's wrong.

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const bad = <T,>(error: string): Result<T> => ({ ok: false, error });

export function name(input: unknown, label = "Name"): Result<string> {
  if (typeof input !== "string") return bad(`${label} is required`);
  const v = input.replace(/\s+/g, " ").trim();
  if (v.length < 2) return bad(`${label} is too short`);
  if (v.length > 100) return bad(`${label} is too long (100 characters at most)`);
  if (/[<>]/.test(v)) return bad(`${label} can't contain < or >`);
  return ok(v);
}

export function email(input: unknown): Result<string> {
  if (typeof input !== "string") return bad("Email is required");
  const v = input.trim().toLowerCase();
  if (v.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(v)) return bad("Enter a valid email address");
  return ok(v);
}

// Optional short text (ward, stake, venue...): empty becomes null
export function optionalText(input: unknown, label: string, max = 100): Result<string | null> {
  if (input === undefined || input === null || input === "") return ok(null);
  if (typeof input !== "string") return bad(`${label} isn't valid`);
  const v = input.replace(/\s+/g, " ").trim();
  if (!v) return ok(null);
  if (v.length > max) return bad(`${label} is too long (${max} characters at most)`);
  if (/[<>]/.test(v)) return bad(`${label} can't contain < or >`);
  return ok(v);
}

export function phone(input: unknown): Result<string | null> {
  if (input === undefined || input === null || input === "") return ok(null);
  if (typeof input !== "string") return bad("Phone number isn't valid");
  const v = input.trim();
  if (!/^\+?[\d\s()-]{7,20}$/.test(v)) return bad("Enter a valid phone number");
  return ok(v);
}

export function wholeNumber(input: unknown, label: string, min = 0, max = 100): Result<number> {
  const n = typeof input === "string" && input.trim() !== "" ? Number(input) : input;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) {
    return bad(`${label} must be a whole number from ${min} to ${max}`);
  }
  return ok(n);
}
