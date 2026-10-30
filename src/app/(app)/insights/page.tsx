import Link from "next/link";
import { FileText } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { loadHousehold, resolveMonth, toCatLite, toGoalLite, toSubLite, toTxLite, type SearchParams } from "@/lib/queries";
import { avgMonthlyNeeds, categoryMovers, emergencyMonths, goalBalanceSeries, goalProgress, monthSeries, summarizeMonth, titheGoalIds, type MonthPoint } from "@/lib/calc";
import { buildCategoryDetails } from "@/lib/details";
import { groupItems } from "@/lib/items";
import { addMonths, monthLabel, monthOf } from "@/lib/dates";
import { getProfile, referenceHousehold, refMonthlyCents, refShare } from "@/lib/profiles";
import { comparePlan, PLANS } from "@/lib/plans";
import {
  budgetVsActual,
  businessSeries,
  categoryTrends,
  dailyBalance,
  fixedFlexSeries,
  givingSeries,
  incomeBySource,
  monthThroughDay,
  parseWindow,
  pieSlices,
  rulesOfThumb,
  subcategorySeries,
  trendInsights,
  trimToData,
  windowMonths,
  windowTotals,
  yearReview,
} from "@/lib/trends";
import { MonthSwitcher } from "@/components/shell/MonthSwitcher";
import { InsightsScreen } from "@/components/insights/InsightsScreen";
import type { CompareRow, InsightsData } from "@/components/insights/types";

export const metadata = { title: "Insights" };

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const avg = (ns: number[]) => (ns.length ? Math.round(sum(ns) / ns.length) : null);

