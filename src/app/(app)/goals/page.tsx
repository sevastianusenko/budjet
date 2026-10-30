import { requireViewer } from "@/lib/auth";
import { loadHousehold, toCatLite, toGoalLite, toTxLite } from "@/lib/queries";
import { avgMonthlyNeeds, emergencyMonths, goalProgress } from "@/lib/calc";
import { monthOf } from "@/lib/dates";
import { GoalsScreen } from "@/components/goals/GoalsScreen";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const viewer = await requireViewer();
  const data = await loadHousehold(viewer.household.id, viewer.today);
  const txs = data.txs.map(toTxLite);
  const needs = avgMonthlyNeeds(txs, data.categories.map(toCatLite), viewer.today, data.budgets);
  const month = monthOf(viewer.today);

  const items = data.goals.map((g) => {
    const p = goalProgress(toGoalLite(g), txs, viewer.today);
    return {
      goal: toGoalLite(g),
      saved: p.saved,
      remaining: p.remaining,
      progress: p.progress,
      contributedThisMonth: p.contributedThisMonth,
      monthsToDeadline: p.monthsToDeadline,
      monthlyNeeded: p.monthlyNeeded,
      avgContribution: p.avgContribution,
      etaMonth: p.etaMonth,
      done: p.done,
      emergencyMonths: g.isEmergency ? emergencyMonths(p.saved, needs) : null,
    };
  });

  const planned = data.goals.filter((g) => !g.archived).reduce((a, g) => a + g.monthlyPlanCents, 0);
  const contributed = txs.filter((t) => t.type === "goal" && t.date.startsWith(month)).reduce((a, t) => a + t.amountCents, 0);

  return <GoalsScreen items={items} plannedThisMonth={planned} contributedThisMonth={contributed} monthlyNeeds={needs} today={viewer.today} />;
}
