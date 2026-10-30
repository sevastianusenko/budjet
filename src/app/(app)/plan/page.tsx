import { requireViewer } from "@/lib/auth";
import { loadHousehold, resolveMonth, toCatLite, toGoalLite, toSubLite, toTxLite, type SearchParams } from "@/lib/queries";
import { summarizeMonth } from "@/lib/calc";
import { buildCategoryDetails } from "@/lib/details";
import { addMonths, monthOf } from "@/lib/dates";
import { MonthSwitcher } from "@/components/shell/MonthSwitcher";
import { PlanTable } from "@/components/plan/PlanTable";

export const metadata = { title: "Plan" };

export default async function PlanPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const month = resolveMonth(sp.m, viewer.today);
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const txs = data.txs.map(toTxLite);
  const summary = summarizeMonth({
    month,
    today: viewer.today,
    txs,
    cats: data.categories.map(toCatLite),
    budgets: data.budgets,
    goals: data.goals.map(toGoalLite),
    expectedIncomeCents: viewer.household.expectedIncomeCents,
    targets: { needs: viewer.household.needsPct, wants: viewer.household.wantsPct, savings: viewer.household.savingsPct },
    tithePct: viewer.household.tithePct,
  });
  const prevHasPlan = data.budgets.some((b) => b.month === addMonths(month, -1) && b.plannedCents > 0);
  const members = data.members.map((m) => ({ id: m.id, name: m.name, color: m.color }));
  const details = buildCategoryDetails(summary, data.txs, txs, data.subcategories.map(toSubLite), members);

  return (
    <div className="space-y-4">
      <h1 className="display pt-2 text-2xl font-semibold tracking-tight">Plan</h1>
      <MonthSwitcher month={month} currentMonth={monthOf(viewer.today)} />
      <PlanTable
        month={month}
        status={summary.status}
        dayOfMonth={summary.dayOfMonth}
        daysInMonth={summary.daysInMonth}
        today={viewer.today}
        expectedIncome={viewer.household.expectedIncomeCents}
        actualIncome={summary.income}
        targets={{ needs: viewer.household.needsPct, wants: viewer.household.wantsPct, savings: viewer.household.savingsPct }}
        details={details}
        goals={data.goals.filter((g) => !g.archived).map((g) => ({ id: g.id, name: g.name, icon: g.icon, monthlyPlanCents: g.monthlyPlanCents }))}
        goalContributions={summary.goalContributions}
        plannedTithe={summary.plannedTithe}
        titheSetAside={summary.titheSetAside}
        tithePct={viewer.household.tithePct}
        prevHasPlan={prevHasPlan}
      />
    </div>
  );
}