export default async function InsightsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const month = resolveMonth(sp.m, viewer.today);
  const window = parseWindow(sp.w);
  const currentMonth = monthOf(viewer.today);
  const h = viewer.household;
  const data = await loadHousehold(h.id, viewer.today);
  const txs = data.txs.map(toTxLite);
  const cats = data.categories.map(toCatLite);
  const subs = data.subcategories.map(toSubLite);
  const goals = data.goals.map(toGoalLite);
  const titheIds = titheGoalIds(goals);
  const targets = { needs: h.needsPct, wants: h.wantsPct, savings: h.savingsPct };
  const catMeta = (id: string) => data.categories.find((c) => c.id === id);

  const summary = summarizeMonth({ month, today: viewer.today, txs, cats, budgets: data.budgets, goals, expectedIncomeCents: h.expectedIncomeCents, targets, tithePct: h.tithePct });
  const progress = goals.filter((g) => !g.archived).map((g) => goalProgress(g, txs, viewer.today));
  const ef = progress.find((p) => p.goal.isEmergency);
  const monthlyNeeds = avgMonthlyNeeds(txs, cats, viewer.today, data.budgets);
  const efMonths = ef ? emergencyMonths(ef.saved, monthlyNeeds) : null;

  // Trend window: N months ending at the selected month, trimmed to months that have any data.
  const series = monthSeries(windowMonths(month, window), txs, cats, titheIds);
  const points = trimToData(series);
  const months = points.map((p) => p.month);
  const full = points.filter((p) => p.month < currentMonth && (p.income > 0 || p.spent > 0));
  const trend = points.map((p) => ({
    month: p.month,
    income: p.income,
    need: p.need,
    want: p.want,
    savings: p.savings + p.goalContributions,
    business: p.business,
    spent: p.spent,
    savingsRate: p.income > 0 ? (p.income - p.need - p.want - p.business) / p.income : null,
  }));

  // Kept: what income left behind each month. Months without logged income are gaps, not losses.
  const keptOf = (p: MonthPoint) => (p.income > 0 ? p.income - p.need - p.want - p.business : null);
  const kept = points.map((p) => ({ month: p.month, income: p.income, spent: p.need + p.want + p.business, kept: keptOf(p) }));
  const keptFull = kept.filter((k): k is typeof k & { kept: number } => k.kept !== null && k.month < currentMonth);
  const keptSummary = keptFull.length ? { months: keptFull.length, total: sum(keptFull.map((k) => k.kept)), avg: Math.round(sum(keptFull.map((k) => k.kept)) / keptFull.length), from: keptFull[0].month } : null;

  // Savings balance by month, forecast at the average contribution over the full months, target = sum of goal targets.
  const balances = goalBalanceSeries(months, goals, txs);
  const lastBalance = balances[balances.length - 1];
  const liveGoals = goals
    .filter((g) => !g.archived && !g.isTithe)
    .sort((a, b) => Number(b.isEmergency) - Number(a.isEmergency) || (lastBalance.byGoal[b.id] ?? 0) - (lastBalance.byGoal[a.id] ?? 0))
    .map((g) => ({ id: g.id, name: g.name, icon: g.icon, isEmergency: g.isEmergency }));
  const contribAvg = full.length ? sum(full.map((p) => p.goalContributions)) / full.length : 0;
  const forecast = contribAvg > 0 && liveGoals.length ? Array.from({ length: 12 }, (_, i) => ({ month: addMonths(month, i + 1), total: Math.round(lastBalance.total + contribAvg * (i + 1)) })) : [];
  const goalTarget = sum(goals.filter((g) => !g.archived && !g.isTithe && g.targetCents > 0).map((g) => g.targetCents));
  let efEta: string | null = null;
  if (ef && efMonths !== null && efMonths < 3 && ef.avgContribution > 0 && monthlyNeeds > 0) {
    const n = Math.ceil((3 * monthlyNeeds - ef.saved) / ef.avgContribution);
    if (n > 0 && n < 120) efEta = monthLabel(addMonths(currentMonth, n));
  }

  // Year to date through the selected month.
  const year = month.slice(0, 4);
  const yearData = yearReview(year, txs, cats, titheIds, viewer.today);
  const ytdPoints = yearData.points.filter((p) => p.month <= month && !p.future);
  const ytd = {
    year,
    months: ytdPoints.filter((p) => p.income > 0 || p.spent > 0).length,
    income: sum(ytdPoints.map((p) => p.income)),
    spent: sum(ytdPoints.map((p) => p.spent)),
    toGoals: yearData.totals.toGoals,
    kept: sum(ytdPoints.map((p) => p.kept ?? 0)),
  };

  // Tiles.
  const fullMonths = trend.filter((p) => p.month < currentMonth && (p.spent > 0 || p.income > 0)).slice(-3);
  const avgSpend = fullMonths.length ? Math.round(fullMonths.reduce((a, p) => a + p.spent, 0) / fullMonths.length) : null;
  const rates = fullMonths.map((p) => p.savingsRate).filter((r): r is number => r !== null);
  const avgRate = rates.length ? rates.reduce((a, r) => a + r, 0) / rates.length : null;
  const fixedFlex = fixedFlexSeries(months, txs, cats, titheIds);
  const fixedFull = fixedFlex.filter((p) => p.month < currentMonth && p.income > 0);
  const fixedShare = fixedFull.length ? sum(fixedFull.map((p) => p.fixed)) / sum(fixedFull.map((p) => p.income)) : null;

  // Category trends with subcategory drill-down.
  const trends = categoryTrends(points, cats, currentMonth, 6).map((t) => ({ ...t, subs: subcategorySeries(t.id, months, txs, subs) }));

  // This month next to last month (up to the same day while the month is in progress) and the usual.
  const cur = series.find((p) => p.month === month) ?? points[points.length - 1];
  const prevMonth = addMonths(month, -1);
  const prevFull = monthSeries([prevMonth], txs, cats, titheIds)[0];
  const prevHasData = prevFull.income > 0 || prevFull.spent > 0 || prevFull.goalContributions > 0;
  const prev = prevHasData ? (summary.status === "current" ? monthThroughDay(prevMonth, summary.dayOfMonth, txs, cats, titheIds) : prevFull) : null;
  const prevLabel = prev ? (summary.status === "current" ? `${monthLabel(prevMonth, "short")} to day ${summary.dayOfMonth}` : monthLabel(prevMonth, "short")) : "last month";
  const fullPoints = points.filter((p) => fullMonths.some((f) => f.month === p.month));
  const hasBusiness = trend.some((p) => p.business > 0);
  const compareRows: CompareRow[] = [
    { key: "need", label: "Needs", kind: "spend", cur: cur.need, prev: prev ? prev.need : null, usual: avg(fullPoints.map((p) => p.need)) },
    { key: "want", label: "Wants", kind: "spend", cur: cur.want, prev: prev ? prev.want : null, usual: avg(fullPoints.map((p) => p.want)) },
    ...(hasBusiness ? [{ key: "business", label: "Business", kind: "spend" as const, cur: cur.business, prev: prev ? prev.business : null, usual: avg(fullPoints.map((p) => p.business)) }] : []),
    { key: "spent", label: "Spent", kind: "spend", cur: cur.need + cur.want + cur.business, prev: prev ? prev.need + prev.want + prev.business : null, usual: avg(fullPoints.map((p) => p.need + p.want + p.business)) },
    { key: "saving", label: "Put into goals", kind: "gain", cur: cur.savings + cur.goalContributions, prev: prev ? prev.savings + prev.goalContributions : null, usual: avg(fullPoints.map((p) => p.savings + p.goalContributions)) },
    { key: "income", label: "Income", kind: "gain", cur: cur.income, prev: prev ? prev.income : null, usual: avg(fullPoints.map((p) => p.income)) },
  ];
  const movers = prev
    ? categoryMovers(prev, cur)
        .map((m) => ({ ...m, name: catMeta(m.categoryId)?.name ?? "", icon: catMeta(m.categoryId)?.icon ?? "Tag" }))
        .filter((m) => m.name)
    : [];

  // The month's running balance, day by day, next to last month's path.
  const throughDay = summary.status === "current" ? summary.dayOfMonth : summary.daysInMonth;
  const balance = {
    points: summary.status === "future" ? [] : dailyBalance(month, txs, cats, titheIds, throughDay),
    prev: prevHasData ? dailyBalance(prevMonth, txs, cats, titheIds) : null,
    prevMonth: prevHasData ? prevMonth : null,
    daysInMonth: summary.daysInMonth,
    throughDay,
  };

  // Where the money went (list + pie) for the selected month.
  const totalSpent = summary.spent;
  const categoryRows = summary.rows
    .filter((r) => r.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map((r) => ({ id: r.cat.id, name: r.cat.name, icon: r.cat.icon, spent: r.spent, share: totalSpent > 0 ? r.spent / totalSpent : 0, vsAvg: r.vsAvg, avg3: r.avg3 }));
  const pie = pieSlices(cur.byCategory, cats, 8);

  // Plan vs actual.
  const budget = {
    points: budgetVsActual(points, data.budgets, cats),
    byCategory: summary.rows
      .filter((r) => (r.cat.group === "need" || r.cat.group === "want") && (r.planned > 0 || r.spent > 0))
      .sort((a, b) => b.planned - a.planned || b.spent - a.spent)
      .slice(0, 10)
      .map((r) => ({ id: r.cat.id, name: r.cat.name, icon: r.cat.icon, planned: r.planned, spent: r.spent })),
  };

  // You vs a reference household sized like yours. Categories sharing one survey line are compared as one row.
  const profile = getProfile(h.comparisonProfile);
  const ref = referenceHousehold(profile, h.adults, h.children);
  const basis: "avg3" | "month" = fullMonths.length > 0 ? "avg3" : "month";
  const youTotal = basis === "avg3" ? (avgSpend ?? summary.spent) - summary.businessSpent : summary.spent - summary.businessSpent;
  const byKey = new Map<string, { id: string; names: string[]; icon: string; you: number }>();
  for (const r of summary.rows) {
    const key = r.cat.blsKey;
    if (!key || r.cat.group === "business") continue;
    const you = basis === "avg3" && r.avg3 > 0 ? r.avg3 : r.spent;
    const existing = byKey.get(key);
    if (existing) {
      existing.names.push(r.cat.name);
      existing.you += you;
    } else byKey.set(key, { id: r.cat.id, names: [r.cat.name], icon: r.cat.icon, you });
  }
  const comparisonRows = [...byKey.entries()]
    .map(([key, r]) => ({
      id: r.id,
      name: r.names.join(" + "),
      icon: r.icon,
      you: r.you,
      typical: refMonthlyCents(ref, key) ?? 0,
      scaled: Math.round((youTotal * (refShare(ref, key) ?? 0)) / 100),
      estimated: ref.estimated.includes(key),
    }))
    .filter((r) => r.you > 0 || r.typical > 0)
    .sort((a, b) => b.typical - a.typical);

  // Rules of thumb and famous plans over the full months of the window.
  const totals = windowTotals(points, cats, txs, titheIds, currentMonth);
  const rules = rulesOfThumb(totals, efMonths);
  const plans = PLANS.map((p) => ({ id: p.id, name: p.name, author: p.author, tagline: p.tagline, source: p.source, buckets: comparePlan(p, cats, { income: totals.income, byCategory: totals.byCategory, goalContributions: totals.goalContributions, titheSetAside: totals.titheSetAside }).buckets }));

  // Trend insights replace the month cards here.
  const insights = trendInsights({ points, currentMonth, trends, fixedShare, targetSavings: targets.savings / 100, efMonths, efMonthlyAvg: ef?.avgContribution ?? 0, monthlyNeeds });

  // Giving and business, only when used.
  const givingData = givingSeries(months, txs, cats, goals);
  const giving = h.tithePct > 0 || goals.some((g) => g.isTithe) || givingData.totals.given > 0 ? { ...givingData, tithePct: h.tithePct } : null;
  const biz = businessSeries(months, txs, cats);
  const bizCats = cats.filter((c) => c.kind === "expense" && c.group === "business");
  const topSubs = bizCats
    .flatMap((c) => subcategorySeries(c.id, months, txs, subs).map((s) => ({ name: bizCats.length > 1 ? `${c.name} · ${s.name}` : s.name, total: s.total })))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const business = biz.used ? { points: biz.points, totals: biz.totals, topSubs, year } : null;

  const details = buildCategoryDetails(summary, data.txs, txs, subs, data.members.map((m) => ({ id: m.id, name: m.name, color: m.color })), groupItems(data.receiptItems));

  const d: InsightsData = {
    month,
    today: viewer.today,
    currentMonth,
    window,
    months,
    monthStatus: summary.status,
    dayOfMonth: summary.dayOfMonth,
    daysInMonth: summary.daysInMonth,
    projectedSpend: summary.projectedSpend,
    tiles: { avgRate, rateSeries: trend.map((p) => p.savingsRate), targetSavingsShare: targets.savings / 100, fullMonthCount: fullMonths.length, efMonths, fixedShare, ytd, balanceNow: lastBalance.total, goalsCount: liveGoals.length },
    insights,
    trend,
    kept,
    keptSummary,
    balances,
    forecast,
    goalTarget,
    goals: liveGoals,
    efEta,
    categoryTrends: trends,
    fixedFlex,
    income: incomeBySource(months, txs, cats),
    budget,
    year: yearData,
    compare: { prevMonth: prev ? prevMonth : null, prevLabel, rows: compareRows, movers },
    balance,
    categoryRows,
    totalSpent,
    pie,
    details,
    comparison: {
      basis,
      fullMonthCount: fullMonths.length,
      rows: comparisonRows,
      youTotal,
      typicalTotal: ref.monthlyTotalCents,
      ref: { profileId: ref.profileId, label: ref.label, short: ref.short, source: ref.source, year: ref.year, adults: ref.adults, children: ref.children, incomeBeforeTax: ref.incomeBeforeTax, modeled: ref.modeled, method: ref.method },
    },
    rules,
    plans,
    planMonths: totals.months,
    planIncome: totals.income,
    giving,
    business,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-2">
        <h1 className="display text-2xl font-semibold tracking-tight">Insights</h1>
        <Link href={`/report?period=month&key=${month}`} className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-green-text hover:bg-card-2">
          <FileText size={16} /> Report
        </Link>
      </div>
      <MonthSwitcher month={month} currentMonth={currentMonth} />
      <InsightsScreen d={d} />
    </div>
  );
}
