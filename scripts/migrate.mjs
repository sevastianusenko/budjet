// Runs pending SQL migrations against DATABASE_URL (Neon / any Postgres).
// Used by `npm run build` on Vercel and by `npm run db:migrate` locally.
// Without DATABASE_URL it does nothing: local dev uses embedded PGlite,
// which migrates itself on first use.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set, skipping (PGlite will migrate itself in dev).");
  process.exit(0);
}

const db = drizzle(neon(url));
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("[migrate] database is up to date.");
