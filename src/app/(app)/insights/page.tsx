import { requireViewer } from "@/lib/auth";
import { loadHousehold, resolveMonth, toCatLite, toGoalLite, toSubLite, toTxLite, type SearchParams } from "@/lib/queries";
import { avgMonthlyNeeds, emergencyMonths, goalProgress, monthSeries, summarizeMonth } from "@/lib/calc";
import { buildCategoryDetails } from "@/lib/details";
import { buildInsights } from "@/lib/insights";
import { lastMonths, monthOf } from "@/lib/dates";
import { getProfile, profileMonthlyCents, profileShare } from "@/lib/profiles";
import { MonthSwitcher } from "@/components/shell/MonthSwitcher";
import { InsightCards } from "@/components/home/InsightCards";
import { InsightsScreen } from "@/components/insights/InsightsScreen";

export const metadata = { title: "Insights" };

export default async function InsightsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const month = resolveMonth(sp.m, viewer.today);
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const txs = data.txs.map(toTxLite);
  const cats = data.categories.map(toCatLite);
  const goals = data.goals.map(toGoalLite);
  const targets = { needs: viewer.household.needsPct, wants: viewer.household.wantsPct, savings: viewer.household.savingsPct };
  const profile = getProfile(viewer.household.comparisonProfile);

  const summary = summarizeMonth({ month, today: viewer.today, txs, cats, budgets: data.budgets, goals, expectedIncomeCents: viewer.household.expectedIncomeCents, targets });
  const progress = goals.filter((g) => !g.archived).map((g) => goalProgress(g, txs, viewer.today));
  const ef = progress.find((p) => p.goal.isEmergency);
  const efMonths = ef ? emergencyMonths(ef.saved, avgMonthlyNeeds(txs, cats, viewer.today, data.budgets)) : null;
  const insights = buildInsights({ summary, goals: progress, emergencyMonths: efMonths, catName: (id) => data.categories.find((c) => c.id === id)?.name ?? "" });

  // Trend window: 12 months ending at the selected month, trimmed to months that have any data.
  const series = monthSeries(lastMonths(month, 12), txs, cats);
  const firstWithData = series.findIndex((p) => p.income > 0 || p.spent > 0 || p.goalContributions > 0);
  const trend = (firstWithData === -1 ? series.slice(-1) : series.slice(Math.max(0, Math.min(firstWithData, series.length - 3)))).map((p) => ({
    month: p.month,
    income: p.income,
    need: p.need,
    want: p.want,
    savings: p.savings + p.goalContributions,
    business: p.business,
    spent: p.spent,
    savingsRate: p.income > 0 ? (p.income - p.need - p.want - p.business) / p.income : null,
  }));

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

  const fullMonths = trend.filter((p) => p.month < monthOf(viewer.today) && (p.spent > 0 || p.income > 0)).slice(-3);
  const avgSpend = fullMonths.length ? Math.round(fullMonths.reduce((a, p) => a + p.spent, 0) / fullMonths.length) : null;
  const rates = fullMonths.map((p) => p.savingsRate).filter((r): r is number => r !== null);
  const avgRate = rates.length ? rates.reduce((a, r) => a + r, 0) / rates.length : null;

  // You vs a typical household: your usual month (3-mo avg when available, else this month) per comparable category.
  const basis: "avg3" | "month" = fullMonths.length > 0 ? "avg3" : "month";
  const comparisonRows = summary.rows
    .filter((r) => r.cat.blsKey && r.cat.group !== "business")
    .map((r) => ({
      id: r.cat.id,
      name: r.cat.name,
      icon: r.cat.icon,
      you: basis === "avg3" && r.avg3 > 0 ? r.avg3 : r.spent,
      typical: profileMonthlyCents(profile, r.cat.blsKey) ?? 0,
      estimated: profile.estimated.includes(r.cat.blsKey ?? ""),
    }))
    .filter((r) => r.you > 0 || r.typical > 0)
    .sort((a, b) => b.typical - a.typical);

  const details = buildCategoryDetails(summary, data.txs, txs, data.subcategories.map(toSubLite), data.members.map((m) => ({ id: m.id, name: m.name, color: m.color })));

  return (
    <div className="space-y-5">
      <h1 className="display pt-2 text-2xl font-semibold tracking-tight">Insights</h1>
      <MonthSwitcher month={month} currentMonth={monthOf(viewer.today)} />
      {insights.length > 0 && <InsightCards insights={insights} title="What the numbers say" />}
      <InsightsScreen
        month={month}
        today={viewer.today}
        trend={trend}
        targetSavingsShare={targets.savings / 100}
        categoryRows={categoryRows}
        details={details}
        totalSpent={totalSpent}
        members={members}
        avgSpend={avgSpend}
        avgRate={avgRate}
        fullMonthCount={fullMonths.length}
        comparison={{
          basis,
          rows: comparisonRows,
          youTotal: basis === "avg3" ? (avgSpend ?? summary.spent) - summary.businessSpent : summary.spent - summary.businessSpent,
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
