"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { DEFAULT_SUBCATEGORIES } from "@/lib/defaults";
import { errorMessage, ownedCategory, ownedSubcategory } from "@/lib/guards";
import type { ActionResult } from "./auth";

const subSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1),
  name: z.string().trim().min(1, "Name the subcategory.").max(40),
});

export async function saveSubcategory(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = subSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const input = parsed.data;
    const { household } = await requireViewerForAction();
    await ownedCategory(household.id, input.categoryId);
    const db = await getDb();
    if (input.id) {
      await ownedSubcategory(household.id, input.id);
      await db.update(schema.subcategories).set({ name: input.name }).where(eq(schema.subcategories.id, input.id));
    } else {
      const [{ n }] = await db
        .select({ n: count() })
        .from(schema.subcategories)
        .where(eq(schema.subcategories.categoryId, input.categoryId));
      await db.insert(schema.subcategories).values({ householdId: household.id, categoryId: input.categoryId, name: input.name, sortOrder: n });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function setSubcategoryArchived(id: string, archived: boolean): Promise<ActionResult> {
  try {
    const { household } = await requireViewerForAction();
    await ownedSubcategory(household.id, id);
    const db = await getDb();
    await db.update(schema.subcategories).set({ archived }).where(eq(schema.subcategories.id, id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Deletes when unused; archives when entries reference it, so history keeps its labels. */
export async function removeSubcategory(id: string): Promise<ActionResult> {
  try {
    const { household } = await requireViewerForAction();
    await ownedSubcategory(household.id, id);
    const db = await getDb();
    const [{ n }] = await db.select({ n: count() }).from(schema.transactions).where(eq(schema.transactions.subcategoryId, id));
    if (n > 0) await db.update(schema.subcategories).set({ archived: true }).where(eq(schema.subcategories.id, id));
    else await db.delete(schema.subcategories).where(eq(schema.subcategories.id, id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Adds the starter subcategories to every default-named category that has none yet. */
export async function addSuggestedSubcategories(): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  try {
    const { household } = await requireViewerForAction();
    const db = await getDb();
    const cats = await db.query.categories.findMany({ where: eq(schema.categories.householdId, household.id) });
    const existing = await db.query.subcategories.findMany({ where: eq(schema.subcategories.householdId, household.id) });
    let added = 0;
    for (const c of cats) {
      const names = DEFAULT_SUBCATEGORIES[c.name];
      if (!names || existing.some((s) => s.categoryId === c.id)) continue;
      await db.insert(schema.subcategories).values(names.map((name, i) => ({ householdId: household.id, categoryId: c.id, name, sortOrder: i })));
      added += names.length;
    }
    revalidatePath("/", "layout");
    return { ok: true, added };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Adds a default category (e.g. Tithe, Business) that this household doesn't have yet. */
export async function addMissingDefaultCategory(name: string): Promise<ActionResult> {
  try {
    const { household } = await requireViewerForAction();
    const { DEFAULT_CATEGORIES } = await import("@/lib/defaults");
    const def = DEFAULT_CATEGORIES.find((d) => d.name === name);
    if (!def) return { ok: false, error: "Unknown default category." };
    const db = await getDb();
    const dup = await db.query.categories.findFirst({
      where: and(eq(schema.categories.householdId, household.id), eq(schema.categories.name, name)),
    });
    if (dup) return { ok: false, error: `${name} already exists.` };
    const [{ n }] = await db.select({ n: count() }).from(schema.categories).where(eq(schema.categories.householdId, household.id));
    const [row] = await db
      .insert(schema.categories)
      .values({
        householdId: household.id,
        name: def.name,
        icon: def.icon,
        kind: def.kind,
        group: def.group,
        isFixed: def.isFixed,
        rollover: def.rollover,
        blsKey: def.blsKey,
        sortOrder: n,
      })
      .returning({ id: schema.categories.id });
    const subs = DEFAULT_SUBCATEGORIES[name];
    if (subs) await db.insert(schema.subcategories).values(subs.map((s, i) => ({ householdId: household.id, categoryId: row.id, name: s, sortOrder: i })));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
