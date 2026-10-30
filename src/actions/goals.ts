"use server";

import { eq } from "drizzle-orm";
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
  startingCents: z.number().int().min(0),
});

export type GoalInput = z.infer<typeof goalSchema>;

export async function saveGoal(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = goalSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const input = parsed.data;
    if (!input.isTithe && input.targetCents < 100) return { ok: false, error: "Set a target amount." };
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
