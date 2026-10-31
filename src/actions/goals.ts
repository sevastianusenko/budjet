"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { isValidISODate } from "@/lib/dates";
import { errorMessage, ownedGoal } from "@/lib/guards";
import type { ActionResult } from "./auth";

const goalSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name the goal.").max(60),
  icon: z.string().min(1).max(40),
  targetCents: z.number().int().min(0),
  monthlyPlanCents: z.number().int().min(0),
  deadline: z.string().refine(isValidISODate, "Pick a valid date.").nullable(),
  isEmergency: z.boolean(),
  isTithe: z.boolean().optional(),
  startingCents: z.number().int(),
});

export type GoalInput = z.infer<typeof goalSchema>;

export async function saveGoal(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = goalSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const input = parsed.data;
    if (!input.isTithe && input.targetCents < 100) return { ok: false, error: "Set a target amount." };
    if (!input.isTithe && input.startingCents < 0) return { ok: false, error: "Already saved can't be negative." };
    const { household } = await requireViewerForAction();
    const db = await getDb();
    const values = {
      name: input.name,
      icon: input.icon,
      targetCents: input.targetCents,
      monthlyPlanCents: input.monthlyPlanCents,
      deadline: input.deadline,
      isEmergency: input.isEmergency,
      startingCents: input.startingCents,
    };
    if (input.id) {
      await ownedGoal(household.id, input.id);
      await db.update(schema.goals).set(values).where(eq(schema.goals.id, input.id));
    } else {
      await db.insert(schema.goals).values({ householdId: household.id, ...values });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function setGoalArchived(id: string, archived: boolean): Promise<ActionResult> {
  try {
    const { household } = await requireViewerForAction();
    await ownedGoal(household.id, id);
    const db = await getDb();
    await db.update(schema.goals).set({ archived }).where(eq(schema.goals.id, id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

const balanceSchema = z.object({
  goalId: z.string().min(1),
  balanceCents: z.number().int().min(0, "The fund can't go below zero.").max(1_000_000_000),
});

/**
 * Sets the Tithe fund to what is really there. The difference moves into the fund's starting amount, so every
 * set-aside and gift in the history stays exactly as logged. The current balance is recomputed here, never trusted
 * from the client.
 */
export async function setTitheBalance(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = balanceSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const { goalId, balanceCents } = parsed.data;
    const { household } = await requireViewerForAction();
    const goal = await ownedGoal(household.id, goalId);
    if (!goal.isTithe) return { ok: false, error: "Only the Tithe fund can be set this way." };
    const db = await getDb();
    const rows = await db
      .select({ amountCents: schema.transactions.amountCents })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.goalId, goalId), eq(schema.transactions.type, "goal")));
    const current = goal.startingCents + rows.reduce((a, r) => a + r.amountCents, 0);
    const delta = balanceCents - current;
    if (delta !== 0) {
      await db.update(schema.goals).set({ startingCents: goal.startingCents + delta }).where(eq(schema.goals.id, goalId));
      revalidatePath("/", "layout");
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Deletes the goal and its contributions. */
export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    const { household } = await requireViewerForAction();
    await ownedGoal(household.id, id);
    const db = await getDb();
    await db.delete(schema.transactions).where(eq(schema.transactions.goalId, id));
    await db.delete(schema.goals).where(eq(schema.goals.id, id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
