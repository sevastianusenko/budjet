import { describe, expect, it } from "vitest";
import { monthSeries, type CatLite, type GoalLite, type TxLite } from "./calc";
import { budgetVsActual, categoryTrends, fixedFlexSeries, givingSeries, incomeBySource, monthThroughDay, pieSlices, rulesOfThumb, subcategorySeries, windowTotals, yearReview } from "./trends";
import { comparePlan, getPlan } from "./plans";
import { equivalence, PROFILES, referenceHousehold } from "./profiles";

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
const cats = [
  cat({ id: "rent", name: "Rent / Mortgage", isFixed: true, blsKey: "shelter" }),
  cat({ id: "groc", name: "Groceries", blsKey: "food_home" }),
  cat({ id: "dine", name: "Dining Out", group: "want", blsKey: "food_away" }),
  cat({ id: "subs", name: "Subscriptions", group: "want", isFixed: true }),
  cat({ id: "tithe", name: "Tithe", isFixed: true, blsKey: "giving" }),
  cat({ id: "biz", name: "Business", group: "business" }),
  cat({ id: "pay", name: "Paycheck", kind: "income", group: "income" }),
  cat({ id: "side", name: "Side Income", kind: "income", group: "income" }),
  cat({ id: "bizinc", name: "Business Income", kind: "income", group: "income" }),
];
let n = 0;
const tx = (p: Partial<TxLite> & { amountCents: number; date: string }): TxLite => ({ id: `t${n++}`, type: "expense", categoryId: null, subcategoryId: null, goalId: null, userId: "u1", ...p });
const months = ["2026-07", "2026-08", "2026-09", "2026-10"];
const txs: TxLite[] = [
  ...months.flatMap((m, i) => [
    tx({ type: "income", categoryId: "pay", amountCents: 600000, date: `${m}-01` }),
    tx({ categoryId: "rent", amountCents: 180000, date: `${m}-02` }),
    tx({ categoryId: "groc", amountCents: 60000 + i * 10000, subcategoryId: "meat", date: `${m}-10` }),
    tx({ categoryId: "groc", amountCents: 20000, subcategoryId: null, date: `${m}-20` }),
    tx({ categoryId: "dine", amountCents: 30000, date: `${m}-12` }),
    tx({ categoryId: "subs", amountCents: 5000, date: `${m}-03` }),
  ]),
  tx({ type: "income", categoryId: "side", amountCents: 50000, date: "2026-09-15" }),
  tx({ type: "income", categoryId: "bizinc", amountCents: 100000, date: "2026-09-16" }),
  tx({ categoryId: "biz", amountCents: 40000, date: "2026-09-17" }),
  tx({ type: "goal", goalId: "tg", amountCents: 60000, date: "2026-09-01" }),
  tx({ type: "goal", goalId: "tg", amountCents: -20000, date: "2026-09-20", categoryId: "tithe" }),
  tx({ type: "goal", goalId: "ef", amountCents: 50000, date: "2026-09-05" }),
];
const titheIds = new Set(["tg"]);
const points = monthSeries(months, txs, cats, titheIds);

describe("category trends", () => {
  it("ranks by total, measures the streak on full months only", () => {
    const t = categoryTrends(points, cats, "2026-10", 3);
    expect(t.map((x) => x.id)).toEqual(["rent", "groc", "dine"]);
    const groc = t[1];
    expect(groc.streak).toBe(2); // Jul→Aug→Sep rising; Oct is the current month and ignored
    expect(groc.series).toEqual([80000, 90000, 100000, 110000]);
    expect(groc.last).toBe(100000);
  });
  it("splits a category by subcategory", () => {
    const s = subcategorySeries("groc", months, txs, []);
    expect(s[0].id).toBe("meat");
    expect(s[0].series).toEqual([60000, 70000, 80000, 90000]);
    expect(s[1].name).toBe("No subcategory");
  });
});

