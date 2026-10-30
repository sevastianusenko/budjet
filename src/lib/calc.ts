/**
 * All budget math lives here, in plain functions over plain data, so it can be
 * unit-tested and so every number in the UI can be explained.
 */
import {
  addDays,
  addMonths,
  dayOf,
  daysInMonth,
  lastMonths,
  monthOf,
  monthsBetween,
  type ISODate,
  type Month,
} from "./dates";

/** "business" is tracked apart from the 50/30/20 split. */
export type Group = "need" | "want" | "savings" | "income" | "business";
export type TxType = "expense" | "income" | "goal";

export interface TxLite {
  id: string;
  type: TxType;
  amountCents: number;
  date: ISODate;
  categoryId: string | null;
  subcategoryId: string | null;
  goalId: string | null;
  userId: string;
}

export interface SubLite {
  id: string;
  categoryId: string;
  name: string;
  archived: boolean;
  sortOrder: number;
}

export interface CatLite {
  id: string;
  name: string;
  icon: string;
  kind: "expense" | "income";
  group: Group;
  isFixed: boolean;
  rollover: boolean;
  blsKey: string | null;
  archived: boolean;
  sortOrder: number;
}

export interface BudgetLite {
  categoryId: string;
  month: Month;
  plannedCents: number;
}

export interface GoalLite {
  id: string;
  name: string;
  icon: string;
  targetCents: number;
  monthlyPlanCents: number;
  deadline: ISODate | null;
  isEmergency: boolean;
  /** The Tithe fund: income set-asides go in, giving comes out. Not savings. */
  isTithe: boolean;
  startingCents: number;
  archived: boolean;
}

export type Pace = "on" | "ahead" | "over" | "none";

export interface CategoryRow {
  cat: CatLite;
  planned: number;
  carry: number;
  /** planned + carry */
  available: number;
  spent: number;
  remaining: number;
  pace: Pace;
  expectedByToday: number;
  /** Average spent in the 3 previous months (0 when no history). */
  avg3: number;
  /** spent / avg3 - 1, or null when there is no history. */
  vsAvg: number | null;
}

export interface SplitPart {
  actual: number;
  target: number;
  /** fraction of income (expected or actual) */
  share: number;
  targetShare: number;
}

export interface MonthSummary {
  month: Month;
  today: ISODate;
  dayOfMonth: number;
  daysInMonth: number;
  daysLeft: number;
  status: "past" | "current" | "future";
  income: number;
  spent: number;
  /** Spent in need + want categories only (business excluded). */
  needWantSpent: number;
  /** Spent in business categories: shown apart from the 50/30/20 split. */
  businessSpent: number;
  /** Explicit savings: goal contributions (net, tithe fund excluded) + spending in "savings" categories. */
  savedExplicit: number;
  /** Net contributions to savings goals (tithe fund excluded). */
  goalContributions: number;
  /** Set aside into the Tithe fund this month (counted as a need). */
  titheSetAside: number;
  /** Given out of the Tithe fund this month (already counted when set aside). */
  titheGiven: number;
  plannedExpenses: number;
  plannedSavingsCategories: number;
  plannedGoals: number;
  /** tithePct × expected income. */
  plannedTithe: number;
  /** Planned income (household setting) or, if unset, actual income this month. 0 if neither. */
  expectedIncome: number;
  /** expectedIncome - all plans. Zero-based check. null when no income reference exists. */
  unassigned: number | null;
  mode: "plan" | "cashflow";
  safeToSpend: number;
  safeToSpendPerDay: number;
  projectedSpend: number;
  /** (income - needWantSpent) / income, null when income is 0. */
  savingsRate: number | null;
  split: { need: SplitPart; want: SplitPart; savings: SplitPart };
  rows: CategoryRow[];
  byMember: { userId: string; spent: number; income: number; count: number }[];
  /** Spending by day for the month, for the pulse strip. */
  byDay: { date: ISODate; spent: number; topUserId: string | null; count: number }[];
}

export interface Targets {
  needs: number;
  wants: number;
  savings: number;
}

