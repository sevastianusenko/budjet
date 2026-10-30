import { requireViewer } from "@/lib/auth";
import { loadHousehold, resolveMonth, toCatLite, toGoalLite, toSubLite, toTxLite, type SearchParams } from "@/lib/queries";
import { avgMonthlyNeeds, categoryMovers, emergencyMonths, goalBalanceSeries, goalProgress, monthSeries, summarizeMonth, titheGoalIds, type MonthPoint } from "@/lib/calc";
import { buildCategoryDetails } from "@/lib/details";
import { groupItems } from "@/lib/items";
import { buildInsights } from "@/lib/insights";
import { addMonths, lastMonths, monthOf } from "@/lib/dates";
import { getProfile, profileMonthlyCents, profileShare } from "@/lib/profiles";
import { MonthSwitcher } from "@/components/shell/MonthSwitcher";
import { InsightCards } from "@/components/home/InsightCards";
import { InsightsScreen, type CompareRow } from "@/components/insights/InsightsScreen";
import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata = { title: "Insights" };

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const avg = (ns: number[]) => (ns.length ? Math.round(sum(ns) / ns.length) : null);

export default async function InsightsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const month = resolveMonth(sp.m, viewer.today);
  const currentMonth = monthOf(viewer.today);
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const txs = data.txs.map(toTxLite);
  const cats = data.categories.map(toCatLite);
  const goals = data.goals.map(toGoalLite);
  const targets = { needs: viewer.household.needsPct, wants: viewer.household.wantsPct, savings: viewer.household.savingsPct };
  const profile = getProfile(viewer.household.comparisonProfile);
  const catMeta = (id: string) => data.categories.find((c) => c.id === id);

  const summary = summarizeMonth({ month, today: viewer.today, txs, cats, budgets: data.budgets, goals, expectedIncomeCents: viewer.household.expectedIncomeCents, targets, tithePct: viewer.household.tithePct });
  const progress = goals.filter((g) => !g.archived).map((g) => goalProgress(g, txs, viewer.today));
  const ef = progress.find((p) => p.goal.isEmergency);
  const efMonths = ef ? emergencyMonths(ef.saved, avgMonthlyNeeds(txs, cats, viewer.today, data.budgets)) : null;
  const insights = buildInsights({ summary, goals: progress, emergencyMonths: efMonths, catName: (id) => catMeta(id)?.name ?? "" });

  // Trend window: 12 months ending at the selected month, trimmed to months that have any data.
  const series = monthSeries(lastMonths(month, 12), txs, cats, titheGoalIds(goals));
  const firstWithData = series.findIndex((p) => p.income > 0 || p.spent > 0 || p.goalContributions > 0);
  const trendPoints = firstWithData === -1 ? series.slice(-1) : series.slice(Math.max(0, Math.min(firstWithData, series.length - 3)));
  const trend = trendPoints.map((p) => ({
    month: p.month,
    income: p.income,
    need: p.need,
    want: p.want,
    savings: p.savings + p.goalContributions,
    business: p.business,
    spent: p.spent,
    savingsRate: p.income > 0 ? (p.income - p.need - p.want - p.business) / p.income : null,
  }));

  // What income left behind each month. Months without logged income are gaps, not losses.
  const keptOf = (p: MonthPoint) => (p.income > 0 ? p.income - p.need - p.want - p.business : null);
  const kept = trendPoints.map((p) => ({ month: p.month, income: p.income, spent: p.need + p.want + p.business, kept: keptOf(p) }));
  const keptFull = kept.filter((k): k is typeof k & { kept: number } => k.kept !== null && k.month < currentMonth);
  const keptSummary = keptFull.length
    ? { months: keptFull.length, total: sum(keptFull.map((k) => k.kept)), avg: Math.round(sum(keptFull.map((k) => k.kept)) / keptFull.length), from: keptFull[0].month }
    : null;

  // Savings balance by month (tithe fund excluded), emergency fund first, then by size.
  const balances = goalBalanceSeries(trendPoints.map((p) => p.month), goals, txs);
  const lastBalance = balances[balances.length - 1];
  const liveGoals = goals
    .filter((g) => !g.archived && !g.isTithe)
    .sort((a, b) => Number(b.isEmergency) - Number(a.isEmergency) || (lastBalance.byGoal[b.id] ?? 0) - (lastBalance.byGoal[a.id] ?? 0))
    .map((g) => ({ id: g.id, name: g.name, icon: g.icon, isEmergency: g.isEmergency }));

  // Year to date, through the selected month.
  const year = month.slice(0, 4);
  const ytdPoints = series.filter((p) => p.month.startsWith(year) && p.month <= month && (p.income > 0 || p.spent > 0 || p.goalContributions > 0));
  const ytd = {
    year,
    months: ytdPoints.length,
    income: sum(ytdPoints.map((p) => p.income)),
    spent: sum(ytdPoints.map((p) => p.need + p.want + p.business)),
    toGoals: sum(ytdPoints.map((p) => p.goalContributions + p.savings)),
    kept: sum(ytdPoints.map((p) => keptOf(p) ?? 0)),
  };

  const totalSpent = summary.spent;
  const categoryRows = summary.rows
    .filter((r) => r.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map((r) => ({
      id: r.cat.id,
      name: r.cat.name,
      icon: r.cat.icon,
      spent: r.spent,
      share: totalSpent > 0 ? r.spent / totalSpent : 0,
      typicalShare: profileShare(profile, r.cat.blsKey),
      vsAvg: r.vsAvg,
      avg3: r.avg3,
    }));

  const members = data.members.map((m) => {
    const bm = summary.byMember.find((x) => x.userId === m.id);
    return { id: m.id, name: m.name, color: m.color, spent: bm?.spent ?? 0, income: bm?.income ?? 0, count: bm?.count ?? 0 };
  });

  const fullMonths = trend.filter((p) => p.month < currentMonth && (p.spent > 0 || p.income > 0)).slice(-3);
  const avgSpend = fullMonths.length ? Math.round(fullMonths.reduce((a, p) => a + p.spent, 0) / fullMonths.length) : null;
  const rates = fullMonths.map((p) => p.savingsRate).filter((r): r is number => r !== null);
  const avgRate = rates.length ? rates.reduce((a, r) => a + r, 0) / rates.length : null;

  // This month next to last month and the 3-month usual.
  const cur = series.find((p) => p.month === month) ?? trendPoints[trendPoints.length - 1];
  const prevMonth = addMonths(month, -1);
  const prev = series.find((p) => p.month === prevMonth) ?? null;
  const fullPoints = trendPoints.filter((p) => fullMonths.some((f) => f.month === p.month));
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

  // You vs a typical household: your usual month (3-mo avg when available, else this month) per comparable category.
  const basis: "avg3" | "month" = fullMonths.length > 0 ? "avg3" : "month";
  const youTotal = basis === "avg3" ? (avgSpend ?? summary.spent) - summary.businessSpent : summary.spent - summary.businessSpent;
  // Categories that map to the same survey line (e.g. Gifts & Giving + Tithe) are compared as one row.
  const byKey = new Map<string, { id: string; names: string[]; icon: string; you: number }>();
  for (const r of summary.rows) {
    const key = r.cat.blsKey;
    if (!key || r.cat.group === "business") continue;
    const you = basis === "avg3" && r.avg3 > 0 ? r.avg3 : r.spent;
    const cur = byKey.get(key);
    if (cur) {
      cur.names.push(r.cat.name);
      cur.you += you;
    } else byKey.set(key, { id: r.cat.id, names: [r.cat.name], icon: r.cat.icon, you });
  }
  const comparisonRows = [...byKey.entries()]
    .map(([key, r]) => ({
      id: r.id,
      name: r.names.join(" + "),
      icon: r.icon,
      you: r.you,
      typical: profileMonthlyCents(profile, key) ?? 0,
      scaled: Math.round((youTotal * (profileShare(profile, key) ?? 0)) / 100),
      estimated: profile.estimated.includes(key),
    }))
    .filter((r) => r.you > 0 || r.typical > 0)
    .sort((a, b) => b.typical - a.typical);

  const details = buildCategoryDetails(summary, data.txs, txs, data.subcategories.map(toSubLite), data.members.map((m) => ({ id: m.id, name: m.name, color: m.color })), groupItems(data.receiptItems));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-2">
        <h1 className="display text-2xl font-semibold tracking-tight">Insights</h1>
        <Link href={`/report?period=month&key=${month}`} className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-green-text hover:bg-card-2">
          <FileText size={16} /> Report
        </Link>
      </div>
      <MonthSwitcher month={month} currentMonth={currentMonth} />
      {insights.length > 0 && <InsightCards insights={insights} title="What the numbers say" />}
      <InsightsScreen
        month={month}
        today={viewer.today}
        monthStatus={summary.status}
        dayOfMonth={summary.dayOfMonth}
        daysInMonth={summary.daysInMonth}
        trend={trend}
        kept={kept}
        keptSummary={keptSummary}
        balances={balances}
        goals={liveGoals}
        emergencyMonths={efMonths}
        ytd={ytd}
        targetSavingsShare={targets.savings / 100}
        categoryRows={categoryRows}
        details={details}
        totalSpent={totalSpent}
        members={members}
        avgSpend={avgSpend}
        avgRate={avgRate}
        fullMonthCount={fullMonths.length}
        compare={{ prevMonth: prev ? prevMonth : null, rows: compareRows, movers }}
        comparison={{
          basis,
          rows: comparisonRows,
          youTotal,
          typicalTotal: Math.round((profile.totalAnnual / 12) * 100),
          profile: {
            id: profile.id,
            label: profile.label,
            short: profile.short,
            source: profile.source,
            year: profile.year,
            persons: profile.persons,
            children: profile.children,
            incomeBeforeTax: profile.incomeBeforeTax,
          },
        }}
      />
    </div>
  );
}
