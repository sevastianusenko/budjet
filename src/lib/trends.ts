import { dayOf, daysInMonth, lastMonths, monthLabel, monthOf, type ISODate, type Month } from "./dates";
import { inMonth, monthSeries, type BudgetLite, type CatLite, type GoalLite, type Group, type MonthPoint, type SubLite, type TxLite } from "./calc";
import type { Insight } from "./insights";

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const mean = (ns: number[]) => (ns.length ? sum(ns) / ns.length : 0);

/* ---------- Window ---------- */

export type WindowKey = "3" | "6" | "12" | "all";

export function parseWindow(v: string | string[] | undefined): WindowKey {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "3" || s === "12" || s === "all" ? s : "6";
}

/** Months ending at `end` for the chosen window. "all" means everything loaded (24 months). */
export function windowMonths(end: Month, key: WindowKey, maxMonths = 24): Month[] {
  return lastMonths(end, key === "all" ? maxMonths : Number(key));
}

/** Drop leading months with no data, but keep at least `min` months so charts have a shape. */
export function trimToData(points: MonthPoint[], min = 3): MonthPoint[] {
  const first = points.findIndex((p) => p.income > 0 || p.spent > 0 || p.goalContributions > 0);
  if (first === -1) return points.slice(-1);
  return points.slice(Math.max(0, Math.min(first, points.length - min)));
}

/* ---------- Category trends ---------- */

export interface CategoryTrend {
  id: string;
  name: string;
  icon: string;
  group: Group;
  /** One value per point in the window, current month included. */
  series: number[];
  /** Over every month in the window, current month included. */
  total: number;
  /** Average and last value over full months only. */
  avg: number;
  last: number;
  deltaPct: number | null;
  /** Consecutive month-over-month increases ending at the last full month. */
  streak: number;
}

export function categoryTrends(points: MonthPoint[], cats: CatLite[], currentMonth: Month, top = 6): CategoryTrend[] {
  const full = points.filter((p) => p.month < currentMonth);
  const base = full.length >= 2 ? full : points;
  const totals = new Map<string, number>();
  for (const p of base) for (const [id, v] of Object.entries(p.byCategory)) totals.set(id, (totals.get(id) ?? 0) + v);
  return [...totals.entries()]
    .map(([id, total]) => ({ id, total, cat: cats.find((c) => c.id === id) }))
    .filter((x): x is { id: string; total: number; cat: CatLite } => !!x.cat && x.cat.kind === "expense" && x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, top)
    .map(({ id, cat }) => {
      const series = points.map((p) => p.byCategory[id] ?? 0);
      const fullSeries = base.map((p) => p.byCategory[id] ?? 0);
      const avg = Math.round(mean(fullSeries));
      const last = fullSeries[fullSeries.length - 1] ?? 0;
      let streak = 0;
      for (let i = fullSeries.length - 1; i > 0 && fullSeries[i] > fullSeries[i - 1]; i--) streak++;
      return { id, name: cat.name, icon: cat.icon, group: cat.group, series, total: sum(series), avg, last, deltaPct: avg > 0 ? last / avg - 1 : null, streak };
    });
}

export interface SubSeries {
  id: string | null;
  name: string;
  series: number[];
  total: number;
}

