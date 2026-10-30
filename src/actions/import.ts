"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { isValidISODate } from "@/lib/dates";
import { errorMessage, ownedCategory, ownedMember, ownedSubcategory } from "@/lib/guards";

const lineSchema = z.object({
  categoryId: z.string().min(1, "Every line needs a category."),
  subcategoryId: z.string().nullable(),
  amountCents: z.number().int().min(1, "Amounts must be above zero."),
  note: z.string().trim().max(200).default(""),
});

const importSchema = z.object({
  date: z.string().refine(isValidISODate, "Pick a valid date."),
  lines: z.array(lineSchema).min(1, "Nothing to import.").max(100, "Import at most 100 lines at a time."),
  store: z.string().trim().max(80).default(""),
  userId: z.string().optional(),
});

export type ImportResult = { ok: true; count: number; totalCents: number } | { ok: false; error: string };

/** Saves parsed receipt lines as expense entries, one per line, all on the same date. */
export async function importEntries(raw: unknown): Promise<ImportResult> {
  try {
    const parsed = importSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const input = parsed.data;
    const { user, household } = await requireViewerForAction();
    const userId = input.userId ?? user.id;
    if (userId !== user.id) await ownedMember(household.id, userId);

    const rows = [];
    for (const line of input.lines) {
      const cat = await ownedCategory(household.id, line.categoryId);
      if (cat.kind !== "expense") throw new Error(`${cat.name} is an income category.`);
      let subcategoryId: string | null = null;
      if (line.subcategoryId) {
        const sub = await ownedSubcategory(household.id, line.subcategoryId);
        if (sub.categoryId !== cat.id) throw new Error(`${sub.name} doesn't belong to ${cat.name}.`);
        subcategoryId = sub.id;
      }
      const note = [input.store, line.note].filter(Boolean).join(" · ").slice(0, 200);
      rows.push({
        householdId: household.id,
        userId,
        categoryId: cat.id,
        subcategoryId,
        type: "expense" as const,
        amountCents: line.amountCents,
        date: input.date,
        note,
      });
    }
    const db = await getDb();
    await db.insert(schema.transactions).values(rows);
    revalidatePath("/", "layout");
    return { ok: true, count: rows.length, totalCents: rows.reduce((a, r) => a + r.amountCents, 0) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
