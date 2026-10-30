import "server-only";
import { and, count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const UNCATEGORIZED = "Uncategorized";

/** The household's "Uncategorized" expense category, created on demand. Imports park unclear rows here. */
export async function ensureUncategorized(householdId: string): Promise<schema.Category> {
  const db = await getDb();
  const existing = await db.query.categories.findFirst({
    where: and(eq(schema.categories.householdId, householdId), eq(schema.categories.name, UNCATEGORIZED), eq(schema.categories.kind, "expense")),
  });
  if (existing) {
    if (existing.archived) await db.update(schema.categories).set({ archived: false }).where(eq(schema.categories.id, existing.id));
    return existing;
  }
  const [{ n }] = await db.select({ n: count() }).from(schema.categories).where(eq(schema.categories.householdId, householdId));
  const [row] = await db
    .insert(schema.categories)
    .values({ householdId, name: UNCATEGORIZED, icon: "CircleHelp", kind: "expense", group: "want", sortOrder: n + 100 })
    .returning();
  return row;
}
