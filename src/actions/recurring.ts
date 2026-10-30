"use server";

import { and, eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { dateInMonth, isValidMonth, monthOf } from "@/lib/dates";
import { errorMessage, ownedCategory, ownedRecurring } from "@/lib/guards";
import type { ActionResult } from "./auth";

const billSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name the bill.").max(60),
  amountCents: z.number().int().min(1, "Enter an amount."),
  dayOfMonth: z.number().int().min(1).max(31),
  categoryId: z.string().min(1, "Pick a category."),
  type: z.enum(["expense", "income"]),
  active: z.boolean().default(true),
});

export type BillInput = z.infer<typeof billSchema>;

export async function saveBill(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = billSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const input = parsed.data;
    const { household } = await requireViewerForAction();
    const cat = await ownedCategory(household.id, input.categoryId);
    if (cat.kind !== input.type) return { ok: false, error: "That category doesn't match the bill type." };
    const db = await getDb();
    const values = {
      name: input.name,
      amountCents: input.amountCents,
      dayOfMonth: input.dayOfMonth,
      categoryId: input.categoryId,
      type: input.type,
      active: input.active,
    };
    if (input.id) {
      await ownedRecurring(household.id, input.id);
      await db.update(schema.recurring).set(values).where(eq(schema.recurring.id, input.id));
    } else {
      await db.insert(schema.recurring).values({ householdId: household.id, ...values });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteBill(id: string): Promise<ActionResult> {
  try {
    const { household } = await requireViewerForAction();
    await ownedRecurring(household.id, id);
    const db = await getDb();
    await db.delete(schema.recurring).where(eq(schema.recurring.id, id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Records this month's payment of a bill as a transaction linked to it. */
export async function markBillPaid(id: string, month: string): Promise<ActionResult> {
  try {
    if (!isValidMonth(month)) return { ok: false, error: "Bad month." };
    const viewer = await requireViewerForAction();
    const bill = await ownedRecurring(viewer.household.id, id);
    const db = await getDb();
    const already = await db.query.transactions.findFirst({
      where: and(eq(schema.transactions.recurringId, id), like(schema.transactions.date, `${month}-%`)),
    });
    if (already) return { ok: false, error: `${bill.name} is already marked paid this month.` };
    const date = month === monthOf(viewer.today) ? viewer.today : dateInMonth(month, bill.dayOfMonth);
    await db.insert(schema.transactions).values({
      householdId: viewer.household.id,
      userId: viewer.user.id,
      categoryId: bill.categoryId,
      recurringId: bill.id,
      type: bill.type,
      amountCents: bill.amountCents,
      date,
      note: bill.name,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
