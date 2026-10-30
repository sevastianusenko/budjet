"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { errorMessage, ownedCategory, ownedSubcategory } from "@/lib/guards";

const schemaIn = z.object({
  /** Entries to move (ids), typically every uncategorized entry with the same note. */
  ids: z.array(z.string()).min(1).max(2000),
  categoryId: z.string().min(1, "Pick a category."),
  subcategoryId: z.string().nullable(),
});

export type SortResult = { ok: true; moved: number } | { ok: false; error: string };

/** Moves a set of expense entries into a category (and optional subcategory) in one go. */
export async function recategorize(raw: unknown): Promise<SortResult> {
  try {
    const parsed = schemaIn.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { ids, categoryId, subcategoryId } = parsed.data;
    const { household } = await requireViewerForAction();
    const cat = await ownedCategory(household.id, categoryId);
    if (cat.kind !== "expense") return { ok: false, error: "Pick an expense category." };
    if (subcategoryId) {
      const sub = await ownedSubcategory(household.id, subcategoryId);
      if (sub.categoryId !== cat.id) return { ok: false, error: "That subcategory belongs to a different category." };
    }
    const db = await getDb();
    let moved = 0;
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const res = await db
        .update(schema.transactions)
        .set({ categoryId: cat.id, subcategoryId: subcategoryId ?? null, updatedAt: new Date() })
        .where(and(eq(schema.transactions.householdId, household.id), eq(schema.transactions.type, "expense"), inArray(schema.transactions.id, chunk)))
        .returning({ id: schema.transactions.id });
      moved += res.length;
    }
    revalidatePath("/", "layout");
    return { ok: true, moved };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** How many expense entries sit in the Uncategorized category. */
export async function uncategorizedCount(): Promise<number> {
  try {
    const { household } = await requireViewerForAction();
    const db = await getDb();
    const cat = await db.query.categories.findFirst({
      where: and(eq(schema.categories.householdId, household.id), eq(schema.categories.name, "Uncategorized")),
    });
    if (!cat) return 0;
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.transactions)
      .where(eq(schema.transactions.categoryId, cat.id));
    return n;
  } catch {
    return 0;
  }
}
