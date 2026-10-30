import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { readSession } from "./session";
import { DEFAULT_TZ, todayIn } from "./dates";

export interface Viewer {
  user: schema.User;
  household: schema.Household;
  tz: string;
  today: string;
}

/** Current signed-in user + household, or null. Memoized per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession();
  if (!session) return null;
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.uid) });
  if (!user || user.householdId !== session.hid) return null;
  const household = await db.query.households.findFirst({ where: eq(schema.households.id, user.householdId) });
  if (!household) return null;
  const tz = decodeURIComponent((await cookies()).get("tz")?.value ?? DEFAULT_TZ);
  return { user, household, tz, today: todayIn(tz) };
});

/** Use in pages/layouts: redirects to /login when signed out. */
export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

/** Use in server actions: throws instead of redirecting. */
export async function requireViewerForAction(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new Error("You're signed out. Please sign in again.");
  return v;
}
