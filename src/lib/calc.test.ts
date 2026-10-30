import { describe, expect, it } from "vitest";
import {
  avgMonthlyNeeds,
  carryFor,
  categoryBreakdown,
  emergencyMonths,
  goalProgress,
  monthSeries,
  starterPlan,
  summarizeMonth,
  type BudgetLite,
  type CatLite,
  type GoalLite,
  type TxLite,
} from "./calc";

const cat = (p: Partial<CatLite> & { id: string; name: string }): CatLite => ({
  icon: "Tag",
  kind: "expense",
  group: "need",
  isFixed: false,
  rollover: false,
  blsKey: null,
  archived: false,
  sortOrder: 0,
  ...p,
});

const rent = cat({ id: "rent", name: "Rent", isFixed: true });
const groceries = cat({ id: "groc", name: "Groceries" });
const dining = cat({ id: "dine", name: "Dining", group: "want" });
const travel = cat({ id: "trav", name: "Travel", group: "want", rollover: true });
const retirement = cat({ id: "ret", name: "Retirement", group: "savings", isFixed: true });
const paycheck = cat({ id: "pay", name: "Paycheck", kind: "income", group: "income" });
const cats = [rent, groceries, dining, travel, retirement, paycheck];

let n = 0;
const tx = (p: Partial<TxLite> & { amountCents: number; date: string }): TxLite => ({
  id: `t${n++}`,
  type: "expense",
  categoryId: null,
  subcategoryId: null,
  goalId: null,
  userId: "u1",
  ...p,
});

const targets = { needs: 50, wants: 30, savings: 20 };

describe("summarizeMonth — plan mode", () => {
  const budgets: BudgetLite[] = [
    { categoryId: "rent", month: "2026-09", plannedCents: 200000 },
    { categoryId: "groc", month: "2026-09", plannedCents: 80000 },
    { categoryId: "dine", month: "2026-09", plannedCents: 30000 },
    { categoryId: "ret", month: "2026-09", plannedCents: 50000 },
  ];
  const txs: TxLite[] = [
    tx({ type: "income", categoryId: "pay", amountCents: 500000, date: "2026-09-01" }),
    tx({ categoryId: "rent", amountCents: 200000, date: "2026-09-01" }),
    tx({ categoryId: "groc", amountCents: 30000, date: "2026-09-10", userId: "u2" }),
    tx({ categoryId: "dine", amountCents: 12000, date: "2026-09-12" }),
    tx({ categoryId: "ret", amountCents: 50000, date: "2026-09-02" }),
    tx({ type: "goal", goalId: "g1", amountCents: 20000, date: "2026-09-03" }),
  ];
  const s = summarizeMonth({
    month: "2026-09",
    today: "2026-09-15",
    txs,
    cats,
    budgets,
    goals: [],
    expectedIncomeCents: 500000,
    targets,
  });

  it("totals", () => {
    expect(s.status).toBe("current");
    expect(s.daysInMonth).toBe(30);
    expect(s.daysLeft).toBe(16);
    expect(s.income).toBe(500000);
    expect(s.spent).toBe(292000);
    expect(s.needWantSpent).toBe(242000);
    expect(s.savedExplicit).toBe(70000);
    expect(s.plannedExpenses).toBe(310000);
    expect(s.plannedSavingsCategories).toBe(50000);
    expect(s.unassigned).toBe(140000);
  });

  it("safe to spend = variable remaining − fixed overspend", () => {
    // groceries 800−300 = 500, dining 300−120 = 180, travel 0 → 680
    expect(s.mode).toBe("plan");
    expect(s.safeToSpend).toBe(68000);
    expect(s.safeToSpendPerDay).toBe(Math.floor(68000 / 16));
  });

  it("pace", () => {
    const rows = Object.fromEntries(s.rows.map((r) => [r.cat.id, r]));
    expect(rows.rent.pace).toBe("on"); // fixed, paid in full
    expect(rows.groc.expectedByToday).toBe(40000);
    expect(rows.groc.pace).toBe("on");
    // dining: expected 150 by day 15; spent 120 → on
    expect(rows.dine.pace).toBe("on");
  });

  it("50/30/20 split uses income reference", () => {
    expect(s.split.need.actual).toBe(230000);
    expect(s.split.need.target).toBe(250000);
    expect(s.split.want.actual).toBe(12000);
    expect(s.split.savings.actual).toBe(70000);
    expect(s.split.savings.share).toBeCloseTo(0.14);
  });

  it("members and days", () => {
    expect(s.byMember.find((m) => m.userId === "u2")?.spent).toBe(30000);
    expect(s.byDay).toHaveLength(30);
    expect(s.byDay[9]).toMatchObject({ date: "2026-09-10", spent: 30000, topUserId: "u2" });
  });

  it("savings rate", () => {
    expect(s.savingsRate).toBeCloseTo((500000 - 242000) / 500000);
  });
});

