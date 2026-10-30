import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addMonths, monthOf, type ISODate, type Month } from "./dates";
import type { BudgetLite, CatLite, GoalLite, SubLite, TxLite } from "./calc";

export interface HouseholdData {
  members: schema.User[];
  categories: schema.Category[];
  subcategories: schema.Subcategory[];
  budgets: BudgetLite[];
  goals: schema.Goal[];
  recurring: schema.Recurring[];
  /** Transactions from `historyStart` onward, plus every goal transaction (for goal totals). */
  txs: schema.Transaction[];
  historyStart: ISODate;
}

const HISTORY_MONTHS = 24;

/**
 * Everything the screens need for a household, in a handful of indexed queries.
 * Memoized per request so the layout and the page share one load.
 */
export const loadHousehold = cache(async (householdId: string, today: ISODate): Promise<HouseholdData> => {
  const db = await getDb();
  const historyStart: ISODate = `${addMonths(monthOf(today), -HISTORY_MONTHS)}-01`;
  const [members, categories, subcategories, budgets, goals, recurring, txs] = await Promise.all([
    db.query.users.findMany({ where: eq(schema.users.householdId, householdId), orderBy: asc(schema.users.createdAt) }),
    db.query.categories.findMany({
      where: eq(schema.categories.householdId, householdId),
      orderBy: [asc(schema.categories.sortOrder), asc(schema.categories.name)],
    }),
    db.query.subcategories.findMany({
      where: eq(schema.subcategories.householdId, householdId),
      orderBy: [asc(schema.subcategories.sortOrder), asc(schema.subcategories.name)],
    }),
    db.query.budgets.findMany({ where: eq(schema.budgets.householdId, householdId) }),
    db.query.goals.findMany({
      where: eq(schema.goals.householdId, householdId),
      orderBy: [asc(schema.goals.sortOrder), asc(schema.goals.createdAt)],
    }),
    db.query.recurring.findMany({ where: eq(schema.recurring.householdId, householdId), orderBy: asc(schema.recurring.dayOfMonth) }),
    db.query.transactions.findMany({
      where: and(
        eq(schema.transactions.householdId, householdId),
        or(gte(schema.transactions.date, historyStart), eq(schema.transactions.type, "goal")),
      ),
      orderBy: [desc(schema.transactions.date), desc(schema.transactions.createdAt)],
    }),
  ]);
  return {
    members,
    categories,
    subcategories,
    budgets: budgets.map((b) => ({ categoryId: b.categoryId, month: b.month, plannedCents: b.plannedCents })),
    goals,
    recurring,
    txs,
    historyStart,
  };
});

export function toTxLite(t: schema.Transaction): TxLite {
  return {
    id: t.id,
    type: t.type,
    amountCents: t.amountCents,
    date: t.date,
    categoryId: t.categoryId,
    subcategoryId: t.subcategoryId,
    goalId: t.goalId,
    userId: t.userId,
  };
}

export function toSubLite(s: schema.Subcategory): SubLite {
  return { id: s.id, categoryId: s.categoryId, name: s.name, archived: s.archived, sortOrder: s.sortOrder };
}

export function toCatLite(c: schema.Category): CatLite {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    kind: c.kind,
    group: c.group,
    isFixed: c.isFixed,
    rollover: c.rollover,
    blsKey: c.blsKey,
    archived: c.archived,
    sortOrder: c.sortOrder,
  };
}

export function toGoalLite(g: schema.Goal): GoalLite {
  return {
    id: g.id,
    name: g.name,
    icon: g.icon,
    targetCents: g.targetCents,
    monthlyPlanCents: g.monthlyPlanCents,
    deadline: g.deadline,
    isEmergency: g.isEmergency,
    isTithe: g.isTithe,
    startingCents: g.startingCents,
    archived: g.archived,
  };
}

/** Resolve the month a screen shows from `?m=`; defaults to the current month. */
export function resolveMonth(param: string | string[] | undefined, today: ISODate): Month {
  const m = Array.isArray(param) ? param[0] : param;
  return m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : monthOf(today);
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
