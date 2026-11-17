// Emergency: switch off two-step sign-in for one account, for example a super admin who
// lost their phone and their recovery codes. Only works from a computer that has the
// database password in .env, so it can't be used from the website.
//
//   npm run reset-two-factor -- someone@example.com

import "dotenv/config";
import pg from "pg";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Give the account's email, e.g.  npm run reset-two-factor -- you@example.com");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(
    `UPDATE "User"
        SET "totpSecret" = NULL, "totpEnabledAt" = NULL, "totpLastStep" = NULL, "recoveryCodes" = '{}',
            "failedLoginCount" = 0, "lockedUntil" = NULL, "sessionVersion" = "sessionVersion" + 1
      WHERE lower(email) = $1
      RETURNING id, name`,
    [email]
  );
  if (rows.length === 0) {
    console.error(`No account found for ${email}.`);
    process.exitCode = 1;
  } else {
    await client.query(
      `INSERT INTO "AuditLog" (id, "actorId", "actorName", action, summary, "targetId", "createdAt")
       VALUES ($1, NULL, 'Server script', 'TWO_FACTOR_OFF', $2, $3, now())`,
      [`script_${Date.now()}`, `Two-step sign-in was switched off for ${rows[0].name} by the emergency script`, rows[0].id]
    );
    console.log(`Two-step sign-in is off for ${rows[0].name}. Sign in with the password, then set it up again under My Account.`);
  }
} finally {
  await client.end();
}
