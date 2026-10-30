"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { isValidISODate } from "@/lib/dates";
import { errorMessage, ownedCategory, ownedMember, ownedSubcategory } from "@/lib/guards";

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  qty: z.number().positive().nullable(),
  unit: z.string().trim().max(20).nullable(),
  unitPriceCents: z.number().int().min(0).nullable(),
  amountCents: z.number().int().min(0),
});

const lineSchema = z.object({
  categoryId: z.string().min(1, "Every line needs a category."),
  subcategoryId: z.string().nullable(),
  amountCents: z.number().int().min(1, "Amounts must be above zero."),
  note: z.string().trim().max(200).default(""),
  items: z.array(itemSchema).max(200).default([]),
});

const importSchema = z.object({
  date: z.string().refine(isValidISODate, "Pick a valid date."),
  lines: z.array(lineSchema).min(1, "Nothing to import.").max(100, "Import at most 100 lines at a time."),
  store: z.string().trim().max(80).default(""),
  totalCents: z.number().int().min(0).optional(),
  userId: z.string().optional(),
});

export type ImportResult = { ok: true; count: number; totalCents: number; receiptId: string } | { ok: false; error: string };

/**
 * Saves a parsed receipt: one receipt row, one expense entry per line (category /
 * subcategory), and the item detail under each entry.
 */
export async function importEntries(raw: unknown): Promise<ImportResult> {
  try {
    const parsed = importSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const input = parsed.data;
    const { user, household } = await requireViewerForAction();
    const userId = input.userId ?? user.id;
    if (userId !== user.id) await ownedMember(household.id, userId);

    const lines = [];
    for (const line of input.lines) {
      const cat = await ownedCategory(household.id, line.categoryId);
      if (cat.kind !== "expense") throw new Error(`${cat.name} is an income category.`);
      let subcategoryId: string | null = null;
      if (line.subcategoryId) {
        const sub = await ownedSubcategory(household.id, line.subcategoryId);
        if (sub.categoryId !== cat.id) throw new Error(`${sub.name} doesn't belong to ${cat.name}.`);
        subcategoryId = sub.id;
      }
      lines.push({ ...line, categoryId: cat.id, subcategoryId });
    }

    const db = await getDb();
    const total = input.totalCents ?? lines.reduce((a, l) => a + l.amountCents, 0);
    const [receipt] = await db
      .insert(schema.receipts)
      .values({ householdId: household.id, userId, store: input.store, date: input.date, totalCents: total })
      .returning({ id: schema.receipts.id });

    let count = 0;
    for (const line of lines) {
      const note = [input.store, line.note].filter(Boolean).join(" · ").slice(0, 200);
      const [tx] = await db
        .insert(schema.transactions)
        .values({
          householdId: household.id,
          userId,
          categoryId: line.categoryId,
          subcategoryId: line.subcategoryId,
          receiptId: receipt.id,
          type: "expense",
          amountCents: line.amountCents,
          date: input.date,
          note,
        })
        .returning({ id: schema.transactions.id });
      count += 1;
      if (line.items.length) {
        await db.insert(schema.receiptItems).values(
          line.items.map((it, i) => ({
            householdId: household.id,
            transactionId: tx.id,
            name: it.name,
            qty: it.qty,
            unit: it.unit,
            unitPriceCents: it.unitPriceCents,
            amountCents: it.amountCents,
            sortOrder: i,
          })),
        );
      }
    }
    revalidatePath("/", "layout");
    return { ok: true, count, totalCents: lines.reduce((a, l) => a + l.amountCents, 0), receiptId: receipt.id };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
