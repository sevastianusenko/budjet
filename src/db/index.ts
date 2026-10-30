import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

declare global {
  var __hearthDb: Promise<DB> | undefined;
}

async function createDb(): Promise<DB> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(url, { schema }) as unknown as DB;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set. Add a Neon Postgres database to this Vercel project (Storage tab) so the variable is injected.",
    );
  }

  // Local development without a database server: embedded Postgres (PGlite),
  // persisted to ./.data/pg. Same schema and migrations as production.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = path.join(process.cwd(), ".data", "pg");
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as DB;
}

/** Shared database handle. Lazily created once per process (survives HMR). */
export function getDb(): Promise<DB> {
  if (!globalThis.__hearthDb) {
    globalThis.__hearthDb = createDb().catch((err) => {
      globalThis.__hearthDb = undefined;
      throw err;
    });
  }
  return globalThis.__hearthDb;
}

export { schema };
