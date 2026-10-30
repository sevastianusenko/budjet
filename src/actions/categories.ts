"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { errorMessage, ownedCategory } from "@/lib/guards";
import type { ActionResult } from "./auth";

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name the category.").max(40),
  icon: z.string().min(1).max(40),
  kind: z.enum(["expense", "income"]),
  group: z.enum(["need", "want", "savings", "income", "business"]),
  isFixed: z.boolean(),
  rollover: z.boolean(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export async function saveCategory(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = categorySchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const input = parsed.data;
    if (input.kind === "income") input.group = "income";
    if (input.kind === "expense" && input.group === "income") input.group = "want";
    const { household } = await requireViewerForAction();
    const db = await getDb();
    const values = {
      name: input.name,
      icon: input.icon,
      kind: input.kind,
      group: input.group,
      isFixed: input.isFixed,
      rollover: input.rollover,
    };
    if (input.id) {
      await ownedCategory(household.id, input.id);
      await db.update(schema.categories).set(values).where(eq(schema.categories.id, input.id));
    } else {
      const [{ n }] = await db.select({ n: count() }).from(schema.categories).where(eq(schema.categories.householdId, household.id));
      await db.insert(schema.categories).values({ householdId: household.id, sortOrder: n, ...values });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<ActionResult> {
  try {
    const { household } = await requireViewerForAction();
    await ownedCategory(household.id, id);
    const db = await getDb();
    await db.update(schema.categories).set({ archived }).where(eq(schema.categories.id, id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Only categories with no entries can be deleted; otherwise archive. */
export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const { household } = await requireViewerForAction();
    await ownedCategory(household.id, id);
    const db = await getDb();
    const [{ n }] = await db.select({ n: count() }).from(schema.transactions).where(eq(schema.transactions.categoryId, id));
    if (n > 0) return { ok: false, error: "This category has entries. Archive it instead to keep history intact." };
    await db.delete(schema.categories).where(eq(schema.categories.id, id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
