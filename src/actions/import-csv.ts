"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { isValidISODate } from "@/lib/dates";
import { errorMessage, ownedCategory, ownedMember, ownedSubcategory } from "@/lib/guards";
import { syncTitheSetAside } from "@/lib/tithe";

const rowSchema = z.object({
  date: z.string().refine(isValidISODate),
  type: z.enum(["expense", "income"]),
  categoryId: z.string().min(1),
  subcategoryId: z.string().nullable(),
  amountCents: z.number().int().min(1),
  note: z.string().trim().max(200).default(""),
  userId: z.string().nullable(),
});

const importSchema = z.object({
  rows: z.array(rowSchema).min(1, "Nothing to import.").max(5000, "Import at most 5,000 rows at a time."),
  /** Skip rows that already exist (same date, type, amount and note). */
  skipDuplicates: z.boolean().default(true),
  /** Create the automatic tithe set-aside for imported income. */
  tithe: z.boolean().default(false),
});

export type CsvImportResult = { ok: true; imported: number; skipped: number; batchId: string } | { ok: false; error: string };

/** Saves rows from a history CSV as entries, tagged with a batch id so the whole import can be undone. */
export async function importHistory(raw: unknown): Promise<CsvImportResult> {
  try {
    const parsed = importSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { rows, skipDuplicates, tithe } = parsed.data;
    const viewer = await requireViewerForAction();
    const { user, household } = viewer;

    // Validate ownership once per distinct id.
    const catIds = [...new Set(rows.map((r) => r.categoryId))];
    const cats = new Map<string, schema.Category>();
    for (const id of catIds) cats.set(id, await ownedCategory(household.id, id));
    const subIds = [...new Set(rows.map((r) => r.subcategoryId).filter((s): s is string => Boolean(s)))];
    const subs = new Map<string, schema.Subcategory>();
    for (const id of subIds) subs.set(id, await ownedSubcategory(household.id, id));
    const userIds = [...new Set(rows.map((r) => r.userId).filter((u): u is string => Boolean(u)))];
    for (const id of userIds) if (id !== user.id) await ownedMember(household.id, id);

    for (const r of rows) {
      const cat = cats.get(r.categoryId)!;
      if (cat.kind !== r.type) throw new Error(`${cat.name} is a${cat.kind === "income" ? "n income" : "n expense"} category but a row says ${r.type}.`);
      if (r.subcategoryId && subs.get(r.subcategoryId)!.categoryId !== cat.id) throw new Error(`A subcategory doesn't belong to ${cat.name}.`);
    }

    const db = await getDb();
    const dates = rows.map((r) => r.date).sort();
    const existing = skipDuplicates
      ? await db.query.transactions.findMany({
          where: and(
            eq(schema.transactions.householdId, household.id),
            gte(schema.transactions.date, dates[0]),
            lte(schema.transactions.date, dates[dates.length - 1]),
            inArray(schema.transactions.type, ["expense", "income"]),
          ),
          columns: { date: true, type: true, amountCents: true, note: true },
        })
      : [];
    const seen = new Set(existing.map((t) => `${t.date}|${t.type}|${t.amountCents}|${t.note.trim().toLowerCase()}`));

    const batchId = crypto.randomUUID();
    const toInsert = [];
    let skipped = 0;
    for (const r of rows) {
      const key = `${r.date}|${r.type}|${r.amountCents}|${r.note.trim().toLowerCase()}`;
      if (skipDuplicates && seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      toInsert.push({
        householdId: household.id,
        userId: r.userId ?? user.id,
        categoryId: r.categoryId,
        subcategoryId: r.subcategoryId,
        type: r.type,
        amountCents: r.amountCents,
        date: r.date,
        note: r.note,
        importBatch: batchId,
      });
    }

    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const inserted = await db.insert(schema.transactions).values(chunk).returning();
      if (tithe && household.tithePct > 0) {
        for (const row of inserted) if (row.type === "income") await syncTitheSetAside(household, row, cats.get(row.categoryId ?? "")?.name);
      }
    }
    revalidatePath("/", "layout");
    return { ok: true, imported: toInsert.length, skipped, batchId };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Undo: removes every entry of an import batch (and the tithe set-asides they produced). */
export async function deleteImportBatch(batchId: string): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  try {
    const { household } = await requireViewerForAction();
    const db = await getDb();
    const rows = await db.query.transactions.findMany({
      where: and(eq(schema.transactions.householdId, household.id), eq(schema.transactions.importBatch, batchId)),
      columns: { id: true },
    });
    const ids = rows.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      await db.delete(schema.transactions).where(inArray(schema.transactions.parentId, chunk));
      await db.delete(schema.transactions).where(inArray(schema.transactions.id, chunk));
    }
    revalidatePath("/", "layout");
    return { ok: true, removed: ids.length };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
