import type { HouseholdData } from "./queries";
import { plannedFor, spentFor, summarizeMonth, titheGoalIds, type GoalLite, type MonthSummary } from "./calc";
import { toCatLite, toGoalLite, toTxLite } from "./queries";
import { monthLabel, type ISODate } from "./dates";
import type { Period } from "./period";

export interface ReportCategory {
  id: string;
  name: string;
  icon: string;
  group: string;
  planned: number;
  spent: number;
  share: number;
  byMonth: number[];
  subs: { name: string; spent: number }[];
}

export interface Report {
  period: Period;
  generated: ISODate;
  householdName: string;
  totals: {
    income: number;
    spent: number;
    needWant: number;
    business: number;
    saved: number;
    goalContributions: number;
    titheSetAside: number;
    titheGiven: number;
    savingsRate: number | null;
    entries: number;
  };
  split: { label: string; actual: number; share: number; targetShare: number | null; color: string }[];
  months: { month: string; label: string; income: number; spent: number; saved: number; rate: number | null }[];
  categories: ReportCategory[];
  goals: { name: string; icon: string; savedAtEnd: number; contributed: number; target: number; isTithe: boolean }[];
  members: { name: string; color: string; spent: number; income: number; count: number }[];
  top: { date: ISODate; name: string; sub: string | null; note: string; amount: number; member: string }[];
  receipts: number;
}

export function buildReport(
  data: HouseholdData,
  household: { name: string; expectedIncomeCents: number; needsPct: number; wantsPct: number; savingsPct: number; tithePct: number },
  period: Period,
  today: ISODate,
): Report {
  const txs = data.txs.map(toTxLite);
  const cats = data.categories.map(toCatLite);
  const goals: GoalLite[] = data.goals.map(toGoalLite);
  const targets = { needs: household.needsPct, wants: household.wantsPct, savings: household.savingsPct };

  const summaries: MonthSummary[] = period.months.map((month) =>
    summarizeMonth({ month, today, txs, cats, budgets: data.budgets, goals, expectedIncomeCents: household.expectedIncomeCents, targets, tithePct: household.tithePct }),
  );
  const sum = (f: (s: MonthSummary) => number) => summaries.reduce((a, s) => a + f(s), 0);
  const inPeriod = (d: string) => d >= period.start && d <= period.end;
  const periodTx = txs.filter((t) => inPeriod(t.date));

  const income = sum((s) => s.income);
  const needWant = sum((s) => s.needWantSpent);
  const business = sum((s) => s.businessSpent);
  const spent = sum((s) => s.spent);
  const saved = sum((s) => s.savedExplicit);
  const need = sum((s) => s.split.need.actual);
  const want = sum((s) => s.split.want.actual);
  const savingsPart = sum((s) => s.split.savings.actual);
  const incomeRef = income > 0 ? income : household.expectedIncomeCents * period.months.length;

  const categories: ReportCategory[] = cats
    .filter((c) => c.kind === "expense")
    .map((c) => {
      const byMonth = period.months.map((m) => spentFor(txs, c.id, m));
      const catSpent = byMonth.reduce((a, b) => a + b, 0);
      const planned = period.months.reduce((a, m) => a + plannedFor(data.budgets, c.id, m), 0);
      const subMap = new Map<string, number>();
      for (const t of periodTx) {
        if (t.type !== "expense" || t.categoryId !== c.id) continue;
        const name = t.subcategoryId ? data.subcategories.find((s) => s.id === t.subcategoryId)?.name ?? "Removed" : "No subcategory";
        subMap.set(name, (subMap.get(name) ?? 0) + t.amountCents);
      }
      const subs = [...subMap.entries()].map(([name, v]) => ({ name, spent: v })).sort((a, b) => b.spent - a.spent);
      return { id: c.id, name: c.name, icon: c.icon, group: c.group, planned, spent: catSpent, share: spent > 0 ? catSpent / spent : 0, byMonth, subs: subs.length > 1 || subs[0]?.name !== "No subcategory" ? subs : [] };
    })
    .filter((c) => c.spent > 0 || c.planned > 0)
    .sort((a, b) => groupOrder(a.group) - groupOrder(b.group) || b.spent - a.spent);

  const titheIds = titheGoalIds(goals);
  const goalRows = goals
    .filter((g) => !g.archived)
    .map((g) => {
      const mine = txs.filter((t) => t.type === "goal" && t.goalId === g.id);
      return {
        name: g.name,
        icon: g.icon,
        savedAtEnd: g.startingCents + mine.filter((t) => t.date <= period.end).reduce((a, t) => a + t.amountCents, 0),
        contributed: mine.filter((t) => inPeriod(t.date)).reduce((a, t) => a + t.amountCents, 0),
        target: g.targetCents,
        isTithe: titheIds.has(g.id),
      };
    });

  const memberMap = new Map<string, { spent: number; income: number; count: number }>();
  for (const t of periodTx) {
    const m = memberMap.get(t.userId) ?? { spent: 0, income: 0, count: 0 };
    if (t.type === "expense") m.spent += t.amountCents;
    if (t.type === "income") m.income += t.amountCents;
    m.count += 1;
    memberMap.set(t.userId, m);
  }
  const members = data.members
    .map((m) => ({ name: m.name, color: m.color, ...(memberMap.get(m.id) ?? { spent: 0, income: 0, count: 0 }) }))
    .filter((m) => m.count > 0);

  const top = data.txs
    .filter((t) => t.type === "expense" && inPeriod(t.date))
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 10)
    .map((t) => ({
      date: t.date,
      name: data.categories.find((c) => c.id === t.categoryId)?.name ?? "Uncategorized",
      sub: t.subcategoryId ? data.subcategories.find((s) => s.id === t.subcategoryId)?.name ?? null : null,
      note: t.note,
      amount: t.amountCents,
      member: data.members.find((m) => m.id === t.userId)?.name ?? "",
    }));

  return {
    period,
    generated: today,
    householdName: household.name,
    totals: {
      income,
      spent,
      needWant,
      business,
      saved,
      goalContributions: sum((s) => s.goalContributions),
      titheSetAside: sum((s) => s.titheSetAside),
      titheGiven: sum((s) => s.titheGiven),
      savingsRate: income > 0 ? (income - needWant - business) / income : null,
      entries: periodTx.length,
    },
    split: [
      { label: "Needs", actual: need, share: incomeRef > 0 ? need / incomeRef : 0, targetShare: household.needsPct / 100, color: "var(--need)" },
      { label: "Wants", actual: want, share: incomeRef > 0 ? want / incomeRef : 0, targetShare: household.wantsPct / 100, color: "var(--want)" },
      { label: "Saving", actual: savingsPart, share: incomeRef > 0 ? savingsPart / incomeRef : 0, targetShare: household.savingsPct / 100, color: "var(--save)" },
      ...(business > 0 ? [{ label: "Business", actual: business, share: incomeRef > 0 ? business / incomeRef : 0, targetShare: null, color: "var(--ink-3)" }] : []),
    ],
    months: summaries.map((s) => ({ month: s.month, label: monthLabel(s.month, "short"), income: s.income, spent: s.spent, saved: s.savedExplicit, rate: s.savingsRate })),
    categories,
    goals: goalRows,
    members,
    top,
    receipts: data.receipts.filter((r) => inPeriod(r.date)).length,
  };
}

function groupOrder(g: string): number {
  return { need: 0, want: 1, savings: 2, business: 3 }[g] ?? 4;
}
