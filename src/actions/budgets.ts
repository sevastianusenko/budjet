"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { starterPlan } from "@/lib/calc";
import { addMonths, isValidMonth, monthOf } from "@/lib/dates";
import { DEFAULT_CATEGORIES, EMERGENCY_FUND_MONTHS, EMERGENCY_FUND_SHARE_PCT, TITHE_SHARE_PCT } from "@/lib/defaults";
import { errorMessage, ownedCategory } from "@/lib/guards";
import type { ActionResult } from "./auth";

const month = z.string().refine(isValidMonth, "Bad month.");
const cents = z.number().int().min(0).max(2_000_000_000);

async function upsertPlanned(householdId: string, categoryId: string, m: string, plannedCents: number) {
  const db = await getDb();
  await db
    .insert(schema.budgets)
    .values({ householdId, categoryId, month: m, plannedCents })
    .onConflictDoUpdate({
      target: [schema.budgets.categoryId, schema.budgets.month],
      set: { plannedCents },
    });
}

export async function setPlanned(raw: { categoryId: string; month: string; plannedCents: number }): Promise<ActionResult> {
  try {
    const parsed = z.object({ categoryId: z.string(), month, plannedCents: cents }).parse(raw);
    const { household } = await requireViewerForAction();
    await ownedCategory(household.id, parsed.categoryId);
    await upsertPlanned(household.id, parsed.categoryId, parsed.month, parsed.plannedCents);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Copy every planned amount from the previous month into `targetMonth`. */
export async function copyLastMonth(targetMonth: string): Promise<ActionResult> {
  try {
    const m = month.parse(targetMonth);
    const { household } = await requireViewerForAction();
    const db = await getDb();
    const prev = await db.query.budgets.findMany({
      where: and(eq(schema.budgets.householdId, household.id), eq(schema.budgets.month, addMonths(m, -1))),
    });
    if (prev.length === 0) return { ok: false, error: "Last month has no plan to copy." };
    for (const b of prev) await upsertPlanned(household.id, b.categoryId, m, b.plannedCents);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Onboarding: spread a monthly take-home income across the starter categories
 * (50/30/20 with BLS proportions) and create an Emergency Fund goal.
 */
export async function applyStarterPlan(raw: { incomeCents: number; month?: string; tithe?: boolean }): Promise<ActionResult> {
  try {
    const parsed = z
      .object({ incomeCents: cents.min(100, "Enter your monthly take-home pay."), month: month.optional(), tithe: z.boolean().optional() })
      .parse(raw);
    const scale = parsed.tithe ? (100 - TITHE_SHARE_PCT) / 100 : 1;
    const viewer = await requireViewerForAction();
    const m = parsed.month ?? monthOf(viewer.today);
    const db = await getDb();
    const cats = await db.query.categories.findMany({ where: eq(schema.categories.householdId, viewer.household.id) });
    const shares = cats
      .map((c) => {
        const def = DEFAULT_CATEGORIES.find((d) => d.name === c.name);
        if (c.name === "Tithe") return { id: c.id, defaultSharePct: parsed.tithe ? TITHE_SHARE_PCT : 0 };
        return { id: c.id, defaultSharePct: (def?.defaultSharePct ?? 0) * scale };
      })
      .filter((c) => c.defaultSharePct > 0);
    for (const p of starterPlan(parsed.incomeCents, shares)) {
      await upsertPlanned(viewer.household.id, p.categoryId, m, p.plannedCents);
    }

    const existingEmergency = await db.query.goals.findFirst({
      where: and(eq(schema.goals.householdId, viewer.household.id), eq(schema.goals.isEmergency, true)),
    });
    if (!existingEmergency) {
      const monthlyNeeds = Math.round(parsed.incomeCents * 0.5);
      await db.insert(schema.goals).values({
        householdId: viewer.household.id,
        name: "Emergency Fund",
        icon: "ShieldCheck",
        targetCents: Math.round((monthlyNeeds * EMERGENCY_FUND_MONTHS) / 100) * 100,
        monthlyPlanCents: Math.round((parsed.incomeCents * EMERGENCY_FUND_SHARE_PCT * scale) / 100 / 100) * 100,
        isEmergency: true,
        sortOrder: 0,
      });
    }

    await db
      .update(schema.households)
      .set({ expectedIncomeCents: parsed.incomeCents, onboardedAt: new Date() })
      .where(eq(schema.households.id, viewer.household.id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function skipOnboarding(): Promise<ActionResult> {
  try {
    const { household } = await requireViewerForAction();
    const db = await getDb();
    await db.update(schema.households).set({ onboardedAt: new Date() }).where(eq(schema.households.id, household.id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
