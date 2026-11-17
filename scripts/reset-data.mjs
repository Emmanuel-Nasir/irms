// Clears everything entered while building and testing IRMS, keeping only
// SUPER_ADMIN accounts so you can still sign in.
//
//   npm run reset-data              shows what would be deleted (nothing is changed)
//   npm run reset-data -- --confirm deletes it
//
// Deleted for good, with no undo: students, teachers, admins, coordinators,
// semesters, classes, enrollments, attendance, QR sessions, graduation progress,
// announcements, events and resources. Take a backup first if any of it matters.

import "dotenv/config";
import pg from "pg";

const confirm = process.argv.includes("--confirm");

// Children first, so nothing is deleted while something still points at it
const TABLES = [
  "EventRsvp",
  "Event",
  "ResourceFile",
  "Resource",
  "LessonPlan",
  "Announcement",
  "Attendance",
  "AttendanceSession",
  "Enrollment",
  "GraduationProgress",
  "Class",
  "Semester",
  "Student",
  "Teacher",
  "LoginAttempt",
  "AuditLog",
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in .env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const admins = await client.query(
    `SELECT name, email FROM "User" WHERE role = 'SUPER_ADMIN' ORDER BY "createdAt"`
  );
  if (admins.rowCount === 0) {
    console.error("No SUPER_ADMIN account exists. Stopping, so you aren't locked out.");
    process.exit(1);
  }

  console.log("\nKept (you can still sign in with these):");
  for (const a of admins.rows) console.log(`  ${a.name} <${a.email}>`);

  console.log(`\n${confirm ? "Deleting" : "Would delete"}:`);
  for (const t of TABLES) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    console.log(`  ${t.padEnd(20)} ${rows[0].n}`);
  }
  const others = await client.query(`SELECT COUNT(*)::int AS n FROM "User" WHERE role <> 'SUPER_ADMIN'`);
  console.log(`  ${"Other user accounts".padEnd(20)} ${others.rows[0].n}`);

  if (!confirm) {
    console.log("\nNothing was changed. Run `npm run reset-data -- --confirm` to delete all of the above.\n");
    process.exit(0);
  }

  await client.query("BEGIN");
  for (const t of TABLES) await client.query(`DELETE FROM "${t}"`);
  await client.query(`DELETE FROM "User" WHERE role <> 'SUPER_ADMIN'`);
  await client.query(`UPDATE "User" SET "failedLoginCount" = 0, "lockedUntil" = NULL`);
  await client.query("COMMIT");
  console.log("\nDone. Only the super admin account(s) above remain.\n");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("\nSomething went wrong, so nothing was deleted:\n", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
