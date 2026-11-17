// One set of password rules for every place a password is set
export const PASSWORD_MIN_LENGTH = 8;
const MAX_BYTES = 72; // bcrypt ignores anything past 72 bytes

// Passwords that appear at the top of every leaked-password list, plus local favourites.
// Checked after lower-casing and removing spaces, so "Password1" is caught too.
const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword1",
  "12345678", "123456789", "1234567890", "12341234", "11111111", "00000000", "87654321", "123123123",
  "qwerty123", "qwertyuiop", "qwerty12", "1q2w3e4r", "1qaz2wsx", "asdfghjk", "zxcvbnm1", "abc12345",
  "abcd1234", "a1b2c3d4", "iloveyou1", "iloveyou", "welcome1", "welcome123", "letmein1", "admin123",
  "admin1234", "administrator1", "changeme1", "trustno1", "football1", "baseball1", "sunshine1",
  "princess1", "monkey123", "dragon123", "master123", "superman1", "batman123", "starwars1",
  "jesus123", "jesus1234", "jesusisking1", "godislove1", "blessed1", "blessing1", "faith123",
  "church123", "nigeria1", "nigeria123", "lagos123", "abeokuta1", "abeokuta123", "institute1",
  "institute123", "irms1234", "irms12345", "student1", "student123", "teacher1", "teacher123",
  "temp1234", "temporary1", "default1", "secret123", "test1234", "testing1", "qwerty1234",
]);

function squash(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

/**
 * Returns what's wrong with a password, or null if it's fine.
 * Pass the person's name and email to stop passwords made from them.
 */
export function passwordProblem(password: unknown, about?: { name?: string | null; email?: string | null }): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, "utf8") > MAX_BYTES) {
    return "Password is too long (keep it under 70 characters)";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number";
  }
  const p = squash(password);
  if (COMMON.has(p) || /^(.)\1+$/.test(p)) {
    return "That password is too common and easy to guess. Choose something more personal.";
  }
  const parts = [
    ...(about?.name ?? "").split(/\s+/),
    (about?.email ?? "").split("@")[0],
  ]
    .map(squash)
    .filter((w) => w.length >= 4);
  if (parts.some((w) => p.includes(w))) {
    return "Don't use your name or email in your password";
  }
  return null;
}
