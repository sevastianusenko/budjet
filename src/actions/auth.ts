"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clearSession, createSession } from "@/lib/session";
import { DEFAULT_CATEGORIES, DEFAULT_SUBCATEGORIES, MEMBER_COLORS } from "@/lib/defaults";

export type ActionResult = { ok: true } | { ok: false; error: string };

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(8, "Use at least 8 characters.").max(200);
const name = z.string().trim().min(1, "Tell us your first name.").max(60);

function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

const signUpSchema = z.object({
  name,
  email,
  password,
  householdName: z.string().trim().min(1, "Give your household a name.").max(60),
});

export async function signUp(raw: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const input = parsed.data;
  const db = await getDb();

  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
  if (existing) return { ok: false, error: "That email already has an account. Sign in instead." };

  const [household] = await db
    .insert(schema.households)
    .values({ name: input.householdName, inviteCode: inviteCode() })
    .returning();

  const [user] = await db
    .insert(schema.users)
    .values({
      householdId: household.id,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      color: MEMBER_COLORS[0],
      role: "owner",
    })
    .returning();

  const createdCats = await db
    .insert(schema.categories)
    .values(
      DEFAULT_CATEGORIES.map((c, i) => ({
        householdId: household.id,
        name: c.name,
        icon: c.icon,
        kind: c.kind,
        group: c.group,
        isFixed: c.isFixed,
        rollover: c.rollover,
        blsKey: c.blsKey,
        sortOrder: i,
      })),
    )
    .returning({ id: schema.categories.id, name: schema.categories.name });
  const subRows = createdCats.flatMap((c) =>
    (DEFAULT_SUBCATEGORIES[c.name] ?? []).map((name, i) => ({ householdId: household.id, categoryId: c.id, name, sortOrder: i })),
  );
  if (subRows.length) await db.insert(schema.subcategories).values(subRows);

  await createSession({ uid: user.id, hid: household.id });
  redirect("/onboarding");
}

const joinSchema = z.object({
  name,
  email,
  password,
  inviteCode: z.string().trim().toUpperCase().length(6, "Invite codes are 6 characters."),
});

export async function joinHousehold(raw: unknown): Promise<ActionResult> {
  const parsed = joinSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const input = parsed.data;
  const db = await getDb();

  const household = await db.query.households.findFirst({ where: eq(schema.households.inviteCode, input.inviteCode) });
  if (!household) return { ok: false, error: "No household matches that invite code. Check it with whoever invited you." };

  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
  if (existing) return { ok: false, error: "That email already has an account. Sign in instead." };

  const members = await db.query.users.findMany({ where: eq(schema.users.householdId, household.id) });
  const used = new Set(members.map((m) => m.color));
  const color = MEMBER_COLORS.find((c) => !used.has(c)) ?? MEMBER_COLORS[members.length % MEMBER_COLORS.length];

  const [user] = await db
    .insert(schema.users)
    .values({
      householdId: household.id,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      color,
      role: "member",
    })
    .returning();

  await createSession({ uid: user.id, hid: household.id });
  redirect("/home");
}

const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });

export async function signIn(raw: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, parsed.data.email) });
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) return { ok: false, error: "Email or password doesn't match." };
  await createSession({ uid: user.id, hid: user.householdId });
  redirect("/home");
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect("/login");
}