/** A category's spending per month, split by subcategory (which car, which child, which kind of food). */
export function subcategorySeries(categoryId: string, months: Month[], txs: TxLite[], subs: SubLite[]): SubSeries[] {
  const mine = txs.filter((t) => t.type === "expense" && t.categoryId === categoryId);
  const ids = new Set(mine.map((t) => t.subcategoryId));
  return [...ids]
    .map((sid) => {
      const series = months.map((m) => sum(mine.filter((t) => t.subcategoryId === sid && inMonth(t, m)).map((t) => t.amountCents)));
      return { id: sid, name: sid === null ? "No subcategory" : subs.find((s) => s.id === sid)?.name ?? "Subcategory", series, total: sum(series) };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);
}

/* ---------- Fixed vs flexible ---------- */

export interface FixedFlexPoint {
  month: Month;
  /** Fixed bills: categories marked fixed (rent, car, insurance, subscriptions, debt) plus tithe set-asides. */
  fixed: number;
  flexNeed: number;
  want: number;
  business: number;
  income: number;
}

export function fixedFlexSeries(months: Month[], txs: TxLite[], cats: CatLite[], titheIds: Set<string>): FixedFlexPoint[] {
  const catById = new Map(cats.map((c) => [c.id, c]));
  return months.map((month) => {
    const p: FixedFlexPoint = { month, fixed: 0, flexNeed: 0, want: 0, business: 0, income: 0 };
    for (const t of txs) {
      if (!inMonth(t, month)) continue;
      if (t.type === "income") p.income += t.amountCents;
      else if (t.type === "goal") {
        if (titheIds.has(t.goalId ?? "") && t.amountCents > 0) p.fixed += t.amountCents;
      } else {
        const c = catById.get(t.categoryId ?? "");
        const g = c?.group ?? "want";
        if (g === "business") p.business += t.amountCents;
        else if (c?.isFixed && (g === "need" || g === "want")) p.fixed += t.amountCents;
        else if (g === "need") p.flexNeed += t.amountCents;
        else if (g === "savings") continue; // saving is not spending here
        else p.want += t.amountCents;
      }
    }
    return p;
  });
}

/* ---------- Income by source ---------- */

export interface IncomeSource {
  id: string;
  name: string;
  icon: string;
  total: number;
}

export interface IncomePoint {
  month: Month;
  bySource: Record<string, number>;
  total: number;
}

export function incomeBySource(months: Month[], txs: TxLite[], cats: CatLite[]): { points: IncomePoint[]; sources: IncomeSource[] } {
  const totals = new Map<string, number>();
  const points = months.map((month) => {
    const p: IncomePoint = { month, bySource: {}, total: 0 };
    for (const t of txs) {
      if (t.type !== "income" || !inMonth(t, month)) continue;
      const id = t.categoryId ?? "other";
      p.bySource[id] = (p.bySource[id] ?? 0) + t.amountCents;
      p.total += t.amountCents;
      totals.set(id, (totals.get(id) ?? 0) + t.amountCents);
    }
    return p;
  });
  const sources = [...totals.entries()]
    .map(([id, total]) => {
      const c = cats.find((x) => x.id === id);
      return { id, name: c?.name ?? "Other income", icon: c?.icon ?? "Banknote", total };
    })
    .sort((a, b) => b.total - a.total);
  return { points, sources };
}

/* ---------- Year in review ---------- */

export interface YearPoint {
  month: Month;
  income: number;
  /** Needs + wants + business. */
  spent: number;
  /** income − spent, null for months without income or in the future. */
  kept: number | null;
  future: boolean;
}

export interface YearTotals {
  year: string;
  months: number;
  income: number;
  spent: number;
  kept: number;
  toGoals: number;
  savingsRate: number | null;
}

function yearTotals(year: string, points: MonthPoint[]): YearTotals {
  const withData = points.filter((p) => p.income > 0 || p.spent > 0 || p.goalContributions > 0);
  const income = sum(withData.map((p) => p.income));
  const spent = sum(withData.map((p) => p.need + p.want + p.business));
  return {
    year,
    months: withData.length,
    income,
    spent,
    kept: income - spent,
    toGoals: sum(withData.map((p) => p.goalContributions + p.savings)),
    savingsRate: income > 0 ? (income - spent) / income : null,
  };
}

export function yearReview(year: string, txs: TxLite[], cats: CatLite[], titheIds: Set<string>, today: ISODate): { points: YearPoint[]; totals: YearTotals; prev: YearTotals | null } {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const current = monthOf(today);
  const series = monthSeries(months, txs, cats, titheIds);
  const points = series.map((p) => {
    const future = p.month > current;
    const spent = p.need + p.want + p.business;
    return { month: p.month, income: p.income, spent, kept: future || p.income <= 0 ? null : p.income - spent, future };
  });
  const prevYear = String(Number(year) - 1);
  const prevMonths = Array.from({ length: 12 }, (_, i) => `${prevYear}-${String(i + 1).padStart(2, "0")}`);
  const prevTotals = yearTotals(prevYear, monthSeries(prevMonths, txs, cats, titheIds));
  return { points, totals: yearTotals(year, series), prev: prevTotals.months > 0 ? prevTotals : null };
}

/* ---------- Plan vs actual ---------- */

export interface BudgetPoint {
  month: Month;
  planned: number;
  spent: number;
}

/** Planned (sum of category plans for needs and wants) next to what was spent, per month. */
export function budgetVsActual(points: MonthPoint[], budgets: BudgetLite[], cats: CatLite[]): BudgetPoint[] {
  const planCats = new Set(cats.filter((c) => c.kind === "expense" && (c.group === "need" || c.group === "want")).map((c) => c.id));
  return points.map((p) => ({
    month: p.month,
    planned: sum(budgets.filter((b) => b.month === p.month && planCats.has(b.categoryId)).map((b) => b.plannedCents)),
    spent: p.need + p.want,
  }));
}

/* ---------- Window totals, rules of thumb ---------- */

export interface WindowTotals {
  months: number;
  income: number;
  need: number;
  want: number;
  business: number;
  savingsGroup: number;
  goalContributions: number;
  titheSetAside: number;
  byCategory: Record<string, number>;
  byBls: Record<string, number>;
  byName: Record<string, number>;
}

/** Sums over the full months of the window (the current month is left out so ratios are not skewed). */
export function windowTotals(points: MonthPoint[], cats: CatLite[], txs: TxLite[], titheIds: Set<string>, currentMonth: Month): WindowTotals {
  const full = points.filter((p) => p.month < currentMonth && (p.income > 0 || p.spent > 0));
  const use = full.length ? full : points;
  const t: WindowTotals = { months: use.length, income: 0, need: 0, want: 0, business: 0, savingsGroup: 0, goalContributions: 0, titheSetAside: 0, byCategory: {}, byBls: {}, byName: {} };
  for (const p of use) {
    t.income += p.income;
    t.need += p.need;
    t.want += p.want;
    t.business += p.business;
    t.savingsGroup += p.savings;
    t.goalContributions += p.goalContributions;
    for (const [id, v] of Object.entries(p.byCategory)) {
      t.byCategory[id] = (t.byCategory[id] ?? 0) + v;
      const c = cats.find((x) => x.id === id);
      if (c?.blsKey) t.byBls[c.blsKey] = (t.byBls[c.blsKey] ?? 0) + v;
      if (c) t.byName[c.name] = (t.byName[c.name] ?? 0) + v;
    }
    t.titheSetAside += sum(txs.filter((x) => x.type === "goal" && titheIds.has(x.goalId ?? "") && x.amountCents > 0 && inMonth(x, p.month)).map((x) => x.amountCents));
  }
  return t;
}

export interface Rule {
  id: string;
  label: string;
  /** e.g. "≤ 30% of income" */
  guide: string;
  /** Your value as a fraction of income (or months for the emergency fund). */
  value: number | null;
  /** The guideline threshold in the same unit as value. */
  limit: number;
  kind: "max" | "min";
  unit: "pct" | "months";
  status: "good" | "watch" | "bad" | "none";
  why: string;
}

function judge(value: number | null, limit: number, kind: "max" | "min"): Rule["status"] {
  if (value === null) return "none";
  if (kind === "max") return value <= limit ? "good" : value <= limit * 1.15 ? "watch" : "bad";
  return value >= limit ? "good" : value >= limit * 0.75 ? "watch" : "bad";
}

export function rulesOfThumb(t: WindowTotals, efMonths: number | null): Rule[] {
  const inc = t.income;
  const pct = (cents: number) => (inc > 0 ? cents / inc : null);
  const bls = (k: string) => t.byBls[k] ?? 0;
  const housing = pct(bls("shelter"));
  const transport = pct(bls("transport_vehicle") + bls("transport_gas"));
  const food = pct(bls("food_home") + bls("food_away"));
  const debtLoad = pct(bls("shelter") + bls("transport_vehicle") + (t.byName["Debt Payments"] ?? 0));
  const savingsRate = inc > 0 ? (inc - t.need - t.want - t.business) / inc : null;
  return [
    { id: "housing", label: "Housing", guide: "≤ 30% of income", value: housing, limit: 0.3, kind: "max", unit: "pct", status: judge(housing, 0.3, "max"), why: "Rent or mortgage above 30% of take-home crowds out everything else. Lenders use 28% of gross." },
    { id: "transport", label: "Transportation", guide: "≤ 15% of income", value: transport, limit: 0.15, kind: "max", unit: "pct", status: judge(transport, 0.15, "max"), why: "Car payments, insurance, gas and transit together. Cars are the most common budget leak after housing." },
    { id: "food", label: "Food", guide: "≤ 15% of income", value: food, limit: 0.15, kind: "max", unit: "pct", status: judge(food, 0.15, "max"), why: "Groceries plus restaurants. Families with kids sit near the top of this range." },
    { id: "debt", label: "Housing, car & debt payments", guide: "≤ 36% of income", value: debtLoad, limit: 0.36, kind: "max", unit: "pct", status: judge(debtLoad, 0.36, "max"), why: "The 28/36 rule: all fixed payments under 36% keeps room for surprises." },
    { id: "savings", label: "Savings rate", guide: "≥ 20% of income", value: savingsRate, limit: 0.2, kind: "min", unit: "pct", status: judge(savingsRate, 0.2, "min"), why: "What's left after needs, wants and business. 20% builds a cushion and funds retirement." },
    { id: "ef", label: "Emergency fund", guide: "3–6 months of needs", value: efMonths, limit: 3, kind: "min", unit: "months", status: judge(efMonths, 3, "min"), why: "Three months covers a job loss or a big repair; six is comfortable." },
  ];
}

/* ---------- Partial month ---------- */

/** A month's totals counting only entries dated on or before `day`, so a month in progress can be compared fairly. */
export function monthThroughDay(month: Month, day: number, txs: TxLite[], cats: CatLite[], titheIds: Set<string>): MonthPoint {
  return monthSeries([month], txs.filter((t) => !inMonth(t, month) || dayOf(t.date) <= day), cats, titheIds)[0];
}

/* ---------- Running balance ---------- */

export interface DayBalance {
  day: number;
  /** Cumulative through this day. */
  income: number;
  /** Needs, wants and business spending plus tithe set-asides, the same "spent" that "kept" uses. */
  spent: number;
  /** Moved into goals or spent in saving categories: kept, not spent. */
  saved: number;
  /** income minus spent. */
  net: number;
}

/**
 * The month's running balance, day by day: income received so far minus money spent so far.
 * Moves into goals are transfers, so they stay in the balance and are reported in `saved`.
 * `throughDay` stops the series early for a month still in progress.
 */
export function dailyBalance(month: Month, txs: TxLite[], cats: CatLite[], titheIds: Set<string>, throughDay = daysInMonth(month)): DayBalance[] {
  const catById = new Map(cats.map((c) => [c.id, c]));
  const last = Math.max(0, Math.min(throughDay, daysInMonth(month)));
  const income = new Array<number>(last + 1).fill(0);
  const spent = new Array<number>(last + 1).fill(0);
  const saved = new Array<number>(last + 1).fill(0);
  for (const t of txs) {
    if (!inMonth(t, month)) continue;
    const d = dayOf(t.date);
    if (d < 1 || d > last) continue;
    if (t.type === "income") income[d] += t.amountCents;
    else if (t.type === "goal") {
      if (titheIds.has(t.goalId ?? "")) {
        if (t.amountCents > 0) spent[d] += t.amountCents;
      } else saved[d] += t.amountCents;
    } else if ((catById.get(t.categoryId ?? "")?.group ?? "want") === "savings") saved[d] += t.amountCents;
    else spent[d] += t.amountCents;
  }
  const out: DayBalance[] = [];
  let inc = 0;
  let sp = 0;
  let sv = 0;
  for (let d = 1; d <= last; d++) {
    inc += income[d];
    sp += spent[d];
    sv += saved[d];
    out.push({ day: d, income: inc, spent: sp, saved: sv, net: inc - sp });
  }
  return out;
}

/* ---------- Pie ---------- */

export interface PieSlice {
  id: string;
  name: string;
  group: Group | "other";
  value: number;
  share: number;
}

export function pieSlices(byCategory: Record<string, number>, cats: CatLite[], max = 8): PieSlice[] {
  const rows = Object.entries(byCategory)
    .map(([id, value]) => ({ id, value, cat: cats.find((c) => c.id === id) }))
    .filter((r) => r.value > 0 && r.cat)
    .sort((a, b) => b.value - a.value);
  const total = sum(rows.map((r) => r.value));
  if (total === 0) return [];
  const head = rows.slice(0, max);
  const tail = rows.slice(max);
  const out: PieSlice[] = head.map((r) => ({ id: r.id, name: r.cat!.name, group: r.cat!.group, value: r.value, share: r.value / total }));
  if (tail.length) {
    const v = sum(tail.map((r) => r.value));
    out.push({ id: "other", name: `Everything else (${tail.length})`, group: "other", value: v, share: v / total });
  }
  return out;
}

/* ---------- Giving ---------- */

export interface GivingPoint {
  month: Month;
  /** Moved into the tithe fund. */
  setAside: number;
  /** Given out of the fund. */
  fromFund: number;
  /** Given from your own money (expenses in giving categories). */
  extra: number;
  fundBalance: number;
  income: number;
}

export function givingSeries(months: Month[], txs: TxLite[], cats: CatLite[], goals: GoalLite[]): { points: GivingPoint[]; totals: { setAside: number; given: number; income: number } } {
  const titheGoals = goals.filter((g) => g.isTithe);
  const titheIds = new Set(titheGoals.map((g) => g.id));
  const givingCats = new Set(cats.filter((c) => c.kind === "expense" && c.blsKey === "giving").map((c) => c.id));
  const starting = sum(titheGoals.map((g) => g.startingCents));
  const points = months.map((month) => {
    const p: GivingPoint = { month, setAside: 0, fromFund: 0, extra: 0, fundBalance: 0, income: 0 };
    for (const t of txs) {
      if (!inMonth(t, month)) continue;
      if (t.type === "income") p.income += t.amountCents;
      else if (t.type === "goal" && titheIds.has(t.goalId ?? "")) {
        if (t.amountCents > 0) p.setAside += t.amountCents;
        else p.fromFund += -t.amountCents;
      } else if (t.type === "expense" && givingCats.has(t.categoryId ?? "")) p.extra += t.amountCents;
    }
    p.fundBalance = starting + sum(txs.filter((t) => t.type === "goal" && titheIds.has(t.goalId ?? "") && monthOf(t.date) <= month).map((t) => t.amountCents));
    return p;
  });
  return { points, totals: { setAside: sum(points.map((p) => p.setAside)), given: sum(points.map((p) => p.fromFund + p.extra)), income: sum(points.map((p) => p.income)) } };
}

/* ---------- Business ---------- */

export interface BusinessPoint {
  month: Month;
  income: number;
  expenses: number;
  net: number;
}

export function businessSeries(months: Month[], txs: TxLite[], cats: CatLite[]): { points: BusinessPoint[]; totals: { income: number; expenses: number; net: number }; used: boolean } {
  const expenseCats = new Set(cats.filter((c) => c.kind === "expense" && c.group === "business").map((c) => c.id));
  const incomeCats = new Set(cats.filter((c) => c.kind === "income" && /business/i.test(c.name)).map((c) => c.id));
  const points = months.map((month) => {
    let income = 0;
    let expenses = 0;
    for (const t of txs) {
      if (!inMonth(t, month)) continue;
      if (t.type === "income" && incomeCats.has(t.categoryId ?? "")) income += t.amountCents;
      else if (t.type === "expense" && expenseCats.has(t.categoryId ?? "")) expenses += t.amountCents;
    }
    return { month, income, expenses, net: income - expenses };
  });
  const income = sum(points.map((p) => p.income));
  const expenses = sum(points.map((p) => p.expenses));
  return { points, totals: { income, expenses, net: income - expenses }, used: income > 0 || expenses > 0 };
}

/* ---------- Trend insights ---------- */

export interface TrendCtx {
  points: MonthPoint[];
  currentMonth: Month;
  trends: CategoryTrend[];
  fixedShare: number | null;
  targetSavings: number;
  efMonths: number | null;
  /** Average monthly contribution to the emergency fund over the window. */
  efMonthlyAvg: number;
  /** One month of needs, the unit the emergency fund is measured in. */
  monthlyNeeds: number;
}

const TONE_RANK = { act: 0, watch: 1, info: 2, good: 3 } as const;

/** Observations about the window, not the month: streaks, drifts, ratios. Ordered act → watch → info → good. */
export function trendInsights(ctx: TrendCtx): Insight[] {
  const out: Insight[] = [];
  const full = ctx.points.filter((p) => p.month < ctx.currentMonth && (p.income > 0 || p.spent > 0));
  const n = full.length;

  for (const t of ctx.trends) {
    if (t.streak >= 3 && t.deltaPct !== null && t.deltaPct >= 0.1) {
      out.push({ id: `streak-${t.id}`, tone: "watch", title: `${t.name} has grown ${t.streak} months in a row`, body: `Last full month ${Math.round(t.deltaPct * 100)}% above its ${n}-month average. Creep like this is easiest to catch early.`, href: `/plan` });
    } else if (t.deltaPct !== null && t.deltaPct >= 0.3 && t.last - t.avg >= 5000) {
      out.push({ id: `high-${t.id}`, tone: "info", title: `${t.name}: highest month in this window`, body: `${Math.round(t.deltaPct * 100)}% above its average. One-off or new normal? Tap the category to see which subcategory moved.` });
    }
  }

  if (n >= 2) {
    let below = 0;
    for (let i = full.length - 1; i >= 0; i--) {
      const r = full[i].savingsRate;
      if (r !== null && r < ctx.targetSavings) below++;
      else break;
    }
    if (below >= 2) out.push({ id: "rate-below", tone: "watch", title: `Savings rate under target ${below} months running`, body: `Target is ${Math.round(ctx.targetSavings * 100)}%. Check what grew in the month-over-month table below.` });
  }

  if (ctx.fixedShare !== null && ctx.fixedShare > 0.5) {
    out.push({ id: "fixed-high", tone: "watch", title: `Fixed bills take ${Math.round(ctx.fixedShare * 100)}% of income`, body: "Above the usual 50% ceiling. Fixed costs are the hardest to trim month to month, so this is the number that decides how much room you have." });
  }

  if (n >= 3) {
    const last = full[n - 1];
    const avgIncome = mean(full.slice(0, -1).map((p) => p.income));
    if (avgIncome > 0 && last.income < avgIncome * 0.85) {
      out.push({ id: "income-dip", tone: "watch", title: `${monthLabel(last.month, "short")} income was ${Math.round((1 - last.income / avgIncome) * 100)}% below usual`, body: "Make sure every paycheck and side income got logged; if it is real, plans for the next month should shrink with it." });
    }
    const negatives = full.slice(-2).filter((p) => p.income > 0 && p.income - p.need - p.want - p.business < 0).length;
    if (negatives === 2) out.push({ id: "kept-neg", tone: "act", title: "Two months in a row spending beat income", body: "That is the trend to break first. Fixed costs and the biggest movers below show where." });
  }

  if (ctx.efMonths !== null && ctx.efMonths < 3 && ctx.efMonthlyAvg > 0 && ctx.monthlyNeeds > 0) {
    const need = 3 * ctx.monthlyNeeds - ctx.efMonths * ctx.monthlyNeeds;
    const months = Math.ceil(need / ctx.efMonthlyAvg);
    if (months > 0 && months < 60) out.push({ id: "ef-eta", tone: "info", title: `Emergency fund hits 3 months in about ${months} month${months === 1 ? "" : "s"}`, body: `At the current pace of ${Math.round(ctx.efMonthlyAvg / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} a month. Bumping it even a little moves the date.`, href: "/goals" });
  }

  if (n >= 2) {
    const kept = full.filter((p) => p.income > 0).map((p) => p.income - p.need - p.want - p.business);
    const avgKept = mean(kept);
    if (kept.length >= 2 && avgKept > 0 && !out.some((i) => i.tone === "act")) {
      out.push({ id: "kept-avg", tone: "good", title: `You keep about ${Math.round(avgKept / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} a month`, body: `Over ${kept.length} full months. Give that money a job in a goal so it does not drift back into spending.`, href: "/goals" });
    }
  }

  return out.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
}
