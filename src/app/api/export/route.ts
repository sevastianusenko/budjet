import { and, asc, eq, gte, lte } from "drizzle-orm";
import { isValidISODate } from "@/lib/dates";
import { getDb, schema } from "@/db";
import { getViewer } from "@/lib/auth";

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Sign in first.", { status: 401 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const range = [
    eq(schema.transactions.householdId, viewer.household.id),
    ...(from && isValidISODate(from) ? [gte(schema.transactions.date, from)] : []),
    ...(to && isValidISODate(to) ? [lte(schema.transactions.date, to)] : []),
  ];
  const db = await getDb();
  const [txs, cats, subs, goals, members] = await Promise.all([
    db.query.transactions.findMany({ where: and(...range), orderBy: asc(schema.transactions.date) }),
    db.query.categories.findMany({ where: eq(schema.categories.householdId, viewer.household.id) }),
    db.query.subcategories.findMany({ where: eq(schema.subcategories.householdId, viewer.household.id) }),
    db.query.goals.findMany({ where: eq(schema.goals.householdId, viewer.household.id) }),
    db.query.users.findMany({ where: eq(schema.users.householdId, viewer.household.id) }),
  ]);
  const cat = new Map(cats.map((c) => [c.id, c]));
  const sub = new Map(subs.map((s) => [s.id, s.name]));
  const goal = new Map(goals.map((g) => [g.id, g.name]));
  const member = new Map(members.map((m) => [m.id, m.name]));

  const header = ["date", "type", "amount", "category", "subcategory", "bucket", "goal", "member", "note"];
  const lines = [header.join(",")];
  for (const t of txs) {
    const c = t.categoryId ? cat.get(t.categoryId) : undefined;
    lines.push(
      [
        t.date,
        t.type,
        (t.amountCents / 100).toFixed(2),
        c?.name ?? "",
        t.subcategoryId ? sub.get(t.subcategoryId) ?? "" : "",
        c?.group ?? (t.type === "goal" ? "savings" : ""),
        t.goalId ? goal.get(t.goalId) ?? "" : "",
        member.get(t.userId) ?? "",
        t.note,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const body = "﻿" + lines.join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hearth-${from && to ? `${from}_${to}` : viewer.today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
