import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** The household's Tithe fund goal, if tithing is set up. */
export async function findTitheGoal(householdId: string) {
  const db = await getDb();
  return db.query.goals.findFirst({
    where: and(eq(schema.goals.householdId, householdId), eq(schema.goals.isTithe, true), eq(schema.goals.archived, false)),
  });
}

/** Creates the Tithe fund goal when missing. Returns it either way. */
export async function ensureTitheGoal(householdId: string) {
  const existing = await findTitheGoal(householdId);
  if (existing) return existing;
  const db = await getDb();
  const [row] = await db
    .insert(schema.goals)
    .values({ householdId, name: "Tithe fund", icon: "Church", targetCents: 0, monthlyPlanCents: 0, isTithe: true, sortOrder: -1 })
    .returning();
  return row;
}

/**
 * Keeps the automatic set-aside in step with an income entry:
 * tithePct × income goes into the Tithe fund on the same date, by the same member.
 * Called after an income is added, edited, or restored. Removes the set-aside when tithing is off.
 */
export async function syncTitheSetAside(household: { id: string; tithePct: number }, income: schema.Transaction, incomeCategoryName?: string) {
  const db = await getDb();
  const existing = await db.query.transactions.findFirst({ where: eq(schema.transactions.parentId, income.id) });
  const goal = household.tithePct > 0 ? await findTitheGoal(household.id) : null;

  if (income.type !== "income" || !goal) {
    if (existing) await db.delete(schema.transactions).where(eq(schema.transactions.id, existing.id));
    return null;
  }

  const amountCents = Math.round((income.amountCents * household.tithePct) / 100);
  const note = `${household.tithePct}% of ${incomeCategoryName ?? "income"}`;
  if (existing) {
    await db
      .update(schema.transactions)
      .set({ amountCents, date: income.date, userId: income.userId, goalId: goal.id, note, updatedAt: new Date() })
      .where(eq(schema.transactions.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(schema.transactions)
    .values({
      householdId: household.id,
      userId: income.userId,
      goalId: goal.id,
      parentId: income.id,
      type: "goal",
      amountCents,
      date: income.date,
      note,
    })
    .returning({ id: schema.transactions.id });
  return row.id;
}

/** Deletes automatic entries that hang off a parent (used when the parent is deleted). */
export async function deleteChildren(parentId: string) {
  const db = await getDb();
  await db.delete(schema.transactions).where(eq(schema.transactions.parentId, parentId));
}