describe("fixed vs flexible, income sources, year, budget", () => {
  it("puts fixed categories and tithe set-asides into fixed", () => {
    const f = fixedFlexSeries(["2026-09"], txs, cats, titheIds)[0];
    expect(f.fixed).toBe(180000 + 5000 + 60000);
    expect(f.flexNeed).toBe(100000);
    expect(f.want).toBe(30000);
    expect(f.business).toBe(40000);
    expect(f.income).toBe(750000);
  });
  it("income by source sorts sources by total", () => {
    const r = incomeBySource(months, txs, cats);
    expect(r.sources.map((s) => s.id)).toEqual(["pay", "bizinc", "side"]);
    expect(r.points[2].bySource.side).toBe(50000);
  });
  it("year review marks future months and totals the past", () => {
    const y = yearReview("2026", txs, cats, titheIds, "2026-10-30");
    expect(y.points[11].future).toBe(true);
    expect(y.points[6].kept).toBe(600000 - 180000 - 80000 - 30000 - 5000);
    expect(y.totals.months).toBe(4);
    expect(y.prev).toBeNull();
  });
  it("plan vs actual sums needs and wants plans per month", () => {
    const b = budgetVsActual(points.slice(0, 1), [{ categoryId: "rent", month: "2026-07", plannedCents: 180000 }, { categoryId: "biz", month: "2026-07", plannedCents: 99999 }], cats);
    expect(b[0].planned).toBe(180000);
    expect(b[0].spent).toBe(180000 + 80000 + 30000 + 5000);
  });
  it("month through a day only counts entries up to that day", () => {
    const p = monthThroughDay("2026-09", 5, txs, cats, titheIds);
    expect(p.need).toBe(180000 + 60000); // rent on the 2nd + tithe set-aside on the 1st; groceries land on the 10th
    expect(p.income).toBe(600000);
  });
});

describe("rules, pie, giving, plans, reference", () => {
  it("rules of thumb use full-month totals", () => {
    const t = windowTotals(points, cats, txs, titheIds, "2026-10");
    expect(t.months).toBe(3);
    const rules = rulesOfThumb(t, 2.5);
    const housing = rules.find((r) => r.id === "housing")!;
    expect(housing.value).toBeCloseTo((180000 * 3) / (600000 * 3 + 150000), 3);
    expect(housing.status).toBe("good");
    expect(rules.find((r) => r.id === "ef")!.status).toBe("watch");
  });
  it("pie folds the tail into Everything else", () => {
    const s = pieSlices(points[2].byCategory, cats, 2);
    expect(s.length).toBe(3);
    expect(s[2].id).toBe("other");
    expect(s.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 6);
  });
  it("giving series tracks the fund and giving from it", () => {
    const g: GoalLite = { id: "tg", name: "Tithe", icon: "Church", targetCents: 0, monthlyPlanCents: 0, deadline: null, isEmergency: false, isTithe: true, startingCents: 10000, archived: false };
    const r = givingSeries(["2026-08", "2026-09"], txs, cats, [g]);
    expect(r.points[1].setAside).toBe(60000);
    expect(r.points[1].fromFund).toBe(20000);
    expect(r.points[1].fundBalance).toBe(50000);
    expect(r.totals.given).toBe(20000);
  });
  it("Ramsey plan: tithe set-aside counts as giving, housing judged against 25%", () => {
    const t = windowTotals(points, cats, txs, titheIds, "2026-10");
    const r = comparePlan(getPlan("ramsey"), cats, { income: t.income, byCategory: t.byCategory, goalContributions: t.goalContributions, titheSetAside: t.titheSetAside });
    const giving = r.buckets.find((b) => b.id === "giving")!;
    expect(giving.amount).toBe(60000);
    expect(giving.status).toBe("under");
    const housing = r.buckets.find((b) => b.id === "housing")!;
    expect(housing.categories).toEqual(["Rent / Mortgage"]);
    expect(housing.status).toBe("over"); // 540000 / 1950000 = 27.7%
    const rec = r.buckets.find((b) => b.id === "recreation")!;
    expect(rec.categories).toEqual(["Subscriptions"]);
  });
  it("reference household scales the family column to 2 adults + 3 kids in Philly", () => {
    const ref = referenceHousehold(PROFILES.philadelphia, 2, 3);
    expect(ref.label).toBe("Philly-area family of 5 (2 adults, 3 kids)");
    const size = equivalence(2, 3) / equivalence(2.5, 1.5);
    const expected = Math.round(((113585 * (92234 / 78535) * size) / 12) * 100);
    expect(ref.monthlyTotalCents).toBe(expected);
    expect(ref.modeled).toBe(true);
    const plain = referenceHousehold(PROFILES.us, 2, 0);
    expect(plain.label).toBe("U.S. household of 2 (2 adults)");
  });
});
