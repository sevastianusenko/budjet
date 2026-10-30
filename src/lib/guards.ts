import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** Load a row and make sure it belongs to the viewer's household. */
export async function ownedCategory(householdId: string, id: string) {
  const db = await getDb();
  const row = await db.query.categories.findFirst({
    where: and(eq(schema.categories.id, id), eq(schema.categories.householdId, householdId)),
  });
  if (!row) throw new Error("That category no longer exists.");
  return row;
}

export async function ownedSubcategory(householdId: string, id: string) {
  const db = await getDb();
  const row = await db.query.subcategories.findFirst({
    where: and(eq(schema.subcategories.id, id), eq(schema.subcategories.householdId, householdId)),
  });
  if (!row) throw new Error("That subcategory no longer exists.");
  return row;
}

export async function ownedGoal(householdId: string, id: string) {
  const db = await getDb();
  const row = await db.query.goals.findFirst({
    where: and(eq(schema.goals.id, id), eq(schema.goals.householdId, householdId)),
  });
  if (!row) throw new Error("That goal no longer exists.");
  return row;
}

export async function ownedTransaction(householdId: string, id: string) {
  const db = await getDb();
  const row = await db.query.transactions.findFirst({
    where: and(eq(schema.transactions.id, id), eq(schema.transactions.householdId, householdId)),
  });
  if (!row) throw new Error("That entry no longer exists.");
  return row;
}

export async function ownedRecurring(householdId: string, id: string) {
  const db = await getDb();
  const row = await db.query.recurring.findFirst({
    where: and(eq(schema.recurring.id, id), eq(schema.recurring.householdId, householdId)),
  });
  if (!row) throw new Error("That bill no longer exists.");
  return row;
}

export async function ownedMember(householdId: string, id: string) {
  const db = await getDb();
  const row = await db.query.users.findFirst({
    where: and(eq(schema.users.id, id), eq(schema.users.householdId, householdId)),
  });
  if (!row) throw new Error("That member is not in your household.");
  return row;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}
