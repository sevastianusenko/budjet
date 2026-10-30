"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { isValidISODate } from "@/lib/dates";
import { errorMessage, ownedCategory, ownedGoal, ownedMember, ownedSubcategory, ownedTransaction } from "@/lib/guards";
import { deleteChildren, syncTitheSetAside } from "@/lib/tithe";

export type TxInput = z.infer<typeof txSchema>;

const txSchema = z.object({
  type: z.enum(["expense", "income", "goal"]),
  amountCents: z.number().int().refine((v) => v !== 0, "Enter an amount."),
  date: z.string().refine(isValidISODate, "Pick a valid date."),
  categoryId: z.string().nullable(),
  subcategoryId: z.string().nullable().optional(),
  goalId: z.string().nullable(),
  note: z.string().trim().max(200, "Keep notes under 200 characters.").default(""),
  /** Who paid. Defaults to the signed-in member. */
  userId: z.string().optional(),
});

export type TxResult = { ok: true; id: string; setAside?: number } | { ok: false; error: string };

async function validate(householdId: string, viewerId: string, raw: unknown) {
  const parsed = txSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const input = parsed.data;

  let subcategoryId: string | null = null;
  let categoryName: string | undefined;
  if (input.type === "goal") {
    if (!input.goalId) throw new Error("Pick a goal.");
    await ownedGoal(householdId, input.goalId);
    // Giving out of the Tithe fund keeps a category (Church, Helping someone…) for the record.
    if (input.categoryId && input.amountCents < 0) {
      const cat = await ownedCategory(householdId, input.categoryId);
      if (cat.kind !== "expense") throw new Error("Pick an expense category for giving.");
      categoryName = cat.name;
      if (input.subcategoryId) {
        const sub = await ownedSubcategory(householdId, input.subcategoryId);
        if (sub.categoryId !== cat.id) throw new Error("That subcategory belongs to a different category.");
        subcategoryId = sub.id;
      }
    } else {
      input.categoryId = null;
    }
  } else {
    if (input.amountCents <= 0) throw new Error("Enter an amount.");
    if (!input.categoryId) throw new Error("Pick a category.");
    const cat = await ownedCategory(householdId, input.categoryId);
    if (cat.kind !== input.type) throw new Error("That category doesn't match the entry type.");
    categoryName = cat.name;
    input.goalId = null;
    if (input.subcategoryId) {
      const sub = await ownedSubcategory(householdId, input.subcategoryId);
      if (sub.categoryId !== cat.id) throw new Error("That subcategory belongs to a different category.");
      subcategoryId = sub.id;
    }
  }
  const userId = input.userId ?? viewerId;
  if (userId !== viewerId) await ownedMember(householdId, userId);
  return { ...input, subcategoryId, userId, categoryName };
}

export async function addTransaction(raw: unknown): Promise<TxResult> {
  try {
    const { user, household } = await requireViewerForAction();
    const input = await validate(household.id, user.id, raw);
    const db = await getDb();
    const [row] = await db
      .insert(schema.transactions)
      .values({
        householdId: household.id,
        userId: input.userId,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        goalId: input.goalId,
        type: input.type,
        amountCents: input.amountCents,
        date: input.date,
        note: input.note,
      })
      .returning();
    let setAside: number | undefined;
    if (row.type === "income" && household.tithePct > 0) {
      const id = await syncTitheSetAside(household, row, input.categoryName);
      if (id) setAside = Math.round((row.amountCents * household.tithePct) / 100);
    }
    revalidatePath("/", "layout");
    return { ok: true, id: row.id, setAside };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateTransaction(id: string, raw: unknown): Promise<TxResult> {
  try {
    const { user, household } = await requireViewerForAction();
    await ownedTransaction(household.id, id);
    const input = await validate(household.id, user.id, raw);
    const db = await getDb();
    const [row] = await db
      .update(schema.transactions)
      .set({
        userId: input.userId,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        goalId: input.goalId,
        type: input.type,
        amountCents: input.amountCents,
        date: input.date,
        note: input.note,
        updatedAt: new Date(),
      })
      .where(eq(schema.transactions.id, id))
      .returning();
    // Keeps (or removes) the automatic tithe set-aside linked to this entry.
    await syncTitheSetAside(household, row, input.categoryName);
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export type DeletedTx = Omit<schema.Transaction, "createdAt" | "updatedAt">;

export async function deleteTransaction(
  id: string,
): Promise<{ ok: true; deleted: DeletedTx } | { ok: false; error: string }> {
  try {
    const { household } = await requireViewerForAction();
    const row = await ownedTransaction(household.id, id);
    const db = await getDb();
    await deleteChildren(id);
    await db.delete(schema.transactions).where(eq(schema.transactions.id, id));
    revalidatePath("/", "layout");
    const { createdAt: _c, updatedAt: _u, ...deleted } = row;
    void _c;
    void _u;
    return { ok: true, deleted };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Undo for deleteTransaction: re-insert the row with its original id (and its tithe set-aside, if any). */
export async function restoreTransaction(deleted: DeletedTx): Promise<TxResult> {
  try {
    const { household } = await requireViewerForAction();
    if (deleted.householdId !== household.id) throw new Error("That entry belongs to another household.");
    const db = await getDb();
    const [row] = await db.insert(schema.transactions).values(deleted).onConflictDoNothing().returning();
    if (row?.type === "income") {
      const cat = row.categoryId ? await db.query.categories.findFirst({ where: eq(schema.categories.id, row.categoryId) }) : null;
      await syncTitheSetAside(household, row, cat?.name);
    }
    revalidatePath("/", "layout");
    return { ok: true, id: deleted.id };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