describe("summarizeMonth — overspend and over-allocation", () => {
  it("fixed overspend and negative unassigned reduce safe to spend", () => {
    const s = summarizeMonth({
      month: "2026-09",
      today: "2026-09-15",
      txs: [
        tx({ categoryId: "rent", amountCents: 210000, date: "2026-09-01" }),
        tx({ categoryId: "groc", amountCents: 10000, date: "2026-09-02" }),
      ],
      cats,
      budgets: [
        { categoryId: "rent", month: "2026-09", plannedCents: 200000 },
        { categoryId: "groc", month: "2026-09", plannedCents: 80000 },
      ],
      goals: [],
      expectedIncomeCents: 250000, // over-allocated by 300
      targets,
    });
    expect(s.unassigned).toBe(-30000);
    // groceries remaining 700 − rent overspend 100 − over-allocation 300 = 300
    expect(s.safeToSpend).toBe(30000);
    expect(s.rows.find((r) => r.cat.id === "rent")?.pace).toBe("over");
  });

  it("flags 'ahead' when spending faster than the calendar", () => {
    const s = summarizeMonth({
      month: "2026-09",
      today: "2026-09-10",
      txs: [tx({ categoryId: "groc", amountCents: 50000, date: "2026-09-05" })],
      cats,
      budgets: [{ categoryId: "groc", month: "2026-09", plannedCents: 90000 }],
      goals: [],
      expectedIncomeCents: 0,
      targets,
    });
    const g = s.rows.find((r) => r.cat.id === "groc")!;
    expect(g.expectedByToday).toBe(30000);
    expect(g.pace).toBe("ahead");
  });
});

describe("summarizeMonth — cashflow mode (no plan yet)", () => {
  it("safe to spend is income − spent − goal contributions", () => {
    const s = summarizeMonth({
      month: "2026-09",
      today: "2026-09-20",
      txs: [
        tx({ type: "income", categoryId: "pay", amountCents: 400000, date: "2026-09-01" }),
        tx({ categoryId: "groc", amountCents: 50000, date: "2026-09-05" }),
        tx({ type: "goal", goalId: "g", amountCents: 25000, date: "2026-09-06" }),
      ],
      cats,
      budgets: [],
      goals: [],
      expectedIncomeCents: 0,
      targets,
    });
    expect(s.mode).toBe("cashflow");
    expect(s.safeToSpend).toBe(325000);
    expect(s.unassigned).toBe(400000); // nothing planned, all income unassigned
  });
});

describe("rollover", () => {
  const budgets: BudgetLite[] = [
    { categoryId: "trav", month: "2026-07", plannedCents: 10000 },
    { categoryId: "trav", month: "2026-08", plannedCents: 10000 },
    { categoryId: "trav", month: "2026-09", plannedCents: 10000 },
  ];
  const txs = [tx({ categoryId: "trav", amountCents: 2000, date: "2026-07-10" })];

  it("chains positive leftovers", () => {
    expect(carryFor(travel, "2026-08", budgets, txs)).toBe(8000);
    expect(carryFor(travel, "2026-09", budgets, txs)).toBe(18000);
    expect(carryFor(travel, "2026-07", budgets, txs)).toBe(0);
  });

  it("does not carry overspend", () => {
    const over = [tx({ categoryId: "trav", amountCents: 15000, date: "2026-07-10" })];
    expect(carryFor(travel, "2026-08", budgets, over)).toBe(0);
  });

  it("ignores categories without rollover", () => {
    expect(carryFor(groceries, "2026-09", [{ categoryId: "groc", month: "2026-08", plannedCents: 100 }], [])).toBe(0);
  });
});

