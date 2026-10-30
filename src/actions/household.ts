"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSession } from "@/lib/session";
import { getDb, schema } from "@/db";
import { requireViewerForAction } from "@/lib/auth";
import { errorMessage, ownedMember } from "@/lib/guards";
import { hashPassword, verifyPassword } from "@/lib/password";
import { PROFILES } from "@/lib/profiles";
import { ensureTitheGoal } from "@/lib/tithe";
import type { ActionResult } from "./auth";

const pct = z.number().int().min(0).max(100);

export async function updateHousehold(raw: {
  name: string;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  expectedIncomeCents: number;
  comparisonProfile: string;
  tithePct: number;
  adults: number;
  children: number;
}): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        name: z.string().trim().min(1, "Give your household a name.").max(60),
        needsPct: pct,
        wantsPct: pct,
        savingsPct: pct,
        expectedIncomeCents: z.number().int().min(0),
        comparisonProfile: z.string().refine((v) => v in PROFILES, "Unknown comparison profile."),
        tithePct: z.number().int().min(0).max(50),
        adults: z.number().int().min(1).max(8),
        children: z.number().int().min(0).max(12),
      })
      .refine((v) => v.needsPct + v.wantsPct + v.savingsPct === 100, "The three targets must add up to 100%.")
      .parse(raw);
    const { household } = await requireViewerForAction();
    const db = await getDb();
    await db.update(schema.households).set(parsed).where(eq(schema.households.id, household.id));
    if (parsed.tithePct > 0) await ensureTitheGoal(household.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function updateProfile(raw: { name: string; color: string }): Promise<ActionResult> {
  try {
    const parsed = z
      .object({ name: z.string().trim().min(1, "Enter your name.").max(60), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
      .parse(raw);
    const { user } = await requireViewerForAction();
    const db = await getDb();
    await db.update(schema.users).set(parsed).where(eq(schema.users.id, user.id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  try {
    const { user, household } = await requireViewerForAction();
    if (user.role !== "owner") return { ok: false, error: "Only the household owner can remove members." };
    if (memberId === user.id) return { ok: false, error: "You can't remove yourself." };
    await ownedMember(household.id, memberId);
    const db = await getDb();
    // Keep their entries: reassign to the owner so history stays whole.
    await db.update(schema.transactions).set({ userId: user.id }).where(eq(schema.transactions.userId, memberId));
    await db.delete(schema.users).where(eq(schema.users.id, memberId));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function regenerateInviteCode(): Promise<ActionResult> {
  try {
    const { household } = await requireViewerForAction();
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (const b of crypto.getRandomValues(new Uint8Array(6))) code += alphabet[b % alphabet.length];
    const db = await getDb();
    await db.update(schema.households).set({ inviteCode: code }).where(eq(schema.households.id, household.id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Owner only: deletes the household and everything in it (members, entries, plans, goals). Irreversible. */
export async function deleteHousehold(confirmName: string): Promise<ActionResult> {
  try {
    const { user, household } = await requireViewerForAction();
    if (user.role !== "owner") return { ok: false, error: "Only the household owner can delete it." };
    if (confirmName.trim() !== household.name.trim()) return { ok: false, error: "Type the household name exactly to confirm." };
    const db = await getDb();
    await db.delete(schema.households).where(eq(schema.households.id, household.id));
    await clearSession();
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  redirect("/signup");
}

export async function changePassword(raw: { current: string; next: string }): Promise<ActionResult> {
  try {
    const parsed = z
      .object({ current: z.string().min(1, "Enter your current password."), next: z.string().min(8, "Use at least 8 characters.").max(200) })
      .parse(raw);
    const { user } = await requireViewerForAction();
    if (!(await verifyPassword(parsed.current, user.passwordHash))) return { ok: false, error: "Current password doesn't match." };
    const db = await getDb();
    await db.update(schema.users).set({ passwordHash: await hashPassword(parsed.next) }).where(eq(schema.users.id, user.id));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