export interface MonthInput {
  month: Month;
  today: ISODate;
  txs: TxLite[];
  cats: CatLite[];
  budgets: BudgetLite[];
  goals: GoalLite[];
  expectedIncomeCents: number;
  targets: Targets;
  /** Percent of income set aside into the Tithe fund (0 = off). */
  tithePct?: number;
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

export function titheGoalIds(goals: Pick<GoalLite, "id" | "isTithe">[]): Set<string> {
  return new Set(goals.filter((g) => g.isTithe).map((g) => g.id));
}

export function inMonth(tx: { date: string }, month: Month): boolean {
  return tx.date.startsWith(month);
}

/** Planned amount for a category in a month (0 when none). */
export function plannedFor(budgets: BudgetLite[], categoryId: string, month: Month): number {
  return budgets.find((b) => b.categoryId === categoryId && b.month === month)?.plannedCents ?? 0;
}

export function spentFor(txs: TxLite[], categoryId: string, month: Month): number {
  return sum(
    txs
      .filter((t) => t.type === "expense" && t.categoryId === categoryId && inMonth(t, month))
      .map((t) => t.amountCents),
  );
}

/**
 * Rollover carry into `month` for a category: positive leftover from previous
 * months, chained, starting at the first month that has a plan for it.
 * Negative leftover (overspend) is not carried: it is shown as "over" in its month.
 */
export function carryFor(
  cat: CatLite,
  month: Month,
  budgets: BudgetLite[],
  txs: TxLite[],
  memo = new Map<string, number>(),
): number {
  if (!cat.rollover) return 0;
  const key = `${cat.id}:${month}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  const catBudgets = budgets.filter((b) => b.categoryId === cat.id && b.month < month);
  if (catBudgets.length === 0) {
    memo.set(key, 0);
    return 0;
  }
  const prev = addMonths(month, -1);
  const prevAvailable = plannedFor(budgets, cat.id, prev) + carryFor(cat, prev, budgets, txs, memo);
  const prevSpent = spentFor(txs, cat.id, prev);
  const carry = Math.max(0, prevAvailable - prevSpent);
  memo.set(key, carry);
  return carry;
}

function paceFor(
  cat: CatLite,
  available: number,
  spent: number,
  expectedByToday: number,
  status: MonthSummary["status"],
): Pace {
  if (status === "future") return "none";
  if (available === 0 && spent === 0) return "none";
  if (spent > available) return "over";
  if (cat.isFixed) return "on";
  if (status === "current" && spent > expectedByToday * 1.1 && spent > 0) return "ahead";
  return "on";
}

export function monthStatus(month: Month, today: ISODate): MonthSummary["status"] {
  const cur = monthOf(today);
  if (month < cur) return "past";
  if (month > cur) return "future";
  return "current";
}

export function summarizeMonth(input: MonthInput): MonthSummary {
  const { month, today, txs, budgets, goals, targets } = input;
  const cats = input.cats.filter((c) => !c.archived || budgets.some((b) => b.categoryId === c.id && b.month === month));
  const status = monthStatus(month, today);
  const D = daysInMonth(month);
  const d = status === "current" ? dayOf(today) : status === "past" ? D : 0;
  const daysLeft = status === "current" ? D - d + 1 : status === "past" ? 0 : D;

  const mtx = txs.filter((t) => inMonth(t, month));
  const catById = new Map(cats.map((c) => [c.id, c]));

  const income = sum(mtx.filter((t) => t.type === "income").map((t) => t.amountCents));
  const expenses = mtx.filter((t) => t.type === "expense");
  const spent = sum(expenses.map((t) => t.amountCents));
  const groupSpent = (g: Group) =>
    sum(expenses.filter((t) => catById.get(t.categoryId ?? "")?.group === g).map((t) => t.amountCents));
  const needSpent = groupSpent("need");
  const wantSpent = groupSpent("want");
  const savingsCatSpent = groupSpent("savings");
  const businessSpent = groupSpent("business");
  // Expenses whose category was deleted count as "want" so nothing silently disappears.
  const orphanSpent = spent - needSpent - wantSpent - savingsCatSpent - businessSpent;
  const titheIds = titheGoalIds(goals);
  const goalTx = mtx.filter((t) => t.type === "goal");
  const titheTx = goalTx.filter((t) => titheIds.has(t.goalId ?? ""));
  const titheSetAside = sum(titheTx.filter((t) => t.amountCents > 0).map((t) => t.amountCents));
  const titheGiven = -sum(titheTx.filter((t) => t.amountCents < 0).map((t) => t.amountCents));
  const goalContributions = sum(goalTx.filter((t) => !titheIds.has(t.goalId ?? "")).map((t) => t.amountCents));
  // Tithe set-asides are a commitment, so they count as needs the moment the money is reserved.
  const needWantSpent = needSpent + wantSpent + orphanSpent + titheSetAside;
  const savedExplicit = savingsCatSpent + goalContributions;

  const memo = new Map<string, number>();
  const prev3 = lastMonths(addMonths(month, -1), 3);
  const rows: CategoryRow[] = cats
    .filter((c) => c.kind === "expense")
    .map((cat) => {
      const planned = plannedFor(budgets, cat.id, month);
      const carry = carryFor(cat, month, budgets, txs, memo);
      const available = planned + carry;
      const catSpent = spentFor(txs, cat.id, month);
      const expectedByToday = status === "current" ? Math.round((available * d) / D) : available;
      const history = prev3.map((m) => spentFor(txs, cat.id, m));
      const monthsWithData = history.filter((h) => h > 0).length;
      const avg3 = monthsWithData ? Math.round(sum(history) / monthsWithData) : 0;
      return {
        cat,
        planned,
        carry,
        available,
        spent: catSpent,
        remaining: available - catSpent,
        pace: paceFor(cat, available, catSpent, expectedByToday, status),
        expectedByToday,
        avg3,
        vsAvg: avg3 > 0 ? catSpent / avg3 - 1 : null,
      };
    })
    .filter((r) => !(r.cat.archived && r.available === 0 && r.spent === 0))
    .sort((a, b) => a.cat.sortOrder - b.cat.sortOrder || a.cat.name.localeCompare(b.cat.name));

  const plannedExpenses = sum(rows.filter((r) => r.cat.group !== "savings").map((r) => r.planned));
  const plannedSavingsCategories = sum(rows.filter((r) => r.cat.group === "savings").map((r) => r.planned));
  const activeGoals = goals.filter((g) => !g.archived && !g.isTithe);
  const plannedGoals = sum(activeGoals.map((g) => g.monthlyPlanCents));

  const expectedIncome = input.expectedIncomeCents > 0 ? input.expectedIncomeCents : income;
  const plannedTithe = Math.round((expectedIncome * (input.tithePct ?? 0)) / 100);
  const unassigned =
    expectedIncome > 0 ? expectedIncome - plannedExpenses - plannedSavingsCategories - plannedGoals - plannedTithe : null;

  const mode: MonthSummary["mode"] = plannedExpenses + plannedSavingsCategories > 0 ? "plan" : "cashflow";

  let safeToSpend: number;
  if (mode === "plan") {
    const variableRemaining = sum(rows.filter((r) => !r.cat.isFixed && r.cat.group !== "savings").map((r) => r.remaining));
    const fixedOverspend = sum(rows.filter((r) => r.cat.isFixed || r.cat.group === "savings").map((r) => Math.max(0, -r.remaining)));
    const overAllocated = unassigned !== null && unassigned < 0 ? unassigned : 0;
    safeToSpend = variableRemaining - fixedOverspend + overAllocated;
  } else {
    // Cash view: reserved tithe money is not spendable; giving from the fund spends the reserve, not this.
    safeToSpend = income - spent - goalContributions - titheSetAside;
  }
  const safeToSpendPerDay = daysLeft > 0 ? Math.floor(safeToSpend / daysLeft) : 0;

  // Projection: what's spent + unpaid fixed bills + recent variable pace × days left.
  let projectedSpend = spent;
  if (status === "current") {
    const unpaidFixed = sum(rows.filter((r) => r.cat.isFixed).map((r) => Math.max(0, r.remaining)));
    const since = addDays(today, -13);
    const recentVariable = sum(
      txs
        .filter((t) => t.type === "expense" && t.date >= since && t.date <= today)
        .filter((t) => !(catById.get(t.categoryId ?? "")?.isFixed))
        .map((t) => t.amountCents),
    );
    const dailyRate = recentVariable / 14;
    projectedSpend = Math.round(spent + unpaidFixed + dailyRate * Math.max(0, daysLeft - 1));
  }

  const savingsRate = income > 0 ? (income - needWantSpent - businessSpent) / income : null;

  const incomeRef = expectedIncome;
  const leftover = status === "past" ? Math.max(0, income - needWantSpent - savedExplicit) : 0;
  const part = (actual: number, targetPct: number): SplitPart => ({
    actual,
    target: Math.round((incomeRef * targetPct) / 100),
    share: incomeRef > 0 ? actual / incomeRef : 0,
    targetShare: targetPct / 100,
  });
  const split = {
    need: part(needSpent + titheSetAside, targets.needs),
    want: part(wantSpent + orphanSpent, targets.wants),
    savings: part(savedExplicit + leftover, targets.savings),
  };

  const memberMap = new Map<string, { userId: string; spent: number; income: number; count: number }>();
  for (const t of mtx) {
    const m = memberMap.get(t.userId) ?? { userId: t.userId, spent: 0, income: 0, count: 0 };
    if (t.type === "expense") m.spent += t.amountCents;
    if (t.type === "income") m.income += t.amountCents;
    m.count += 1;
    memberMap.set(t.userId, m);
  }
  const byMember = [...memberMap.values()].sort((a, b) => b.spent - a.spent);

  const byDay: MonthSummary["byDay"] = [];
  for (let day = 1; day <= D; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const dayTx = expenses.filter((t) => t.date === date);
    const perUser = new Map<string, number>();
    for (const t of dayTx) perUser.set(t.userId, (perUser.get(t.userId) ?? 0) + t.amountCents);
    let topUserId: string | null = null;
    let top = -1;
    for (const [u, v] of perUser) if (v > top) { top = v; topUserId = u; }
    byDay.push({ date, spent: sum(dayTx.map((t) => t.amountCents)), topUserId, count: dayTx.length });
  }

  return {
    month,
    today,
    dayOfMonth: d,
    daysInMonth: D,
    daysLeft,
    status,
    income,
    spent,
    needWantSpent,
    businessSpent,
    savedExplicit,
    goalContributions,
    titheSetAside,
    titheGiven,
    plannedExpenses,
    plannedSavingsCategories,
    plannedGoals,
    plannedTithe,
    expectedIncome,
    unassigned,
    mode,
    safeToSpend,
    safeToSpendPerDay,
    projectedSpend,
    savingsRate,
    split,
    rows,
    byMember,
    byDay,
  };
}

/* ---------------------------------- Goals ---------------------------------- */

export interface GoalProgress {
  goal: GoalLite;
  saved: number;
  remaining: number;
  /** 0..1 */
  progress: number;
  contributedThisMonth: number;
  monthsToDeadline: number | null;
  /** Needed per month to hit the deadline, or null without a deadline. */
  monthlyNeeded: number | null;
  /** Average monthly contribution over the last 3 full months + this month. */
  avgContribution: number;
  /** Months to finish at the current pace, null if no pace. */
  etaMonths: number | null;
  etaMonth: Month | null;
  done: boolean;
}

export function goalProgress(goal: GoalLite, txs: TxLite[], today: ISODate): GoalProgress {
  const month = monthOf(today);
  const mine = txs.filter((t) => t.type === "goal" && t.goalId === goal.id);
  const saved = goal.startingCents + sum(mine.map((t) => t.amountCents));
  const remaining = Math.max(0, goal.targetCents - saved);
  const contributedThisMonth = sum(mine.filter((t) => inMonth(t, month)).map((t) => t.amountCents));

  const window = lastMonths(month, 4);
  const windowTotal = sum(mine.filter((t) => window.some((m) => inMonth(t, m))).map((t) => t.amountCents));
  const firstMonth = mine.length ? mine.map((t) => monthOf(t.date)).sort()[0] : month;
  const monthsActive = Math.min(4, Math.max(1, monthsBetween(firstMonth, month) + 1));
  const avgContribution = Math.round(windowTotal / monthsActive);

  let monthsToDeadline: number | null = null;
  let monthlyNeeded: number | null = null;
  if (goal.deadline) {
    monthsToDeadline = Math.max(0, monthsBetween(month, monthOf(goal.deadline)));
    monthlyNeeded = monthsToDeadline > 0 ? Math.ceil(remaining / monthsToDeadline) : remaining;
  }
  const pace = avgContribution > 0 ? avgContribution : goal.monthlyPlanCents;
  const etaMonths = remaining === 0 ? 0 : pace > 0 ? Math.ceil(remaining / pace) : null;
  const etaMonth = etaMonths === null ? null : addMonths(month, etaMonths);

  return {
    goal,
    saved,
    remaining,
    progress: goal.targetCents > 0 ? Math.min(1, saved / goal.targetCents) : 0,
    contributedThisMonth,
    monthsToDeadline,
    monthlyNeeded,
    avgContribution,
    etaMonths,
    etaMonth,
    done: remaining === 0,
  };
}

/**
 * Average monthly spending in "need" categories over the last n full months.
 * With no history yet it falls back to the larger of (current month scaled to a
 * full month) and (this month's planned needs), so a fresh household gets a sane number.
 */
export function avgMonthlyNeeds(txs: TxLite[], cats: CatLite[], today: ISODate, budgets: BudgetLite[] = [], n = 3): number {
  const needIds = new Set(cats.filter((c) => c.group === "need").map((c) => c.id));
  const cur = monthOf(today);
  const months = lastMonths(addMonths(cur, -1), n);
  const totals = months.map((m) =>
    sum(txs.filter((t) => t.type === "expense" && inMonth(t, m) && needIds.has(t.categoryId ?? "")).map((t) => t.amountCents)),
  );
  const withData = totals.filter((t) => t > 0);
  if (withData.length) return Math.round(sum(withData) / withData.length);
  // No history yet: scale the current month to a full month.
  const curNeeds = sum(txs.filter((t) => t.type === "expense" && inMonth(t, cur) && needIds.has(t.categoryId ?? "")).map((t) => t.amountCents));
  const d = dayOf(today);
  const scaled = d > 0 ? Math.round((curNeeds * daysInMonth(cur)) / d) : 0;
  const planned = sum(budgets.filter((b) => b.month === cur && needIds.has(b.categoryId)).map((b) => b.plannedCents));
  return Math.max(scaled, planned);
}

/** Months of essential spending covered by the emergency fund. */
export function emergencyMonths(saved: number, monthlyNeeds: number): number | null {
  if (monthlyNeeds <= 0) return null;
  return saved / monthlyNeeds;
}

/* --------------------------------- History --------------------------------- */

export interface MonthPoint {
  month: Month;
  income: number;
  spent: number;
  need: number;
  want: number;
  savings: number;
  business: number;
  goalContributions: number;
  byCategory: Record<string, number>;
  byMember: Record<string, number>;
  savingsRate: number | null;
}

export function monthSeries(months: Month[], txs: TxLite[], cats: CatLite[], titheIds: Set<string> = new Set()): MonthPoint[] {
  const catById = new Map(cats.map((c) => [c.id, c]));
  return months.map((month) => {
    const mtx = txs.filter((t) => inMonth(t, month));
    const point: MonthPoint = {
      month,
      income: 0,
      spent: 0,
      need: 0,
      want: 0,
      savings: 0,
      business: 0,
      goalContributions: 0,
      byCategory: {},
      byMember: {},
      savingsRate: null,
    };
    for (const t of mtx) {
      if (t.type === "income") point.income += t.amountCents;
      else if (t.type === "goal") {
        // Tithe set-asides are a need; giving out of the fund was already counted.
        if (titheIds.has(t.goalId ?? "")) {
          if (t.amountCents > 0) point.need += t.amountCents;
        } else point.goalContributions += t.amountCents;
      } else {
        point.spent += t.amountCents;
        const g = catById.get(t.categoryId ?? "")?.group ?? "want";
        if (g === "need") point.need += t.amountCents;
        else if (g === "savings") point.savings += t.amountCents;
        else if (g === "business") point.business += t.amountCents;
        else point.want += t.amountCents;
        const cid = t.categoryId ?? "uncategorized";
        point.byCategory[cid] = (point.byCategory[cid] ?? 0) + t.amountCents;
        point.byMember[t.userId] = (point.byMember[t.userId] ?? 0) + t.amountCents;
      }
    }
    point.savingsRate = point.income > 0 ? (point.income - point.need - point.want - point.business) / point.income : null;
    return point;
  });
}

/* ----------------------------- Subcategories ------------------------------ */

export interface BreakdownRow {
  /** null = entries logged without a subcategory */
  subcategoryId: string | null;
  name: string;
  spent: number;
  count: number;
  /** share of the category's spending this month */
  share: number;
  /** average over the 3 previous months (months with any spending in the category) */
  avg3: number;
}

/** How a category's spending splits across its subcategories for a month. */
export function categoryBreakdown(categoryId: string, month: Month, txs: TxLite[], subs: SubLite[]): { rows: BreakdownRow[]; total: number } {
  const mine = txs.filter((t) => t.type === "expense" && t.categoryId === categoryId);
  const cur = mine.filter((t) => inMonth(t, month));
  const total = sum(cur.map((t) => t.amountCents));
  const prev = lastMonths(addMonths(month, -1), 3);
  const monthsWithData = prev.filter((m) => mine.some((t) => inMonth(t, m))).length;

  const keys = new Set<string | null>([...subs.filter((s) => s.categoryId === categoryId && !s.archived).map((s) => s.id)]);
  for (const t of cur) keys.add(t.subcategoryId);
  for (const t of mine) if (prev.some((m) => inMonth(t, m))) keys.add(t.subcategoryId);

  const rows: BreakdownRow[] = [...keys].map((key) => {
    const name = key === null ? "No subcategory" : subs.find((s) => s.id === key)?.name ?? "Removed subcategory";
    const curTx = cur.filter((t) => t.subcategoryId === key);
    const spent = sum(curTx.map((t) => t.amountCents));
    const prevSpent = sum(mine.filter((t) => t.subcategoryId === key && prev.some((m) => inMonth(t, m))).map((t) => t.amountCents));
    return {
      subcategoryId: key,
      name,
      spent,
      count: curTx.length,
      share: total > 0 ? spent / total : 0,
      avg3: monthsWithData ? Math.round(prevSpent / monthsWithData) : 0,
    };
  });
  // Hide empty "No subcategory" rows; keep named subs even when unused so the table is stable.
  return {
    rows: rows
      .filter((r) => !(r.subcategoryId === null && r.spent === 0 && r.avg3 === 0))
      .sort((a, b) => b.spent - a.spent || b.avg3 - a.avg3 || a.name.localeCompare(b.name)),
    total,
  };
}

/* ------------------------------ Starter plan ------------------------------- */

/** Spread a monthly take-home income across categories by their default share (percent of income). */
export function starterPlan(
  incomeCents: number,
  cats: { id: string; defaultSharePct: number }[],
): { categoryId: string; plannedCents: number }[] {
  return cats
    .filter((c) => c.defaultSharePct > 0)
    .map((c) => ({
      categoryId: c.id,
      // round to whole dollars so the plan reads cleanly
      plannedCents: Math.round((incomeCents * c.defaultSharePct) / 100 / 100) * 100,
    }));
}

/* ---------- Trend helpers for the Insights tab ---------- */

export interface BalancePoint {
  month: Month;
  /** End-of-month balance per savings goal: starting amount + contributions dated up to that month. */
  byGoal: Record<string, number>;
  total: number;
}

/** Savings balance over time. The Tithe fund and archived goals are left out. */
export function goalBalanceSeries(months: Month[], goals: GoalLite[], txs: TxLite[]): BalancePoint[] {
  const live = goals.filter((g) => !g.isTithe && !g.archived);
  const contributions = txs.filter((t) => t.type === "goal" && t.goalId !== null);
  return months.map((month) => {
    const byGoal: Record<string, number> = {};
    let total = 0;
    for (const g of live) {
      const bal = g.startingCents + sum(contributions.filter((t) => t.goalId === g.id && monthOf(t.date) <= month).map((t) => t.amountCents));
      byGoal[g.id] = bal;
      total += bal;
    }
    return { month, byGoal, total };
  });
}

export interface Mover {
  categoryId: string;
  before: number;
  after: number;
  delta: number;
}

/** Categories whose spending changed the most between two months, biggest absolute change first. */
export function categoryMovers(before: MonthPoint, after: MonthPoint, minDelta = 2500): Mover[] {
  const ids = new Set([...Object.keys(before.byCategory), ...Object.keys(after.byCategory)]);
  return [...ids]
    .map((categoryId) => {
      const b = before.byCategory[categoryId] ?? 0;
      const a = after.byCategory[categoryId] ?? 0;
      return { categoryId, before: b, after: a, delta: a - b };
    })
    .filter((m) => Math.abs(m.delta) >= minDelta)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}