describe("goals", () => {
  const goal: GoalLite = {
    id: "g1",
    name: "Emergency",
    icon: "PiggyBank",
    targetCents: 1000000,
    monthlyPlanCents: 50000,
    deadline: "2027-01-31",
    isEmergency: true,
    startingCents: 200000,
    archived: false,
  };
  const txs = [
    tx({ type: "goal", goalId: "g1", amountCents: 50000, date: "2026-08-05" }),
    tx({ type: "goal", goalId: "g1", amountCents: 50000, date: "2026-09-05" }),
  ];

  it("progress, needed per month, ETA", () => {
    const p = goalProgress(goal, txs, "2026-09-15");
    expect(p.saved).toBe(300000);
    expect(p.remaining).toBe(700000);
    expect(p.progress).toBeCloseTo(0.3);
    expect(p.contributedThisMonth).toBe(50000);
    expect(p.monthsToDeadline).toBe(4);
    expect(p.monthlyNeeded).toBe(175000);
    expect(p.avgContribution).toBe(50000); // 100000 over 2 active months
    expect(p.etaMonths).toBe(14);
    expect(p.etaMonth).toBe("2027-11");
  });

  it("emergency months", () => {
    expect(emergencyMonths(300000, 100000)).toBe(3);
    expect(emergencyMonths(300000, 0)).toBeNull();
  });

  it("average monthly needs falls back to a scaled current month", () => {
    const t = [tx({ categoryId: "groc", amountCents: 30000, date: "2026-09-05" })];
    expect(avgMonthlyNeeds(t, cats, "2026-09-15")).toBe(60000);
  });
});

describe("series & starter plan", () => {
  it("month series groups by bucket", () => {
    const pts = monthSeries(["2026-08", "2026-09"], [
      tx({ type: "income", categoryId: "pay", amountCents: 100000, date: "2026-09-01" }),
      tx({ categoryId: "groc", amountCents: 10000, date: "2026-09-01" }),
      tx({ categoryId: "dine", amountCents: 5000, date: "2026-09-01" }),
      tx({ categoryId: "ret", amountCents: 5000, date: "2026-09-01" }),
    ], cats);
    expect(pts[0].spent).toBe(0);
    expect(pts[1]).toMatchObject({ income: 100000, need: 10000, want: 5000, savings: 5000, spent: 20000 });
    expect(pts[1].savingsRate).toBeCloseTo(0.85);
  });

  it("starter plan rounds to whole dollars", () => {
    const plan = starterPlan(612345, [
      { id: "a", defaultSharePct: 26 },
      { id: "b", defaultSharePct: 0 },
    ]);
    expect(plan).toEqual([{ categoryId: "a", plannedCents: 159200 }]);
  });
});

describe("business group and subcategory breakdown", () => {
  const biz = cat({ id: "biz", name: "Business", group: "business" });
  const allCats = [...cats, biz];
  const subs = [
    { id: "s-meat", categoryId: "groc", name: "Meat & fish", archived: false, sortOrder: 0 },
    { id: "s-veg", categoryId: "groc", name: "Vegetables & fruit", archived: false, sortOrder: 1 },
  ];
  const txs: TxLite[] = [
    tx({ type: "income", categoryId: "pay", amountCents: 500000, date: "2026-09-01" }),
    tx({ categoryId: "groc", subcategoryId: "s-meat", amountCents: 12000, date: "2026-09-03" }),
    tx({ categoryId: "groc", subcategoryId: "s-veg", amountCents: 8000, date: "2026-09-04" }),
    tx({ categoryId: "groc", amountCents: 5000, date: "2026-09-05" }),
    tx({ categoryId: "groc", subcategoryId: "s-meat", amountCents: 9000, date: "2026-08-10" }),
    tx({ categoryId: "biz", amountCents: 40000, date: "2026-09-06" }),
  ];

  it("keeps business out of needs/wants but inside spent and savings rate", () => {
    const s = summarizeMonth({ month: "2026-09", today: "2026-09-20", txs, cats: allCats, budgets: [], goals: [], expectedIncomeCents: 0, targets });
    expect(s.spent).toBe(65000);
    expect(s.businessSpent).toBe(40000);
    expect(s.needWantSpent).toBe(25000);
    expect(s.split.need.actual).toBe(25000);
    expect(s.savingsRate).toBeCloseTo((500000 - 25000 - 40000) / 500000);
  });

  it("breaks a category down by subcategory with shares and 3-month averages", () => {
    const { rows, total } = categoryBreakdown("groc", "2026-09", txs, subs);
    expect(total).toBe(25000);
    expect(rows.map((r) => r.name)).toEqual(["Meat & fish", "Vegetables & fruit", "No subcategory"]);
    expect(rows[0]).toMatchObject({ spent: 12000, count: 1, avg3: 9000 });
    expect(rows[0].share).toBeCloseTo(0.48);
    expect(rows[2]).toMatchObject({ subcategoryId: null, spent: 5000 });
  });

  it("month series carries a business column", () => {
    const pts = monthSeries(["2026-09"], txs, allCats);
    expect(pts[0].business).toBe(40000);
    expect(pts[0].need).toBe(25000);
  });
});
